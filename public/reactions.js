/* EVENING WIRE — Shared Reaction Hub. Messages are fetched from the server,
   never localStorage. Polling does not replace the form or erase a draft. */
(function(){
 const host=document.getElementById('commandDesk');
 if(!host)return;
 const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const categories=[['general','General'],['senate','Senate'],['house','House'],['governors','Governors'],['election-night','Election Night'],['news','News']];
 let filter='all',posts=[],ready=false,storage='unavailable',warning='',loading=false,active=false,lastRendered='',lastError='';
 const nameFor=id=>categories.find(([code])=>code===id)?.[1]||'Election';
 const current=()=>document.body.dataset.ewView==='reactions';
 function since(date){const n=Date.parse(date);return Number.isFinite(n)?new Date(n).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'Recently'}
 function listMarkup(){
  if(!ready)return '<p class="reaction-empty">Unable to load public comments right now. Press Refresh to try again.</p>';
  if(!posts.length)return '<p class="reaction-empty">No reactions in this category yet. Be the first to share your thoughts.</p>';
  return posts.map(p=>'<article class="reaction-post" data-post-id="'+safe(p.id)+'">'+
   '<div class="reaction-posthead"><b>'+safe(p.name||'Anonymous')+'</b><span>'+safe(nameFor(p.topic))+' · '+safe(since(p.created_at))+'</span></div>'+
   '<p>'+safe(p.message)+'</p>'+
   '<div class="reaction-controls"><button type="button" data-like="'+safe(p.id)+'">♡ '+Number(p.likes||0)+' Appreciate</button>'+
   '<button type="button" data-report="'+safe(p.id)+'">⚑ Report</button></div></article>').join('');
 }
 function updatePosts(){
  if(!current())return;
  const list=document.getElementById('reactionList');
  const count=document.getElementById('reactionLiveCount');
  const signature=JSON.stringify(posts.map(p=>[p.id,p.likes,p.message,p.name,p.topic,p.created_at]))+'|'+ready;
  if(list&&signature!==lastRendered){list.innerHTML=listMarkup();lastRendered=signature}
  if(count)count.textContent=ready?posts.length+' recent reactions · updates every 7 seconds':'Connection unavailable';
  const submit=document.querySelector('#reactionForm button[type=submit]');
  if(submit)submit.disabled=!ready;
  const warningNode=document.getElementById('reactionStorageWarning');
  if(warningNode){
   if(storage==='temporary'){warningNode.hidden=false;warningNode.textContent='⚠ '+(warning||'Temporary storage: messages may disappear after a server restart.')}
   else warningNode.hidden=true;
  }
  const status=document.getElementById('reactionFormStatus');
  if(status&&lastError)status.textContent=lastError;
 }
 async function refresh(){
  if(loading)return;
  loading=true;
  try{
   const response=await fetch('/api/community/posts'+(filter==='all'?'':'?topic='+encodeURIComponent(filter)),{cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Unable to fetch reactions');
   posts=Array.isArray(data.posts)?data.posts:[];ready=true;
   storage=data.storage||'postgresql';warning=data.warning||'';lastError='';
  }catch(e){
   ready=false;lastError='The comments feed is temporarily unavailable. Try Refresh.';
  }finally{loading=false;updatePosts()}
 }
 function draw(){
  lastRendered='';
  host.innerHTML=
  '<div class="reaction-header"><div><div class="cmd-eyebrow">THE EVENING WIRE · COMMUNITY</div>'+
  '<h1>THE REACTION <span>HUB</span></h1>'+
  '<p>Join the election discussion with visitors on other devices. These are reader opinions—not official race calls or election results.</p></div>'+
  '<span class="reaction-live">COMMUNITY DISCUSSION</span></div>'+
  '<div id="reactionStorageWarning" class="reaction-status" style="margin:0 0 15px;padding:12px 16px;border-radius:9px;border:1px solid #9c813d;background:#62471c44;color:#f5d99c" hidden></div>'+
  '<div class="reaction-layout"><section class="reaction-panel"><h2>SHARE YOUR TAKE</h2>'+
  '<p class="reaction-hint">Your message will appear to everyone who visits this hub. Please keep it civil and do not include private information.</p>'+
  '<form id="reactionForm">'+
  '<label>Your display name (optional)<input name="name" maxlength="30" placeholder="Anonymous" autocomplete="nickname"></label>'+
  '<label>Topic<select name="topic">'+categories.map(([code,label])=>'<option value="'+code+'">'+safe(label)+'</option>').join('')+'</select></label>'+
  '<label>Your reaction<textarea name="message" required minlength="8" maxlength="700" placeholder="What do you think about the election?" rows="5"></textarea></label>'+
  '<div class="reaction-footer"><span id="reactionCount">0 / 700</span><button type="submit" disabled>POST REACTION →</button></div>'+
  '<p id="reactionFormStatus" class="reaction-status" role="status" aria-live="polite"></p></form></section>'+
  '<section class="reaction-panel"><div class="reaction-top"><div><div class="cmd-eyebrow">LIVE PUBLIC DISCUSSION</div>'+
  '<h2>LATEST REACTIONS</h2><p id="reactionLiveCount" class="reaction-hint">Connecting to the community…</p></div>'+
  '<button type="button" id="reactionRefresh">↻ Refresh</button></div>'+
  '<div class="reaction-filters">'+[['all','All Reactions'],...categories].map(([code,label])=>
  '<button type="button" data-reaction-topic="'+code+'" class="'+(filter===code?'chosen':'')+'">'+safe(label)+'</button>').join('')+'</div>'+
  '<div id="reactionList"></div></section></div>';
  const form=host.querySelector('#reactionForm');
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const button=form.querySelector('button[type=submit]');
   button.disabled=true;
   const data=new FormData(form);
   const body={name:data.get('name'),topic:data.get('topic'),message:data.get('message')};
   const status=host.querySelector('#reactionFormStatus');
   try{
    const response=await fetch('/api/community/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Posting failed');
    status.textContent='Your comment was posted. Other visitors will see it when their feed updates.';
    form.querySelector('textarea').value='';
    document.getElementById('reactionCount').textContent='0 / 700';
    filter='all';
    for(const button of host.querySelectorAll('[data-reaction-topic]'))button.classList.toggle('chosen',button.dataset.reactionTopic==='all');
    await refresh();
   }catch(e){status.textContent='Unable to publish: '+String(e.message||e)}
   finally{button.disabled=!ready}
  });
  form.querySelector('textarea').addEventListener('input',event=>{
   const count=document.getElementById('reactionCount');
   if(count)count.textContent=event.target.value.length+' / 700';
  });
  host.querySelector('#reactionRefresh').addEventListener('click',()=>refresh());
  host.querySelectorAll('[data-reaction-topic]').forEach(button=>button.addEventListener('click',()=>{
   filter=button.dataset.reactionTopic;
   host.querySelectorAll('[data-reaction-topic]').forEach(b=>b.classList.toggle('chosen',b===button));
   posts=[];lastRendered='';updatePosts();refresh();
  }));
  host.querySelector('#reactionList').addEventListener('click',async event=>{
   const like=event.target.closest('[data-like]'),report=event.target.closest('[data-report]');
   if(!like&&!report)return;
   const button=like||report;
   const path=like?'like':'report';
   if(report&&!confirm('Report this reaction for moderation?'))return;
   button.disabled=true;
   try{
    const response=await fetch('/api/community/'+encodeURIComponent(like?like.dataset.like:report.dataset.report)+'/'+path,{method:'POST'});
    if(!response.ok)throw Error('Action could not be completed');
    await refresh();
   }catch(e){button.disabled=false;const status=document.getElementById('reactionFormStatus');if(status)status.textContent=String(e.message||e)}
  });
  updatePosts();
 }
 function open(){
  active=true;draw();refresh();
 }
 // Check for comments posted on other phones, computers and browsers.
 setInterval(()=>{if(current()&&!document.hidden)refresh()},7000);
 document.addEventListener('visibilitychange',()=>{if(current()&&!document.hidden)refresh()});
 window.EWReactions={open,refresh};
})();
