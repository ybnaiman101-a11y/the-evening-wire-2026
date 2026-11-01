import {Pool} from 'pg';
import {randomUUID,createHash,timingSafeEqual} from 'node:crypto';
const connection=process.env.DATABASE_URL||process.env.REACTION_DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRESQL_URL||process.env.DB_URL||'';
const adminSecret=process.env.REACTION_ADMIN_TOKEN||'';
let pool=null,ready=false;
console.log('REACTION_HUB_CONFIG connection_present='+Boolean(connection)+' matching_env_keys='+['DATABASE_URL','REACTION_DATABASE_URL','POSTGRES_URL','POSTGRESQL_URL','DB_URL'].filter(key=>Boolean(process.env[key])).join(','));
const limits=new Map();
const topics=new Set(['general','senate','house','governors','election-night','news']);
const respond=(r,n,x)=>{r.writeHead(n,{'Content-Type':'application/json','Cache-Control':'no-store'});r.end(JSON.stringify(x))};
function fingerprint(req){return createHash('sha256').update(String(req.socket.remoteAddress||'unknown')).digest('hex').slice(0,24)}
function rate(req,limit,ms){const k=fingerprint(req)+req.url.split('?')[0]+req.method,n=Date.now(),v=limits.get(k);if(!v||n-v.s>ms){limits.set(k,{s:n,c:1});return true}if(v.c>=limit)return false;v.c++;return true}
async function setup(){
 if(!connection)return;
 try{
  pool=new Pool({connectionString:connection,max:4,connectionTimeoutMillis:8000,ssl:connection.includes('localhost')?false:{rejectUnauthorized:false}});
  await pool.query("CREATE TABLE IF NOT EXISTS community_posts(id uuid PRIMARY KEY,name varchar(30) NOT NULL,topic varchar(32) NOT NULL,message varchar(700) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),likes integer NOT NULL DEFAULT 0,reports integer NOT NULL DEFAULT 0,status varchar(20) NOT NULL DEFAULT 'visible')");
  await pool.query("CREATE TABLE IF NOT EXISTS community_likes(post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,visitor varchar(24) NOT NULL,PRIMARY KEY(post_id,visitor))");
  ready=true;console.log('REACTION_HUB_DATABASE_CONNECTED');
 }catch(e){ready=false;console.warn('Reaction DB not ready:',e.message);await pool?.end().catch(()=>{});pool=null}
}
setup();setInterval(()=>{if(!ready)setup();for(const [k,v] of limits)if(Date.now()-v.s>3600000)limits.delete(k)},120000).unref();
async function input(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>4000)throw Error('Too long')}return JSON.parse(data||'{}')}
function authorized(req){const s=req.headers['x-reaction-admin-token'];return !!adminSecret&&adminSecret.length>=24&&typeof s==='string'&&s.length===adminSecret.length&&timingSafeEqual(Buffer.from(s),Buffer.from(adminSecret))}
export async function communityRoute(req,res,path){
 if(!path.startsWith('/api/community/'))return false;
 const route=path.slice('/api/community/'.length);
 if(route==='health'&&req.method==='GET'){respond(res,200,{ready,configured:Boolean(connection)});return true}
 if(!ready){respond(res,503,{ready:false,error:'Reaction Hub database connection not yet configured'});return true}
 try{
  if(route==='posts'&&req.method==='GET'){
   const topic=new URL(req.url,'http://localhost').searchParams.get('topic');const q=await pool.query("SELECT id,name,topic,message,created_at,likes FROM community_posts WHERE status='visible' AND ($1::text IS NULL OR topic=$1) ORDER BY created_at DESC LIMIT 100",[topics.has(topic)?topic:null]);
   respond(res,200,{ready:true,posts:q.rows});return true
  }
  if(route==='posts'&&req.method==='POST'){
   if(!rate(req,3,600000)){respond(res,429,{error:'Limit: three posts per ten minutes'});return true}
   const x=await input(req),name=String(x.name||'Anonymous').trim().replace(/[\x00-\x1f\x7f]/g,' ').slice(0,30),message=String(x.message||'').trim(),topic=String(x.topic||'general');
   if(message.length<8||message.length>700||!topics.has(topic)||/https?:\/\/|www\./i.test(message)){respond(res,400,{error:'Enter 8–700 characters, without links, and select a valid topic'});return true}
   const id=randomUUID();await pool.query('INSERT INTO community_posts(id,name,topic,message) VALUES($1,$2,$3,$4)',[id,name,topic,message]);respond(res,201,{ok:true,id});return true
  }
  const like=route.match(/^([a-f0-9-]{36})\/like$/);
  if(like&&req.method==='POST'){
   if(!rate(req,20,600000)){respond(res,429,{error:'Rate limited'});return true}
   const q=await pool.query('INSERT INTO community_likes(post_id,visitor) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING post_id',[like[1],fingerprint(req)]);
   if(q.rowCount)await pool.query('UPDATE community_posts SET likes=likes+1 WHERE id=$1',[like[1]]);
   respond(res,200,{ok:true});return true
  }
  const report=route.match(/^([a-f0-9-]{36})\/report$/);
  if(report&&req.method==='POST'){
   if(!rate(req,5,3600000)){respond(res,429,{error:'Rate limited'});return true}
   await pool.query("UPDATE community_posts SET reports=reports+1,status=CASE WHEN reports>=2 THEN 'hidden' ELSE status END WHERE id=$1",[report[1]]);
   respond(res,200,{ok:true});return true
  }
  const moderation=route.match(/^admin\/([a-f0-9-]{36})\/(hide|restore)$/);
  if(moderation&&req.method==='POST'){
   if(!authorized(req)){respond(res,403,{error:'Administrator only'});return true}
   await pool.query('UPDATE community_posts SET status=$1 WHERE id=$2',[moderation[2]==='hide'?'hidden':'visible',moderation[1]]);
   respond(res,200,{ok:true});return true
  }
  respond(res,404,{error:'Not found'});return true
 }catch(e){console.error('Reaction API',e);respond(res,500,{error:'Could not process request'});return true}
}
