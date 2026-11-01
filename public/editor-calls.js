/* THE EVENING WIRE — secured owner-only election call publisher. */
(function(){
const stateNames='AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming'.split('|').map(x=>({code:x.slice(0,2),name:x.slice(3)}));
const nums=[7,1,9,4,52,8,5,1,28,14,2,2,17,9,4,4,6,6,2,8,9,13,8,4,8,2,3,4,2,12,3,26,14,1,15,5,6,17,2,7,1,9,38,4,1,11,10,2,8,1];
const dist=Object.fromEntries(stateNames.map((s,i)=>[s.code,nums[i]]));
const senate=new Set('AL AK AR CO DE GA ID IL IA KS KY LA ME MA MI MN MS MT NE NH NJ NM NC OK OR RI SC SD TN TX VA WV WY'.split(' '));
const governors=new Set('AL AK AZ AR CA CO CT FL GA HI ID IL IA KS ME MD MA MI MN NE NV NH NM NY OH OK OR PA RI SC SD TN TX VT WI WY'.split(' '));
const senateSpecial=new Set(['OH','FL']);
let open=false,logged=false,meta={},calls=[],busy=false,status='';
const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const q=id=>document.getElementById(id);
const callTitle=c=>(stateNames.find(s=>s.code===c.state)?.name||c.state)+' '+(c.office==='senate'?(c.special?'Special Senate':'Senate'):c.office==='governor'?'Governor':'House District '+c.district);
async function api(path,method,body){
 const r=await fetch(path,{method:method||'GET',credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={error:'Unexpected server response'}}
 if(!r.ok)throw Error(data.error||'Request failed');return data
}
async function check(){try{const d=await api('/api/admin/session');logged=d.authenticated;meta=d}catch(e){logged=false;status='Admin connection unavailable: '+e.message}}
function updateOptions(){
 const form=q('ewCallForm');if(!form)return;
 const office=form.elements.namedItem('office').value,state=form.elements.namedItem('state').value,special=form.elements.namedItem('special').checked;
 const legal=office==='governor'?governors:office==='senate'?(special?senateSpecial:senate):null;
 for(const option of form.elements.namedItem('state').options){option.disabled=!!legal&&!legal.has(option.value)}
 if(legal&&!legal.has(state)){form.elements.namedItem('state').value=office==='senate'&&special?'OH':[...legal][0]||'TX'}
 const house=form.querySelector('[data-house-district]'),sen=form.querySelector('[data-senate-special]');
 house.hidden=office!=='house';sen.hidden=office!=='senate';
 const district=form.elements.namedItem('district');district.innerHTML=Array.from({length:dist[form.elements.namedItem('state').value]||1},(_,i)=>'<option value="'+(i+1)+'">District '+(i+1)+'</option>').join('');
}
function view(){
 const panel=q('ewEditorMount');if(!panel)return;
 if(!open){
  panel.innerHTML='<section class="ew-editor-teaser"><div><span class="cmd-eyebrow">THE EVENING WIRE · EDITORIAL DESK</span><h3>OWNER RACE-CALL CONTROLS</h3><p>Only the authenticated owner can publish or retract election calls. Every published call includes an attributed source and a link to the original report.</p></div><button type="button" id="ewOpenEditor" class="cmd-primary">🔒 OPEN ADMIN DESK</button></section>';
  q('ewOpenEditor').onclick=async()=>{open=true;await check();if(logged)await load();view()};return
 }
 const warning=meta.storage==='temporary'?'<div class="cmd-notice"><strong>IMPORTANT: TEMPORARY STORAGE.</strong> Calls may disappear on server restart or deploy. Export your calls after changes. A PostgreSQL connection is still required for permanent publication.</div>':'';
 panel.innerHTML='<section class="ew-editor-console"><div class="ew-editor-head"><div><span class="cmd-eyebrow">PRIVATE · OWNER ONLY</span><h2>RACE CALL ADMIN DESK</h2><p>Editor-issued calls are displayed publicly as attributed editorial projections, not official certified results.</p></div><button type="button" id="ewCloseEditor" class="cmd-minibtn">CLOSE ✕</button></div>'+
 (!meta.configured?'<p class="cmd-notice">The owner password has not been configured on Render. Public visitors cannot publish calls.</p>':!logged?
 '<form id="ewEditorLogin" class="ew-admin-login"><label>ADMINISTRATOR PASSWORD<input name="password" type="password" autocomplete="current-password" required placeholder="Private owner password"></label><button type="submit" class="cmd-primary">UNLOCK PRIVATE DESK</button></form>':
 warning+
 '<form id="ewCallForm" class="ew-call-form">'+
 '<div class="ew-form-grid"><label>RACE / OFFICE<select name="office"><option value="senate">U.S. SENATE</option><option value="governor">GOVERNOR</option><option value="house">U.S. HOUSE — 435 DISTRICTS</option></select></label>'+
 '<label>STATE<select name="state">'+stateNames.map(s=>'<option value="'+s.code+'"'+(s.code==='TX'?' selected':'')+'>'+s.name+'</option>').join('')+'</select></label>'+
 '<label data-house-district hidden>CONGRESSIONAL DISTRICT<select name="district"></select></label>'+
 '<label data-senate-special><span>SPECIAL ELECTION</span><span class="ew-check-inline"><input type="checkbox" name="special"> Ohio or Florida special Senate election</span></label>'+
 '<label>WINNING CANDIDATE<input name="candidate" maxlength="130" required placeholder="Exact candidate name"></label>'+
 '<label>PARTY<select name="party"><option value="R">REPUBLICAN</option><option value="D">DEMOCRATIC</option><option value="I">INDEPENDENT</option><option value="OTHER">OTHER</option></select></label>'+
 '<label>SOURCE / NETWORK<input name="sourceName" maxlength="100" required placeholder="e.g. AP, Fox News, state election office"></label>'+
 '<label>LINK TO THE ORIGINAL RACE CALL<input name="sourceUrl" type="url" pattern="https://.*" required placeholder="https://example.com/actual-call-announcement"></label></div>'+
 '<label>EDITORIAL NOTE (OPTIONAL)<textarea name="note" rows="2" maxlength="400" placeholder="Clarification or source information"></textarea></label>'+
 '<label class="ew-check-inline"><input name="confirm" type="checkbox" required> I checked the source and confirm it has called this exact race for this candidate.</label>'+
 '<div class="ew-editor-actions"><button type="submit" class="cmd-primary">PUBLISH / UPDATE RACE CALL</button><button type="button" id="ewExportCalls">⬇ DOWNLOAD CALLS BACKUP</button><label class="ew-import-label">RESTORE BACKUP <input id="ewRestoreCalls" type="file" accept=".json,application/json"></label><button type="button" id="ewLogOut">LOG OUT</button></div></form>'+
 '<div class="ew-editor-managed"><h3>ALREADY CALLED — LOCKED ('+calls.length+')</h3><p>Once a race is called, another call for the same race is blocked. You may retract an incorrect call, but you cannot issue a duplicate.</p>'+
 (calls.length?calls.map(c=>'<div class="ew-managed-row"><div><b>'+safe(callTitle(c))+'</b><small>'+safe(c.candidate)+' · '+safe(c.sourceName)+' · '+safe(c.party)+'</small></div><button type="button" data-edit-call="'+safe(c.id)+'">EDIT</button><button type="button" class="ew-retract" data-retract-call="'+safe(c.id)+'">RETRACT</button></div>').join(''):'<p>There are no published editorial race calls yet.</p>')+'</div>')+
 '<p id="ewEditorStatus" role="status" class="reaction-status">'+safe(status)+'</p></section>';
 q('ewCloseEditor').onclick=()=>{open=false;view()};
 if(!logged){
  const login=q('ewEditorLogin');
  if(login)login.onsubmit=async e=>{e.preventDefault();try{const data=await api('/api/admin/login','POST',{password:login.elements.namedItem('password').value});login.elements.namedItem('password').value='';logged=data.authenticated;meta=data;status='Access granted to the private editorial desk.';await load();view()}catch(err){status=err.message;q('ewEditorStatus').textContent=status}};
  return;
 }
 const form=q('ewCallForm');updateOptions();
 form.elements.namedItem('office').onchange=updateOptions;form.elements.namedItem('state').onchange=updateOptions;form.elements.namedItem('special').onchange=updateOptions;
 form.onsubmit=async event=>{
  event.preventDefault();if(busy)return;busy=true;
  const d=new FormData(form),body={office:d.get('office'),state:d.get('state'),district:Number(d.get('district')||0),special:form.elements.namedItem('special').checked,candidate:d.get('candidate'),party:d.get('party'),sourceName:d.get('sourceName'),sourceUrl:d.get('sourceUrl'),note:d.get('note'),confirm:form.elements.namedItem('confirm').checked};
  try{if(calls.some(c=>c.id===body.office+'-'+body.state+(body.office==='house'?'-'+body.district:body.office==='senate'&&body.special?'-special':'')))throw Error('Already called and locked. Choose an uncalled race.');await api('/api/admin/calls','POST',body);status='PUBLISHED. The race call is now available to visitors. Download a backup if storage is temporary.';await load();view();window.dispatchEvent(new CustomEvent('ew-calls-updated'))}catch(err){status=err.message;q('ewEditorStatus').textContent=status}finally{busy=false}
 };
 q('ewExportCalls').onclick=async()=>{
  try{const data=await api('/api/admin/backup');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='evening-wire-race-calls-backup.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),3000);status='Backup downloaded.';q('ewEditorStatus').textContent=status}catch(err){q('ewEditorStatus').textContent=err.message}
 };
 q('ewRestoreCalls').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;if(!confirm('Replace every editorial race call with this backup?'))return;
  try{const data=JSON.parse(await file.text());await api('/api/admin/restore','POST',data);status='Backup restored.';await load();view();window.dispatchEvent(new CustomEvent('ew-calls-updated'))}catch(err){q('ewEditorStatus').textContent=err.message}
 };
 q('ewLogOut').onclick=async()=>{try{await api('/api/admin/logout','POST')}catch{}logged=false;status='Logged out.';view()};
 panel.querySelectorAll('[data-edit-call]').forEach(b=>b.onclick=()=>{
  const c=calls.find(x=>x.id===b.dataset.editCall);if(!c)return;
  form.elements.namedItem('office').value=c.office;form.elements.namedItem('special').checked=c.special===true;form.elements.namedItem('state').value=c.state;updateOptions();
  if(c.office==='house')form.elements.namedItem('district').value=String(c.district);
  for(const key of ['candidate','party','sourceName','sourceUrl','note'])form.elements.namedItem(key).value=c[key]||'';
  form.elements.namedItem('confirm').checked=false;form.scrollIntoView({behavior:'smooth',block:'center'});
  q('ewEditorStatus').textContent='Editing '+callTitle(c)+'. Verify the winner and source before republishing.';
 });
 panel.querySelectorAll('[data-retract-call]').forEach(b=>b.onclick=async()=>{
  const c=calls.find(x=>x.id===b.dataset.retractCall);
  if(!c||!confirm('RETRACT the published call for '+callTitle(c)+'? This removes it for all visitors.'))return;
  try{await api('/api/admin/retract','POST',{id:c.id});status='Call retracted for every visitor.';await load();view();window.dispatchEvent(new CustomEvent('ew-calls-updated'))}catch(err){q('ewEditorStatus').textContent=err.message}
 });
}
async function load(){
 try{const result=await api('/api/editor/calls');calls=Array.isArray(result.calls)?result.calls:[];meta={...meta,...result}}catch(err){status=err.message}
}
function mount(){if(!q('ewEditorMount'))return;if(!open){view();return}view()}
window.EWEditor={mount,isEditing:()=>open,load:async()=>{await load();if(open)view()}};
})();
