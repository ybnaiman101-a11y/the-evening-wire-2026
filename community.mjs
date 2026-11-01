import {Pool} from 'pg';
import {temporaryCommunityRoute} from './community-temp.mjs';
import {authenticatedMember} from './members.mjs';
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
  await pool.query("ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES ew_members(id)");
  await pool.query("ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES community_posts(id) ON DELETE CASCADE");
  await pool.query("ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS edited_at timestamptz");
  await pool.query("CREATE INDEX IF NOT EXISTS ew_community_parent_idx ON community_posts(parent_id)");
  await pool.query("CREATE TABLE IF NOT EXISTS community_reports(post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,member_id uuid NOT NULL REFERENCES ew_members(id),PRIMARY KEY(post_id,member_id))");
  ready=true;console.log('REACTION_HUB_DATABASE_CONNECTED');
 }catch(e){ready=false;console.warn('Reaction DB not ready:',e.message);await pool?.end().catch(()=>{});pool=null}
}
setup();setInterval(()=>{if(!ready)setup();for(const [k,v] of limits)if(Date.now()-v.s>3600000)limits.delete(k)},120000).unref();
async function input(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>4000)throw Error('Too long')}return JSON.parse(data||'{}')}
function authorized(req){const s=req.headers['x-reaction-admin-token'];return !!adminSecret&&adminSecret.length>=24&&typeof s==='string'&&s.length===adminSecret.length&&timingSafeEqual(Buffer.from(s),Buffer.from(adminSecret))}
export async function communityRoute(req,res,path){
 if(!path.startsWith('/api/community/'))return false;
 const route=path.slice('/api/community/'.length);
 const member=await authenticatedMember(req);
 if(route==='health'&&req.method==='GET'&&connection){respond(res,200,{ready,configured:true,postingEnabled:ready,storage:'postgresql'});return true}
 if(!member){respond(res,401,{error:'Sign in to view and post reactions.'});return true}
 if(!connection){respond(res,503,{error:'Discussion requires PostgreSQL storage'});return true}
 if(!ready){respond(res,503,{ready:false,error:'Permanent database is configured but not yet available'});return true}
 try{
  if(route==='posts'&&req.method==='GET'){
   const topic=new URL(req.url,'http://localhost').searchParams.get('topic');
   const q=await pool.query("SELECT p.id,COALESCE(m.display_name,p.name) AS name,p.topic,p.message,p.created_at,p.edited_at,p.likes,p.parent_id,p.member_id,COALESCE((SELECT count(*)::int FROM community_posts replies WHERE replies.parent_id=p.id AND replies.status='visible'),0) AS reply_count FROM community_posts p LEFT JOIN ew_members m ON p.member_id=m.id WHERE p.status='visible' AND ($1::text IS NULL OR p.topic=$1) ORDER BY p.created_at DESC LIMIT 350",[topics.has(topic)?topic:null]);
   respond(res,200,{ready:true,posts:q.rows});return true
  }
  if(route==='posts'&&req.method==='POST'){
   if(!rate(req,3,600000)){respond(res,429,{error:'Limit: three posts per ten minutes'});return true}
   const x=await input(req),name=member.displayName.slice(0,30),message=String(x.message||'').trim(),topic=String(x.topic||'general'),parent=typeof x.parentId==='string'&&/^[0-9a-f-]{36}$/.test(x.parentId)?x.parentId:null;
   if(message.length<8||message.length>700||!topics.has(topic)||/https?:\/\/|www\./i.test(message)){respond(res,400,{error:'Enter 8–700 characters, without links, and select a valid topic'});return true}
   if(parent){
    const q=await pool.query("SELECT id,topic,parent_id FROM community_posts WHERE id=$1 AND status='visible'",[parent]);
    if(!q.rowCount||q.rows[0].topic!==topic||q.rows[0].parent_id){respond(res,400,{error:'Replies must be to an existing top-level message in the same category.'});return true}
   }
   const id=randomUUID();await pool.query('INSERT INTO community_posts(id,name,topic,message,member_id,parent_id) VALUES($1,$2,$3,$4,$5,$6)',[id,name,topic,message,member.id,parent]);respond(res,201,{ok:true,id});return true
  }
  const edit=route.match(/^([a-f0-9-]{36})\/edit$/);
  if(edit&&req.method==='POST'){
   // Member ID is taken from the signed-in session, never supplied by the client.
   if(!rate(req,12,600000)){respond(res,429,{error:'Too many message edits. Try again shortly.'});return true}
   const x=await input(req),message=String(x.message||'').trim();
   if(message.length<8||message.length>700||/https?:\/\/|www\./i.test(message)){
    respond(res,400,{error:'Write 8–700 characters without links.'});return true
   }
   const updated=await pool.query("UPDATE community_posts SET message=$1,edited_at=now() WHERE id=$2 AND member_id=$3 AND status='visible' RETURNING id",[message,edit[1],member.id]);
   if(!updated.rowCount){respond(res,403,{error:'You can only edit your own visible messages.'});return true}
   respond(res,200,{ok:true,id:updated.rows[0].id});return true
  }
  const like=route.match(/^([a-f0-9-]{36})\/like$/);
  if(like&&req.method==='POST'){
   if(!rate(req,20,600000)){respond(res,429,{error:'Rate limited'});return true}
   const memberFingerprint=createHash('sha256').update(member.id).digest('hex').slice(0,24);
   const q=await pool.query('INSERT INTO community_likes(post_id,visitor) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING post_id',[like[1],memberFingerprint]);
   if(q.rowCount)await pool.query('UPDATE community_posts SET likes=likes+1 WHERE id=$1',[like[1]]);
   respond(res,200,{ok:true});return true
  }
  const report=route.match(/^([a-f0-9-]{36})\/report$/);
  if(report&&req.method==='POST'){
   if(!rate(req,5,3600000)){respond(res,429,{error:'Rate limited'});return true}
   const inserted=await pool.query("INSERT INTO community_reports(post_id,member_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING post_id",[report[1],member.id]);
   if(inserted.rowCount)await pool.query("UPDATE community_posts SET reports=reports+1,status=CASE WHEN reports>=2 THEN 'hidden' ELSE status END WHERE id=$1",[report[1]]);
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
