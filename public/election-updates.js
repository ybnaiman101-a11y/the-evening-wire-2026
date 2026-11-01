/* THE EVENING WIRE — fixed-position urgent notices on every newsroom tab.
   Reads only owner-published notices. Other members have no publish access. */
(function(){
'use strict';
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seenKey='ew-election-updates-seen-2026';
let seen=[];
try{const x=JSON.parse(localStorage.getItem(seenKey)||'[]');if(Array.isArray(x))seen=x.filter(v=>typeof v==='string').slice(-250)}catch{}
let updates=[],visibleId=null,historyOpen=false,previousIds='',busy=false;
const root=document.createElement('div');root.id='ew-global-updates';root.setAttribute('aria-label','Election Updates');document.body.append(root);
const safeURL=x=>{try{const u=new URL(x);return u.protocol==='https:'?u.href:null}catch{return null}};
const relativeTime=t=>{const d=new Date(t);return Number.isFinite(d.getTime())?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'Just now'};
const kinds={'race-called':'RACE CALL','breaking':'BREAKING','results':'RESULTS','important':'IMPORTANT'};
function persist(){try{localStorage.setItem(seenKey,JSON.stringify(seen.slice(-250)))}catch{}}
const unread=()=>updates.filter(u=>!seen.includes(u.id));
function render(){
 const active=updates.find(u=>u.id===visibleId);
 const n=unread().length;
 const bubble=u=>{
  const source=safeURL(u.sourceUrl);
  return '<article class="ew-alert-card ew-alert-'+escapeHTML(u.category)+'" role="alert">'+
   '<div class="ew-alert-top"><div class="ew-alert-brand"><span class="ew-alert-pulse"></span>ELECTION UPDATE</div>'+
   '<button type="button" data-ew-alert-close="'+escapeHTML(u.id)+'" aria-label="Dismiss this election update">✕</button></div>'+
   '<div class="ew-alert-type">'+escapeHTML(kinds[u.category]||'IMPORTANT')+' · THE EVENING WIRE</div>'+
   '<p>'+escapeHTML(u.message)+'</p>'+
   (source?'<a href="'+escapeHTML(source)+'" target="_blank" rel="noopener noreferrer">VIEW ORIGINAL SOURCE ↗</a>':'')+
   '<footer><span>'+escapeHTML(relativeTime(u.createdAt))+'</span><span>Published by site administrator</span></footer>'+
   '</article>'
 };
 root.innerHTML=
  '<button type="button" id="ewAlertBell" class="ew-alert-bell" aria-label="Election Updates'+(n?' - '+n+' unread':'')+'" aria-expanded="'+historyOpen+'">🔔 <span>ELECTION UPDATES</span>'+(n?'<b>'+n+'</b>':'')+'</button>'+
  (active?bubble(active):'')+
  (historyOpen?'<section class="ew-alert-history" aria-label="Recent election updates"><div class="ew-alert-history-head"><strong>RECENT ELECTION UPDATES</strong><button type="button" data-ew-history-close="1" aria-label="Close updates history">✕</button></div>'+
   (updates.length?updates.map(u=>'<div class="ew-alert-history-item">'+
    '<span>'+escapeHTML(kinds[u.category]||'ELECTION UPDATE')+' · '+escapeHTML(relativeTime(u.createdAt))+'</span>'+
    '<p>'+escapeHTML(u.message)+'</p><button type="button" data-ew-alert-show="'+escapeHTML(u.id)+'">'+(seen.includes(u.id)?'READ AGAIN':'VIEW UPDATE')+'</button></div>').join(''):
    '<p class="ew-alert-history-empty">No active Election Updates have been posted yet.</p>')+'</section>':'');
}
function next(){
 if(visibleId&&updates.some(x=>x.id===visibleId))return;
 const u=unread()[0];visibleId=u?u.id:null;
}
root.addEventListener('click',e=>{
 const closer=e.target.closest('[data-ew-alert-close]');
 if(closer){
  const id=closer.dataset.ewAlertClose;
  if(!seen.includes(id)){seen.push(id);persist()}
  visibleId=null;next();render();return
 }
 const show=e.target.closest('[data-ew-alert-show]');
 if(show){visibleId=show.dataset.ewAlertShow;historyOpen=false;render();return}
 const closeHistory=e.target.closest('[data-ew-history-close]');
 if(closeHistory){historyOpen=false;render();return}
 if(e.target.closest('#ewAlertBell')){historyOpen=!historyOpen;render()}
});
async function refresh(){
 if(busy||document.hidden)return;busy=true;
 try{
  const res=await fetch('/api/updates',{credentials:'same-origin',cache:'no-store'});
  if(res.status===401){root.hidden=true;return}
  if(!res.ok)throw Error('No updates');
  const json=await res.json();
  const items=Array.isArray(json.updates)?json.updates:[];
  const signature=items.map(u=>u.id).join('|');
  const lastTop=updates[0]?.id||null;
  updates=items.filter(u=>u&&u.id&&u.message);
  root.hidden=false;
  // Newly issued updates always take priority, regardless of the current tab.
  if(updates[0]?.id!==lastTop&&updates[0]&&!seen.includes(updates[0].id))visibleId=updates[0].id;
  if(!updates.some(u=>u.id===visibleId))visibleId=null;
  next();
  if(signature!==previousIds){previousIds=signature;render()}
 }catch{}finally{busy=false}
}
window.EWElectionUpdates={refresh};
render();
refresh();
setInterval(refresh,4000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
window.addEventListener('ew-owner-update-posted',()=>{busy=false;refresh()});
})();