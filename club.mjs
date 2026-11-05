// THE LOUNGE — persistent Clubhouse features; additive migrations only.
import {randomUUID} from 'node:crypto';
import {Pool} from './local-db-pool.mjs';
import {postgresTLS,postgresConnectionString} from './postgres-tls.mjs';
import {authenticatedMember} from './members.mjs';
import {isEditorAdmin} from './editor-calls.mjs';
import {newsroom} from './newsroom.mjs';
import {historicalEventsReader} from './history-reader.mjs';

const source=process.env.DATABASE_URL||process.env.REACTION_DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRESQL_URL||process.env.DB_URL||'';
const rooms=new Set(['general','politics','jewish','world','history','economics','science','questions']);
const debates=[
 'Should the United States have term limits for members of Congress?',
 'Which historical empire had the greatest influence on the modern world?',
 'Should voting in national elections be mandatory?',
 'Is artificial intelligence more of an opportunity or a threat?',
 'Which matters more in political leadership: experience or new ideas?',
 'Should more major decisions be made by local governments?',
 'Is space exploration worth the government investment?',
 'Are social networks improving or harming public debate?',
 'Should public officials be required to participate in debates?',
 'Which period of history would you most want to visit?',
 'Do economic sanctions work better than diplomatic negotiations?',
 'Is it better to elect judges or appoint them?',
 'Should elections use ranked-choice voting?',
 'Which is more important: individual privacy or public security?'
];
const quizzes=[
 ['Which treaty ended World War I for Germany?',['Treaty of Versailles','Treaty of Utrecht','Treaty of Paris','Treaty of Tordesillas'],0,'The Treaty of Versailles was signed in 1919.'],
 ['What is the largest country by land area?',['Canada','Russia','China','United States'],1,'Russia covers the largest land area.'],
 ['Which planet has the most prominent ring system?',['Mars','Venus','Saturn','Mercury'],2,'Saturn is famous for its extensive rings.'],
 ['What year did the Berlin Wall fall?',['1979','1985','1989','1991'],2,'The Berlin Wall opened on November 9, 1989.'],
 ['Which sea separates northeast Africa and the Arabian Peninsula?',['Black Sea','Red Sea','Caspian Sea','Baltic Sea'],1,'The Red Sea lies between Africa and the Arabian Peninsula.'],
 ['How many voting members serve in the U.S. House of Representatives?',['100','400','435','538'],2,'The U.S. House has 435 voting seats.'],
 ['What does GDP stand for?',['General Debt Position','Gross Domestic Product','Global Development Plan','Government Deposit Program'],1,'GDP measures the value of final goods and services produced in an economy.'],
 ['Which element has chemical symbol Au?',['Silver','Aluminum','Gold','Argon'],2,'Au comes from the Latin word aurum.'],
 ['Which ancient city was buried by Mount Vesuvius in AD 79?',['Athens','Pompeii','Carthage','Alexandria'],1,'Pompeii was buried by the volcanic eruption.'],
 ['What is the capital of Australia?',['Sydney','Melbourne','Canberra','Perth'],2,'Canberra is Australia’s capital.'],
 ['In what year did the United States declare independence?',['1776','1787','1812','1765'],0,'The Declaration of Independence was adopted July 4, 1776.'],
 ['Which river flows through Budapest?',['Seine','Danube','Rhine','Nile'],1,'The Danube passes through Budapest, Hungary.'],
 ['What is the most abundant gas in Earth’s atmosphere?',['Oxygen','Nitrogen','Carbon dioxide','Argon'],1,'Nitrogen makes up about 78% of the atmosphere.'],
 ['Who was the first U.S. president?',['Thomas Jefferson','George Washington','John Adams','James Madison'],1,'George Washington became president in 1789.']
];
const today=()=>{
 const values=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return values.year+'-'+values.month+'-'+values.day;
};
const dayNumber=key=>Math.floor(Date.parse(key+'T00:00:00Z')/86400000);
const debateToday=()=>({date:today(),question:debates[((dayNumber(today())%debates.length)+debates.length)%debates.length]});
const quizToday=()=>{const d=today(),q=quizzes[((dayNumber(d)%quizzes.length)+quizzes.length)%quizzes.length];return {date:d,question:q[0],options:q[1]}};
let pool=null,connecting=null;
async function ensure(){
 if(pool)return pool;
 if(connecting)return connecting;
 connecting=(async()=>{
  if(!source)throw Error('PostgreSQL is not configured');
  const db=new Pool({connectionString:postgresConnectionString(source),ssl:postgresTLS(source),max:3,connectionTimeoutMillis:8000});
  try{
   await db.query("CREATE TABLE IF NOT EXISTS club_posts(id uuid PRIMARY KEY,member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,kind varchar(20) NOT NULL,room varchar(32) NOT NULL DEFAULT 'general',message varchar(1200) NOT NULL,side varchar(12),parent_id uuid REFERENCES club_posts(id) ON DELETE CASCADE,anonymous boolean NOT NULL DEFAULT false,day_key varchar(10),status varchar(12) NOT NULL DEFAULT 'visible',created_at timestamptz NOT NULL DEFAULT now())");
   await db.query("CREATE INDEX IF NOT EXISTS club_posts_recent ON club_posts(created_at DESC)");
   await db.query("CREATE TABLE IF NOT EXISTS club_post_likes(post_id uuid NOT NULL REFERENCES club_posts(id) ON DELETE CASCADE,member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,PRIMARY KEY(post_id,member_id))");
   await db.query("CREATE TABLE IF NOT EXISTS club_polls(id uuid PRIMARY KEY,member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,question varchar(250) NOT NULL,options jsonb NOT NULL,closes_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
   await db.query("CREATE TABLE IF NOT EXISTS club_poll_votes(poll_id uuid NOT NULL REFERENCES club_polls(id) ON DELETE CASCADE,member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,choice integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(poll_id,member_id))");
   await db.query("CREATE TABLE IF NOT EXISTS club_predictions(id uuid PRIMARY KEY,member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,question varchar(250) NOT NULL,closes_at timestamptz NOT NULL,outcome boolean,created_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz)");
   await db.query("CREATE TABLE IF NOT EXISTS club_prediction_votes(prediction_id uuid NOT NULL REFERENCES club_predictions(id) ON DELETE CASCADE,member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,answer boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(prediction_id,member_id))");
   await db.query("CREATE TABLE IF NOT EXISTS club_quiz_answers(member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,day_key varchar(10) NOT NULL,choice integer NOT NULL,correct boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(member_id,day_key))");
   await db.query("CREATE TABLE IF NOT EXISTS club_profiles(member_id uuid PRIMARY KEY REFERENCES ew_members(id) ON DELETE CASCADE,bio varchar(240) NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now())");
   pool=db;console.log('CLUBHOUSE_DB_READY');return pool;
  }catch(err){await db.end().catch(()=>{});throw err}
 })().finally(()=>{connecting=null});
 return connecting;
}
const send=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};
const validId=x=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(x||''));
const clean=x=>String(x||'').trim().replace(/\s+/g,' ');
const allowedOrigin=req=>!req.headers.origin||['https://'+req.headers.host,'http://'+req.headers.host].includes(req.headers.origin);
async function body(req){let s='';for await(const chunk of req){s+=chunk;if(s.length>10000)throw Error('Request too large')}try{return JSON.parse(s||'{}')}catch{throw Error('Invalid JSON')}}
const hit=new Map();
function rate(member,key,max=10){const k=member.id+':'+key,n=Date.now(),p=hit.get(k);if(!p||n-p.at>600000){hit.set(k,{at:n,count:1});return true}if(p.count>=max)return false;p.count++;return true}
setInterval(()=>{for(const [k,v] of hit)if(Date.now()-v.at>1200000)hit.delete(k)},600000).unref();
function closeTime(value){
 const stamp=Date.parse(String(value||''));
 if(!Number.isFinite(stamp)||stamp<Date.now()+3600000||stamp>Date.now()+90*86400000)return null;
 return new Date(stamp).toISOString();
}
async function snapshot(member){
 const uid=member?.id||null;
 const [postsQ,pollsQ,pollVotesQ,predQ,predVotesQ,likeQ,quizQ,profileQ,allScoresQ]=await Promise.all([
  pool.query("SELECT p.id,p.kind,p.room,p.message,p.side,p.parent_id,p.anonymous,p.day_key,p.created_at,CASE WHEN p.anonymous THEN 'Anonymous' ELSE m.display_name END AS name,CASE WHEN p.anonymous THEN null ELSE m.id END AS member_id,CASE WHEN p.anonymous THEN null ELSE av.updated_at END AS avatar_updated_at,(SELECT count(*)::integer FROM club_post_likes l WHERE l.post_id=p.id) AS likes FROM club_posts p JOIN ew_members m ON m.id=p.member_id LEFT JOIN ew_member_avatars av ON av.member_id=m.id WHERE p.status='visible' ORDER BY p.created_at DESC LIMIT 160"),
  pool.query("SELECT p.id,p.question,p.options,p.closes_at,p.created_at,m.display_name AS author FROM club_polls p JOIN ew_members m ON m.id=p.member_id ORDER BY p.created_at DESC LIMIT 35"),
  pool.query("SELECT v.poll_id,v.choice,count(*)::integer AS votes FROM club_poll_votes v WHERE v.poll_id IN (SELECT id FROM club_polls ORDER BY created_at DESC LIMIT 35) GROUP BY v.poll_id,v.choice"),
  pool.query("SELECT p.id,p.question,p.closes_at,p.outcome,p.created_at,m.display_name AS author FROM club_predictions p JOIN ew_members m ON m.id=p.member_id ORDER BY p.created_at DESC LIMIT 35"),
  pool.query("SELECT prediction_id,answer,count(*)::integer AS votes FROM club_prediction_votes WHERE prediction_id IN (SELECT id FROM club_predictions ORDER BY created_at DESC LIMIT 35) GROUP BY prediction_id,answer"),
  uid?pool.query('SELECT post_id FROM club_post_likes WHERE member_id=$1',[uid]):Promise.resolve({rows:[]}),
  uid?pool.query('SELECT choice,correct FROM club_quiz_answers WHERE member_id=$1 AND day_key=$2',[uid,today()]):Promise.resolve({rows:[]}),
  uid?pool.query('SELECT bio FROM club_profiles WHERE member_id=$1',[uid]):Promise.resolve({rows:[]}),
  pool.query("SELECT m.id,m.display_name,COALESCE(pr.bio,'') AS bio,av.updated_at AS avatar_updated_at,COALESCE(p.posts,0)::integer AS post_count,COALESCE(l.likes,0)::integer AS like_count,COALESCE(q.correct,0)::integer AS quiz_count,COALESCE(v.correct,0)::integer AS prediction_count FROM ew_members m LEFT JOIN club_profiles pr ON pr.member_id=m.id LEFT JOIN ew_member_avatars av ON av.member_id=m.id LEFT JOIN (SELECT member_id,count(*) AS posts FROM club_posts WHERE status='visible' GROUP BY member_id) p ON p.member_id=m.id LEFT JOIN (SELECT cp.member_id,count(*) AS likes FROM club_post_likes pl JOIN club_posts cp ON cp.id=pl.post_id WHERE cp.status='visible' GROUP BY cp.member_id) l ON l.member_id=m.id LEFT JOIN (SELECT member_id,count(*) AS correct FROM club_quiz_answers WHERE correct=true GROUP BY member_id) q ON q.member_id=m.id LEFT JOIN (SELECT pv.member_id,count(*) AS correct FROM club_prediction_votes pv JOIN club_predictions pr ON pr.id=pv.prediction_id WHERE pr.outcome IS NOT NULL AND pr.outcome=pv.answer GROUP BY pv.member_id) v ON v.member_id=m.id")
 ]);
 const posts=postsQ.rows.map(p=>({...p,avatarUrl:p.member_id&&p.avatar_updated_at?'/api/members/avatar/'+p.member_id+'?v='+new Date(p.avatar_updated_at).getTime():null}));
 const myLikes=new Set(likeQ.rows.map(x=>x.post_id));
 const pollCounts=new Map();for(const v of pollVotesQ.rows){if(!pollCounts.has(v.poll_id))pollCounts.set(v.poll_id,{});pollCounts.get(v.poll_id)[v.choice]=v.votes}
 const predictionCounts=new Map();for(const v of predVotesQ.rows){if(!predictionCounts.has(v.prediction_id))predictionCounts.set(v.prediction_id,{});predictionCounts.get(v.prediction_id)[String(v.answer)]=v.votes}
 const mine=uid?await Promise.all([
   pool.query('SELECT poll_id,choice FROM club_poll_votes WHERE member_id=$1',[uid]),
   pool.query('SELECT prediction_id,answer FROM club_prediction_votes WHERE member_id=$1',[uid])
 ]):[{rows:[]},{rows:[]}];
 const myPolls=Object.fromEntries(mine[0].rows.map(x=>[x.poll_id,x.choice]));
 const myPredictions=Object.fromEntries(mine[1].rows.map(x=>[x.prediction_id,x.answer]));
 const polls=pollsQ.rows.map(p=>({...p,counts:pollCounts.get(p.id)||{},myVote:Object.hasOwn(myPolls,p.id)?myPolls[p.id]:null,closed:new Date(p.closes_at).getTime()<=Date.now()}));
 const predictions=predQ.rows.map(p=>({...p,counts:predictionCounts.get(p.id)||{},myVote:Object.hasOwn(myPredictions,p.id)?myPredictions[p.id]:null,closed:new Date(p.closes_at).getTime()<=Date.now()}));
 const leaderboard=allScoresQ.rows.map(r=>({...r,score:Number(r.post_count)*2+Number(r.like_count)+Number(r.quiz_count)*10+Number(r.prediction_count)*20,avatarUrl:r.avatar_updated_at?'/api/members/avatar/'+r.id+'?v='+new Date(r.avatar_updated_at).getTime():null})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.display_name.localeCompare(b.display_name)).slice(0,50);
 const debate=debateToday(),quiz=quizToday();
 return {date:today(),signedIn:!!member,member:member?{id:uid,displayName:member.displayName,avatarUrl:member.avatarUrl||null}:null,debate,quiz:{...quiz,answered:quizQ.rows.length?quizQ.rows[0]:null},bio:profileQ.rows[0]?.bio||'',posts:posts.map(p=>({...p,liked:myLikes.has(p.id)})),polls,predictions,leaderboard};
}

