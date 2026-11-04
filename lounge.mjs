// THE LOUNGE: opt-in social profiles and one-way following.
// All data is stored in the existing PostgreSQL database; no old data is changed.
import {Pool} from './local-db-pool.mjs';
import {postgresTLS,postgresConnectionString} from './postgres-tls.mjs';
import {authenticatedMember} from './members.mjs';
const url=process.env.DATABASE_URL||process.env.REACTION_DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRESQL_URL||process.env.DB_URL||'';
let pool=null,ready=false,connecting=null;
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
const originOK=req=>!req.headers.origin||req.headers.origin==='https://'+req.headers.host||req.headers.origin==='http://'+req.headers.host;
async function initialize(){
 if(ready)return;
 if(connecting)return connecting;
 connecting=(async()=>{
  if(!url)throw Error('Database not configured');
  const db=new Pool({connectionString:postgresConnectionString(url),max:2,ssl:postgresTLS(url),connectionTimeoutMillis:8000});
  try{
   await db.query('CREATE TABLE IF NOT EXISTS lounge_discovery(member_id uuid PRIMARY KEY REFERENCES ew_members(id) ON DELETE CASCADE,visible boolean NOT NULL DEFAULT false,updated_at timestamptz DEFAULT now())');
   await db.query('CREATE TABLE IF NOT EXISTS lounge_follows(follower_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,followed_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(follower_id,followed_id),CHECK(follower_id<>followed_id))');
   await db.query('CREATE INDEX IF NOT EXISTS lounge_followed_lookup ON lounge_follows(followed_id)');
   pool=db;ready=true;console.log('LOUNGE_SOCIAL_DATABASE_CONNECTED');
  }catch(err){await db.end().catch(()=>{});throw err}
 })().finally(()=>{connecting=null});
 return connecting
}
async function body(req){let s='';for await(const b of req){s+=b;if(s.length>2048)throw Error('Request too long')}try{return JSON.parse(s||'{}')}catch{throw Error('Invalid JSON')}}
const avatar=r=>r.avatar_updated_at?'/api/members/avatar/'+r.id+'?v='+new Date(r.avatar_updated_at).getTime():null;
export async function loungeRoute(req,res,path){
 if(!path.startsWith('/api/lounge/'))return false;
 const route=path.slice('/api/lounge/'.length);
 if(req.method==='POST'&&!originOK(req)){json(res,403,{error:'Origin not allowed'});return true}
 try{await initialize()}catch(err){console.warn('LOUNGE_DB_NOT_READY',String(err.message||err));json(res,503,{error:'The community database is temporarily unavailable.'});return true}
 const member=await authenticatedMember(req);
 if(route==='people'&&req.method==='GET'){
  const people=(await pool.query("SELECT m.id,m.display_name,av.updated_at AS avatar_updated_at,COALESCE(f.followers,0)::integer AS followers FROM lounge_discovery d JOIN ew_members m ON m.id=d.member_id LEFT JOIN ew_member_avatars av ON av.member_id=m.id LEFT JOIN LATERAL(SELECT count(*)::integer AS followers FROM lounge_follows lf WHERE lf.followed_id=m.id) f ON true WHERE d.visible=true ORDER BY m.display_name LIMIT 100")).rows;
  let follows=new Set();
  if(member){const r=await pool.query('SELECT followed_id FROM lounge_follows WHERE follower_id=$1',[member.id]);follows=new Set(r.rows.map(x=>x.followed_id))}
  json(res,200,{people:people.map(p=>({id:p.id,displayName:p.display_name,avatarUrl:avatar(p),followers:Number(p.followers)||0,following:follows.has(p.id)})),signedIn:!!member});return true
 }
 if(route==='me'&&req.method==='GET'){
  if(!member){json(res,200,{user:null,visible:false,followers:0,following:0});return true}
  const r=await pool.query("SELECT COALESCE((SELECT visible FROM lounge_discovery WHERE member_id=$1),false) AS visible,(SELECT count(*)::integer FROM lounge_follows WHERE followed_id=$1) AS followers,(SELECT count(*)::integer FROM lounge_follows WHERE follower_id=$1) AS following",[member.id]);
  json(res,200,{user:{id:member.id,displayName:member.displayName,avatarUrl:member.avatarUrl||null},...r.rows[0]});return true
 }
 if(!member){json(res,401,{error:'Sign in to use your social profile'});return true}
 if(route==='visibility'&&req.method==='POST'){
  const x=await body(req);
  if(typeof x.visible!=='boolean'){json(res,400,{error:'Choose whether to appear in Friends'});return true}
  await pool.query('INSERT INTO lounge_discovery(member_id,visible) VALUES($1,$2) ON CONFLICT(member_id) DO UPDATE SET visible=$2,updated_at=now()',[member.id,x.visible]);
  json(res,200,{ok:true,visible:x.visible});return true
 }
 if((route==='follow'||route==='unfollow')&&req.method==='POST'){
  const x=await body(req),id=String(x.memberId||'');
  if(!/^[0-9a-f-]{36}$/.test(id)||id===member.id){json(res,400,{error:'Choose a valid friend'});return true}
  if(route==='follow'){
   const check=await pool.query('SELECT 1 FROM lounge_discovery WHERE member_id=$1 AND visible=true',[id]);
   if(!check.rowCount){json(res,404,{error:'This member is not available in Friends'});return true}
   await pool.query('INSERT INTO lounge_follows(follower_id,followed_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[member.id,id]);
  }else{
   await pool.query('DELETE FROM lounge_follows WHERE follower_id=$1 AND followed_id=$2',[member.id,id]);
  }
  json(res,200,{ok:true,following:route==='follow'});return true
 }
 json(res,404,{error:'Unknown social action'});return true
}
