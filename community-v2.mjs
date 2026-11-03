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

// Strict, bounded inline photo decoder: accepts only browser-displayable raster data.
// SVG/HTML are never accepted. The client resizes pictures before transmission.
export function decodeCommunityImage(value){
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='string'||value.length>2100000)throw Error('Image is too large (1.5 MB maximum after resizing).');
 const m=value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!m)throw Error('Choose a JPEG, PNG, or WebP picture, not an unsupported file.');
 const bytes=Buffer.from(m[2],'base64');
 if(bytes.length<20||bytes.length>1500000||m[2].length!==Math.ceil(bytes.length/3)*4)throw Error('Picture is too large or invalid.');
 const typ=m[1];
 const matches=typ==='image/jpeg'?bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff:
  typ==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
  bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP';
 if(!matches)throw Error('The picture file does not match its image type.');
 return {bytes,mediaType:typ}
}


export function decodeCommunityAudio(value){
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='string'||value.length>2450000)throw Error('Voice note is too large (1.6 MB maximum).');
 const m=value.match(/^data:(audio\/(?:webm|mp4|ogg))(?:;codecs=[a-z0-9.,-]+)?;base64,([A-Za-z0-9+/]+={0,2})$/i);
 if(!m)throw Error('Voice note must be recorded as WebM, MP4 or Ogg audio.');
 const bytes=Buffer.from(m[2],'base64');
 if(bytes.length<30||bytes.length>1600000||m[2].length!==Math.ceil(bytes.length/3)*4)throw Error('Voice note is too large or invalid.');
 const typ=m[1].toLowerCase();
 const matches=typ==='audio/webm'?bytes.subarray(0,4).equals(Buffer.from([26,69,223,163])):
  typ==='audio/mp4'?bytes.subarray(4,8).toString('ascii')==='ftyp':
  bytes.subarray(0,4).toString('ascii')==='OggS';
 if(!matches)throw Error('The audio file does not match the expected recording type.');
 return {bytes,mediaType:typ}
}


export function decodeCommunityVideo(value){
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='string'||value.length>17000000)throw Error('Video clip is too large. Choose a file below 12 MB.');
 const m=value.match(/^data:(video\/(?:mp4|webm));base64,([A-Za-z0-9+/]+={0,2})$/i);
 if(!m)throw Error('Choose an MP4 or WebM video. Other video formats are not supported.');
 const bytes=Buffer.from(m[2],'base64');
 if(bytes.length<32||bytes.length>12000000||m[2].length!==Math.ceil(bytes.length/3)*4)throw Error('Video must be a valid clip below 12 MB.');
 const typ=m[1].toLowerCase();
 const matches=typ==='video/mp4'?bytes.subarray(4,8).toString('ascii')==='ftyp':
  bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]));
 if(!matches)throw Error('Video contents do not match the declared file type.');
 return {bytes,mediaType:typ}
}

