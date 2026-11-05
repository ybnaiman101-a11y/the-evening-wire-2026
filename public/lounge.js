/* THE LOUNGE — daily social site router, safely reusing the existing member and post database. */
(function(){
'use strict';
const desk=document.getElementById('commandDesk'),hero=document.getElementById('loungeWelcome'),nav=document.querySelector('.lounge-nav');
if(!desk||!hero||!nav)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rooms=[['general','💬','General Discussion','Talk about whatever is on your mind'],['politics','🏛️','Politics','Elections, government and political ideas'],['jewish','✡️','Hasidic & Jewish Life','Traditions, Torah, community and Jewish history'],['world','🌍','World Affairs','Geopolitics, countries and current events'],['history','📜','History & Geography','Empires, borders and the past'],['economics','📈','Economics & Markets','Business, money and the economy'],['science','🔬','Science & Ideas','Discoveries, technology and how things work'],['questions','❔','Questions & Debates','Ask, discuss and respectfully disagree']];
const rnames=Object.fromEntries(rooms.map(r=>[r[0],r[2]]));
let page='',member=null,admin=false,status='',searchTerm='',sequence=0;
const validAvatar=x=>typeof x==='string'&&/^\/api\/members\/avatar\/[0-9a-f-]{36}\?v=\d+$/.test(x);
const avatar=(p,size='normal')=>'<span class="lounge-avatar '+(size==='big'?'big':'')+'">'+(validAvatar(p?.avatarUrl||p?.avatar_url)?'<img src="'+esc(p.avatarUrl||p.avatar_url)+'" alt="'+esc(p.displayName||p.name||'Member')+' photo" loading="lazy">':esc(String(p?.displayName||p?.name||'?')[0]).toUpperCase())+'</span>';
const format=x=>{const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Recently'};
async function api(path,method='GET',data){
 const res=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
 let body={};try{body=await res.json()}catch{}
 if(!res.ok)throw Error(body.error||'Connection interrupted. Please try again.');return body
}
const roomTiles=()=>rooms.map(([id,icon,label,description])=>'<a class="lounge-room-tile" href="/#pulse/'+id+'"><span>'+icon+'</span><strong>'+label+'</strong><small>'+description+'</small><i>JOIN ROOM ↗</i></a>').join('');
function card(p){
 const name=p.name||'Member',media=(p.image_id?'<img loading="lazy" class="lounge-post-image" src="/api/community/images/'+esc(p.image_id)+'" alt="Shared photo">':'')+(p.video_id?'<video controls preload="metadata" playsinline src="/api/community/videos/'+esc(p.video_id)+'" aria-label="Shared video"></video>':'')+(p.audio_id?'<audio controls preload="metadata" src="/api/community/audio/'+esc(p.audio_id)+'" aria-label="Voice note"></audio>':'');
 return '<article class="lounge-mini-post"><div class="lounge-mini-author">'+avatar(p)+'<div><strong>'+esc(name)+'</strong><small> · '+esc(format(p.created_at))+' · '+esc(rnames[p.topic]||'Hangout')+'</small></div></div>'+(p.message?'<p>'+esc(p.message)+'</p>':'')+media+'<div class="lounge-mini-actions"><span>♡ '+Object.values(p.reactions||{}).reduce((a,b)=>a+Number(b||0),0)+'</span><a href="/#pulse/'+encodeURIComponent(p.topic)+'">View conversation ↗</a></div></article>'
}
function panel(title,intro,body){
 return '<div class="lounge-panel-head"><span class="lounge-eyebrow">THE LOUNGE</span><h1>'+title+'</h1>'+(intro?'<p>'+intro+'</p>':'')+'</div>'+body
}
function empty(text){return '<div class="lounge-empty">✳ <p>'+esc(text)+'</p></div>'}
async function latest(){const data=await api('/api/community/posts?scope=social');return data.posts||[]}
async function home(token){
 desk.innerHTML=panel('Your corner of the internet','', '<div class="lounge-home-actions"><a href="/#pulse" class="lounge-action-main">⚡ OPEN THE PULSE</a><a href="/#friends">♡ FIND FRIENDS</a><a href="/#rooms">☷ EXPLORE ROOMS</a><a href="/club">✦ CLUBHOUSE · 12 FEATURES</a></div><div class="lounge-home-grid"><section class="lounge-surface"><h2>Fresh conversations</h2><div id="loungeHomePosts" class="lounge-post-stack">'+empty('Loading posts…')+'</div></section><aside class="lounge-surface"><h2>Find your crowd</h2><div class="lounge-home-rooms">'+rooms.slice(0,5).map(r=>'<a href="/#pulse/'+r[0]+'"><span>'+r[1]+'</span><strong>'+r[2]+'</strong><span>↗</span></a>').join('')+'</div><a href="/#rooms" class="lounge-inline-link">ALL ROOMS ↗</a><div class="lounge-promo"><span>✦</span><b>Share a little something.</b><p>Politics, history, big ideas and good conversation. Everyone is invited.</p></div></aside></div>');
 try{const posts=await latest();if(token===sequence){const el=document.getElementById('loungeHomePosts');if(el)el.innerHTML=posts.length?posts.slice(0,12).map(card).join(''):empty('Your Lounge is ready. Start the first conversation!')}}catch(err){if(token===sequence)desk.querySelector('#loungeHomePosts').innerHTML=empty(err.message)}
}
function roomsPage(){
 desk.innerHTML=panel('Find your room','Drop in anywhere. Every conversation has a place.','<div class="lounge-room-grid">'+roomTiles()+'</div>');
}
async function pollPage(token){
 desk.innerHTML=panel('The opinion corner','Fun questions. Your vote.','<div id="loungePollList" class="lounge-poll-list">'+empty('Loading polls…')+'</div>');
 try{const data=await api('/api/community/polls?scope=social');if(token!==sequence)return;
 const el=document.getElementById('loungePollList');el.innerHTML=(data.polls||[]).length?data.polls.map(p=>{
  const voted=p.myVote!==null&&p.myVote!==undefined,closed=p.closed||new Date(p.closes_at)<new Date();
  return '<article class="lounge-poll"><h2>'+esc(p.question)+'</h2><p>Posted '+esc(format(p.created_at))+'</p>'+p.options.map((o,i)=>{
   const count=Number(p.counts?.[i]||0),total=p.options.reduce((n,_,j)=>n+Number(p.counts?.[j]||0),0),percent=total?Math.round(100*count/total):0;
   return '<button type="button" class="lounge-poll-option" data-vote="'+esc(p.id)+'" data-choice="'+i+'" '+((voted||closed)?'disabled':'')+'><span>'+esc(o)+(voted||closed?' · '+percent+'%':'')+'</span><i style="width:'+percent+'%"></i></button>'
  }).join('')+'<small>'+(closed?'POLL CLOSED':voted?'VOTE RECORDED':'CHOOSE AN ANSWER')+'</small></article>'
 }).join(''):empty('No polls yet. The Lounge owner can create one in THE PULSE.')}
 catch(err){if(token===sequence)document.getElementById('loungePollList').innerHTML=empty(err.message)}
}
async function friendsPage(token){
 desk.innerHTML=panel('Friends & familiar faces','Find the people who choose to share their profiles.','<div id="loungeFriendIntro"></div><div id="loungeFriendList" class="lounge-people-grid">'+empty('Finding friends…')+'</div>');
 try{const [people,me]=await Promise.all([api('/api/lounge/people'),api('/api/lounge/me')]);if(token!==sequence)return;
 const toggle=document.getElementById('loungeFriendIntro');
 toggle.innerHTML=member?'<div class="lounge-discovery-choice"><div><strong>Appear in the Friends directory?</strong><p>Off by default. Your email is never shown.</p></div><button type="button" data-visibility="'+(me.visible?'off':'on')+'">'+(me.visible?'✓ VISIBLE · HIDE ME':'MAKE ME VISIBLE')+'</button></div>':'<div class="lounge-discovery-choice"><p>Browse freely. <a href="/login">Sign in</a> to follow friends or add yourself.</p></div>';
 const others=(people.people||[]).filter(x=>x.id!==member?.id);document.getElementById('loungeFriendList').innerHTML=others.length?others.map(p=>'<article class="lounge-person">'+avatar(p,'big')+'<h2>'+esc(p.displayName)+'</h2><p>'+Number(p.followers||0)+' followers</p>'+(member?'<button type="button" data-follow="'+esc(p.id)+'" data-followed="'+(p.following?'1':'0')+'">'+(p.following?'✓ FOLLOWING':'♡ FOLLOW')+'</button>':'<a href="/login">SIGN IN TO FOLLOW</a>')+'</article>').join(''):empty('No one has joined the public Friends directory yet. You can be the first.')}
 catch(err){if(token===sequence)document.getElementById('loungeFriendList').innerHTML=empty(err.message)}
}
async function discoverPage(token){
 desk.innerHTML=panel('Discover','Search posts, people, and topics.','<form id="loungeSearchForm" class="lounge-search-form"><input name="query" aria-label="Search posts" placeholder="Search conversations…" value="'+esc(searchTerm)+'"><button type="submit">SEARCH</button></form><div id="loungeDiscoverList" class="lounge-post-stack">'+empty('Loading recent conversations…')+'</div>');
 try{const posts=await latest();if(token!==sequence)return;
 const term=searchTerm.toLowerCase();const matches=posts.filter(p=>(p.message+' '+p.name+' '+(rnames[p.topic]||'')).toLowerCase().includes(term));
 document.getElementById('loungeDiscoverList').innerHTML=matches.length?matches.slice(0,60).map(card).join(''):empty('No matching conversations yet.')}
 catch(err){if(token===sequence)document.getElementById('loungeDiscoverList').innerHTML=empty(err.message)}
}
async function prepareAvatar(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file?.type)||file.size>12000000)throw Error('Choose a JPG, PNG, or WebP picture under 12 MB.');
 const picture=await createImageBitmap(file);
 try{
  const c=document.createElement('canvas');c.width=320;c.height=320;const ctx=c.getContext('2d');
  if(!ctx)throw Error('Could not process this photo.');
  const size=Math.min(picture.width,picture.height);
  ctx.drawImage(picture,(picture.width-size)/2,(picture.height-size)/2,size,size,0,0,320,320);
  const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.84));
  if(!blob||blob.size>500000)throw Error('Picture too large after resizing.');
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read picture'));reader.readAsDataURL(blob)})
 }finally{picture.close()}
}
function profilePage(){
 desk.innerHTML=panel('My profile','Your corner. Your style.',member?'<div class="lounge-profile-card">'+avatar(member,'big')+'<div><h2>'+esc(member.displayName)+'</h2><p>'+esc(member.email)+'</p><label class="lounge-upload-avatar">📷 CHANGE PROFILE PICTURE <input id="loungeAvatar" type="file" accept="image/jpeg,image/png,image/webp" hidden></label> '+(member.avatarUrl?'<button data-avatar-remove="1">REMOVE PHOTO</button>':'')+'</div></div>'+
 '<div class="lounge-profile-grid"><section class="lounge-surface"><h2>Display name</h2><form id="loungeNameForm"><label>NAME<input name="displayName" minlength="2" maxlength="40" required value="'+esc(member.displayName)+'"></label><button type="submit">SAVE NAME</button></form></section><section class="lounge-surface"><h2>Account & settings</h2><p>Your existing login stays active on this device, just like before.</p><button type="button" data-signout="1" class="lounge-secondary-button">SIGN OUT</button><details class="lounge-owner-box"><summary>Owner sign-in</summary><form id="loungeOwnerForm"><label>ADMIN PASSWORD<input name="password" type="password" autocomplete="current-password" required></label><label class="lounge-inline-check"><input name="remember" type="checkbox" checked> Remember this device</label><button type="submit">UNLOCK OWNER TOOLS</button></form></details></section></div><p class="lounge-inline-link"><a href="/#friends">Manage Friends visibility ↗</a></p>':
 '<section class="lounge-guest-profile"><h2>Welcome in.</h2><p>Browsing is free. Join to post, react, follow friends, and set your profile picture.</p><a href="/login" class="lounge-action-main">SIGN IN OR JOIN</a></section>');
}
function setStatus(message){
 let node=desk.querySelector('.lounge-action-status');
 if(!node){node=document.createElement('p');node.className='lounge-action-status';node.setAttribute('role','status');desk.prepend(node)}
 node.textContent=message||''
}
function currentHash(){
 const raw=decodeURIComponent(location.hash.replace(/^#/,'')||'home').replace(/^\//,'');
 const [p,...rest]=raw.split('/');return {page:['home','pulse','rooms','polls','friends','discover','profile'].includes(p)?p:'home',room:rest[0]||'all'}
}
async function route(){
 const token=++sequence,{page:next,room}=currentHash();page=next;hero.hidden=page!=='home';document.body.dataset.ewView=page==='pulse'?'reactions':page;
 nav.querySelectorAll('[data-page]').forEach(n=>n.setAttribute('aria-current',n.dataset.page===page?'page':'false'));
 desk.onclick=null;desk.oninput=null;desk.onchange=null;desk.onsubmit=null;desk.onpaste=null;desk.ondragover=null;desk.ondrop=null;
 try{const x=await api('/api/members/session');if(token!==sequence)return;member=x.user||null}catch{member=null}
 if(page==='pulse'){
  hero.hidden=true;
  if(!window.EWReactions?.open)throw Error('The Pulse could not load. Please refresh the page.');
  window.EWReactions.chooseRoom(room);
  await window.EWReactions.open();
  return
 }
 if(page==='home')return home(token);
 if(page==='rooms')return roomsPage();
 if(page==='polls')return pollPage(token);
 if(page==='friends')return friendsPage(token);
 if(page==='discover')return discoverPage(token);
 if(page==='profile')return profilePage();
}
desk.addEventListener('click',async e=>{
 if(page==='pulse')return;
 const vote=e.target.closest('[data-vote]'),follow=e.target.closest('[data-follow]'),visibility=e.target.closest('[data-visibility]'),out=e.target.closest('[data-signout]'),remove=e.target.closest('[data-avatar-remove]');
 try{
  if(vote){
   if(!member){location.href='/login';return}
   await api('/api/community/polls/'+vote.dataset.vote+'/vote','POST',{choice:Number(vote.dataset.choice)});await route()
  }else if(follow){
   if(!member){location.href='/login';return}
   const active=follow.dataset.followed==='1';await api('/api/lounge/'+(active?'unfollow':'follow'),'POST',{memberId:follow.dataset.follow});await route()
  }else if(visibility){
   await api('/api/lounge/visibility','POST',{visible:visibility.dataset.visibility==='on'});await route()
  }else if(out){
   await api('/api/members/logout','POST');member=null;await route()
  }else if(remove){
   await api('/api/members/avatar/remove','POST');await route()
  }
 }catch(err){setStatus(err.message)}
});
desk.addEventListener('submit',async e=>{
 if(page==='pulse')return;
 if(!['loungeSearchForm','loungeNameForm','loungeOwnerForm'].includes(e.target.id))return;
 e.preventDefault();
 const form=e.target,button=form.querySelector('[type=submit]');if(button)button.disabled=true;
 try{
  const fields=new FormData(form);
  if(form.id==='loungeSearchForm'){searchTerm=String(fields.get('query')||'').trim().slice(0,120);return discoverPage(sequence)}
  if(form.id==='loungeNameForm'){
   await api('/api/members/profile','POST',{displayName:String(fields.get('displayName')||'')});setStatus('Name saved.');await route()
  }
  if(form.id==='loungeOwnerForm'){
   await api('/api/admin/login','POST',{password:String(fields.get('password')||''),rememberDevice:fields.get('remember')==='on'});
   setStatus('Owner controls unlocked. Open THE PULSE to moderate or create polls.')
  }
 }catch(err){setStatus(err.message)}finally{if(button)button.disabled=false}
});
desk.addEventListener('change',async e=>{
 if(e.target.id!=='loungeAvatar'||page!=='profile')return;
 const file=e.target.files?.[0];if(!file)return;
 try{setStatus('Preparing picture…');const imageData=await prepareAvatar(file);await api('/api/members/avatar','POST',{imageData});await route()}
 catch(err){setStatus(err.message)}
});
// A failed panel must show an error instead of making every other tab seem dead.
function navigate(){
 return route().catch(error=>{
  const message=String(error?.message||'Could not open that section.');
  console.error('Lounge navigation:',message);
  desk.innerHTML='<div class="lounge-empty"><strong>THIS TAB DID NOT OPEN</strong><p>'+esc(message)+'</p><p><a href="/#home">Return home</a> or refresh to try again.</p></div>';
  hero.hidden=true;
 })
}
// Navigate immediately on click, even when the tab hash has not changed.
nav.addEventListener('click',event=>{
 const link=event.target.closest('a[data-page]');
 if(!link)return;
 const href=link.getAttribute('href');
 if(!href||!href.startsWith('/#'))return;
 event.preventDefault();
 if(location.pathname+location.hash!==href)history.pushState(null,'',href);
 navigate();
});
window.addEventListener('hashchange',navigate);
window.addEventListener('popstate',navigate);
window.addEventListener('pageshow',()=>{if(!page)navigate()});
navigate();
})();