/* THE EVENING WIRE — ten-second admin Election Updates.
   Server-Sent Events deliver instantly; HTTP polling provides a recovery path.
   Popups never stay visible more than ten seconds. */
(function(){
'use strict';
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:null}catch{return null}};
const kinds={'race-called':'RACE CALLED','breaking':'BREAKING','results':'RESULTS','important':'IMPORTANT'};
const root=document.createElement('div');root.id='ew-global-updates';root.setAttribute('aria-label','Election Update broadcast');root.hidden=true;document.body.append(root);
const seenKey='ew-alerts-seen-v2';
let showing=null,latestSeen=new Set(),timer=null,polling=false,hasInteracted=false,stream=null,streamStatus='connecting';
try{const old=JSON.parse(sessionStorage.getItem(seenKey)||'[]');if(Array.isArray(old))latestSeen=new Set(old.filter(v=>typeof v==='string').slice(-100))}catch{}
const markSeen=id=>{latestSeen.add(id);try{sessionStorage.setItem(seenKey,JSON.stringify([...latestSeen].slice(-100)))}catch{}};
document.addEventListener('pointerdown',()=>{hasInteracted=true},{once:true});
document.addEventListener('keydown',()=>{hasInteracted=true},{once:true});
function beep(){
 if(!hasInteracted||!(window.AudioContext||window.webkitAudioContext))return;
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext,ctx=new Ctx(),osc=ctx.createOscillator(),vol=ctx.createGain();
  osc.type='sine';osc.frequency.value=860;
  vol.gain.setValueAtTime(.0001,ctx.currentTime);
  vol.gain.exponentialRampToValueAtTime(.045,ctx.currentTime+.02);
  vol.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.19);
  osc.connect(vol).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.2);
  osc.onended=()=>ctx.close().catch(()=>{});
 }catch{}
}
function hide(){
 if(timer!==null){clearTimeout(timer);timer=null}
 showing=null;root.hidden=true;root.innerHTML='';
}
function card(item){
 const source=safeUrl(item.sourceUrl);
 root.innerHTML='<article class="ew-alert-card ew-alert-'+safe(item.category)+'" role="alert" aria-live="assertive">'+
  '<div class="ew-alert-top"><div class="ew-alert-brand"><span class="ew-alert-pulse"></span> ELECTION UPDATE</div>'+
  '<button type="button" data-ew-alert-dismiss aria-label="Dismiss Election Update">✕</button></div>'+
  '<div class="ew-alert-type">'+safe(kinds[item.category]||'IMPORTANT')+' · THE EVENING WIRE · OWNER ANNOUNCEMENT</div>'+
  '<p>'+safe(item.message)+'</p>'+
  (source?'<a href="'+safe(source)+'" target="_blank" rel="noopener noreferrer">READ ORIGINAL SOURCE ↗</a>':'')+
  '<footer>LIVE SITEWIDE BROADCAST · DISAPPEARS IN 10 SECONDS</footer>'+
  '<div class="ew-alert-progress" aria-hidden="true"></div></article>';
 root.hidden=false;
 root.querySelector('[data-ew-alert-dismiss]').onclick=hide;
}
function deliver(item,preview=false){
 if(!item||!item.id||!item.message||(!preview&&latestSeen.has(item.id)))return false;
 const published=Date.parse(item.createdAt),age=Date.now()-published;
 // Short recoverable broadcast buffer: do not replay old messages on a later visit.
 if(!preview&&(!Number.isFinite(published)||age>25000||age< -120000))return false;
 if(!preview)markSeen(item.id);
 if(timer!==null)clearTimeout(timer);
 showing=item.id;card(item);beep();
 timer=setTimeout(hide,10000);
 window.dispatchEvent(new CustomEvent('ew-election-update-displayed',{detail:{id:item.id,preview}}));
 return true
}
async function refresh(){
 if(polling||document.hidden)return;
 polling=true;
 try{
  const response=await fetch('/api/updates',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(9000)});
  if(response.status===401){hide();return}
  if(!response.ok)return;
  const data=await response.json(),items=Array.isArray(data.updates)?data.updates:[];
  // If several updates arrived while offline, show only the latest unseen urgent update.
  const next=items.find(x=>x?.id&&!latestSeen.has(x.id));
  if(next)deliver(next);
 }catch{}finally{polling=false}
}
function connect(){
 if(!('EventSource' in window))return;
 try{
  stream=new EventSource('/api/updates/stream',{withCredentials:true});
  stream.onopen=()=>{streamStatus='connected';refresh()};
  stream.onerror=()=>{streamStatus='reconnecting'};
  stream.addEventListener('election-update',e=>{
   try{deliver(JSON.parse(e.data))}catch{}
  });
  stream.addEventListener('election-update-withdrawn',e=>{
   try{if(JSON.parse(e.data).id===showing)hide()}catch{}
  });
 }catch{streamStatus='unavailable'}
}
function preview({category='important',message='Test: Your Election Update is displaying correctly.',sourceUrl=null}={}){
 return deliver({id:'local-preview-'+Date.now(),category,message,sourceUrl,createdAt:new Date().toISOString()},true)
}
window.EWElectionUpdates={refresh,preview,hide,status:()=>({streamStatus,showing})};
connect();refresh();
setInterval(refresh,1800);
document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();else refresh()});
window.addEventListener('ew-owner-update-posted',e=>{
 const update=e.detail?.update;
 if(update)deliver(update);
 else refresh()
});
})();