export function announceHubUpdate(type='messages'){
 for(const response of [...listeners]){try{response.write('event: change\ndata: '+JSON.stringify({type})+'\n\n')}catch{listeners.delete(response)}}
}
export async function setupCommunityV2(pool){
 await pool.query("CREATE TABLE IF NOT EXISTS community_images(id uuid PRIMARY KEY,member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,media_type varchar(24) NOT NULL,image_data bytea NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
 await pool.query("CREATE INDEX IF NOT EXISTS ew_community_images_member_recent ON community_images(member_id,created_at DESC)");
 await pool.query("ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS image_id uuid REFERENCES community_images(id) ON DELETE SET NULL");
 await pool.query("CREATE TABLE IF NOT EXISTS community_audio(id uuid PRIMARY KEY,member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,media_type varchar(24) NOT NULL,audio_data bytea NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
 await pool.query("CREATE INDEX IF NOT EXISTS ew_community_audio_member_recent ON community_audio(member_id,created_at DESC)");
 await pool.query("ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS audio_id uuid REFERENCES community_audio(id) ON DELETE SET NULL");
 await pool.query("CREATE TABLE IF NOT EXISTS community_videos(id uuid PRIMARY KEY,member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,media_type varchar(24) NOT NULL,video_data bytea NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
 await pool.query("CREATE INDEX IF NOT EXISTS ew_community_video_member_recent ON community_videos(member_id,created_at DESC)");
 await pool.query("ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS video_id uuid REFERENCES community_videos(id) ON DELETE SET NULL");
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
 if(/^images\/[0-9a-f-]{36}$/.test(route)&&req.method==='GET'){
  const id=route.slice('images/'.length);
  const found=await pool.query("SELECT i.media_type,i.image_data FROM community_images i JOIN community_posts p ON p.image_id=i.id WHERE i.id=$1 AND p.status='visible' LIMIT 1",[id]);
  if(!found.rowCount){json(res,404,{error:'Photo unavailable'});return true}
  const image=found.rows[0],data=image.image_data;
  res.writeHead(200,{'Content-Type':image.media_type,'Content-Length':Buffer.byteLength(data),'Cache-Control':'private, max-age=120','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox"});
  res.end(data);return true
 }
 if(/^audio\/[0-9a-f-]{36}$/.test(route)&&req.method==='GET'){
  const id=route.slice('audio/'.length);
  const found=await pool.query("SELECT a.media_type,a.audio_data FROM community_audio a JOIN community_posts p ON p.audio_id=a.id WHERE a.id=$1 AND p.status='visible' LIMIT 1",[id]);
  if(!found.rowCount){json(res,404,{error:'Voice note unavailable'});return true}
  const audio=found.rows[0],data=Buffer.from(audio.audio_data),total=data.length;
  const headers={'Content-Type':audio.media_type,'Accept-Ranges':'bytes','Cache-Control':'private, max-age=120','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox"};
  const range=String(req.headers.range||'');
  if(range){
   const m=range.match(/^bytes=(\d*)-(\d*)$/);
   if(!m||(!m[1]&&!m[2])){res.writeHead(416,{...headers,'Content-Range':'bytes */'+total});res.end();return true}
   let start=m[1]?Number(m[1]):Math.max(0,total-Number(m[2]));
   let end=m[2]&&m[1]?Math.min(total-1,Number(m[2])):total-1;
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=total){
    res.writeHead(416,{...headers,'Content-Range':'bytes */'+total});res.end();return true
   }
   res.writeHead(206,{...headers,'Content-Range':'bytes '+start+'-'+end+'/'+total,'Content-Length':end-start+1});
   res.end(data.subarray(start,end+1));return true
  }
  res.writeHead(200,{...headers,'Content-Length':total});res.end(data);return true
 }
 if(/^videos\/[0-9a-f-]{36}$/.test(route)&&req.method==='GET'){
  const id=route.slice('videos/'.length);
  const found=await pool.query("SELECT v.media_type,v.video_data FROM community_videos v JOIN community_posts p ON p.video_id=v.id WHERE v.id=$1 AND p.status='visible' LIMIT 1",[id]);
  if(!found.rowCount){json(res,404,{error:'Video unavailable'});return true}
  const video=found.rows[0],data=Buffer.from(video.video_data),total=data.length;
  const headers={'Content-Type':video.media_type,'Accept-Ranges':'bytes','Cache-Control':'private, max-age=120','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox"};
  const range=String(req.headers.range||'');
  if(range){
   const m=range.match(/^bytes=(\d*)-(\d*)$/);
   if(!m||(!m[1]&&!m[2])){res.writeHead(416,{...headers,'Content-Range':'bytes */'+total});res.end();return true}
   const start=m[1]?Number(m[1]):Math.max(0,total-Number(m[2]));
   const end=m[2]&&m[1]?Math.min(total-1,Number(m[2])):total-1;
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=total){res.writeHead(416,{...headers,'Content-Range':'bytes */'+total});res.end();return true}
   res.writeHead(206,{...headers,'Content-Range':'bytes '+start+'-'+end+'/'+total,'Content-Length':end-start+1});
   res.end(data.subarray(start,end+1));return true
  }
  res.writeHead(200,{...headers,'Content-Length':total});res.end(data);return true
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
