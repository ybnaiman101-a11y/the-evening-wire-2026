/* THE LOUNGE — Clubhouse front end: all tabs are real hash links, not dead buttons. */
(function(){
'use strict';
const main=document.getElementById('clubContent'),nav=document.getElementById('clubNav'),flash=document.getElementById('flash');
const tabs=[
 ['debate','⚖','Daily Debate','Take a side in today’s big question.'],
 ['polls','◉','Polling Station','Create polls and watch the votes come in.'],
 ['leaderboard','🏆','Leaderboard','See the top contributors each week.'],
 ['quiz','🧠','Quiz Arena','A new question every day.'],
 ['predictions','🔮','Prediction Center','Make forecasts and build your accuracy record.'],
 ['rooms','💬','Hangout Rooms','Real conversations with friends.'],
 ['profiles','👤','Member Profiles','Your bio, photo, and friends.'],
 ['news','🗞','News Desk','Headlines and the conversations behind them.'],
 ['trending','↗',"What's Trending",'The most active posts and rooms.'],
 ['history','📜','On This Day','Discover something from the past.'],
 ['questions','❔','Ask the Lounge','Ask publicly or anonymously.'],
 ['owner','✦',"Owner's Corner",'Announcements and community controls.']
];
const channels=[
 ['general','💬','General Discussion'],['politics','🏛️','Politics'],['jewish','✡️','Hasidic & Jewish Life'],
 ['world','🌍','World Affairs'],['history','📜','History & Geography'],['economics','📈','Economics & Markets'],
 ['science','🔬','Science & Ideas'],['questions','❔','Questions & Debates']
];
let db=null,stories=[],admin=false,activeRoom='general',historyFacts=null,quizFeedback=null,loading=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>{const d=new Date(s);return Number.isFinite(d.getTime())?d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Recently'};
const day=s=>new Date(s).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
const avatar=p=>'<span class="avatar">'+(p.avatarUrl&&/^\/api\/members\/avatar\/[a-f0-9-]{36}\?v=\d+$/i.test(p.avatarUrl)?'<img alt="" src="'+esc(p.avatarUrl)+'" loading="lazy">':esc((p.display_name||p.name||p.displayName||'?')[0]).toUpperCase())+'</span>';
const empty=s=>'<div class="empty">'+esc(s)+'</div>';
const head=(t,p)=>'<div class="pagehead"><div><span class="eyebrow">THE LOUNGE / CLUBHOUSE</span><h1>'+esc(t)+'</h1><p>'+esc(p||'')+'</p></div><span class="chip">'+esc(db?.date||'')+'</span></div>';
function say(msg,error=false){flash.hidden=false;flash.textContent=(error?'⚠ ':'✓ ')+msg;flash.style.borderColor=error?'#d28f96':'#6ee5ee';clearTimeout(say.timer);say.timer=setTimeout(()=>flash.hidden=true,4800)}
async function api(url,method='GET',data){
 const r=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 let obj={};try{obj=await r.json()}catch{}if(!r.ok)throw Error(obj.error||'Could not connect. Try again.');return obj
}
function signed(){if(db?.signedIn)return true;location.href='/login';return false}
function post(p){
 const reply=p.parent_id?' reply':'';
 const canReply=['room','debate','question'].includes(p.kind)&&!p.parent_id;
 const label=p.side?'<span class="side '+(p.side==='yes'?'yes':'no')+'">'+esc(p.side.toUpperCase())+'</span>':'';
 return '<article class="post'+reply+'" id="post-'+esc(p.id)+'"><div class="post-head">'+avatar(p)+'<strong>'+esc(p.name)+'</strong>'+label+'<time>'+esc(fmt(p.created_at))+'</time></div><p>'+esc(p.message)+'</p><div class="post-actions"><button type="button" data-like="'+esc(p.id)+'">'+(p.liked?'♥':'♡')+' '+Number(p.likes||0)+'</button>'+(canReply?'<button type="button" data-reply-toggle="'+esc(p.id)+'">↩ Reply</button>':'')+(admin?'<button type="button" class="danger" data-hide-post="'+esc(p.id)+'">Hide</button>':'')+'</div>'+(canReply?'<form data-reply-form="'+esc(p.id)+'" hidden><input name="reply" required minlength="3" maxlength="1200" placeholder="Write a respectful reply…"><button type="submit">SEND REPLY</button></form>':'')+'</article>'
}
function postsFor(kind,room=null){
 if(!db)return '';
 const all=db.posts.filter(p=>p.kind===kind&&(room===null||p.room===room)&&(kind!=='debate'||p.day_key===db.date));
 const mainPosts=all.filter(p=>!p.parent_id);
 return mainPosts.map(p=>post(p)+all.filter(r=>r.parent_id===p.id).reverse().map(post).join('')).join('')||empty('No messages yet. Start the conversation!')
}
function home(){
 return '<div class="hero"><span class="eyebrow">WELCOME BACK TO YOUR SOCIAL CLUB</span><h1>Your people.<br><em>Your conversations.</em></h1><p>Debate, vote, compete, predict and discover something new together. The Pulse and your existing messages are still right where you left them.</p><div class="hero-actions"><a href="#debate">TODAY’S DEBATE ↗</a><a href="/#pulse">OPEN THE PULSE ↗</a></div></div>'
 +'<div class="pagehead"><div><span class="eyebrow">ALL 12 FEATURES</span><h1 style="font-size:29px">Explore the Clubhouse</h1></div><span class="chip">'+(db?.signedIn?'SIGNED IN':'GUEST VIEW')+'</span></div>'
 +'<div class="tiles">'+tabs.map(t=>'<a class="tile" href="#'+t[0]+'"><span class="tile-icon">'+t[1]+'</span><h3>'+esc(t[2])+'</h3><p>'+esc(t[3])+'</p></a>').join('')+'</div>';
}
function debate(){
 const d=db.debate;
 return head('Daily Debate','One question every day. Choose a side, defend your reasoning, and discuss respectfully.')
 +'<section class="surface"><span class="eyebrow">TODAY’S QUESTION</span><h2 style="font-size:clamp(25px,3vw,36px);margin:13px 0">'+esc(d.question)+'</h2>'
 +'<form id="debateForm"><label>Your position<select name="side" required><option value="yes">YES / AGREE</option><option value="no">NO / DISAGREE</option></select></label><label>Your argument<textarea name="message" required maxlength="1200" minlength="3" placeholder="Explain why you chose that side…"></textarea></label><button type="submit">POST MY ARGUMENT</button></form></section>'
 +'<section class="surface"><h2>Member arguments</h2>'+postsFor('debate')+'</section>';
}
function polls(){
 return head('Polling Station','Create a poll, let friends choose, and see real results.')
 +'<div class="two"><section class="surface"><h2>Create a poll</h2><form id="pollForm"><label>Your question<input name="question" required minlength="10" maxlength="250" placeholder="What do you think about…?"></label><label>Choice 1<input name="one" required maxlength="100"></label><label>Choice 2<input name="two" required maxlength="100"></label><label>Choice 3 (optional)<input name="three" maxlength="100"></label><label>Choice 4 (optional)<input name="four" maxlength="100"></label><label>Closes in<select name="days"><option value="1">1 day</option><option value="3">3 days</option><option selected value="7">7 days</option><option value="30">30 days</option></select></label><button type="submit">PUBLISH POLL</button></form></section><section class="surface"><h2>How voting works</h2><p>Each signed-in member gets one vote per poll. The percentages appear after voting or when a poll closes.</p><p>The creator cannot change submitted votes. Polls stay saved in the Lounge database.</p><a class="smalllink" href="/#polls">See the original Lounge polls ↗</a></section></div>'
 +'<section class="surface"><h2>Community polls</h2>'+(db.polls.length?db.polls.map(p=>{
   const voted=p.myVote!==null,results=voted||p.closed,total=Object.values(p.counts).reduce((a,b)=>a+Number(b),0);
   return '<article class="post"><div class="row between"><strong>'+esc(p.question)+'</strong><span class="chip">'+(p.closed?'CLOSED':'OPEN')+'</span></div><p class="muted">By '+esc(p.author)+' · Closes '+esc(fmt(p.closes_at))+'</p>'
   +p.options.map((option,i)=>{const pct=total?Math.round(100*Number(p.counts[i]||0)/total):0;return '<button class="option" data-poll-vote="'+esc(p.id)+'" data-choice="'+i+'" '+(results?'disabled':'')+'><span>'+esc(option)+(results?' · '+pct+'%':'')+'</span><i style="width:'+(results?pct:0)+'%"></i></button>'}).join('')+'<span class="hint">'+total+' votes'+(voted?' · YOUR VOTE RECORDED':'')+'</span></article>'
 }).join(''):empty('No polls yet. Be the first to create one!'))+'</section>';
}
function leaderboard(){
 return head('Lounge Leaderboard','Earn points by contributing, receiving likes, answering quizzes and predicting correctly.')
 +'<section class="surface"><div class="row between"><h2>Top members</h2><span class="chip">ALL-TIME RANKINGS</span></div>'
 +(db.leaderboard.length?'<div style="overflow-x:auto"><table class="scoreboard"><thead><tr><th>RANK</th><th>MEMBER</th><th>POSTS</th><th>LIKES</th><th>QUIZ</th><th>PREDICTIONS</th><th>POINTS</th></tr></thead><tbody>'+db.leaderboard.map((p,i)=>'<tr><td>'+(i+1)+'</td><td><div class="name">'+avatar(p)+'<strong>'+esc(p.display_name)+'</strong></div></td><td>'+p.post_count+'</td><td>'+p.like_count+'</td><td>'+p.quiz_count+'</td><td>'+p.prediction_count+'</td><td>'+p.score+'</td></tr>').join('')+'</tbody></table></div>':empty('Rankings appear when members start participating.'))
 +'<p class="hint">Points: post = 2, like received = 1, correct quiz = 10, correct resolved prediction = 20. Scores update from saved activity.</p></section>';
}
function quiz(){
 const q=db.quiz,answered=q.answered;
 return head('Quiz Arena','Test your knowledge of history, science, geography and more. One question each day.')
 +'<section class="surface"><span class="eyebrow">DAILY CHALLENGE</span><h2 style="font-size:27px;margin:14px 0 18px">'+esc(q.question)+'</h2>'
 +(quizFeedback?'<p class="notice"><strong>'+(quizFeedback.correct?'Correct!':'Not quite.')+'</strong> '+esc(quizFeedback.explanation)+'</p>':'')
 +(answered?'<p class="result">✓ You already answered today. '+(answered.correct?'Correct — 10 points earned.':'Come back tomorrow for a new challenge.')+'</p>':'<div class="stack">'+q.options.map((o,i)=>'<button class="option" type="button" data-quiz-answer="'+i+'"><span>'+String.fromCharCode(65+i)+'. '+esc(o)+'</span></button>').join('')+'</div>')
 +'<div class="hint">Questions rotate daily, and each account can answer once per day.</div></section>';
}
function predictions(){
 return head('Prediction Center','Make yes-or-no predictions about real events. Score 20 points when your answer is confirmed correct.')
 +'<div class="two"><section class="surface"><h2>Create a prediction</h2><form id="predictionForm"><label>Predict a verifiable event<input name="question" required minlength="10" maxlength="250" placeholder="Will [specific event] happen by [date]?"></label><label>Voting stays open for<select name="days"><option value="1">1 day</option><option value="7" selected>7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></label><button type="submit">CREATE PREDICTION</button></form></section><section class="surface"><h2>Keep your record</h2><p>Choose Yes or No before the deadline. When voting closes, the Lounge owner can mark the verified outcome.</p><p>This is a free points game, not betting or a marketplace.</p></section></div>'
 +'<section class="surface"><h2>Open and resolved predictions</h2>'+(db.predictions.length?db.predictions.map(p=>{
   const total=Object.values(p.counts).reduce((a,b)=>a+Number(b),0),yes=Number(p.counts.true||0),no=Number(p.counts.false||0);
   const finished=p.outcome!==null,locked=finished||p.closed||p.myVote!==null;
   return '<article class="post"><div class="row between"><strong>'+esc(p.question)+'</strong><span class="chip">'+(finished?'RESOLVED':p.closed?'VOTING CLOSED':'OPEN')+'</span></div><p class="muted">By '+esc(p.author)+' · Closes '+esc(fmt(p.closes_at))+'</p>'
   +'<div class="buttonrow"><button data-prediction-vote="'+esc(p.id)+'" data-answer="true" '+(locked?'disabled':'')+'>YES</button><button data-prediction-vote="'+esc(p.id)+'" data-answer="false" '+(locked?'disabled':'')+'>NO</button></div><p class="hint">'+(locked?'Yes '+(total?Math.round(yes*100/total):0)+'% · No '+(total?Math.round(no*100/total):0)+'% · '+total+' predictions':'Predictions stay hidden until you answer or voting closes.')+(p.myVote!==null?' · Your answer: '+(p.myVote?'Yes':'No'):'')+'</p>'
   +(finished?'<p class="result">Verified outcome: '+(p.outcome?'YES':'NO')+'</p>':'')
   +(admin&&p.closed&&!finished?'<div class="buttonrow"><button class="light" data-resolve="'+esc(p.id)+'" data-outcome="true">OWNER: Resolve YES</button><button class="light" data-resolve="'+esc(p.id)+'" data-outcome="false">OWNER: Resolve NO</button></div>':'')+'</article>'
 }).join(''):empty('No predictions yet. Be the first!'))+'</section>';
}
function rooms(){
 return head('Live Hangout Rooms','Choose a subject and start chatting. Your original Pulse rooms are still available.')
 +'<div class="room-grid">'+channels.map(r=>'<a class="room-link" href="/#pulse/'+r[0]+'"><b>'+r[1]+' '+esc(r[2])+'</b><small>Open the original live discussion ↗</small></a>').join('')+'</div>'
 +'<div class="surface" style="margin-top:20px"><h2>Clubhouse quick chat</h2><div class="row"><label style="min-width:220px">Room<select id="clubRoom">'+channels.map(r=>'<option value="'+r[0]+'" '+(r[0]===activeRoom?'selected':'')+'>'+esc(r[2])+'</option>').join('')+'</select></label></div><form id="roomForm"><textarea name="message" required minlength="3" maxlength="1200" placeholder="Share something with your Lounge friends…"></textarea><button type="submit">POST TO ROOM</button></form><div id="roomPosts">'+postsFor('room',activeRoom)+'</div></div>';
}
function profiles(){
 return head('Member Profiles','Keep the same account, profile picture, name, friends and messages you already have.')
 +'<div class="two"><section class="surface"><h2>About me</h2>'+(db.signedIn?'<p>Signed in as <b>'+esc(db.member.displayName)+'</b></p><form id="bioForm"><label>Profile biography<textarea maxlength="240" name="bio" placeholder="A little about yourself…">'+esc(db.bio)+'</textarea></label><button type="submit">SAVE MY BIO</button></form><p class="hint">Your profile photo and display name are managed on your existing Lounge profile.</p><a class="smalllink" href="/#profile">Manage picture and name ↗</a>':'<p>Sign in to create your profile.</p><a class="smalllink" href="/login">Sign in or join ↗</a>')+'</section><section class="surface"><h2>Find friends</h2><p>Browse the opt-in friends directory, follow members, and visit their profiles.</p><a class="smalllink" href="/#friends">OPEN FRIENDS DIRECTORY ↗</a></section></div>'
 +'<section class="surface"><h2>Clubhouse members</h2><div class="three">'+(db.leaderboard.length?db.leaderboard.slice(0,12).map(p=>'<div class="post"><div class="post-head">'+avatar(p)+'<b>'+esc(p.display_name)+'</b></div><p>'+esc(p.bio||'No biography yet')+'</p><span class="chip">'+p.score+' points</span></div>').join(''):empty('Members will appear here after they participate.'))+'</div></section>';
}
function news(){
 return head('The News Desk','Read the latest available publisher headlines, then discuss them with friends.')
 +'<section class="surface"><div class="row between"><h2>Latest news headlines</h2><button type="button" id="newsReload">↻ Refresh</button></div>'
 +(stories.length?stories.slice(0,30).map(x=>'<article class="post"><div class="row between"><span class="side">'+esc(x.source)+'</span><time class="muted">'+esc(fmt(x.published))+'</time></div><h3 style="line-height:1.4;margin-top:12px"><a href="'+esc(https(x.url))+'" target="_blank" rel="noopener noreferrer">'+esc(x.title)+' ↗</a></h3><p>'+esc(x.excerpt||'')+'</p><a class="smalllink" href="/#pulse/politics">DISCUSS IN THE PULSE ↗</a></article>').join(''):empty('No fresh publisher headlines are available right now.'))
 +'<p class="hint">Recent world, U.S., business and technology headlines are sourced from publisher feeds and linked to their original coverage.</p></section>';
}
function https(url){try{const u=new URL(url);return /^https?:$/.test(u.protocol)?u.href:'#'}catch{return '#'}}
function trending(){
 const popular=[...db.posts].filter(p=>!p.parent_id&&p.kind!=='announcement').sort((a,b)=>Number(b.likes)-Number(a.likes)||Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,15);
 const roomCounts=channels.map(r=>({name:r[2],key:r[0],count:db.posts.filter(p=>p.kind==='room'&&p.room===r[0]).length})).sort((a,b)=>b.count-a.count);
 return head("What's Trending",'The conversations earning the most likes and attention from members.')
 +'<div class="two"><section class="surface"><h2>Trending conversations</h2>'+popular.map(post).join('')+'</section><section class="surface"><h2>Most active rooms</h2>'+roomCounts.map((r,i)=>'<div class="post row between"><a href="/#pulse/'+r.key+'">'+(i+1)+'. '+esc(r.name)+' ↗</a><span class="chip">'+r.count+' Clubhouse posts</span></div>').join('')+'<p class="hint">Activity is based on saved Clubhouse posts.</p></section></div>';
}
function history(){
 const now=new Date(),mm=String(now.getMonth()+1).padStart(2,'0'),dd=String(now.getDate()).padStart(2,'0');
 return head('On This Day','A daily look at the events that shaped history.')
 +'<section class="surface"><h2>'+esc(now.toLocaleDateString('en-US',{month:'long',day:'numeric'}))+' through history</h2>'
 +(historyFacts===null?empty('Loading historical events…'):historyFacts.length?historyFacts.map(e=>'<article class="historymark" style="margin:12px 0"><time>'+esc(e.year)+'</time><p>'+esc(e.text)+'</p></article>').join(''):empty('The historical feed is unavailable at the moment.'))
 +'<p class="hint">Events are sourced from Wikipedia’s On This Day feed when available, and should be checked against primary sources for detailed research.</p><a class="smalllink" href="https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries" target="_blank" rel="noopener noreferrer">MORE EVENTS IN HISTORY ↗</a></section>';
}
function questions(){
 return head('Ask the Lounge','Ask your friends a question, request advice, or begin a thoughtful discussion.')
 +'<section class="surface"><h2>Ask a question</h2><form id="questionForm"><label>Your question<textarea required minlength="3" maxlength="1200" name="message" placeholder="What would you like to ask the Lounge?"></textarea></label><label class="row"><input type="checkbox" name="anonymous" style="width:auto"> Post anonymously (your name will be hidden from other readers)</label><button type="submit">ASK THE LOUNGE</button></form><p class="hint">Anonymous posts remain linked privately to your account for moderation.</p></section>'
 +'<section class="surface"><h2>Recent questions</h2>'+postsFor('question')+'</section>';
}
function owner(){
 return head("Owner's Corner",'Announcements and community moderation — controlled by the Lounge owner.')
 +(admin?'<div class="surface"><h2>Publish an announcement</h2><form id="announcementForm"><label>Message<textarea name="message" required minlength="3" maxlength="1200" placeholder="Post an announcement for everyone…"></textarea></label><button type="submit">PUBLISH TO CLUBHOUSE</button></form><p class="hint">The owner may also hide individual posts using the Hide controls throughout the Clubhouse.</p></div>':
 '<div class="notice">Only the site owner can publish announcements and moderate. <a class="smalllink" href="/#profile">Unlock owner tools from your existing Lounge profile ↗</a></div>')
 +'<section class="surface"><h2>Official Lounge announcements</h2>'+postsFor('announcement')+'</section>';
}
function render(){
 const raw=location.hash.slice(1).split('/')[0];const page=raw==='home'||tabs.some(t=>t[0]===raw)?raw:'home';
 for(const link of nav.querySelectorAll('[data-tab]'))link.setAttribute('aria-current',link.dataset.tab===page?'page':'false');
 const views={home,debate,polls,leaderboard,quiz,predictions,rooms,profiles,news,trending,history,questions,owner};
 main.innerHTML=db?views[page]():head('Clubhouse temporarily unavailable','Navigation is working, but saved data could not be loaded.')+'<div class="surface"><p>Try refreshing. Existing member data and messages are untouched.</p><button id="tryAgain">RETRY CONNECTION</button></div>';
 if(page==='history'&&historyFacts===null)loadHistory();
}
async function refresh(quiet=false){
 if(loading)return;
 loading=true;
 try{
  const r=await Promise.allSettled([api('/api/club/dashboard'),api('/api/club/news'),api('/api/admin/session')]);
  if(r[0].status!=='fulfilled')throw r[0].reason;
  db=r[0].value;stories=r[1].status==='fulfilled'?r[1].value.stories||[]:[];
  admin=r[2].status==='fulfilled'&&r[2].value.authenticated===true;
  render();
  if(!quiet)say('Clubhouse is ready.')
 }catch(e){if(!quiet)say(String(e.message||e),true);render()}
 finally{loading=false}
}
async function loadHistory(){
 try{
  const obj=await api('/api/club/history');
  historyFacts=Array.isArray(obj.events)?obj.events:[];
 }catch{historyFacts=[]}
 if(location.hash==='#history')render()
}
function deadline(days){return new Date(Date.now()+Number(days)*86400000).toISOString()}
document.addEventListener('click',async event=>{
 const b=event.target.closest('button');if(!b)return;
 try{
  if(b.id==='tryAgain'){await refresh();return}
  if(b.id==='newsReload'){await refresh();say('News refreshed.');return}
  if(b.dataset.replyToggle){const form=main.querySelector('[data-reply-form="'+b.dataset.replyToggle+'"]');if(form){form.hidden=!form.hidden;if(!form.hidden)form.querySelector('input')?.focus()}return}
  if(b.dataset.like){if(!signed())return;await api('/api/club/posts/'+b.dataset.like+'/like','POST',{});await refresh(true);return}
  if(b.dataset.pollVote){if(!signed())return;await api('/api/club/polls/'+b.dataset.pollVote+'/vote','POST',{choice:Number(b.dataset.choice)});say('Vote saved.');await refresh(true);return}
  if(b.dataset.predictionVote){if(!signed())return;await api('/api/club/predictions/'+b.dataset.predictionVote+'/vote','POST',{answer:b.dataset.answer==='true'});say('Prediction recorded.');await refresh(true);return}
  if(b.dataset.quizAnswer!==undefined){if(!signed())return;quizFeedback=await api('/api/club/quiz','POST',{choice:Number(b.dataset.quizAnswer)});await refresh(true);return}
  if(b.dataset.resolve){if(!signed())return;if(!confirm('Resolve this event? Only confirm after verifying the real-world outcome.'))return;await api('/api/club/predictions/'+b.dataset.resolve+'/resolve','POST',{outcome:b.dataset.outcome==='true'});say('Outcome saved.');await refresh(true);return}
  if(b.dataset.hidePost){if(!admin)return;if(!confirm('Hide this post from the Clubhouse?'))return;await api('/api/club/posts/'+b.dataset.hidePost+'/hide','POST',{});say('Post hidden.');await refresh(true);return}
 }catch(e){say(e.message,true)}
});
main.addEventListener('change',e=>{if(e.target.id==='clubRoom'){activeRoom=e.target.value;const target=main.querySelector('#roomPosts');if(target)target.innerHTML=postsFor('room',activeRoom)}});
document.addEventListener('submit',async event=>{
 const form=event.target;
 const id=form.id,replyId=form.dataset.replyForm;
 if(!['debateForm','pollForm','predictionForm','roomForm','bioForm','questionForm','announcementForm'].includes(id)&&!replyId)return;
 event.preventDefault();if(!signed())return;
 const submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;
 const v=new FormData(form);
 try{
  if(id==='debateForm')await api('/api/club/posts','POST',{kind:'debate',side:v.get('side'),message:v.get('message')});
  if(id==='pollForm')await api('/api/club/polls','POST',{question:v.get('question'),options:['one','two','three','four'].map(x=>String(v.get(x)||'').trim()).filter(Boolean),closesAt:deadline(v.get('days'))});
  if(id==='predictionForm')await api('/api/club/predictions','POST',{question:v.get('question'),closesAt:deadline(v.get('days'))});
  if(id==='roomForm')await api('/api/club/posts','POST',{kind:'room',room:activeRoom,message:v.get('message')});
  if(id==='bioForm')await api('/api/club/profile','POST',{bio:v.get('bio')});
  if(id==='questionForm')await api('/api/club/posts','POST',{kind:'question',message:v.get('message'),anonymous:v.get('anonymous')==='on'});
  if(id==='announcementForm')await api('/api/club/posts','POST',{kind:'announcement',message:v.get('message')});
  if(replyId){
   const parent=db.posts.find(p=>p.id===replyId);
   if(!parent)throw Error('Conversation was not found');
   await api('/api/club/posts','POST',{kind:parent.kind,room:parent.room,side:parent.kind==='debate'?parent.side:undefined,message:v.get('reply'),parentId:replyId});
  }
  say('Saved to the Lounge.');await refresh(true)
 }catch(err){say(err.message,true)}finally{if(submit)submit.disabled=false}
});
window.addEventListener('hashchange',render);
refresh(true);
setInterval(()=>{if(document.visibilityState==='visible'&&db)refresh(true)},30000);
})();
