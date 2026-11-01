// Temporary file-backed community store for use only while PostgreSQL is unconfigured.
// Render web service filesystems are ephemeral; a restart, redeploy, or instance migration
// can remove posts. The client shows this warning clearly on every page load.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {URL} from 'node:url';
const filename='/tmp/evening-wire-reactions.json';
const validTopics=new Set(['general','senate','house','governors','election-night','news']);
const limits=new Map();
let posts=[],io=Promise.resolve();
const init=readFile(filename,'utf8').then(data=>{
 const saved=JSON.parse(data);
 if(Array.isArray(saved)) posts=saved.filter(x=>x&&typeof x.id==='string').slice(0,1000);
 console.log('REACTION_TEMP_STORE_LOADED count='+posts.length);
}).catch(err=>{if(err.code!=='ENOENT')console.warn('REACTION_TEMP_LOAD_FAILED',err.message)});
function visitor(req){
 const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim().slice(0,96);
 return createHash('sha256').update(ip).digest('hex').slice(0,32);
}
function limited(req,action,max,ms){
 const key=visitor(req)+':'+action,now=Date.now(),v=limits.get(key);
 if(!v||now-v.t>ms){limits.set(key,{t:now,n:1});return false}
 if(v.n>=max)return true;v.n++;return false;
}
const answer=(res,status,payload)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload))};
const limitedResponse=(res)=>answer(res,429,{error:'You have reached the posting limit. Please try again later.'});
async function payload(req){
 let s='';for await(const chunk of req){s+=chunk;if(s.length>4500)throw Error('Request too long')}
 try{return JSON.parse(s||'{}')}catch{throw Error('Invalid request')}
}
function persist(){
 const next=io.catch(()=>{}).then(async()=>{
   const draft=filename+'.new';
   await writeFile(draft,JSON.stringify(posts.slice(0,1000)),{mode:0o600});
   await rename(draft,filename);
 });
 io=next;
 return next;
}
function responsePosts(topic){
 return posts.filter(p=>p.status==='visible'&&(!validTopics.has(topic)||p.topic===topic))
   .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,100)
   .map(p=>({id:p.id,name:p.name,topic:p.topic,message:p.message,created_at:p.created_at,likes:p.likes}));
}
const meta={ready:true,configured:false,postingEnabled:true,storage:'temporary',warning:'Temporary posting: comments may be lost after server restarts or deployments. Permanent database connection is still required.'};
export async function temporaryCommunityRoute(req,res,route){
 await init;
 if(route==='health'&&req.method==='GET'){answer(res,200,meta);return}
 if(route==='posts'&&req.method==='GET'){
  const topic=new URL(req.url,'http://localhost').searchParams.get('topic');
  answer(res,200,{...meta,posts:responsePosts(topic)});return;
 }
 if(route==='posts'&&req.method==='POST'){
  if(limited(req,'post',3,600000)){limitedResponse(res);return}
  let data;
  try{data=await payload(req)}catch(e){answer(res,400,{error:e.message});return}
  const name=String(data.name||'Anonymous').normalize('NFKC').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,30)||'Anonymous';
  const message=String(data.message||'').normalize('NFKC').trim();
  const topic=String(data.topic||'general');
  if(!validTopics.has(topic)||message.length<8||message.length>700||/https?:\/\/|www\./i.test(message)){
   answer(res,400,{error:'Choose a valid topic and write 8–700 characters without links.'});return;
  }
  const post={id:randomUUID(),name,message,topic,created_at:new Date().toISOString(),likes:0,reports:0,liked:[],reported:[],status:'visible'};
  posts.unshift(post);if(posts.length>1000)posts=posts.slice(0,1000);
  try{await persist()}catch(err){posts=posts.filter(p=>p.id!==post.id);console.error('Reaction temporary save failed',err.message);answer(res,503,{error:'Could not save comment. Please retry.'});return}
  answer(res,201,{ok:true,id:post.id,storage:'temporary'});return;
 }
 const like=route.match(/^([a-f0-9-]{36})\/like$/);
 if(like&&req.method==='POST'){
  if(limited(req,'like',30,600000)){limitedResponse(res);return}
  const p=posts.find(p=>p.id===like[1]&&p.status==='visible');
  if(!p){answer(res,404,{error:'Comment not found'});return}
  const key=visitor(req);
  if(!p.liked.includes(key)){p.liked.push(key);p.likes++;try{await persist()}catch{}}
  answer(res,200,{ok:true,liked:true});return;
 }
 const report=route.match(/^([a-f0-9-]{36})\/report$/);
 if(report&&req.method==='POST'){
  if(limited(req,'report',6,3600000)){limitedResponse(res);return}
  const p=posts.find(p=>p.id===report[1]&&p.status==='visible');
  if(!p){answer(res,404,{error:'Comment not found'});return}
  const key=visitor(req);
  if(!p.reported.includes(key)){p.reported.push(key);p.reports++;if(p.reports>=3)p.status='hidden';try{await persist()}catch{}}
  answer(res,200,{ok:true});return;
 }
 answer(res,404,{error:'Unknown community endpoint'});
}
setInterval(()=>{const now=Date.now();for(const [key,v] of limits)if(now-v.t>3600000)limits.delete(key)},3600000).unref();