export async function clubRoute(req,res,path,legacyStories=[]){
 if(!path.startsWith('/api/club/'))return false;
 if(!['GET','POST'].includes(req.method)){send(res,405,{error:'Method not allowed'});return true}
 if(req.method==='POST'&&!allowedOrigin(req)){send(res,403,{error:'Origin not allowed'});return true}
 if(path==='/api/club/news'&&req.method==='GET'){
  const force=new URL(req.url,'http://localhost').searchParams.get('refresh')==='1';
  const result=await newsroom({force});
  if(result.stories.length){send(res,200,result);return true}
  // Secondary engine: independent publisher collection used by the existing site.
  // Only expose public, attributed stories with genuine recent timestamps.
  const cutoff=Date.now()-72*3600000;
  const fallback=(Array.isArray(legacyStories)?legacyStories:[]).filter(x=>x&&typeof x.title==='string'&&typeof x.url==='string'&&/^https:\/\//i.test(x.url)&&Date.parse(x.published)>=cutoff&&Date.parse(x.published)<=Date.now()+3600000).sort((a,b)=>Date.parse(b.published)-Date.parse(a.published)).slice(0,50).map(x=>({title:x.title,url:x.url,published:x.published,source:x.source||'Publisher',topic:'United States',excerpt:String(x.excerpt||'').slice(0,220)}));
  send(res,200,{...result,stories:fallback,unavailable:fallback.length===0,fallback:fallback.length>0,fallbackSource:'Existing Lounge news collector'});
  return true;
 }
 if(path==='/api/club/history'&&req.method==='GET'){const force=new URL(req.url,'http://localhost').searchParams.get('refresh')==='1';send(res,200,await historicalEventsReader({force}));return true}
 if((path==='/api/club/daily'||path==='/api/club/quiz-today')&&req.method==='GET'){
  const daily={date:today(),quiz:quizToday(),debate:debateToday(),ready:true};
  send(res,200,path==='/api/club/quiz-today'?daily.quiz:daily);return true;
 }
 try{await ensure()}catch(e){console.warn('CLUBHOUSE_DB_UNAVAILABLE',e.message);send(res,503,{error:'The Lounge database is not available. Existing messages have not been changed.'});return true}
 const route=path.slice('/api/club/'.length);
 try{
  const member=await authenticatedMember(req);
  if(route==='dashboard'&&req.method==='GET'){send(res,200,await snapshot(member));return true}
  if(!member){send(res,401,{error:'Sign in to participate.',login:'/login'});return true}
  if(req.method==='POST'&&!rate(member,route,15)){send(res,429,{error:'Too many actions; try again shortly.'});return true}
  if(route==='profile'&&req.method==='POST'){
   const data=await body(req),bio=clean(data.bio);
   if(bio.length>240){send(res,400,{error:'Biography must be under 240 characters.'});return true}
   await pool.query("INSERT INTO club_profiles(member_id,bio) VALUES($1,$2) ON CONFLICT(member_id) DO UPDATE SET bio=EXCLUDED.bio,updated_at=now()",[member.id,bio]);
   send(res,200,{ok:true});return true
  }
  if(route==='posts'&&req.method==='POST'){
   const d=await body(req),kind=String(d.kind||'room'),message=clean(d.message),room=String(d.room||'general'),side=String(d.side||''),parent=validId(d.parentId)?d.parentId:null;
   if(!['room','question','debate','announcement'].includes(kind)||message.length<3||message.length>1200){send(res,400,{error:'Write 3–1,200 characters and choose a valid post type.'});return true}
   if(kind==='room'&&!rooms.has(room)){send(res,400,{error:'Choose an available discussion room.'});return true}
   if(kind==='debate'&&!['yes','no'].includes(side)){send(res,400,{error:'Choose a debate side.'});return true}
   if(kind==='announcement'&&!await isEditorAdmin(req)){send(res,403,{error:'Owner access required.'});return true}
   if(parent){
    const q=await pool.query("SELECT kind FROM club_posts WHERE id=$1 AND status='visible'",[parent]);
    if(!q.rows.length||q.rows[0].kind!==kind||kind==='announcement'){send(res,400,{error:'Choose an existing conversation to reply to.'});return true}
   }
   const postId=randomUUID();
   await pool.query('INSERT INTO club_posts(id,member_id,kind,room,message,side,parent_id,anonymous,day_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[postId,member.id,kind,kind==='room'?room:'general',message,kind==='debate'?side:null,parent,kind==='question'&&Boolean(d.anonymous),kind==='debate'?today():null]);
   send(res,201,{ok:true,id:postId});return true
  }
  const like=route.match(/^posts\/([a-f0-9-]{36})\/like$/i);
  if(like&&req.method==='POST'){
   const id=like[1];const p=await pool.query("SELECT id FROM club_posts WHERE id=$1 AND status='visible'",[id]);
   if(!p.rows.length){send(res,404,{error:'Post not found'});return true}
   const q=await pool.query('DELETE FROM club_post_likes WHERE post_id=$1 AND member_id=$2 RETURNING post_id',[id,member.id]);
   if(!q.rowCount)await pool.query('INSERT INTO club_post_likes(post_id,member_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,member.id]);
   send(res,200,{ok:true,liked:!q.rowCount});return true
  }
  if(route==='polls'&&req.method==='POST'){
   const d=await body(req),question=clean(d.question),options=Array.isArray(d.options)?d.options.map(clean).filter(Boolean):[],closes=closeTime(d.closesAt);
   if(question.length<10||question.length>250||options.length<2||options.length>5||options.some(x=>x.length>100)||new Set(options.map(x=>x.toLowerCase())).size!==options.length||!closes){send(res,400,{error:'Add a 10–250 character question, 2–5 different options and a deadline within 90 days.'});return true}
   const id=randomUUID();await pool.query('INSERT INTO club_polls(id,member_id,question,options,closes_at) VALUES($1,$2,$3,$4::jsonb,$5)',[id,member.id,question,JSON.stringify(options),closes]);send(res,201,{ok:true,id});return true
  }
  const pollVote=route.match(/^polls\/([a-f0-9-]{36})\/vote$/i);
  if(pollVote&&req.method==='POST'){
   const d=await body(req),choice=Number(d.choice),q=await pool.query('SELECT options,closes_at FROM club_polls WHERE id=$1',[pollVote[1]]);
   if(!q.rows.length){send(res,404,{error:'Poll not found'});return true}
   if(Date.parse(q.rows[0].closes_at)<=Date.now()){send(res,409,{error:'Voting has closed.'});return true}
   if(!Number.isInteger(choice)||choice<0||choice>=q.rows[0].options.length){send(res,400,{error:'Choose a valid option.'});return true}
   const v=await pool.query('INSERT INTO club_poll_votes(poll_id,member_id,choice) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING choice',[pollVote[1],member.id,choice]);
   send(res,v.rowCount?200:409,v.rowCount?{ok:true}:{error:'You already voted.'});return true
  }
  if(route==='predictions'&&req.method==='POST'){
   const d=await body(req),question=clean(d.question),closes=closeTime(d.closesAt);
   if(question.length<10||question.length>250||!closes){send(res,400,{error:'Enter a yes-or-no prediction and a deadline within 90 days.'});return true}
   const id=randomUUID();await pool.query('INSERT INTO club_predictions(id,member_id,question,closes_at) VALUES($1,$2,$3,$4)',[id,member.id,question,closes]);send(res,201,{ok:true,id});return true
  }
  const predict=route.match(/^predictions\/([a-f0-9-]{36})\/vote$/i);
  if(predict&&req.method==='POST'){
   const d=await body(req),q=await pool.query('SELECT closes_at,outcome FROM club_predictions WHERE id=$1',[predict[1]]);
   if(!q.rows.length){send(res,404,{error:'Prediction not found'});return true}
   if(q.rows[0].outcome!==null||Date.parse(q.rows[0].closes_at)<=Date.now()){send(res,409,{error:'Predictions are closed.'});return true}
   if(typeof d.answer!=='boolean'){send(res,400,{error:'Choose Yes or No.'});return true}
   const v=await pool.query('INSERT INTO club_prediction_votes(prediction_id,member_id,answer) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING answer',[predict[1],member.id,d.answer]);
   send(res,v.rowCount?200:409,v.rowCount?{ok:true}:{error:'You already predicted.'});return true
  }
  const resolve=route.match(/^predictions\/([a-f0-9-]{36})\/resolve$/i);
  if(resolve&&req.method==='POST'){
   if(!await isEditorAdmin(req)){send(res,403,{error:'Owner access required.'});return true}
   const d=await body(req);
   if(typeof d.outcome!=='boolean'){send(res,400,{error:'Set a Yes or No result.'});return true}
   const r=await pool.query('UPDATE club_predictions SET outcome=$2,resolved_at=now() WHERE id=$1 AND outcome IS NULL AND closes_at<=now() RETURNING id',[resolve[1],d.outcome]);
   send(res,r.rowCount?200:409,r.rowCount?{ok:true}:{error:'Outcome already resolved or voting has not closed.'});return true
  }
  if(route==='quiz'&&req.method==='POST'){
   const d=await body(req),q=quizzes[((dayNumber(today())%quizzes.length)+quizzes.length)%quizzes.length],choice=Number(d.choice);
   if(!Number.isInteger(choice)||choice<0||choice>=q[1].length){send(res,400,{error:'Choose one of the four answers.'});return true}
   const correct=choice===q[2],result=await pool.query('INSERT INTO club_quiz_answers(member_id,day_key,choice,correct) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING choice',[member.id,today(),choice,correct]);
   if(!result.rowCount){send(res,409,{error:'Today’s question is already answered.'});return true}
   send(res,200,{ok:true,correct,correctAnswer:q[2],explanation:q[3]});return true
  }
  const hide=route.match(/^posts\/([a-f0-9-]{36})\/hide$/i);
  if(hide&&req.method==='POST'){
   if(!await isEditorAdmin(req)){send(res,403,{error:'Owner access required.'});return true}
   const updated=await pool.query("UPDATE club_posts SET status='hidden' WHERE id=$1 RETURNING id",[hide[1]]);send(res,updated.rowCount?200:404,{ok:!!updated.rowCount});return true
  }
  send(res,404,{error:'Unknown Lounge feature.'});return true
 }catch(err){
  console.error('CLUBHOUSE_API',String(err?.message||err).slice(0,300));
  send(res,err.message==='Invalid JSON'||err.message==='Request too large'?400:500,{error:err.message==='Invalid JSON'||err.message==='Request too large'?err.message:'The Lounge could not complete that action.'});
  return true
 }
}
