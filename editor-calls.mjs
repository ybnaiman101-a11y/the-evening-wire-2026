import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {Pool} from 'pg';
const passwordHash=String(process.env.EW_ADMIN_PASSWORD_SHA256||'').toLowerCase();
const db=process.env.DATABASE_URL||process.env.REACTION_DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRESQL_URL||process.env.DB_URL||'';
const file='/tmp/ew-race-calls.json',sessions=new Map(),failures=new Map();
const codes='AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const nums=[7,1,9,4,52,8,5,1,28,14,2,2,17,9,4,4,6,6,2,8,9,13,8,4,8,2,3,4,2,12,3,26,14,1,15,5,6,17,2,7,1,9,38,4,1,11,10,2,8,1];
const districts=Object.fromEntries(codes.map((c,i)=>[c,nums[i]]));
const senate=new Set('AL AK AR CO DE GA ID IL IA KS KY LA ME MA MI MN MS MT NE NH NJ NM NC OK OR RI SC SD TN TX VA WV WY'.split(' '));
const governors=new Set('AL AK AZ AR CA CO CT FL GA HI ID IL IA KS ME MD MA MI MN NE NV NH NM NY OH OK OR PA RI SC SD TN TX VT WI WY'.split(' '));
let calls=[],audit=[],store=db?'unavailable':'temporary',pool=null,queue=Promise.resolve();
function send(res,code,data,headers={}){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data))}
function meta(){return {configured:/^[a-f0-9]{64}$/.test(passwordHash),storage:store,persistent:store==='postgresql',warning:store==='temporary'?'Temporary server storage: calls may disappear after a restart or redeployment. Export backups until PostgreSQL is connected.':null}}
const snapshot=()=>({version:1,calls,audit});
function current(req){const key=(String(req.headers.cookie||'').match(/(?:^|;\s*)ew_editor_session=([a-f0-9]{64})(?:;|$)/)||[])[1];const expiry=sessions.get(key);return !!expiry&&expiry>Date.now()}
function secureOrigin(req){return !req.headers.origin||req.headers.origin==='https://'+req.headers.host||req.headers.origin==='http://'+req.headers.host}
function validPassword(value){return typeof value==='string'&&value.length<=256&&/^[a-f0-9]{64}$/.test(passwordHash)&&timingSafeEqual(createHash('sha256').update(value).digest(),Buffer.from(passwordHash,'hex'))}
async function input(req,max=250000){let s='';for await(const chunk of req){s+=chunk;if(s.length>max)throw Error('Request too large')}try{return JSON.parse(s||'{}')}catch{throw Error('Invalid JSON')}}
function valid(x){
 const office=String(x.office||''),state=String(x.state||'').toUpperCase(),special=office==='senate'&&x.special===true;
 if(!['senate','governor','house'].includes(office)||!districts[state])throw Error('Choose a valid race and state');
 if(office==='governor'&&!governors.has(state))throw Error('No scheduled regular 2026 governor race for this state');
 if(office==='senate'&&!special&&!senate.has(state))throw Error('No scheduled regular 2026 Senate race; select special election when applicable');
 const district=office==='house'?Number(x.district):null;
 if(office==='house'&&(!Number.isInteger(district)||district<1||district>districts[state]))throw Error('Invalid House district');
 const candidate=String(x.candidate||'').trim().slice(0,130),sourceName=String(x.sourceName||'').trim().slice(0,100),sourceUrl=String(x.sourceUrl||'').trim();
 const party=String(x.party||'').toUpperCase(),note=String(x.note||'').trim().slice(0,400);
 if(candidate.length<2||sourceName.length<2||!['R','D','I','OTHER'].includes(party))throw Error('Winner, party and the named reporting source are required');
 try{const u=new URL(sourceUrl);if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))throw Error()}catch{throw Error('Provide an HTTPS link to the original call source')}
 const id=office+'-'+state+(office==='house'?'-'+district:special?'-special':'');
 return {id,office,state,district,special,candidate,party,sourceName,sourceUrl,note,editorial:true,callType:'Evening Wire editorial call',calledAt:new Date().toISOString()};
}
async function save(){
 if(store==='postgresql'){await pool.query('INSERT INTO ew_editor_state(id,data) VALUES(1,$1::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[JSON.stringify(snapshot())]);return}
 const work=queue.catch(()=>{}).then(async()=>{await writeFile(file+'.tmp',JSON.stringify(snapshot()),{mode:0o600});await rename(file+'.tmp',file)});queue=work;await work;
}
const init=(async()=>{
 if(db){try{
  pool=new Pool({connectionString:db,max:3,connectionTimeoutMillis:8000,ssl:db.includes('localhost')?false:{rejectUnauthorized:false}});
  await pool.query('CREATE TABLE IF NOT EXISTS ew_editor_state(id integer PRIMARY KEY,data jsonb NOT NULL)');
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
 await init;const route=path.slice('/api/admin/'.length),authed=current(req);
 if(route==='session'&&req.method==='GET'){send(res,200,{authenticated:authed,...meta(),count:calls.length});return true}
 if(!secureOrigin(req)){send(res,403,{error:'Origin not allowed'});return true}
 if(route==='login'&&req.method==='POST'){
  const address=req.socket.remoteAddress||'unknown',n=Date.now(),last=failures.get(address);
  if(last&&n-last.start<900000&&last.count>=6){send(res,429,{error:'Too many attempts. Try again later.'});return true}
  let b;try{b=await input(req,1500)}catch(e){send(res,400,{error:e.message});return true}
  if(!validPassword(b.password)){const f=last&&n-last.start<900000?last:{start:n,count:0};f.count++;failures.set(address,f);send(res,401,{error:'Incorrect administrator password'});return true}
  failures.delete(address);const key=randomBytes(32).toString('hex');sessions.set(key,n+43200000);
  send(res,200,{authenticated:true,...meta(),count:calls.length},{'Set-Cookie':'ew_editor_session='+key+'; HttpOnly; Secure; SameSite=Strict; Path=/api/admin/; Max-Age=43200'});return true;
 }
 if(route==='logout'&&req.method==='POST'){const k=(String(req.headers.cookie||'').match(/ew_editor_session=([a-f0-9]{64})/)||[])[1];sessions.delete(k);send(res,200,{authenticated:false},{'Set-Cookie':'ew_editor_session=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin/; Max-Age=0'});return true}
 if(!authed){send(res,403,{error:'Admin login required'});return true}
 if(route==='backup'&&req.method==='GET'){send(res,200,{...snapshot(),exportedAt:new Date().toISOString(),...meta()},{'Content-Disposition':'attachment; filename="evening-wire-race-calls.json"'});return true}
 if(store==='unavailable'){send(res,503,{error:'Database unavailable. Publishing disabled to prevent data loss.'});return true}
 if(route==='calls'&&req.method==='POST'){
  let x,row;try{x=await input(req,5000);row=valid(x);if(x.confirm!==true)throw Error('Confirm you verified the source calls this race')}catch(e){send(res,400,{error:e.message});return true}
  const previous=snapshot(),pos=calls.findIndex(c=>c.id===row.id);
  if(pos>=0)calls[pos]=row;else calls.push(row);
  audit.push({event:pos>=0?'corrected':'published',id:row.id,candidate:row.candidate,at:row.calledAt});audit=audit.slice(-1000);
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
  const restored=[];try{for(const item of b.calls){const x=valid(item);x.calledAt=Number.isFinite(Date.parse(item.calledAt))?item.calledAt:x.calledAt;restored.push(x)}}catch(e){send(res,400,{error:'Invalid backup call: '+e.message});return true}
  const old=snapshot();calls=restored;audit=Array.isArray(b.audit)?b.audit.slice(-1000):[];
  try{await save()}catch(e){calls=old.calls;audit=old.audit;send(res,503,{error:'Could not restore backup'});return true}
  send(res,200,{ok:true,total:calls.length,...meta()});return true
 }
 send(res,404,{error:'Unknown admin endpoint'});return true
}
