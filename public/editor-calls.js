/* THE EVENING WIRE — owner-only, named-candidate election call selector.
   Uses the same 506-race roster as the public Senate, House and Governor tabs.
   The ONLY way to publish a winner is the authenticated owner's action. */
(function(){
'use strict';
const states='AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming'.split('|').map(x=>({code:x.slice(0,2),name:x.slice(3)}));
const stateName=code=>states.find(s=>s.code===code)?.name||code;
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=id=>document.getElementById(id);
const parties={R:'REPUBLICAN',D:'DEMOCRAT',I:'INDEPENDENT',OTHER:'OTHER'};
const roster=()=>window.EWRaceCatalog?.races||[];
const byKey=key=>window.EWRaceCatalog?.byKey?.[key]||null;
const title=x=>stateName(x.state)+' '+(x.office==='senate'?(x.special?'Special Senate':'Senate'):x.office==='governor'?'Governor':'House District '+x.district);
const label=x=>title(x)+' — '+(x.candidates||[]).slice(0,2).map(c=>c.name).join(' vs ');
let open=false,logged=false,meta={},calls=[],busy=false,status='',officeFilter='senate',stateFilter='OH',raceKey='senate-OH-special';
async function api(path,method='GET',body){
 const resp=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 let data={};try{data=await resp.json()}catch{}
 if(!resp.ok)throw Error(data.error||'The editorial service is unavailable');return data;
}
async function check(){
 try{const result=await api('/api/admin/session');logged=result.authenticated===true;meta=result}catch(e){logged=false;status=e.message}
}
async function load(){
 try{const result=await api('/api/editor/calls');calls=Array.isArray(result.calls)?result.calls:[];meta={...meta,...result}}
 catch(err){status=err.message}
}
function namedWinner(c,i){
 return '<label class="ew-winner-option"><input type="radio" name="winner" value="'+i+'" required>'+
  '<span><b>'+safe(c.party==='R'?'🔴 REPUBLICAN':c.party==='D'?'🔵 DEMOCRAT':'⚪ INDEPENDENT / OTHER')+'</b><br>'+
  safe(c.name)+(c.status==='confirmed'?'':' <small>· NOMINEE STATUS REQUIRES VERIFICATION</small>')+'</span></label>';
}
function populateStates(){
 const form=q('ewCallForm');if(!form)return;
 const state=form.elements.namedItem('state');
 const validStates=new Set(roster().filter(x=>x.office===officeFilter).map(x=>x.state));
 state.innerHTML='<option value="ALL">ALL STATES</option>'+states.filter(x=>validStates.has(x.code)).map(x=>
  '<option value="'+x.code+'">'+safe(x.name)+'</option>').join('');
 if(!validStates.has(stateFilter))stateFilter='ALL';
 state.value=stateFilter;
}
function populateRaces(){
 const form=q('ewCallForm');if(!form)return;
 const element=form.elements.namedItem('raceKey');
 const list=roster().filter(x=>x.office===officeFilter&&(stateFilter==='ALL'||x.state===stateFilter))
  .sort((a,b)=>a.state.localeCompare(b.state)||(a.district||0)-(b.district||0));
 element.innerHTML=list.map(x=>'<option value="'+safe(x.key)+'">'+safe(title(x))+
  (calls.some(c=>c.id===x.key)?' — ALREADY CALLED / LOCKED':'')+'</option>').join('');
 if(!list.some(x=>x.key===raceKey))raceKey=list.find(x=>!calls.some(c=>c.id===x.key))?.key||list[0]?.key||'';
 element.value=raceKey;
 populateCandidates();
}
function populateCandidates(){
 const form=q('ewCallForm'),area=q('ewCandidateChoices'),button=q('ewPublishCall');if(!form||!area)return;
 const race=byKey(form.elements.namedItem('raceKey').value),called=calls.find(c=>c.id===race?.key);
 if(!race){
  area.innerHTML='<div class="ew-call-disabled">Candidate roster unavailable. No calls can be published until it loads.</div>';
  if(button)button.disabled=true;
  return;
 }
 if(called){
  area.innerHTML='<div class="ew-call-disabled"><strong>🔒 THIS RACE HAS ALREADY BEEN CALLED.</strong><br>'+
  safe(called.candidate)+' · '+safe(parties[called.party]||called.party)+'. A second call is blocked. Existing race calls appear below.</div>';
  if(button)button.disabled=true;return;
 }
 if(button)button.disabled=!race.candidates?.length;
 const choices=(race.candidates||[]).map(namedWinner).join('');
 area.innerHTML='<div class="ew-call-race-panel"><strong>'+safe(title(race))+'</strong>'+
  '<p>Choose the winner below. The candidate name and party are entered automatically.</p>'+
  (choices||'<p>No candidates confirmed for this election.</p>')+
  (race.note?'<p class="ew-candidate-provenance">'+safe(race.note)+'</p>':'')+
  '<p class="ew-candidate-provenance">Curated candidates: <a href="https://github.com/ElectIndex/26_us_forecast_data/blob/main/races.csv" target="_blank" rel="noopener noreferrer">ElectIndex roster</a> (not an official certified ballot). Verify the actual winner before publishing. Citing a source is optional.</p></div>';
}
function wireForm(){
 const form=q('ewCallForm');if(!form)return;
 form.elements.namedItem('office').value=officeFilter;
 populateStates();populateRaces();
 form.elements.namedItem('office').onchange=()=>{
  officeFilter=form.elements.namedItem('office').value;
  populateStates();populateRaces();
 };
 form.elements.namedItem('state').onchange=()=>{
  stateFilter=form.elements.namedItem('state').value;
  populateRaces();
 };
 form.elements.namedItem('raceKey').onchange=()=>{
  raceKey=form.elements.namedItem('raceKey').value;
  populateCandidates();
 };
 form.onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  const selected=byKey(form.elements.namedItem('raceKey').value);
  const candidateIdx=form.querySelector('input[name="winner"]:checked')?.value;
  const winner=selected?.candidates?.[Number(candidateIdx)];
  if(!selected||candidateIdx==null||!winner){status='Select a race and click the radio button beside the winning candidate.';q('ewEditorStatus').textContent=status;return}
  if(calls.some(c=>c.id===selected.key)){status='This race is already called and locked.';q('ewEditorStatus').textContent=status;populateCandidates();return}
  const data=new FormData(form);
  const payload={office:selected.office,state:selected.state,district:selected.district||null,special:selected.special===true,
    candidate:winner.name,party:winner.party,sourceName:data.get('sourceName'),sourceUrl:data.get('sourceUrl'),note:data.get('note'),confirm:data.get('confirm')==='on'};
  busy=true;q('ewPublishCall').disabled=true;
  try{
   await api('/api/admin/calls','POST',payload);
   status='PUBLISHED: '+title(selected)+' called for '+winner.name+'. This race is now locked.';
   await load();view();window.dispatchEvent(new Event('ew-calls-updated'));
  }catch(err){status=err.message;q('ewEditorStatus').textContent=status;populateCandidates()}
  finally{busy=false}
 };
 q('ewExportCalls').onclick=async()=>{
  try{
   const data=await api('/api/admin/backup'),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='evening-wire-race-calls-backup.json';anchor.click();
   setTimeout(()=>URL.revokeObjectURL(url),3000);q('ewEditorStatus').textContent='Backup downloaded.';
  }catch(err){q('ewEditorStatus').textContent=err.message}
 };
 q('ewRestoreCalls').onchange=async e=>{
  const file=e.target.files?.[0];
  if(!file||!window.confirm('Replace published race calls with this backup? Original call locks remain enforced.'))return;
  try{await api('/api/admin/restore','POST',JSON.parse(await file.text()));await load();status='Backup restored.';view();window.dispatchEvent(new Event('ew-calls-updated'))}
  catch(err){q('ewEditorStatus').textContent=err.message}
 };
 q('ewLogOut').onclick=async()=>{
  try{await api('/api/admin/logout','POST')}catch{}
  logged=false;status='Administrator signed out.';view();
 };
 q('ewCloseEditor').onclick=()=>{open=false;view()};
 q('ewEditorMount').querySelectorAll('[data-retract-call]').forEach(btn=>btn.onclick=async()=>{
  const c=calls.find(x=>x.id===btn.dataset.retractCall);
  if(!c||!window.confirm('Retract '+title(c)+'? The original call lock will remain for this race.'))return;
  try{await api('/api/admin/retract','POST',{id:c.id});status='Call withdrawn; original call lock preserved.';await load();view();window.dispatchEvent(new Event('ew-calls-updated'))}
  catch(err){q('ewEditorStatus').textContent=err.message}
 });
}
function view(){
 const panel=q('ewEditorMount');if(!panel)return;
 if(!open){
  panel.innerHTML='<section class="ew-editor-teaser"><div><span class="cmd-eyebrow">THE EVENING WIRE · OWNER DESK</span>'+
   '<h3>🔒 RACE CALL ADMIN CONTROLS</h3><p>Choose any of 506 races, click a named candidate, and publish your verified editorial call. Only the site owner can call winners.</p></div>'+
   '<button type="button" id="ewOpenEditor" class="cmd-primary">OPEN ADMIN RACE CALL DESK</button></section>';
  q('ewOpenEditor').onclick=async()=>{open=true;await check();if(logged){await window.EWRaceCatalogPromise;await load()}view()};
  return;
 }
 const warning=meta.storage==='temporary'?'<div class="cmd-notice">Database unavailable for permanent calls: export backups.</div>':'';
 const locked=calls.map(c=>'<div class="ew-managed-row"><div><b>'+safe(title(c))+'</b>'+
   '<small>'+safe(c.candidate)+' · '+(c.sourceName?safe(c.sourceName)+' · ':'OWNER EDITORIAL CALL · ')+safe(parties[c.party]||c.party)+'</small></div>'+
   '<span class="cmd-pill good">CALLED · LOCKED</span>'+
   '<button class="ew-retract" type="button" data-retract-call="'+safe(c.id)+'">RETRACT</button></div>').join('');
 panel.innerHTML='<section class="ew-editor-console"><div class="ew-editor-head"><div><span class="cmd-eyebrow">ADMIN ONLY · THE EVENING WIRE</span>'+
  '<h2>RACE CALL DESK</h2><p>All 506 election contests are selectable, including Ohio and Florida special Senate elections.</p></div>'+
  '<button type="button" id="ewCloseEditor" class="cmd-minibtn">CLOSE ✕</button></div>'+
  (!meta.configured?'<p class="cmd-notice">Administrator password is not configured.</p>':!logged?
   '<form id="ewEditorLogin" class="ew-admin-login"><label>OWNER ADMIN PASSWORD<input name="password" type="password" autocomplete="current-password" required></label>'+
   '<button type="submit" class="cmd-primary">UNLOCK RACE CALL DESK</button></form>':
  warning+'<form id="ewCallForm" class="ew-call-form">'+
  '<div class="ew-form-grid"><label>1. OFFICE<select name="office"><option value="senate">U.S. SENATE · 35</option><option value="house">U.S. HOUSE · 435</option><option value="governor">GOVERNORS · 36</option></select></label>'+
  '<label>2. STATE<select name="state"></select></label>'+
  '<label>3. CHOOSE RACE<select name="raceKey" required></select></label></div>'+
  '<div id="ewCandidateChoices" aria-live="polite"></div>'+
  '<div class="ew-form-grid"><label>ORIGINAL SOURCE / NETWORK (OPTIONAL)<input name="sourceName" maxlength="100" placeholder="Name the reporting outlet, if available"></label>'+
  '<label>LINK TO SOURCE (OPTIONAL)<input name="sourceUrl" type="url" pattern="https://.*" placeholder="https://example.com/race-call"></label></div>'+
  '<label>EDITORIAL NOTE (OPTIONAL)<textarea name="note" maxlength="400" rows="2"></textarea></label>'+
  '<label class="ew-check-inline"><input name="confirm" type="checkbox" required> I reviewed the election outcome and confirm this is my editorial race call. A source is optional.</label>'+
  '<div class="ew-editor-actions"><button type="submit" class="cmd-primary" id="ewPublishCall">PUBLISH WINNER · LOCK RACE</button>'+
  '<button type="button" id="ewExportCalls">⬇ BACKUP CALLS</button>'+
  '<label class="ew-import-label">RESTORE BACKUP <input id="ewRestoreCalls" type="file" accept=".json,application/json"></label>'+
  '<button type="button" id="ewLogOut">OWNER LOG OUT</button></div></form>'+
  '<div class="ew-editor-managed"><h3>RACES ALREADY CALLED ('+calls.length+')</h3>'+
  '<p>These races are locked against duplicate calls. Retracting a call never permits a second first call.</p>'+
  (locked||'<p>No races have been called yet.</p>')+'</div>')+
  '<p class="reaction-status" id="ewEditorStatus" role="status">'+safe(status)+'</p></section>';
 q('ewCloseEditor').onclick=()=>{open=false;view()};
 if(!logged){
  const form=q('ewEditorLogin');
  if(form)form.onsubmit=async e=>{
   e.preventDefault();
   try{
    const result=await api('/api/admin/login','POST',{password:form.elements.namedItem('password').value});
    logged=result.authenticated===true;meta=result;
    await window.EWRaceCatalogPromise;await load();status='Owner verified. Choose a race and its winner.';view();
   }catch(err){status=err.message;q('ewEditorStatus').textContent=status}
  };
  return;
 }
 wireForm();
}
async function mount(){if(!q('ewEditorMount'))return;if(open&&logged&&roster().length===0)await window.EWRaceCatalogPromise;view()}
window.EWEditor={mount,isEditing:()=>open,load:async()=>{await load();if(open)view()}};
window.addEventListener('ew-race-catalog-ready',()=>{if(open&&logged&&q('ewEditorMount'))view()});
})();