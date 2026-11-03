// THE EVENING WIRE — additive Reaction Hub 2.0 capabilities.
// Existing posts, member accounts and administrator credentials are unchanged.
import {randomUUID} from 'node:crypto';
import {isEditorAdmin} from './editor-calls.mjs';

const emojiKinds=new Set(['like','love','laugh','wow','usa','fire']);
const categories=new Set(['general','senate','house','governors','election-night','news']);
const listeners=new Set();
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
const originOK=req=>!req.headers.origin||req.headers.origin==='https://'+req.headers.host||req.headers.origin==='http://'+req.headers.host;
async function input(req){
 let str='';for await(const p of req){str+=p;if(str.length>5000)throw Error('Request too long')}
 try{return JSON.parse(str||'{}')}catch{throw Error('Invalid JSON')}
}
export function announceHubUpdate(type='messages'){
 for(const response of [...listeners]){try{response.write('event: change\ndata: '+JSON.stringify({type})+'\n\n')}catch{listeners.delete(response)}}
}
export async function setupCommunityV2(pool){
 await pool.query("ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false");
 await pool.query("ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS official boolean NOT NULL DEFAULT false");
 await pool.query("CREATE TABLE IF NOT EXISTS community_reactions(post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,emoji varchar(12) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(post_id,member_id,emoji))");
 await pool.query("CREATE INDEX IF NOT EXISTS ew_reaction_post_index ON community_reactions(post_id)");
 await pool.query("CREATE TABLE IF NOT EXISTS community_polls(id uuid PRIMARY KEY,question varchar(180) NOT NULL,options jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),closes_at timestamptz NOT NULL,closed boolean NOT NULL DEFAULT false)");
 await pool.query("CREATE TABLE IF NOT EXISTS community_poll_votes(poll_id uuid NOT NULL REFERENCES community_polls(id) ON DELETE CASCADE,member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,choice_index smallint NOT NULL,PRIMARY KEY(poll_id,member_id))");
 await pool.query("CREATE TABLE IF NOT EXISTS community_presence(member_id uuid PRIMARY KEY REFERENCES ew_members(id) ON DELETE CASCADE,last_seen_at timestamptz NOT NULL DEFAULT now())");
}
export async function addHubPostDetails(pool,posts,member){
 if(!posts.length)return posts;
 const ids=posts.map(p=>p.id);
 const reactions=await pool.query('SELECT post_id,emoji,count(*)::integer AS count FROM community_reactions WHERE post_id=ANY($1::uuid[]) GROUP BY post_id,emoji',[ids]);
 const aggregates=new Map();
 for(const item of reactions.rows){
  const row=aggregates.get(item.post_id)||{};
  if(emojiKinds.has(item.emoji))row[item.emoji]=Number(item.count);
  aggregates.set(item.post_id,row)
 }
 let mine=new Map();
 if(member){
  const mineQuery=await pool.query('SELECT post_id,emoji FROM community_reactions WHERE member_id=$1 AND post_id=ANY($2::uuid[])',[member.id,ids]);
  for(const item of mineQuery.rows){const set=mine.get(item.post_id)||[];set.push(item.emoji);mine.set(item.post_id,set)}
 }
 return posts.map(p=>({...p,reactions:aggregates.get(p.id)||{},myReactions:mine.get(p.id)||[]}))
}
export async function communityV2Route(req,res,route,pool,member){
 if(route==='stream'&&req.method==='GET'){
  if(listeners.size>=250){json(res,503,{error:'Live channel busy; use refresh'});return true}
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});
  res.write('event: ready\ndata: {}\n\n');
  listeners.add(res);
  const ping=setInterval(()=>{try{res.write(': heartbeat\n\n')}catch{cleanup()}},19000);
  function cleanup(){listeners.delete(res);clearInterval(ping)}
  req.on('close',cleanup);return true
 }
 if(route==='presence'&&req.method==='GET'){
  const r=await pool.query("SELECT count(*)::integer AS online FROM community_presence WHERE last_seen_at > now()-interval '90 seconds'");
  json(res,200,{online:Number(r.rows[0]?.online||0),definition:'Members active within 90 seconds'});return true
 }
 if(route==='presence'&&req.method==='POST'){
  if(!member){json(res,401,{error:'Sign in to appear online'});return true}
  if(!originOK(req)){json(res,403,{error:'Origin not allowed'});return true}
  await pool.query("INSERT INTO community_presence(member_id,last_seen_at) VALUES($1,now()) ON CONFLICT(member_id) DO UPDATE SET last_seen_at=now()",[member.id]);
  json(res,200,{ok:true});return true
 }
 if(route==='polls'&&req.method==='GET'){
  const rows=(await pool.query("SELECT id,question,options,created_at,closes_at,closed FROM community_polls ORDER BY created_at DESC LIMIT 12")).rows;
  if(!rows.length){json(res,200,{polls:[]});return true}
  const ids=rows.map(x=>x.id);
  const counts=(await pool.query("SELECT poll_id,choice_index,count(*)::integer AS total FROM community_poll_votes WHERE poll_id=ANY($1::uuid[]) GROUP BY poll_id,choice_index",[ids])).rows;
  const myVotes=member?(await pool.query("SELECT poll_id,choice_index FROM community_poll_votes WHERE member_id=$1 AND poll_id=ANY($2::uuid[])",[member.id,ids])).rows:[];
  const byId=new Map(),mine=new Map(myVotes.map(x=>[x.poll_id,Number(x.choice_index)]));
  for(const x of counts){let o=byId.get(x.poll_id)||{};o[x.choice_index]=Number(x.total);byId.set(x.poll_id,o)}
  json(res,200,{polls:rows.map(p=>({...p,counts:byId.get(p.id)||{},myVote:mine.has(p.id)?mine.get(p.id):null}))});return true
 }
 const vote=route.match(/^polls\/([a-f0-9-]{36})\/vote$/);
 if(vote&&req.method==='POST'){
  if(!member){json(res,401,{error:'Sign in to vote'});return true}
  if(!originOK(req)){json(res,403,{error:'Origin not allowed'});return true}
  const x=await input(req),choice=Number(x.choice);
  const p=(await pool.query('SELECT options,closed,closes_at FROM community_polls WHERE id=$1',[vote[1]])).rows[0];
  if(!p){json(res,404,{error:'Poll not found'});return true}
  if(p.closed||Date.parse(p.closes_at)<=Date.now()){json(res,409,{error:'Poll closed'});return true}
  if(!Number.isInteger(choice)||choice<0||choice>=p.options.length){json(res,400,{error:'Choose a valid answer'});return true}
  const inserted=await pool.query("INSERT INTO community_poll_votes(poll_id,member_id,choice_index) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING poll_id",[vote[1],member.id,choice]);
  if(!inserted.rowCount){json(res,409,{error:'You already voted in this poll'});return true}
  announceHubUpdate('polls');json(res,200,{ok:true});return true
 }
 const reaction=route.match(/^([a-f0-9-]{36})\/react$/);
 if(reaction&&req.method==='POST'){
  if(!member){json(res,401,{error:'Sign in to react'});return true}
  if(!originOK(req)){json(res,403,{error:'Origin not allowed'});return true}
  const body=await input(req),emoji=String(body.emoji||'');
  if(!emojiKinds.has(emoji)){json(res,400,{error:'Unknown reaction'});return true}
  const visible=await pool.query("SELECT 1 FROM community_posts WHERE id=$1 AND status='visible'",[reaction[1]]);
  if(!visible.rowCount){json(res,404,{error:'Message not found'});return true}
  const created=await pool.query("INSERT INTO community_reactions(post_id,member_id,emoji) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING post_id",[reaction[1],member.id,emoji]);
  if(!created.rowCount)await pool.query('DELETE FROM community_reactions WHERE post_id=$1 AND member_id=$2 AND emoji=$3',[reaction[1],member.id,emoji]);
  announceHubUpdate('messages');json(res,200,{ok:true,active:!!created.rowCount});return true
 }
 const remove=route.match(/^([a-f0-9-]{36})\/delete$/);
 if(remove&&req.method==='POST'){
  if(!member){json(res,401,{error:'Sign in to delete'});return true}
  if(!originOK(req)){json(res,403,{error:'Origin not allowed'});return true}
  const updated=await pool.query("UPDATE community_posts SET status='deleted' WHERE id=$1 AND member_id=$2 AND status='visible' AND created_at>now()-interval '15 minutes' RETURNING id",[remove[1],member.id]);
  if(!updated.rowCount){json(res,403,{error:'You can delete only your own recent messages (within 15 minutes)'});return true}
  announceHubUpdate('messages');json(res,200,{ok:true});return true
 }
 if(route.startsWith('admin/')){
  if(!originOK(req)){json(res,403,{error:'Origin not allowed'});return true}
  if(!await isEditorAdmin(req)){json(res,403,{error:'Owner administrator sign-in required'});return true}
  if(route==='admin/polls'&&req.method==='POST'){
   const body=await input(req),question=String(body.question||'').trim(),options=Array.isArray(body.options)?body.options.map(x=>String(x||'').trim()):[];
   if(question.length<8||question.length>180||options.length<2||options.length>5||options.some(x=>x.length<1||x.length>90)||new Set(options.map(x=>x.toLowerCase())).size!==options.length){
    json(res,400,{error:'Enter a question (8–180 characters) and 2–5 distinct answers'});return true
   }
   const hours=Number(body.durationHours)||24;if(![1,6,12,24,48,72,168].includes(hours)){json(res,400,{error:'Choose a supported poll duration'});return true}
   const id=randomUUID();
   await pool.query("INSERT INTO community_polls(id,question,options,closes_at) VALUES($1,$2,$3::jsonb,now()+($4 * interval '1 hour'))",[id,question,JSON.stringify(options),hours]);
   announceHubUpdate('polls');json(res,201,{ok:true,id});return true
  }
  const close=route.match(/^admin\/polls\/([a-f0-9-]{36})\/close$/);
  if(close&&req.method==='POST'){
   await pool.query("UPDATE community_polls SET closed=true WHERE id=$1",[close[1]]);
   announceHubUpdate('polls');json(res,200,{ok:true});return true
  }
  const pin=route.match(/^admin\/posts\/([a-f0-9-]{36})\/pin$/);
  if(pin&&req.method==='POST'){
   const q=await pool.query("UPDATE community_posts SET pinned=NOT pinned WHERE id=$1 AND status='visible' RETURNING pinned",[pin[1]]);
   announceHubUpdate('messages');json(res,q.rowCount?200:404,q.rowCount?{ok:true,pinned:q.rows[0].pinned}:{error:'Message not found'});return true
  }
  const hide=route.match(/^admin\/posts\/([a-f0-9-]{36})\/hide$/);
  if(hide&&req.method==='POST'){
   await pool.query("UPDATE community_posts SET status='hidden' WHERE id=$1",[hide[1]]);
   announceHubUpdate('messages');json(res,200,{ok:true});return true
  }
  if(route==='admin/announcement'&&req.method==='POST'){
   const b=await input(req),message=String(b.message||'').trim(),topic=String(b.topic||'general');
   if(message.length<8||message.length>700||!categories.has(topic)){json(res,400,{error:'Write 8–700 characters and choose a discussion room'});return true}
   const id=randomUUID();
   await pool.query("INSERT INTO community_posts(id,name,topic,message,official,pinned) VALUES($1,'THE EVENING WIRE',$2,$3,true,true)",[id,topic,message]);
   announceHubUpdate('messages');json(res,201,{ok:true,id});return true
  }
 }
 return false
}
