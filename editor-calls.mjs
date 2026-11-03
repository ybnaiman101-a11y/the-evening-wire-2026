import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {Pool} from './local-db-pool.mjs';
import {postgresTLS,postgresConnectionString} from './postgres-tls.mjs';
const passwordHash=String(process.env.EW_ADMIN_PASSWORD_SHA256||'').toLowerCase();
const cookieSecure=process.env.EW_LOCAL_DATABASE==='1'?'':'; Secure';
const db=process.env.DATABASE_URL||process.env.REACTION_DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRESQL_URL||process.env.DB_URL||'';
const file='/tmp/ew-race-calls.json',sessions=new Map(),failures=new Map();
const codes='AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const nums=[7,1,9,4,52,8,5,1,28,14,2,2,17,9,4,4,6,6,2,8,9,13,8,4,8,2,3,4,2,12,3,26,14,1,15,5,6,17,2,7,1,9,38,4,1,11,10,2,8,1];
const districts=Object.fromEntries(codes.map((c,i)=>[c,nums[i]]));
const senate=new Set('AL AK AR CO DE GA ID IL IA KS KY LA ME MA MI MN MS MT NE NH NJ NM NC OK OR RI SC SD TN TX VA WV WY'.split(' '));
const governors=new Set('AL AK AZ AR CA CO CT FL GA HI ID IL IA KS ME MD MA MI MN NE NV NH NM NY OH OK OR PA RI SC SD TN TX VT WI WY'.split(' '));
const specialSenate=new Set(['OH','FL']);
let calls=[],audit=[],store=db?'unavailable':'temporary',pool=null,queue=Promise.resolve();
function send(res,code,data,headers={}){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data))}
function meta(){return {configured:/^[a-f0-9]{64}$/.test(passwordHash),storage:store,persistent:store==='postgresql',warning:store==='temporary'?'Temporary server storage: calls may disappear after a restart or redeployment. Export backups until PostgreSQL is connected.':null}}
const snapshot=()=>({version:1,calls,audit});
export async function isEditorAdmin(req){await init;return current(req)}
async function current(req){
 const key=(String(req.headers.cookie||'').match(/(?:^|;\s*)ew_editor_session=([a-f0-9]{64})(?:;|$)/)||[])[1];
 if(!key)return false;
 if(store==='postgresql'){
  try{
   const row=await pool.query("SELECT 1 FROM ew_editor_sessions WHERE token_hash=$1 AND expires_at>now() LIMIT 1",[createHash('sha256').update(key).digest('hex')]);
   return row.rowCount>0;
  }catch(err){console.warn('EW_ADMIN_SESSION_CHECK_FAILED',String(err.message||err));return false}
 }
 const expiry=sessions.get(key);return !!expiry&&expiry>Date.now();
}
function secureOrigin(req){return !req.headers.origin||req.headers.origin==='https://'+req.headers.host||req.headers.origin==='http://'+req.headers.host}
function validPassword(value){return typeof value==='string'&&value.length<=256&&/^[a-f0-9]{64}$/.test(passwordHash)&&timingSafeEqual(createHash('sha256').update(value).digest(),Buffer.from(passwordHash,'hex'))}
async function input(req,max=250000){let s='';for await(const chunk of req){s+=chunk;if(s.length>max)throw Error('Request too large')}try{return JSON.parse(s||'{}')}catch{throw Error('Invalid JSON')}}
function valid(x){
 const office=String(x.office||''),state=String(x.state||'').toUpperCase(),special=office==='senate'&&x.special===true;
 if(!['senate','governor','house'].includes(office)||!districts[state])throw Error('Choose a valid race and state');
 if(office==='governor'&&!governors.has(state))throw Error('No scheduled regular 2026 governor race for this state');
 if(office==='senate'&&special&&!specialSenate.has(state))throw Error('Only Ohio and Florida have November 2026 U.S. Senate special elections');
 if(office==='senate'&&!special&&!senate.has(state))throw Error('This state has no regular 2026 Senate election. Ohio and Florida are SPECIAL elections; select special election.');
 const district=office==='house'?Number(x.district):null;
 if(office==='house'&&(!Number.isInteger(district)||district<1||district>districts[state]))throw Error('Invalid House district');
 const candidate=String(x.candidate||'').trim().slice(0,130),sourceName=String(x.sourceName||'').trim().slice(0,100),sourceUrl=String(x.sourceUrl||'').trim();
 const party=String(x.party||'').toUpperCase(),note=String(x.note||'').trim().slice(0,400);
 if(candidate.length<2||!['R','D','I','OTHER'].includes(party))throw Error('Winner and party are required');
 if(sourceUrl){try{const u=new URL(sourceUrl);if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))throw Error()}catch{throw Error('If supplied, the source must be a valid HTTPS URL')}}
 const id=office+'-'+state+(office==='house'?'-'+district:special?'-special':'');
 return {id,office,state,district,special,candidate,party,sourceName,sourceUrl,note,editorial:true,callType:'Evening Wire editorial call',calledAt:new Date().toISOString()};
}
async function save(){
 if(store==='postgresql'){await pool.query('INSERT INTO ew_editor_state(id,data) VALUES(1,$1::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[JSON.stringify(snapshot())]);return}
 const work=queue.catch(()=>{}).then(async()=>{await writeFile(file+'.tmp',JSON.stringify(snapshot()),{mode:0o600});await rename(file+'.tmp',file)});queue=work;await work;
}
const init=(async()=>{
 if(db){try{
  pool=new Pool({connectionString:postgresConnectionString(db),max:3,connectionTimeoutMillis:8000,ssl:postgresTLS(db)});
  await pool.query('CREATE TABLE IF NOT EXISTS ew_editor_state(id integer PRIMARY KEY,data jsonb NOT NULL)');
  await pool.query('CREATE TABLE IF NOT EXISTS ew_editor_sessions(token_hash varchar(64) PRIMARY KEY,expires_at timestamptz NOT NULL)');
  const result=await pool.query('SELECT data FROM ew_editor_state WHERE id=1'),saved=result.rows[0]?.data;
  if(Array.isArray(saved?.calls)){calls=saved.calls;audit=Array.isArray(saved.audit)?saved.audit:[]}
  store='postgresql';console.log('EW_EDITOR_DB_READY total='+calls.length);return;
 }catch(e){console.error('EW_EDITOR_DB_UNAVAILABLE '+e.message);store='unavailable';return}}
 try{const saved=JSON.parse(await readFile(file,'utf8'));if(Array.isArray(saved.calls)){calls=saved.calls;audit=Array.isArray(saved.audit)?saved.audit:[]}}
 catch(e){if(e.code!=='ENOENT')console.warn('EW_EDITOR_TEMP_READ '+e.message)}
 console.log('EW_EDITOR_TEMP_READY total='+calls.length);
})();
export function publicCalls(){return calls.slice().sort((a,b)=>Date.parse(b.calledAt)-Date.parse(a.calledAt))}
export function publicMeta(){return meta()}
export async function editorRoute(req,res,path){
 if(path==='/api/editor/calls'){await init;send(res,200,{...meta(),calls:publicCalls()});return true}
 if(!path.startsWith('/api/admin/'))return false;
 await init;const route=path.slice('/api/admin/'.length),authed=await current(req);
 if(route==='session'&&req.method==='GET'){send(res,200,{authenticated:authed,...meta(),count:calls.length});return true}
 if(!secureOrigin(req)){send(res,403,{error:'Origin not allowed'});return true}
 if(route==='login'&&req.method==='POST'){
  const address=req.socket.remoteAddress||'unknown',n=Date.now(),last=failures.get(address);
  if(last&&n-last.start<900000&&last.count>=6){send(res,429,{error:'Too many attempts. Try again later.'});return true}
  let b;try{b=await input(req,1500)}catch(e){send(res,400,{error:e.message});return true}
  if(!validPassword(b.password)){const f=last&&n-last.start<900000?last:{start:n,count:0};f.count++;failures.set(address,f);send(res,401,{error:'Incorrect administrator password'});return true}
  failures.delete(address);const key=randomBytes(32).toString('hex');
  if(store==='postgresql'){
   try{await pool.query("INSERT INTO ew_editor_sessions(token_hash,expires_at) VALUES($1,now()+interval '12 hours')",[createHash('sha256').update(key).digest('hex')])}
   catch(err){console.error('EW_ADMIN_SESSION_SAVE_FAILED',String(err.message||err));send(res,503,{error:'Unable to save your secure administrator session. Please retry.'});return true}
  }else sessions.set(key,n+43200000);
  send(res,200,{authenticated:true,...meta(),count:calls.length},{'Set-Cookie':'ew_editor_session='+key+'; HttpOnly'+cookieSecure+'; SameSite=Strict; Path=/; Max-Age=43200'});return true;
 }
 if(route==='logout'&&req.method==='POST'){
  const k=(String(req.headers.cookie||'').match(/ew_editor_session=([a-f0-9]{64})/)||[])[1];
  if(k&&store==='postgresql')await pool.query('DELETE FROM ew_editor_sessions WHERE token_hash=$1',[createHash('sha256').update(k).digest('hex')]);
  if(k)sessions.delete(k);
  send(res,200,{authenticated:false},{'Set-Cookie':'ew_editor_session=; HttpOnly'+cookieSecure+'; SameSite=Strict; Path=/; Max-Age=0'});return true}
 if(!authed){send(res,403,{error:'Admin login required'});return true}
 if(route==='backup'&&req.method==='GET'){send(res,200,{...snapshot(),exportedAt:new Date().toISOString(),...meta()},{'Content-Disposition':'attachment; filename="evening-wire-race-calls.json"'});return true}
 if(store==='unavailable'){send(res,503,{error:'Database unavailable. Publishing disabled to prevent data loss.'});return true}
 if(route==='calls'&&req.method==='POST'){
  let x,row;try{x=await input(req,5000);row=valid(x);if(x.confirm!==true)throw Error('Confirm you reviewed the reported election outcome before publishing')}catch(e){send(res,400,{error:e.message});return true}
  // A race can receive only its FIRST editorial call. Changing or retracting a call
  // never unlocks another first-call action for that race.
  if(calls.some(c=>c.id===row.id)||audit.some(e=>e.id===row.id&&['published','corrected','retracted'].includes(e.event))){send(res,409,{error:'THIS RACE HAS ALREADY BEEN CALLED. Duplicate calls are blocked. Use retraction if a published call was wrong.'});return true}
  const previous=snapshot();calls.push(row);
  audit.push({event:'published',id:row.id,candidate:row.candidate,at:row.calledAt});audit=audit.slice(-1000);
  try{await save()}catch(e){calls=previous.calls;audit=previous.audit;send(res,503,{error:'Could not save. No call was published.'});return true}
  send(res,200,{ok:true,call:row,...meta()});return true
 }
 if(route==='retract'&&req.method==='POST'){
  let x;try{x=await input(req,1500)}catch(e){send(res,400,{error:e.message});return true}
  const old=snapshot(),id=String(x.id||'');if(!calls.some(c=>c.id===id)){send(res,404,{error:'Race call not found'});return true}
  calls=calls.filter(c=>c.id!==id);audit.push({event:'retracted',id,at:new Date().toISOString()});audit=audit.slice(-1000);
  try{await save()}catch(e){calls=old.calls;audit=old.audit;send(res,503,{error:'Could not save retraction'});return true}
  send(res,200,{ok:true,...meta()});return true
 }
 if(route==='restore'&&req.method==='POST'){
  let b;try{b=await input(req,300000);if(b.version!==1||!Array.isArray(b.calls)||b.calls.length>700)throw Error('Invalid backup')}catch(e){send(res,400,{error:e.message});return true}
  const restored=[],used=new Set();try{for(const item of b.calls){const x=valid(item);if(used.has(x.id))throw Error('Duplicate race call in backup: '+x.id);used.add(x.id);x.calledAt=Number.isFinite(Date.parse(item.calledAt))?item.calledAt:x.calledAt;restored.push(x)}}catch(e){send(res,400,{error:'Invalid backup call: '+e.message});return true}
  const old=snapshot();calls=restored;audit=Array.isArray(b.audit)?b.audit.slice(-1000):[];
  // Restore the lock history as well as the calls. Don't silently erase prior call locks.
  for(const event of old.audit)if(['published','corrected','retracted'].includes(event.event)&&!audit.some(x=>x.id===event.id&&x.event===event.event))audit.push(event);
  audit=audit.slice(-1000);
  try{await save()}catch(e){calls=old.calls;audit=old.audit;send(res,503,{error:'Could not restore backup'});return true}
  send(res,200,{ok:true,total:calls.length,...meta()});return true
 }
 send(res,404,{error:'Unknown admin endpoint'});return true
}
