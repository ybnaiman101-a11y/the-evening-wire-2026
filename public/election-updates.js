/* THE EVENING WIRE — owner Election Update: one ten-second popup, then gone.
   The server delivers ONLY updates that are less than ten seconds old. */
(function(){
'use strict';
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:null}catch{return null}};
const kinds={'race-called':'RACE CALLED','breaking':'BREAKING','results':'RESULTS','important':'IMPORTANT'};
const root=document.createElement('div');root.id='ew-global-updates';root.setAttribute('aria-label','Election Update');root.hidden=true;document.body.append(root);
let showing=null,latestSeen=new Set(),timer=null,loading=false,hadInteraction=false;
const key='ew-alerts-seen';
try{const a=JSON.parse(sessionStorage.getItem(key)||'[]');if(Array.isArray(a))latestSeen=new Set(a.filter(x=>typeof x==='string').slice(-60))}catch{}
document.addEventListener('pointerdown',()=>{hadInteraction=true},{once:true});
document.addEventListener('keydown',()=>{hadInteraction=true},{once:true});
function beep(){
 if(!hadInteraction||!window.AudioContext)return;
 try{
  const ctx=new AudioContext();const osc=ctx.createOscillator(),vol=ctx.createGain();
  osc.type='sine';osc.frequency.value=900;
  vol.gain.setValueAtTime(.0001,ctx.currentTime);
  vol.gain.exponentialRampToValueAtTime(.035,ctx.currentTime+.025);
  vol.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.17);
  osc.connect(vol).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.19);
  osc.onended=()=>ctx.close().catch(()=>{});
 }catch{}
}
function hide(){
 if(timer!==null){clearTimeout(timer);timer=null}
 showing=null;root.hidden=true;root.innerHTML='';
}
function render(item){
 const source=safeUrl(item.sourceUrl);
 root.innerHTML='<article class="ew-alert-card ew-alert-'+safe(item.category)+'" role="alert" aria-live="assertive">'+
  '<div class="ew-alert-top"><div class="ew-alert-brand"><span class="ew-alert-pulse"></span>ELECTION UPDATE</div>'+
  '<button type="button" id="ewAlertDismiss" aria-label="Dismiss this Election Update">✕</button></div>'+
  '<div class="ew-alert-type">'+safe(kinds[item.category]||'IMPORTANT')+' · THE EVENING WIRE</div>'+
  '<p>'+safe(item.message)+'</p>'+
  (source?'<a href="'+safe(source)+'" target="_blank" rel="noopener noreferrer">VIEW ORIGINAL SOURCE ↗</a>':'')+
  '<footer>ADMIN BROADCAST · AUTOMATICALLY CLOSES IN 10 SECONDS</footer>'+
  '<div class="ew-alert-progress" aria-hidden="true"></div></article>';
 root.hidden=false;
 root.querySelector('#ewAlertDismiss').onclick=hide;
}
function deliver(item){
 const end=Date.parse(item.expiresAt);
 if(!Number.isFinite(end)||end<=Date.now()||latestSeen.has(item.id))return;
 latestSeen.add(item.id);
 try{sessionStorage.setItem(key,JSON.stringify([...latestSeen].slice(-60)))}catch{}
 if(timer!==null)clearTimeout(timer);
 showing=item.id;
 render(item);
 beep();
 // A notification's lifetime is fixed at ten seconds FROM PUBLISH TIME,
 // not ten more seconds after a late poll or page reload.
 timer=setTimeout(hide,Math.max(0,end-Date.now()));
}
async function refresh(){
 if(loading||document.hidden)return;loading=true;
 try{
  const res=await fetch('/api/updates',{cache:'no-store',credentials:'same-origin'});
  if(res.status===401){hide();return}
  if(!res.ok)return;
  const data=await res.json(),items=Array.isArray(data.updates)?data.updates:[];
  if(showing&&!items.some(u=>u.id===showing)){hide()}
  const incoming=items.find(u=>u?.id&&!latestSeen.has(u.id)&&Date.parse(u.expiresAt)>Date.now());
  if(incoming)deliver(incoming);
 }catch{}finally{loading=false}
}
refresh();
setInterval(refresh,1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden){hide()}else refresh()});
window.addEventListener('ew-owner-update-posted',refresh);
window.EWElectionUpdates={refresh};
})();