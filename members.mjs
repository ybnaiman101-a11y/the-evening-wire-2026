// THE EVENING WIRE: public member accounts backed ONLY by PostgreSQL.
// No ephemeral authentication, no plaintext passwords, no public member directory.
import {Pool} from 'pg';
import {randomBytes,randomUUID,createHash,scrypt as scryptCb,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {isEditorAdmin} from './editor-calls.mjs';
const scrypt=promisify(scryptCb);
const url=process.env.DATABASE_URL||process.env.REACTION_DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRESQL_URL||process.env.DB_URL||'';
let db=null,ready=false,connecting=false,diagnostic=null;
const rateLimit=new Map();
const send=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data))};
const cookieName='ew_member_session';
function originOK(req){const origin=String(req.headers.origin||'');return !origin||origin==='https://'+req.headers.host||origin==='http://'+req.headers.host}
function client(req){return String(req.socket.remoteAddress||'unknown')}
function rate(req,tag,max,windowMs){const key=client(req)+':'+tag,now=Date.now();let row=rateLimit.get(key);if(!row||now-row.s>windowMs){row={s:now,c:0};rateLimit.set(key,row)}row.c++;return row.c<=max}
function sessionCookie(token,maxAge){return cookieName+'='+token+'; Path=/api/members/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge}
function cookie(req){return (String(req.headers.cookie||'').match(/(?:^|;\s*)ew_member_session=([a-f0-9]{64})(?:;|$)/)||[])[1]||''}
const tokenHash=token=>createHash('sha256').update(token).digest('hex');
async function input(req){let data='';for await(const part of req){data+=part;if(data.length>5000)throw Error('Request too large')}try{return JSON.parse(data||'{}')}catch{throw Error('Invalid JSON')}}
const name=x=>String(x||'').normalize('NFKC').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,40);
const email=x=>String(x||'').normalize('NFKC').trim().toLowerCase();
function checkEmail(x){return x.length>=5&&x.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x)}
function publicUser(r){return r?{id:r.id,displayName:r.display_name,email:r.email,joinedAt:r.joined_at,lastLoginAt:r.last_login_at}:null}
async function hashPassword(secret){const salt=randomBytes(24).toString('hex');const out=await scrypt(secret,salt,64,{maxmem:32*1024*1024});return 'scrypt:'+salt+':'+Buffer.from(out).toString('hex')}
async function verifyPassword(secret,stored){
 const parts=String(stored||'').split(':');
 if(parts.length!==3||parts[0]!=='scrypt'||!/^[0-9a-f]{48}$/.test(parts[1])||!/^[0-9a-f]{128}$/.test(parts[2]))return false;
 const value=await scrypt(secret,parts[1],64,{maxmem:32*1024*1024});
 return timingSafeEqual(value,Buffer.from(parts[2],'hex'))
}
async function setup(){
 if(!url||connecting||ready)return;
 connecting=true;
 try{
  db=new Pool({connectionString:url,max:3,connectionTimeoutMillis:8000,ssl:url.includes('localhost')?false:{rejectUnauthorized:false}});
  await db.query("CREATE TABLE IF NOT EXISTS ew_members(id uuid PRIMARY KEY,display_name varchar(40) NOT NULL,email varchar(254) UNIQUE NOT NULL,password_hash varchar(255) NOT NULL,joined_at timestamptz NOT NULL DEFAULT now(),last_login_at timestamptz)");
  await db.query("CREATE TABLE IF NOT EXISTS ew_member_sessions(token_hash varchar(64) PRIMARY KEY,member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL)");
  ready=true;diagnostic=null;console.log('EW_MEMBERS_DATABASE_CONNECTED');
 }catch(e){diagnostic=String(e.message||e).slice(0,150);console.warn('EW_MEMBERS_DATABASE_UNAVAILABLE '+diagnostic);await db?.end().catch(()=>{});db=null;ready=false}
 finally{connecting=false}
}
setup();
setInterval(()=>{if(!ready)setup();const now=Date.now();for(const [k,v] of rateLimit)if(now-v.s>3600000)rateLimit.delete(k)},120000).unref();
async function getMember(req){
 const t=cookie(req);if(!t||!ready)return null;
 const result=await db.query("SELECT m.id,m.display_name,m.email,m.joined_at,m.last_login_at FROM ew_member_sessions s JOIN ew_members m ON s.member_id=m.id WHERE s.token_hash=$1 AND s.expires_at>now() LIMIT 1",[tokenHash(t)]);
 return publicUser(result.rows[0])
}
async function createSession(res,member){
 const t=randomBytes(32).toString('hex');
 await db.query("INSERT INTO ew_member_sessions(token_hash,member_id,expires_at) VALUES($1,$2,now()+interval '30 days')",[tokenHash(t),member.id]);
 send(res,200,{ok:true,user:publicUser(member)},{'Set-Cookie':sessionCookie(t,2592000)})
}
export async function memberRoute(req,res,path){
 if(path==='/api/members/status'){send(res,200,{ready,requiresDatabase:true,adminAvailable:Boolean(process.env.EW_ADMIN_PASSWORD_SHA256),message:ready?'Member sign-in is available':'Account registration and login require the permanent PostgreSQL database connection.'});return true}
 if(path==='/api/admin/members'){
  if(!isEditorAdmin(req)){send(res,403,{error:'Administrator authentication required'});return true}
  if(!ready){send(res,503,{error:'Member database not connected. No persistent member accounts available.',members:[]});return true}
  const totals=await db.query('SELECT count(*)::integer AS total FROM ew_members');
  const users=await db.query('SELECT id,display_name,email,joined_at,last_login_at FROM ew_members ORDER BY joined_at DESC LIMIT 200');
  send(res,200,{total:totals.rows[0].total,returned:users.rows.length,members:users.rows.map(publicUser),notice:'Emails are user-entered and are not verified. Passwords are never displayed.'});return true
 }
 if(!path.startsWith('/api/members/'))return false;
 const route=path.slice('/api/members/'.length);
 if(route==='session'&&req.method==='GET'){
  if(!ready){send(res,200,{ready:false,user:null,error:'Accounts are unavailable until PostgreSQL is connected'});return true}
  send(res,200,{ready:true,user:await getMember(req)});return true
 }
 if(!originOK(req)){send(res,403,{error:'Origin not allowed'});return true}
 if(route==='logout'&&req.method==='POST'){
  if(ready&&cookie(req))await db.query('DELETE FROM ew_member_sessions WHERE token_hash=$1',[tokenHash(cookie(req))]);
  send(res,200,{ok:true},{'Set-Cookie':sessionCookie('',0)});return true
 }
 if(!ready){send(res,503,{error:'Member registration is disabled until the permanent PostgreSQL database is connected.'});return true}
 if((route==='signup'||route==='login')&&req.method==='POST'){
  if(!rate(req,route,route==='login'?8:3,900000)){send(res,429,{error:'Too many attempts. Please try again later.'});return true}
  let obj;try{obj=await input(req)}catch(e){send(res,400,{error:e.message});return true}
  const mail=email(obj.email),secret=String(obj.password||'');
  if(!checkEmail(mail)||secret.length<12||secret.length>128){send(res,400,{error:'Enter a valid email and a password of 12–128 characters.'});return true}
  if(route==='signup'){
   const displayName=name(obj.displayName);
   if(displayName.length<2){send(res,400,{error:'Display name must be at least two characters.'});return true}
   if(obj.agreed!==true){send(res,400,{error:'Please accept the account information notice.'});return true}
   const passwordHash=await hashPassword(secret),id=randomUUID();
   try{
    await db.query("INSERT INTO ew_members(id,display_name,email,password_hash,last_login_at) VALUES($1,$2,$3,$4,now())",[id,displayName,mail,passwordHash]);
   }catch(e){if(e.code==='23505'){send(res,409,{error:'This email already has an account. Sign in instead.'});return true}throw e}
   const row=await db.query('SELECT id,display_name,email,joined_at,last_login_at FROM ew_members WHERE id=$1',[id]);
   await createSession(res,row.rows[0]);return true
  }
  const row=await db.query('SELECT id,display_name,email,password_hash,joined_at,last_login_at FROM ew_members WHERE email=$1 LIMIT 1',[mail]);
  if(!row.rows.length||!(await verifyPassword(secret,row.rows[0].password_hash))){send(res,401,{error:'Incorrect email or password.'});return true}
  await db.query('UPDATE ew_members SET last_login_at=now() WHERE id=$1',[row.rows[0].id]);
  row.rows[0].last_login_at=new Date().toISOString();
  await createSession(res,row.rows[0]);return true
 }
 send(res,404,{error:'Member endpoint not found'});return true
}
