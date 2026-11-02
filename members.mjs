// THE EVENING WIRE: public member accounts backed ONLY by PostgreSQL.
// No ephemeral authentication, no plaintext passwords, no public member directory.
import {Pool} from 'pg';
import {randomBytes,randomUUID,createHash,scrypt as scryptCb,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {isEditorAdmin} from './editor-calls.mjs';
const scrypt=promisify(scryptCb);
const url=process.env.DATABASE_URL||process.env.REACTION_DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRESQL_URL||process.env.DB_URL||'';
const databaseSource=['DATABASE_URL','REACTION_DATABASE_URL','POSTGRES_URL','POSTGRESQL_URL','DB_URL'].find(key=>Boolean(process.env[key]))||'none';

const dbEnvKeys=['DATABASE_URL','REACTION_DATABASE_URL','POSTGRES_URL','POSTGRESQL_URL','DB_URL'];
let altCheckCache={at:0,rows:[]};
async function checkOtherRegistrationDatabases(){
 // Owner-only diagnostic. Never disclose connection URLs, credentials, or account names.
 if(Date.now()-altCheckCache.at<300000)return altCheckCache.rows;
 const seen=new Set([url]),sources=[];
 for(const key of dbEnvKeys){
  const link=process.env[key];
  if(!link||seen.has(link))continue;
  seen.add(link);
  let alt=null;
  try{
   alt=new Pool({connectionString:link,max:1,connectionTimeoutMillis:3500,ssl:link.includes('localhost')?false:{rejectUnauthorized:false}});
   const exists=await alt.query("SELECT to_regclass('public.ew_members') AS member_table");
   const hasTable=Boolean(exists.rows[0]?.member_table);
   const count=hasTable?Number((await alt.query('SELECT count(*)::integer AS n FROM public.ew_members')).rows[0].n):0;
   const oldMembers=count>0?(await alt.query('SELECT id,display_name,email,joined_at,last_login_at FROM public.ew_members ORDER BY joined_at DESC LIMIT 200')).rows.map(publicUser):[];
   sources.push({source:key,status:'connected',members:count,hasMemberTable:hasTable,users:oldMembers});
  }catch(err){
   sources.push({source:key,status:'unavailable',members:null,hasMemberTable:null});
  }finally{if(alt)await alt.end().catch(()=>{})}
 }
 altCheckCache={at:Date.now(),rows:sources};
 return sources;
}

let db=null,ready=false,connecting=false,diagnostic=null;
const rateLimit=new Map();
const send=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data))};
const cookieName='ew_member_session';
function originOK(req){const origin=String(req.headers.origin||'');return !origin||origin==='https://'+req.headers.host||origin==='http://'+req.headers.host}
function client(req){return String(req.socket.remoteAddress||'unknown')}
function rate(req,tag,max,windowMs){const key=client(req)+':'+tag,now=Date.now();let row=rateLimit.get(key);if(!row||now-row.s>windowMs){row={s:now,c:0};rateLimit.set(key,row)}row.c++;return row.c<=max}
function sessionCookie(token,maxAge){return cookieName+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge}
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
  await db.query("ALTER TABLE ew_members ADD COLUMN IF NOT EXISTS pin_hash varchar(255)");
  await db.query("CREATE TABLE IF NOT EXISTS ew_member_login_attempts(email varchar(254) PRIMARY KEY,attempts integer NOT NULL DEFAULT 0,locked_until timestamptz,updated_at timestamptz DEFAULT now())");
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
 await db.query("INSERT INTO ew_member_sessions(token_hash,member_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",[tokenHash(t),member.id]);
 send(res,200,{ok:true,user:publicUser(member)},{'Set-Cookie':sessionCookie(t,43200)})
}
export async function authenticatedMember(req){return ready?getMember(req):null}
export async function memberRoute(req,res,path){
 if(path==='/api/members/status'){send(res,200,{ready,requiresDatabase:true,adminAvailable:Boolean(process.env.EW_ADMIN_PASSWORD_SHA256),message:ready?'Member sign-in is available':'Account registration and login require the permanent PostgreSQL database connection.'});return true}
 if(path==='/api/admin/members'){
  if(!isEditorAdmin(req)){send(res,403,{error:'Administrator authentication required'});return true}
  if(!ready){send(res,503,{error:'Member database not connected. No persistent member accounts available.',members:[]});return true}
  const totals=await db.query('SELECT count(*)::integer AS total FROM ew_members');
  const users=await db.query('SELECT id,display_name,email,joined_at,last_login_at FROM ew_members ORDER BY joined_at DESC LIMIT 200');
  const alternateDatabases=totals.rows[0].total===0?await checkOtherRegistrationDatabases():[];
  send(res,200,{total:totals.rows[0].total,returned:users.rows.length,members:users.rows.map(publicUser),storageSource:databaseSource,alternateDatabases,notice:'Emails are user-entered and are not verified. Passwords are never displayed.'});return true
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
 if(route==='profile'&&req.method==='POST'){
  // Display names are identity data: derive the account exclusively from the secure
  // member session, never a client-supplied user ID or email.
  const account=await authenticatedMember(req);
  if(!account){send(res,401,{error:'Sign in to edit your profile'});return true}
  if(!ready){send(res,503,{error:'Database not connected'});return true}
  if(!rate(req,'profile-'+account.id,8,3600000)){send(res,429,{error:'Too many profile changes. Try again in an hour.'});return true}
  let obj;try{obj=await input(req)}catch(e){send(res,400,{error:e.message});return true}
  const displayName=name(obj.displayName);
  if(displayName.length<2||displayName.length>40||/[<>]/.test(displayName)){
   send(res,400,{error:'Choose a display name between 2 and 40 characters, without < or >.'});return true
  }
  const result=await db.query('UPDATE ew_members SET display_name=$1 WHERE id=$2 RETURNING id,display_name,email,joined_at,last_login_at',[displayName,account.id]);
  if(!result.rowCount){send(res,404,{error:'Member account not found'});return true}
  // The Reaction Hub JOINs posts to member IDs, so existing linked posts/replies
  // immediately display the updated name. Archived anonymous posts stay anonymous.
  send(res,200,{ok:true,user:publicUser(result.rows[0]),message:'Display name updated across your account-linked messages and replies.'});return true
 }
 if(!ready){send(res,503,{error:'Member registration is disabled until the permanent PostgreSQL database is connected.'});return true}
 // One-time activation for accounts that were registered BEFORE PINs existed.
 // Requires the account's original scrypt-protected password, not the admin password.
 // It deliberately uses separate rate limits so a legacy user is not trapped by
 // failed PIN attempts for a PIN that was never created.
 if(route==='activate-pin'&&req.method==='POST'){
  if(!rate(req,'activate-pin',6,1800000)){send(res,429,{error:'Too many PIN setup attempts from this connection. Try again after 30 minutes.'});return true}
  let obj;try{obj=await input(req)}catch(e){send(res,400,{error:e.message});return true}
  const mail=email(obj.email),secret=String(obj.password||''),pin=String(obj.pin||'');
  if(!checkEmail(mail)||secret.length<12||secret.length>128||!/^[0-9]{4}$/.test(pin)){
   send(res,400,{error:'Use your existing email, original account password (12+ characters), and a new four-digit PIN.'});return true
  }
  // The account-specific migration lockout is not the existing PIN lockout.
  const attemptKey='legacy-'+createHash('sha256').update(mail).digest('hex');
  const existing=await db.query('SELECT locked_until FROM ew_member_login_attempts WHERE email=$1',[attemptKey]);
  if(existing.rows[0]?.locked_until&&new Date(existing.rows[0].locked_until)>new Date()){
   send(res,429,{error:'Too many incorrect old-password attempts. Try again after 30 minutes.'});return true
  }
  const result=await db.query('SELECT id,display_name,email,password_hash,pin_hash,joined_at,last_login_at FROM ew_members WHERE email=$1 LIMIT 1',[mail]);
  const account=result.rows[0];
  if(account?.pin_hash){
   send(res,409,{error:'A PIN is already set on this account. Use the ordinary four-digit PIN login.'});return true
  }
  const valid=!!account&&await verifyPassword(secret,account.password_hash);
  if(!valid){
   await db.query("INSERT INTO ew_member_login_attempts(email,attempts,locked_until,updated_at) VALUES($1,1,NULL,now()) ON CONFLICT(email) DO UPDATE SET attempts=CASE WHEN ew_member_login_attempts.updated_at<now()-interval '30 minutes' THEN 1 ELSE ew_member_login_attempts.attempts+1 END,locked_until=CASE WHEN ew_member_login_attempts.updated_at<now()-interval '30 minutes' THEN NULL WHEN ew_member_login_attempts.attempts>=4 THEN now()+interval '30 minutes' ELSE NULL END,updated_at=now()",[attemptKey]);
   send(res,401,{error:'Original email or password was incorrect. Your old account password—not a PIN—is required for this one-time setup.'});return true
  }
  const newPinHash=await hashPassword(pin);
  const saved=await db.query("UPDATE ew_members SET pin_hash=$2,last_login_at=now() WHERE id=$1 AND pin_hash IS NULL RETURNING id,display_name,email,joined_at,last_login_at",[account.id,newPinHash]);
  if(!saved.rowCount){send(res,409,{error:'A PIN has already been set for this account. Please sign in.'});return true}
  await db.query('DELETE FROM ew_member_login_attempts WHERE email=$1 OR email=$2',[mail,attemptKey]);
  console.log('EW_LEGACY_MEMBER_PIN_ACTIVATED');
  await createSession(res,saved.rows[0]);return true
 }
 if((route==='signup'||route==='login')&&req.method==='POST'){
  if(!rate(req,route,route==='login'?5:3,900000)){send(res,429,{error:'Too many attempts. Please try again later.'});return true}
  let obj;try{obj=await input(req)}catch(e){send(res,400,{error:e.message});return true}
  const mail=email(obj.email),secret=String(obj.password||''),pin=String(obj.pin||'');
  if(!checkEmail(mail)){send(res,400,{error:'Enter a valid email address'});return true}
  if(route==='signup'&&(secret.length<12||secret.length>128||!/^[0-9]{4}$/.test(pin))){send(res,400,{error:'Registration needs a password of 12–128 characters and a four-digit PIN.'});return true}
  if(route==='login'&&!/^[0-9]{4}$/.test(pin)){send(res,400,{error:'Enter your four-digit PIN.'});return true}
  if(route==='signup'){
   const displayName=name(obj.displayName);
   if(displayName.length<2){send(res,400,{error:'Display name must be at least two characters.'});return true}
   if(obj.agreed!==true){send(res,400,{error:'Please accept the account information notice.'});return true}
   const passwordHash=await hashPassword(secret),pinHash=await hashPassword(pin),id=randomUUID();
   try{
    await db.query("INSERT INTO ew_members(id,display_name,email,password_hash,pin_hash,last_login_at) VALUES($1,$2,$3,$4,$5,now())",[id,displayName,mail,passwordHash,pinHash]);
   }catch(e){if(e.code==='23505'){send(res,409,{error:'This email already has an account. Sign in instead.'});return true}throw e}
   const row=await db.query('SELECT id,display_name,email,joined_at,last_login_at FROM ew_members WHERE id=$1',[id]);
   await createSession(res,row.rows[0]);return true
  }
  // Database-persisted lockouts protect short PINs across service restarts.
  const attempts=await db.query('SELECT locked_until FROM ew_member_login_attempts WHERE email=$1',[mail]);
  if(attempts.rows[0]?.locked_until&&new Date(attempts.rows[0].locked_until)>new Date()){
   send(res,429,{error:'PIN locked due to incorrect attempts. Try again in 30 minutes.'});return true
  }
  const row=await db.query('SELECT id,display_name,email,pin_hash,joined_at,last_login_at FROM ew_members WHERE email=$1 LIMIT 1',[mail]);
  const correct=!!row.rows.length&&await verifyPassword(pin,row.rows[0].pin_hash);
  if(!correct){
   await db.query("INSERT INTO ew_member_login_attempts(email,attempts,locked_until,updated_at) VALUES($1,1,NULL,now()) ON CONFLICT(email) DO UPDATE SET attempts=CASE WHEN ew_member_login_attempts.updated_at<now()-interval '30 minutes' THEN 1 ELSE ew_member_login_attempts.attempts+1 END,locked_until=CASE WHEN ew_member_login_attempts.updated_at<now()-interval '30 minutes' THEN NULL WHEN ew_member_login_attempts.attempts>=4 THEN now()+interval '30 minutes' ELSE NULL END,updated_at=now()",[mail]);
   send(res,401,{error:'Incorrect email or PIN. Five failed tries trigger a 30-minute lockout.'});return true
  }
  await db.query('DELETE FROM ew_member_login_attempts WHERE email=$1',[mail]);
  await db.query('UPDATE ew_members SET last_login_at=now() WHERE id=$1',[row.rows[0].id]);
  row.rows[0].last_login_at=new Date().toISOString();
  await createSession(res,row.rows[0]);return true
 }
 send(res,404,{error:'Member endpoint not found'});return true
}
