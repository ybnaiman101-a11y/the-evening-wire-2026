/* THE EVENING WIRE — Registered member discussions, replies, and live colors */
(function(){
'use strict';
const host=document.getElementById('commandDesk');if(!host)return;
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const topics=[['all','All'],['general','General'],['senate','Senate'],['house','House'],['governors','Governors'],['election-night','Election Night'],['news','News']];
const topicLabel=id=>topics.find(t=>t[0]===id)?.[1]||'General';
const when=x=>{const t=Date.parse(x);return Number.isFinite(t)?new Date(t).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'Recently'};
let list=[],filter='all',activeReply=null,editingId=null,loading=false,ready=false,member=null,lastListSignature='',lastError='';
const q=id=>document.getElementById(id),shown=()=>document.body.dataset.ewView==='reactions';
const shade=(m)=>{const key=String(m.member_id||m.name||m.id||'');let v=0;for(let i=0;i<key.length;i++)v=(v*33+key.charCodeAt(i))>>>0;return v%8};
function card(p,child=false,replies=[]){
 const color=shade(p);
 return '<article class="reaction-post '+(child?'ew-reply':'ew-root')+' ew-author-'+color+'" data-post-id="'+safe(p.id)+'">'+
 '<div class="reaction-posthead"><div class="ew-avatar ew-avatar-'+color+'">'+safe((p.name||'?').slice(0,1).toUpperCase())+'</div>'+
 '<div class="ew-author-info"><b>'+safe(p.name||'Legacy guest')+'</b><span>'+safe(topicLabel(p.topic))+' · '+safe(when(p.created_at))+(p.edited_at?' · EDITED':'')+'</span></div></div>'+
 '<p class="reaction-message">'+safe(p.message)+'</p>'+
 '<div class="reaction-controls">'+
 '<button type="button" data-like="'+safe(p.id)+'">♥ '+Number(p.likes||0)+' Likes</button>'+ 
 (member&&p.member_id===member.id?'<button type="button" data-ew-edit="'+safe(p.id)+'">✎ Edit my message</button>':'')+
 (child?'':'<button type="button" data-reply="'+safe(p.id)+'">↪ Reply'+(replies.length?' ('+replies.length+')':'')+'</button>')+
 '<button type="button" data-report="'+safe(p.id)+'">⚑ Report</button></div>'+
 (child?'':'<div class="ew-replies">'+replies.map(r=>card(r,true,[])).join('')+'</div>')+
 '</article>'
}
function listHTML(){
 if(!ready)return '<div class="reaction-empty">The discussion feed is temporarily unavailable.</div>';
 const parents=list.filter(p=>!p.parent_id),children=new Map();
 for(const p of list)if(p.parent_id){const a=children.get(p.parent_id)||[];a.push(p);children.set(p.parent_id,a)}
 return parents.length?parents.map(p=>card(p,false,(children.get(p.id)||[]).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)))).join(''):
 '<div class="reaction-empty">Nobody has posted in this section yet. Start the conversation.</div>'
}
function updateFeed(){
 if(!shown())return;
 const feed=q('reactionList'),count=q('reactionLiveCount'),send=q('reactionSubmit');
 const sig=JSON.stringify(list.map(p=>[p.id,p.likes,p.message,p.parent_id]))+'|'+ready;
 if(feed&&lastListSignature!==sig&&!editingId){feed.innerHTML=listHTML();lastListSignature=sig}
 if(count)count.textContent=(ready?list.filter(p=>!p.parent_id).length+' discussions · updates every 7 seconds':'Connection unavailable');
 if(send)send.disabled=!ready;
}
async function refresh(){
 if(loading)return;loading=true;
 try{
  const url='/api/community/posts'+(filter==='all'?'':'?topic='+encodeURIComponent(filter));
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store'}),data=await response.json();
  if(!response.ok)throw Error(data.error||'Comments temporarily unavailable');
  list=Array.isArray(data.posts)?data.posts:[];ready=true;lastError='';
 }catch(e){ready=false;lastError=e.message}
 finally{loading=false;updateFeed()}
}
function replyInfo(){
 const line=q('ewReplyInfo'),form=q('reactionForm');if(!line||!form)return;
 const parent=list.find(x=>x.id===activeReply);
 if(parent){
  line.hidden=false;line.innerHTML='↪ Replying to <b>'+safe(parent.name)+'</b> · '+safe(parent.message.slice(0,80))+' <button type="button" id="ewCancelReply">CANCEL</button>';
  q('ewCancelReply').onclick=()=>{activeReply=null;replyInfo()};
  form.elements.namedItem('topic').value=parent.topic;
  form.elements.namedItem('topic').disabled=true;
 }else{
  line.hidden=true;line.textContent='';
  form.elements.namedItem('topic').disabled=false;
 }
}
async function open(){
 const session=await fetch('/api/members/session',{credentials:'same-origin',cache:'no-store'}).then(x=>x.json()).catch(()=>null);
 member=session?.user||null;
 if(!shown())return;
 if(!member){host.innerHTML='<div class="reaction-panel"><h2>MEMBER SIGN-IN REQUIRED</h2><p>Sign in to join the discussion.</p><a href="/">Return to sign-in</a></div>';return}
 host.innerHTML='<div class="reaction-header"><div><div class="cmd-eyebrow">THE EVENING WIRE · MEMBERS-ONLY COMMUNITY</div>'+
 '<h1>REACTION <span>HUB</span></h1>'+
 '<p>Share your election take, reply to other members, and follow live discussion from every device. Display names are locked to accounts.</p></div><span class="reaction-live">● LIVE DISCUSSION</span></div>'+
 '<div class="reaction-layout"><section class="reaction-panel"><div class="ew-reaction-author"><span class="ew-avatar ew-avatar-'+shade({member_id:member.id})+'">'+safe(member.displayName.charAt(0).toUpperCase())+'</span><div><b>Posting as '+safe(member.displayName)+'</b><small>Your registered name is permanent across posts and replies</small></div></div>'+
 '<form id="reactionForm"><div id="ewReplyInfo" class="ew-reply-target" hidden></div>'+
 '<label>CHOOSE A TOPIC<select name="topic">'+topics.filter(t=>t[0]!=='all').map(t=>'<option value="'+t[0]+'">'+safe(t[1])+'</option>').join('')+'</select></label>'+
 '<label>YOUR MESSAGE<textarea name="message" required minlength="8" maxlength="700" rows="5" placeholder="What is your take?"></textarea></label>'+
 '<div class="reaction-footer"><span id="reactionCount">0 / 700</span><button type="submit" id="reactionSubmit" disabled>POST MESSAGE ↗</button></div>'+
 '<p id="reactionFormStatus" class="reaction-status" role="status" aria-live="polite"></p></form></section>'+
 '<section class="reaction-panel"><div class="reaction-top"><div><span class="cmd-eyebrow">DISCUSSION</span><h2>MEMBER MESSAGES</h2><p id="reactionLiveCount" class="reaction-hint">Connecting…</p></div><button type="button" id="reactionRefresh">↻ REFRESH</button></div>'+
 '<div class="reaction-filters">'+topics.map(t=>'<button type="button" data-reaction-topic="'+t[0]+'" class="'+(filter===t[0]?'chosen':'')+'">'+safe(t[1])+'</button>').join('')+'</div>'+
 '<div id="reactionList"></div></section></div>';
 const form=q('reactionForm'),text=form.elements.namedItem('message');
 text.addEventListener('input',()=>{q('reactionCount').textContent=text.value.length+' / 700'});
 form.onsubmit=async e=>{
  e.preventDefault();const button=q('reactionSubmit');button.disabled=true;
  try{
   const body={topic:form.elements.namedItem('topic').value,message:text.value,parentId:activeReply};
   const r=await fetch('/api/community/posts',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Posting failed');
   text.value='';q('reactionCount').textContent='0 / 700';activeReply=null;replyInfo();
   q('reactionFormStatus').textContent='Published! Other members can now see your message.';await refresh();
  }catch(err){q('reactionFormStatus').textContent=err.message}
  finally{button.disabled=!ready}
 };
 q('reactionRefresh').onclick=refresh;
 host.querySelectorAll('[data-reaction-topic]').forEach(b=>b.onclick=()=>{
  filter=b.dataset.reactionTopic;host.querySelectorAll('[data-reaction-topic]').forEach(x=>x.classList.toggle('chosen',x===b));
  list=[];lastListSignature='';activeReply=null;editingId=null;replyInfo();refresh()
 });
 q('reactionList').addEventListener('submit',async e=>{
  const form=e.target.closest('[data-ew-edit-form]');if(!form)return;
  e.preventDefault();const id=form.dataset.ewEditForm;const btn=form.querySelector('[type=submit]');btn.disabled=true;
  try{
   const message=form.elements.namedItem('message').value;
   const resp=await fetch('/api/community/'+encodeURIComponent(id)+'/edit',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})});
   const data=await resp.json();if(!resp.ok)throw Error(data.error||'Could not save changes');
   editingId=null;lastListSignature='';q('reactionFormStatus').textContent='Your message was updated.';
   await refresh();
  }catch(err){q('reactionFormStatus').textContent=err.message;btn.disabled=false}
 });
 q('reactionList').onclick=async e=>{
  const edit=e.target.closest('[data-ew-edit]'),cancelEdit=e.target.closest('[data-ew-cancel-edit]');
  if(cancelEdit){editingId=null;lastListSignature='';updateFeed();return}
  if(edit){
   const original=list.find(p=>p.id===edit.dataset.ewEdit&&p.member_id===member?.id);
   const card=edit.closest('[data-post-id]');
   if(!original||!card)return;
   editingId=original.id;
   const content=card.querySelector('.reaction-message');
   if(!content)return;
   content.hidden=true;
   const existing=card.querySelector('[data-ew-edit-form]');if(existing)existing.remove();
   const form=document.createElement('form');form.dataset.ewEditForm=original.id;form.className='ew-edit-message-form';
   form.innerHTML='<label>EDIT YOUR MESSAGE<textarea name="message" minlength="8" maxlength="700" required></textarea></label>'+
    '<div><button type="submit">SAVE CHANGES</button><button type="button" data-ew-cancel-edit="1">CANCEL</button></div>';
   content.insertAdjacentElement('afterend',form);
   form.elements.namedItem('message').value=original.message;
   form.elements.namedItem('message').focus();
   return
  }
  const reply=e.target.closest('[data-reply]'),like=e.target.closest('[data-like]'),report=e.target.closest('[data-report]');
  if(reply){const original=list.find(p=>p.id===reply.dataset.reply);if(!original)return;activeReply=original.id;replyInfo();form.scrollIntoView({behavior:'smooth',block:'start'});text.focus();return}
  const b=like||report;if(!b)return;
  if(report&&!confirm('Report this comment to moderators?'))return;
  b.disabled=true;
  try{const id=like?like.dataset.like:report.dataset.report,action=like?'like':'report';
   const r=await fetch('/api/community/'+encodeURIComponent(id)+'/'+action,{method:'POST',credentials:'same-origin'});
   if(!r.ok)throw Error('Unable to '+action+' this message');await refresh();
  }catch(err){q('reactionFormStatus').textContent=err.message;b.disabled=false}
 };
 await refresh();
}
setInterval(()=>{if(shown()&&!document.hidden)refresh()},7000);
document.addEventListener('visibilitychange',()=>{if(shown()&&!document.hidden)refresh()});
window.EWReactions={open,refresh};
})();