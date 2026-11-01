/* Evening Wire public Reaction Hub UI */
(function(){
const host=document.getElementById('commandDesk');if(!host)return;
const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const categories=[['general','All Reactions'],['senate','Senate'],['house','House'],['governors','Governors'],['election-night','Election Night'],['news','News']];
let filter='all',posts=[],ready=false,formStatus='',storage='unavailable',storageWarning='';
function render(){
 host.innerHTML='<div class="reaction-header"><div><div class="cmd-eyebrow">THE EVENING WIRE · COMMUNITY</div><h1>THE REACTION <span>HUB</span></h1><p>What do you think about the 2026 midterms? Share your views with the Evening Wire community. Opinions are public comments, not official results or race calls.</p></div><span class="reaction-live">COMMUNITY DISCUSSION</span></div>'+
 (storage==='temporary'?'<div class="reaction-status" style="margin:0 0 15px;padding:12px 16px;border-radius:9px;border:1px solid #9c813d;background:#62471c44;color:#f5d99c">⚠ '+safe(storageWarning)+'</div>':'')+
 '<div class="reaction-layout"><section class="reaction-panel"><h2>SHARE YOUR TAKE</h2><p class="reaction-hint">Your post will be visible to visitors once submitted. Do not share private information. Keep discussion civil.</p>'+
 '<form id="reactionForm"><label>Your display name (optional)<input name="name" maxlength="30" placeholder="Anonymous"></label><label>Topic<select name="topic">'+categories.slice(1).map(([id,n])=>'<option value="'+id+'">'+safe(n)+'</option>').join('')+'</select></label><label>Your reaction<textarea name="message" required minlength="8" maxlength="700" placeholder="What is your opinion on the election?" rows="5"></textarea></label>'+
 '<div class="reaction-footer"><span id="reactionCount">0 / 700</span><button type="submit" '+(!ready?'disabled':'')+'>POST REACTION →</button></div><p id="reactionFormStatus" class="reaction-status">'+safe(formStatus)+'</p></form></section>'+
 '<section class="reaction-panel"><div class="reaction-top"><div><div class="cmd-eyebrow">PUBLIC CONVERSATION</div><h2>LATEST REACTIONS</h2></div><button id="reactionRefresh">↻ Refresh</button></div>'+
 '<div class="reaction-filters">'+[['all','All Reactions'],...categories.slice(1)].map(([id,n])=>'<button data-reaction-topic="'+id+'" class="'+(filter===id?'chosen':'')+'">'+safe(n)+'</button>').join('')+'</div>'+
 '<div id="reactionList">'+(!ready?'<p class="reaction-empty">Community posts are temporarily unavailable until the database is connected.</p>':posts.length?posts.map(p=>'<article class="reaction-post"><div class="reaction-posthead"><b>'+safe(p.name)+'</b><span>'+safe(categories.find(c=>c[0]===p.topic)?.[1]||p.topic)+' · '+safe(new Date(p.created_at).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))+' ET</span></div><p>'+safe(p.message)+'</p><div class="reaction-controls"><button data-like="'+safe(p.id)+'">♡ '+Number(p.likes||0)+' Appreciate</button><button data-report="'+safe(p.id)+'">⚑ Report</button></div></article>').join(''):'<p class="reaction-empty">No reactions in this category yet. Be the first to share an opinion.</p>')+'</div></section></div>';
 const form=document.getElementById('reactionForm');
 form.addEventListener('submit',async e=>{
  e.preventDefault();const submit=form.querySelector('button[type=submit]');submit.disabled=true;const d=new FormData(form);const x={name:d.get('name'),topic:d.get('topic'),message:d.get('message')};
  try{const r=await fetch('/api/community/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(x)}),v=await r.json();if(!r.ok)throw Error(v.error||'Could not post');formStatus='Your reaction was published.';form.reset();await refresh();}catch(e){formStatus=String(e.message||e);render()}finally{const b=document.querySelector('#reactionForm button[type=submit]');if(b)b.disabled=!ready}
 });
 form.querySelector('textarea').addEventListener('input',e=>{document.getElementById('reactionCount').textContent=e.target.value.length+' / 700'});
 host.querySelectorAll('[data-reaction-topic]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.reactionTopic;refresh()}));
 document.getElementById('reactionRefresh').addEventListener('click',refresh);
 host.querySelectorAll('[data-like]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;await fetch('/api/community/'+b.dataset.like+'/like',{method:'POST'}).catch(()=>{});refresh()}));
 host.querySelectorAll('[data-report]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Report this comment for review?'))return;b.disabled=true;await fetch('/api/community/'+b.dataset.report+'/report',{method:'POST'}).catch(()=>{});refresh()}));
}
async function refresh(){
 try{const r=await fetch('/api/community/posts'+(filter!=='all'?'?topic='+encodeURIComponent(filter):''),{cache:'no-store'});const v=await r.json();if(!r.ok)throw Error(v.error||'Comments unavailable');posts=v.posts||[];ready=true;storage=v.storage||'postgresql';storageWarning=v.warning||'';formStatus='';}catch(e){posts=[];ready=false;storage='unavailable';formStatus='Posting is currently unavailable.'}
 if(document.body.dataset.ewView==='reactions')render();
}
window.EWReactions={open:()=>{document.body.dataset.ewView='reactions';render();refresh()},refresh};
})();
