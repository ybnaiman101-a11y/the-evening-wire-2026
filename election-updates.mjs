// THE EVENING WIRE — owner-only, persistent, site-wide Election Update notices.
// Members can read; only the authenticated administrator can publish or retract.
import {Pool} from 'pg';
import {postgresTLS} from './postgres-tls.mjs';
import {randomUUID} from 'node:crypto';
import {isEditorAdmin} from './editor-calls.mjs';

const url=process.env.DATABASE_URL||process.env.REACTION_DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRESQL_URL||process.env.DB_URL||'';
let pool=null,ready=false;
const liveClients=new Set();
function push(event,detail){
 const packet='event: '+event+'\ndata: '+JSON.stringify(detail)+'\n\n';
 for(const res of liveClients){try{res.write(packet)}catch{liveClients.delete(res)}}
}
const types=new Set(['breaking','race-called','results','important']);
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
function sameOrigin(req){const o=String(req.headers.origin||'');return o==='https://'+req.headers.host||o==='http://'+req.headers.host}
async function body(req){
 let str='';for await(const chunk of req){str+=chunk;if(str.length>2500)throw Error('Request too large')}
 try{return JSON.parse(str||'{}')}catch{throw Error('Invalid JSON')}
}
function record(r){return {id:r.id,category:r.category,message:r.message,sourceUrl:r.source_url||null,createdAt:r.created_at,expiresAt:r.expires_at,retractedAt:r.retracted_at||null}}
const init=(async()=>{
 if(!url){console.warn('EW_ELECTION_UPDATES_UNAVAILABLE DATABASE_URL not configured');return}
 try{
  pool=new Pool({connectionString:url,max:3,connectionTimeoutMillis:8000,ssl:postgresTLS(url)});
  await pool.query("CREATE TABLE IF NOT EXISTS ew_election_updates(id uuid PRIMARY KEY,category varchar(24) NOT NULL,message varchar(700) NOT NULL,source_url varchar(600),created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,retracted_at timestamptz)");
  await pool.query('CREATE INDEX IF NOT EXISTS ew_election_updates_recent ON ew_election_updates(created_at DESC)');
  ready=true;console.log('EW_ELECTION_UPDATES_DB_READY');
 }catch(e){console.error('EW_ELECTION_UPDATES_DB_ERROR '+String(e.message||e));pool?.end().catch(()=>{});pool=null}
})();
export async function updateRoute(req,res,path){
 if(path!=='/api/updates'&&!path.startsWith('/api/updates/'))return false;
 await init;
 if(!ready){send(res,503,{error:'Election Update storage is unavailable. Notices cannot be published without PostgreSQL.'});return true}
 if(path==='/api/updates/stream'&&req.method==='GET'){
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});
  res.write('retry: 2500\n\n');
  liveClients.add(res);
  const heartbeat=setInterval(()=>{try{res.write(': election-updates heartbeat\n\n')}catch{liveClients.delete(res);clearInterval(heartbeat)}},18000);
  heartbeat.unref?.();
  req.on('close',()=>{liveClients.delete(res);clearInterval(heartbeat)});
  return true
 }
 if(path==='/api/updates'&&req.method==='GET'){
  const rows=await pool.query("SELECT id,category,message,source_url,created_at,expires_at,retracted_at FROM ew_election_updates WHERE retracted_at IS NULL AND created_at > now()-interval '25 seconds' ORDER BY created_at DESC LIMIT 12");
  send(res,200,{updates:rows.rows.map(record),pollEveryMs:1500,deliveryGraceMs:25000,popupDurationMs:10000,source:'The Evening Wire owner'});
  return true
 }
 if(path==='/api/updates/admin'&&req.method==='GET'){
  if(!await isEditorAdmin(req)){send(res,403,{error:'Owner authentication required'});return true}
  const rows=await pool.query("SELECT id,category,message,source_url,created_at,expires_at,retracted_at FROM ew_election_updates ORDER BY created_at DESC LIMIT 30");
  send(res,200,{updates:rows.rows.map(record)});return true
 }
 if(req.method==='POST'&&!sameOrigin(req)){send(res,403,{error:'Request origin not allowed'});return true}
 if(path==='/api/updates'&&req.method==='POST'){
  if(!await isEditorAdmin(req)){send(res,403,{error:'Only The Evening Wire owner can publish Election Updates.'});return true}
  let x;try{x=await body(req)}catch(e){send(res,400,{error:e.message});return true}
  const message=String(x.message||'').trim(),category=String(x.category||'important');
  if(message.length<8||message.length>700||!types.has(category)){
   send(res,400,{error:'Provide a message between 8 and 700 characters and a valid update type.'});return true
  }
  let sourceUrl=null;
  if(String(x.sourceUrl||'').trim()){
   try{const u=new URL(String(x.sourceUrl).trim());if(u.protocol!=='https:'||u.username||u.password||u.href.length>600)throw Error();sourceUrl=u.href}
   catch{send(res,400,{error:'Source link must be a valid HTTPS URL'});return true}
  }
  const recent=await pool.query("SELECT count(*)::int AS count FROM ew_election_updates WHERE created_at>now()-interval '10 minutes'");
  if(recent.rows[0].count>=12){send(res,429,{error:'Limit of 12 urgent notices per ten minutes.'});return true}
  const row=await pool.query("INSERT INTO ew_election_updates(id,category,message,source_url,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 seconds') RETURNING id,category,message,source_url,created_at,expires_at,retracted_at",
   [randomUUID(),category,message,sourceUrl]);
  const result=record(row.rows[0]);
  push('election-update',result);
  console.log('EW_ELECTION_UPDATE_PUBLISHED id='+result.id+' connected_receivers='+liveClients.size);
  send(res,201,{ok:true,update:result,connectedReceivers:liveClients.size,message:'Election Update published to all connected readers. Popup lasts ten seconds per screen.'});return true
 }
 const remove=path.match(/^\/api\/updates\/([0-9a-f-]{36})\/retract$/);
 if(remove&&req.method==='POST'){
  if(!await isEditorAdmin(req)){send(res,403,{error:'Owner authentication required'});return true}
  const row=await pool.query("UPDATE ew_election_updates SET retracted_at=now() WHERE id=$1 AND retracted_at IS NULL RETURNING id",[remove[1]]);
  if(!row.rowCount){send(res,404,{error:'Election Update not found or already withdrawn'});return true}
  push('election-update-withdrawn',{id:remove[1]});
  send(res,200,{ok:true});return true
 }
 send(res,404,{error:'Unknown Election Update endpoint'});return true
}
