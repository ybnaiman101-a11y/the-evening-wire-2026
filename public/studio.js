/* THE EVENING WIRE — Elections studio: authentic U.S. maps, historical swings,
   member predictions, and separate admin-attested official final results. */
(function(){
'use strict';
const app=document.getElementById('commandDesk');if(!app)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names=window.EWMaps?.NAMES||{};
const states=()=>window.EWRaceCatalog?.races||[];
const namesByKey=key=>window.EWRaceCatalog?.byKey?.[key];
const title=r=>(names[r.state]||r.state)+' '+(r.office==='senate'?(r.special?'Special Senate':'Senate'):r.office==='governor'?'Governor':'House '+r.district);
const choice=c=>c.party+'|'+c.name;
const party=p=>p==='R'?'REPUBLICAN':p==='D'?'DEMOCRAT':p==='I'?'INDEPENDENT':'OTHER';
const fmt=n=>Number(n||0).toLocaleString('en-US');
const round=n=>Number(n).toFixed(2);
const fmtMargin=v=>(v>=0?'R +':'D +')+Math.abs(v).toFixed(2)+' points';
const renderKey=r=>r.key;
const time=x=>{const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'})+' ET':'Not available'};
const sourceLink=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:'#'}catch{return '#'}};
const get=async endpoint=>{
 const r=await fetch(endpoint,{credentials:'same-origin',cache:'no-store'});
 const body=await r.json();if(!r.ok)throw Error(body.error||'Server unavailable');return body
};
const post=async(endpoint,body)=>{
 const r=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Request not accepted');return data
};
let mode='senate',active='map',selected=null,err='',results={calls:[],races:[]},historical=null,challenge=null,admin=false;
let predOffice='senate',predState='OH',predRace='senate-OH-special',predNotice='',finalNotice='',swingState='TX',open=false;
function renderHeader(page,description,activeTab){
 return '<div class="ew-studio-hero"><div class="cmd-eyebrow">THE EVENING WIRE · ELECTION NIGHT 2026</div><h1>'+esc(page)+'</h1><p>'+esc(description)+'</p>'+
  '<div class="ew-studio-switch"><button data-ew-studio="map" class="'+(activeTab==='map'?'sel':'')+'">🗺 LIVE ELECTION MAP</button>'+
  '<button data-ew-studio="swing" class="'+(activeTab==='swing'?'sel':'')+'">↗ SWING ANALYZER</button>'+
  '<button data-ew-studio="challenge" class="'+(activeTab==='challenge'?'sel':'')+'">✦ PREDICTION CHALLENGE</button></div></div>';
}
function setupLinks(){
 app.querySelectorAll('[data-ew-studio]').forEach(b=>b.onclick=()=>{
  window.location.hash='#'+(b.dataset.ewStudio==='map'?'election-map':b.dataset.ewStudio==='swing'?'swing':'predictions');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  if(window.EWStudio?.open)window.EWStudio.open(b.dataset.ewStudio);
 })
}
function subsetCalls(office){
 return (results.calls||[]).filter(c=>c.office===office&&c.editorial===true&&['R','D','I','OTHER'].includes(c.party)&&c.sourceUrl?.startsWith('https://'))
}
function mapStats(){
 const list=subsetCalls(mode),total=mode==='senate'?35:mode==='house'?435:36;
 const count=p=>list.filter(c=>c.party===p).length;
 return '<div class="ew-studio-stats">'+[
 ['TOTAL 2026 RACES',total,'All eligible seats'],
 ['REPUBLICAN CALLS',count('R'),'Evening Wire projections'],
 ['DEMOCRATIC CALLS',count('D'),'Evening Wire projections'],
 ['STILL NOT CALLED',Math.max(0,total-list.length),'No winner inferred']
 ].map(x=>'<div class="ew-studio-stat"><small>'+x[0]+'</small><b>'+x[1]+'</b><span>'+x[2]+'</span></div>').join('')+'</div>';
}
function mapSelection(){
 if(!selected)return '<p>Click a state or House district on the map to inspect its candidates and source-linked Evening Wire calls. Use the tabs to switch between offices.</p>';
 const races=states().filter(x=>x.office===mode&&x.state===selected.state&&(mode!=='house'||x.district===selected.district));
 if(!races.length)return '<p>No scheduled 2026 '+esc(mode)+' contest is listed in this location.</p>';
 return races.map(r=>{
  const call=(results.calls||[]).find(x=>x.id===r.key);
  return '<div class="ew-map-selected"><b>'+esc(title(r))+'</b>'+
   '<div class="ew-map-names">'+(r.candidates||[]).map(c=>'<p><span class="ew-studio-party '+(c.party==='R'?'red':c.party==='D'?'blue':'gold')+'">'+esc(party(c.party))+'</span> '+esc(c.name)+'</p>').join('')+'</div>'+
   (call?'<div class="ew-projection-status '+(call.party==='R'?'red':'blue')+'"><b>EVENING WIRE CALL:</b> '+esc(call.candidate)+
    '<p>Editorial projection — NOT official certification</p><a target="_blank" rel="noopener noreferrer" href="'+esc(sourceLink(call.sourceUrl))+'">'+esc(call.sourceName)+' · Original source ↗</a></div>':
    '<div class="ew-uncalled">NOT CALLED · No editorial winner published</div>')+'</div>'
 }).join('');
}
function mapView(){
 app.innerHTML=renderHeader('ELECTION NIGHT LIVE MAP','Official U.S. Census boundaries · only your attributed race calls determine winning colors · never AP or headlines','map')+
 '<div class="ew-studio-toolbar">'+[['senate','U.S. SENATE · 35'],['house','U.S. HOUSE · 435'],['governor','GOVERNORS · 36']].map(([v,l])=>
 '<button type="button" data-ew-map-mode="'+v+'" class="'+(v===mode?'sel':'')+'">'+l+'</button>').join('')+
 '<button type="button" id="ewMapRefresh">↻ REFRESH CALLS</button></div>'+
 '<div id="ewLiveMapStats">'+mapStats()+'</div><div class="ew-map-grid"><section class="ew-map-main"><div id="ewStudioMap" class="ew-studio-map" aria-label="Accurate United States election map"></div>'+
 '<div class="ew-map-legend"><span><i class="red"></i> GOP CALLED</span><span><i class="blue"></i> DEMOCRAT CALLED</span><span><i class="gray"></i> NOT CALLED</span><span><i class="dark"></i> NO 2026 CONTEST</span></div>'+
 '<p class="ew-studio-note">Geographic boundaries: U.S. Census TIGERweb. Map colors represent only the site owner’s sourced editorial calls, not official results. Ohio and Florida are special Senate elections.</p></section>'+
 '<aside class="ew-map-aside"><h3>RACE INSPECTOR</h3><div id="ewMapInspector">'+mapSelection()+'</div>'+
 '<h3>LATEST RACE CALLS</h3><div id="ewMapLatest">'+mapLatest()+'</div></aside></div>';
 setupLinks();
 app.querySelectorAll('[data-ew-map-mode]').forEach(btn=>btn.onclick=()=>{mode=btn.dataset.ewMapMode;selected=null;mapView()});
 app.querySelector('#ewMapRefresh').onclick=()=>reloadMap(true);
 mountMap();
}
function mapLatest(){
 const list=subsetCalls(mode).slice().sort((a,b)=>Date.parse(b.calledAt)-Date.parse(a.calledAt)).slice(0,10);
 if(!list.length)return '<p>No sourced owner calls in this office yet. Gray means uncalled, not tied.</p>';
 return list.map(c=>{
  const race=namesByKey(c.id);
  return '<div class="ew-studio-call"><b>'+esc(race?title(race):c.state+' '+c.office)+'</b><span class="ew-studio-party '+(c.party==='R'?'red':'blue')+'">'+esc(c.party)+'</span>'+
   '<p>'+esc(c.candidate)+'</p><a href="'+esc(sourceLink(c.sourceUrl))+'" target="_blank" rel="noopener noreferrer">'+esc(c.sourceName)+' ↗</a></div>';
 }).join('');
}
function mountMap(){
 const host=app.querySelector('#ewStudioMap');if(!host||!window.EWMaps?.mount)return;
 window.EWMaps.mount(host,{mode,mini:false,results,
  senateStates:states().filter(x=>x.office==='senate').map(x=>x.state),
  governorStates:states().filter(x=>x.office==='governor').map(x=>x.state),
  senateSpecialStates:['OH','FL'],
  onSelect:loc=>{
   selected=loc;
   const el=app.querySelector('#ewMapInspector');if(el)el.innerHTML=mapSelection()
  }});
}
async function reloadMap(force=false){
 try{
  const data=await get('/api/election'),before=JSON.stringify(results.calls||[]);
  results=data;
  if(active==='map'&&(force||before!==JSON.stringify(results.calls||[])))mapView();
 }catch(e){err=e.message;if(force){const p=app.querySelector('.ew-map-aside');if(p)p.insertAdjacentHTML('afterbegin','<p class="ew-studio-note">'+esc(err)+'</p>')}}
}
function historicLine(code,y){
 const obj=historical?.states?.[code]?.[y];return obj?{...obj,margin:obj.repPct-obj.demPct}:null
}
function stateOptions(selectedCode){
 return Object.entries(window.EWMaps?.NAMES||{}).sort((a,b)=>a[1].localeCompare(b[1]))
  .map(([code,label])=>'<option value="'+esc(code)+'"'+(code===selectedCode?' selected':'')+'>'+esc(label)+'</option>').join('')
}
function delta(v){return (v>=0?'+':'')+round(v)+' points'}
function bar(label,value,more){
 const v=Math.min(85,Math.max(4,50+(value||0)*.55));
 return '<div class="ew-swing-row"><span>'+esc(label)+'</span><div class="ew-swing-bar"><div class="ew-swing-mid"></div>'+
  '<i class="'+(value>=0?'r':'d')+'" style="width:'+Math.abs(v-50)+'%;left:'+(value>=0?'50%':v+'%')+'"></i></div>'+
  '<b>'+fmtMargin(value)+'</b><small>'+esc(more||'')+'</small></div>'
}
function swingFinals(code){
 return (challenge?.finals||[]).filter(f=>namesByKey(f.raceKey)?.state===code).sort((a,b)=>(namesByKey(a.raceKey)?.office||'').localeCompare(namesByKey(b.raceKey)?.office||''));
}
function swingDetail(){
 const p20=historicLine(swingState,'2020'),p24=historicLine(swingState,'2024');
 if(!p20||!p24)return '<p>Historic source unavailable for selected state.</p>';
 const margin20=p20.margin,margin24=p24.margin,change=margin24-margin20;
 const turnout=(p24.totalVotes-p20.totalVotes)/p20.totalVotes*100;
 const finals=swingFinals(swingState);
 return '<div class="ew-swing-state-head"><h2>'+esc((window.EWMaps?.NAMES||{})[swingState]||swingState)+'</h2><p>Actual statewide presidential baseline — Republican margin minus Democratic margin</p></div>'+
 bar('2020 · PRESIDENT',margin20,'TOTAL VOTES '+fmt(p20.totalVotes))+
 bar('2024 · PRESIDENT',margin24,'TOTAL VOTES '+fmt(p24.totalVotes))+
 '<div class="ew-swing-metrics"><div><small>2020 → 2024 PRESIDENTIAL MARGIN CHANGE</small><strong>'+delta(change)+'</strong><p>'+(change>=0?'Republican':'Democratic')+' relative shift</p></div>'+
 '<div><small>2020 → 2024 PRESIDENTIAL VOLUME CHANGE</small><strong>'+(turnout>=0?'+':'')+turnout.toFixed(2)+'%</strong><p>Ballots counted, not turnout rate</p></div></div>'+
 '<h3>2026 OFFICIAL FINALS (IF AVAILABLE)</h3>'+
 (finals.length?finals.map(f=>{
  const race=namesByKey(f.raceKey),numerical=f.repVotes!==null&&f.demVotes!==null&&f.totalVotes>0;
  const margin=numerical?(f.repVotes-f.demVotes)/f.totalVotes*100:null;
  return '<div class="ew-final-swing"><b>'+esc(race?title(race):f.raceKey)+'</b>'+
   '<p>Owner-entered final winner: '+esc(f.choice.split('|').slice(1).join('|'))+
   ' · <a href="'+esc(sourceLink(f.sourceUrl))+'" target="_blank" rel="noopener noreferrer">'+esc(f.sourceName)+' ↗</a></p>'+
   (numerical?bar('2026 · '+race?.office?.toUpperCase(),margin,'FINAL SOURCE-LINKED VOTES '+fmt(f.totalVotes)):
    '<p>Final vote totals have not been recorded, so no numerical swing can be calculated.</p>')+
   (numerical?'<p class="ew-studio-note">Relative to the 2024 presidential statewide margin: '+delta(margin-margin24)+'. Different office and electorate; this is a comparison, not a like-for-like swing.</p>':'')+
   '</div>'
 }).join(''):'<div class="ew-studio-empty">No owner-entered official final results for this state yet. Editorial race calls are deliberately excluded from this section.</div>')+
 '<p class="ew-studio-note">Presidential baseline source: <a href="https://www.presidency.ucsb.edu/statistics/elections/2020" target="_blank" rel="noopener noreferrer">2020</a> and <a href="https://www.presidency.ucsb.edu/statistics/elections/2024" target="_blank" rel="noopener noreferrer">2024</a>, American Presidency Project (UCSB), compiled from state results. County comparisons require verified county-by-county data; none are fabricated.</p>';
}
function swingView(){
 app.innerHTML=renderHeader('ELECTION SWING ANALYZER','Compare verified 2020 and 2024 state presidential results; show 2026 only after documented official results become available','swing')+
 '<div class="ew-studio-toolbar"><label>CHOOSE A STATE <select id="ewSwingState">'+stateOptions(swingState)+'</select></label>'+
 '<span class="ew-studio-note">Red = Republican margin · Blue = Democratic margin</span></div>'+
 '<div class="ew-swing-layout"><section class="ew-studio-panel" id="ewSwingDetail">'+swingDetail()+'</section>'+
 '<aside class="ew-studio-panel"><h3>STATEWIDE HISTORICAL CHANGE · 2020 → 2024</h3><p>Positive movement means the Republican margin grew between presidential elections; negative movement means it shrank.</p>'+
 '<div class="ew-swing-table-wrap"><table><thead><tr><th>STATE</th><th>2020</th><th>2024</th><th>Δ R MARGIN</th></tr></thead><tbody>'+
 Object.keys(historical?.states||{}).sort().map(code=>{
  const v20=historicLine(code,'2020'),v24=historicLine(code,'2024');
  return '<tr data-ew-swing-pick="'+esc(code)+'"><td><button type="button" data-ew-swing-state="'+esc(code)+'">'+esc(code)+'</button></td>'+
   '<td>'+fmtMargin(v20.margin)+'</td><td>'+fmtMargin(v24.margin)+'</td><td class="'+(v24.margin-v20.margin>=0?'ew-rchange':'ew-dchange')+'">'+delta(v24.margin-v20.margin)+'</td></tr>'
 }).join('')+'</tbody></table></div></aside></div>';
 setupLinks();
 app.querySelector('#ewSwingState').onchange=e=>{swingState=e.target.value;app.querySelector('#ewSwingDetail').innerHTML=swingDetail()};
 app.querySelectorAll('[data-ew-swing-state]').forEach(b=>b.onclick=()=>{swingState=b.dataset.ewSwingState;app.querySelector('#ewSwingState').value=swingState;app.querySelector('#ewSwingDetail').innerHTML=swingDetail();app.querySelector('#ewSwingDetail').scrollIntoView({behavior:'smooth',block:'center'})});
}
function pickStateOptions(){
 const codes=[...new Set(states().filter(r=>r.office===predOffice).map(r=>r.state))].sort();
 return codes.map(c=>'<option value="'+esc(c)+'"'+(c===predState?' selected':'')+'>'+esc((window.EWMaps?.NAMES||{})[c]||c)+'</option>').join('')
}
function chooseRaces(){
 return states().filter(x=>x.office===predOffice&&x.state===predState).sort((a,b)=>(a.district||0)-(b.district||0))
}
function winnerChoiceText(value){return (String(value||'').split('|').slice(1).join('|'))||String(value||'')}
function deadlineText(){return 'Nov 3, 2026 · 12:00 AM EST'}
function predictionEditor(){
 const r=namesByKey(predRace),mine=challenge?.my?.find(x=>x.raceKey===predRace),final=challenge?.finals?.find(x=>x.raceKey===predRace);
 if(!r)return '<p class="ew-studio-note">Choose an eligible race to see its candidates.</p>';
 const eligible=!mine&&!challenge?.locked&&!final;
 const votes=(challenge?.poll||[]).filter(p=>p.raceKey===predRace),sum=votes.reduce((a,x)=>a+x.count,0);
 const census='<div class="ew-pred-vote-summary"><b>COMMUNITY FORECAST · '+fmt(sum)+' ENTRIES</b>'+
 r.candidates.map(c=>{
  const v=votes.find(x=>x.choice===choice(c))?.count||0,p=sum?Math.round(v/sum*100):0;
  return '<div class="ew-pred-row"><span>'+esc(c.name)+'</span><strong>'+p+'% ('+v+')</strong><div class="ew-pred-track"><i class="'+(c.party==='R'?'r':'d')+'" style="width:'+p+'%"></i></div></div>'
 }).join('')+'</div>';
 return '<div class="ew-studio-panel"><h3>'+esc(title(r))+'</h3>'+
 (mine?'<div class="ew-pred-locked"><b>✓ YOUR PICK IS LOCKED</b><p>You chose '+esc(winnerChoiceText(mine.choice))+' on '+esc(time(mine.createdAt))+'. You cannot enter this race again.</p></div>':
 final?'<div class="ew-pred-locked">An official final has been recorded. New predictions are closed for this race.</div>':
 !eligible?'<div class="ew-pred-locked">Predictions are closed. The deadline was '+deadlineText()+'.</div>':
 '<form id="ewPredictForm"><p>Who will win? One prediction per member per race. No revisions and no monetary stakes.</p>'+
 r.candidates.map(c=>'<label class="ew-pred-option"><input name="choice" type="radio" value="'+esc(choice(c))+'" required><span class="ew-studio-party '+(c.party==='R'?'red':c.party==='D'?'blue':'gold')+'">'+esc(party(c.party))+'</span> <b>'+esc(c.name)+'</b></label>').join('')+
 '<button type="submit" class="ew-studio-primary">LOCK IN MY PREDICTION</button></form>')+
 (final?'<p class="ew-studio-note">Official final entered by owner: '+esc(winnerChoiceText(final.choice))+' · <a href="'+esc(sourceLink(final.sourceUrl))+'" target="_blank" rel="noopener noreferrer">'+esc(final.sourceName)+'</a></p>':'')+
 '<p class="ew-studio-note" id="ewPredictionNote">'+esc(predNotice)+'</p>'+census+'</div>';
}
function leaderboard(){
 const entries=challenge?.leaderboard||[];
 return '<section class="ew-studio-panel"><h3>COMMUNITY LEADERBOARD</h3><p>Scored only against separately source-linked final results—not Evening Wire race calls.</p>'+
 '<div class="ew-leaderboard"><table><thead><tr><th>#</th><th>MEMBER</th><th>CORRECT</th><th>SCORED</th><th>PICKS</th></tr></thead><tbody>'+
 (entries.length?entries.map((e,i)=>'<tr><td>'+Number(i+1)+'</td><td>'+esc(e.name)+'</td><td>'+e.correct+'</td><td>'+e.scored+'</td><td>'+e.predictions+'</td></tr>').join(''):
 '<tr><td colspan="5">No predictions yet. Be the first to participate.</td></tr>')+'</tbody></table></div>'+
 '<p class="ew-studio-note">Predictions are informational. No cash prizes, betting, wagers, or odds markets.</p></section>';
}
function adminPanel(){
 if(!admin)return '<div class="ew-studio-panel ew-admin-final-access"><h3>OWNER · RECORD OFFICIAL FINALS</h3>'+
  '<p>After election officials certify results, the owner can add source-linked finals here. This is separate from your editorial Race Calls desk.</p>'+
  '<form id="ewChallengeAdminLogin"><label>ADMIN PASSWORD<input type="password" name="password" autocomplete="current-password" required></label>'+
  '<button type="submit" class="ew-studio-primary">UNLOCK OFFICIAL FINALS</button></form></div>';
 const r=namesByKey(predRace),current=challenge?.finals?.find(f=>f.raceKey===predRace);
 return '<div class="ew-studio-panel ew-admin-finals"><h3>OWNER ONLY · OFFICIAL FINAL RESULT ENTRY</h3>'+
 '<p>Enter a result only after an original state election office has published the final result. A normal election-night race call does not qualify. Scoring updates from this separate entry.</p>'+
 (current?'<div class="ew-pred-locked">A final is already recorded for this race: '+esc(winnerChoiceText(current.choice))+'. Corrections require a documented reason below.</div>':'')+
 '<form id="ewChallengeFinalForm"><label>OFFICIAL FINAL WINNER<select name="choice" required>'+((r?.candidates||[]).map(c=>'<option value="'+esc(choice(c))+'"'+(current?.choice===choice(c)?' selected':'')+'>'+esc(c.name)+' · '+esc(party(c.party))+'</option>').join(''))+'</select></label>'+
 '<label>ISSUING ELECTION OFFICE / SOURCE<input name="sourceName" required minlength="4" maxlength="120" placeholder="Example: State Secretary of State"></label>'+
 '<label>ORIGINAL OFFICIAL HTTPS RESULTS PAGE<input name="sourceUrl" type="url" pattern="https://.*" required placeholder="https://official.state.gov/results"></label>'+
 '<div class="ew-final-votes"><label>REPUBLICAN VOTES (OPTIONAL SET)<input name="repVotes" type="number" min="0" step="1"></label>'+
 '<label>DEMOCRATIC VOTES (OPTIONAL SET)<input name="demVotes" type="number" min="0" step="1"></label>'+
 '<label>TOTAL VOTES (OPTIONAL SET)<input name="totalVotes" type="number" min="1" step="1"></label></div>'+
 (current?'<label>CORRECTION REASON (REQUIRED)<textarea name="correctionNote" minlength="12" maxlength="500" placeholder="Document why the earlier final result needs correction" required></textarea></label>':'')+
 '<label class="ew-studio-check"><input type="checkbox" name="confirmCertified" required> I checked that the linked original election authority has published the final result for this exact race and candidate.</label>'+
 '<button class="ew-studio-primary" type="submit">'+(current?'SAVE DOCUMENTED CORRECTION':'RECORD FINAL · ENABLE SCORING')+'</button>'+
 '<p id="ewFinalNote" class="ew-studio-note">'+esc(finalNotice)+'</p></form></div>';
}
function predictionView(){
 const all=chooseRaces();
 if(!all.some(r=>r.key===predRace))predRace=all[0]?.key||'';
 const stats=challenge?.stats||{participants:0,total:0};
 app.innerHTML=renderHeader('READER PREDICTION CHALLENGE','One immutable prediction per person per race · no betting · scored only after official final results','challenge')+
 '<div class="ew-challenge-bar"><div><small>COMMUNITY PARTICIPANTS</small><b>'+fmt(stats.participants)+'</b></div><div><small>LOCKED PREDICTIONS</small><b>'+fmt(stats.total)+'</b></div>'+
 '<div><small>SUBMISSION DEADLINE</small><b class="ew-deadline">'+deadlineText()+'</b></div>'+
 '<div><small>STATUS</small><b>'+(challenge?.locked?'PREDICTIONS CLOSED':'PREDICTIONS OPEN')+'</b></div></div>'+
 '<div class="ew-studio-toolbar"><label>OFFICE<select id="ewPredOffice">'+[['senate','SENATE'],['house','HOUSE'],['governor','GOVERNOR']].map(([v,l])=>'<option value="'+v+'"'+(v===predOffice?' selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
 '<label>STATE<select id="ewPredState">'+pickStateOptions()+'</select></label>'+
 '<label>RACE<select id="ewPredRace">'+all.map(r=>'<option value="'+esc(r.key)+'"'+(predRace===r.key?' selected':'')+'>'+esc(title(r))+'</option>').join('')+'</select></label>'+
 '<button id="ewPredRefresh" type="button">↻ UPDATE SCORES</button></div>'+
 '<div class="ew-pred-grid"><div id="ewPredEditor">'+predictionEditor()+'</div><div>'+leaderboard()+'</div></div>'+
 '<div id="ewPredAdmin">'+adminPanel()+'</div>'+
 '<p class="ew-studio-note">The Evening Wire forecasts represent member opinions. Separately recorded final results are supplied by the owner and linked to an original election authority. Verify those sources. This platform does not offer wagers or prizes.</p>';
 setupLinks();
 app.querySelector('#ewPredOffice').onchange=e=>{
  predOffice=e.target.value;predState=states().find(r=>r.office===predOffice)?.state||'AL';predRace='';predNotice='';predictionView()
 };
 app.querySelector('#ewPredState').onchange=e=>{predState=e.target.value;predRace='';predNotice='';predictionView()};
 app.querySelector('#ewPredRace').onchange=e=>{predRace=e.target.value;predNotice='';predictionView()};
 app.querySelector('#ewPredRefresh').onclick=async()=>{await loadChallenge();predictionView()};
 const form=app.querySelector('#ewPredictForm');
 if(form)form.onsubmit=async e=>{
  e.preventDefault();const v=new FormData(form).get('choice');if(!v)return;
  if(!window.confirm('Lock this prediction permanently? You cannot change it later.'))return;
  try{await post('/api/challenge/predict',{raceKey:predRace,choice:v});predNotice='Prediction stored and locked successfully.';await loadChallenge();predictionView()}
  catch(e){predNotice=e.message;app.querySelector('#ewPredictionNote').textContent=predNotice}
 };
 const login=app.querySelector('#ewChallengeAdminLogin');
 if(login)login.onsubmit=async e=>{
  e.preventDefault();try{
   const password=new FormData(login).get('password');
   const data=await post('/api/admin/login',{password});admin=data.authenticated===true;
   predictionView()
  }catch(err){const p=app.querySelector('.ew-admin-final-access p');if(p)p.textContent=err.message}
 };
 const final=app.querySelector('#ewChallengeFinalForm');
 if(final)final.onsubmit=async e=>{
  e.preventDefault();
  const data=new FormData(final),previous=challenge.finals.some(f=>f.raceKey===predRace);
  if(!window.confirm('Confirm this is an official FINAL result from the linked election authority, NOT an editorial race call?'))return;
  const payload={raceKey:predRace,choice:data.get('choice'),sourceName:data.get('sourceName'),sourceUrl:data.get('sourceUrl'),
   confirmCertified:data.get('confirmCertified')==='on'};
  if(['repVotes','demVotes','totalVotes'].some(x=>data.get(x)!=='')){
   for(const x of ['repVotes','demVotes','totalVotes'])payload[x]=data.get(x)
  }
  if(previous)payload.correctionNote=data.get('correctionNote');
  try{
   await post(previous?'/api/challenge/admin/correct':'/api/challenge/admin/final',payload);
   finalNotice=previous?'Documented correction saved. Scores recalculated.':'Official final source recorded. Member predictions can now score.';
   await loadChallenge();predictionView()
  }catch(err){finalNotice=err.message;const note=app.querySelector('#ewFinalNote');if(note)note.textContent=finalNotice}
 };
}
async function loadChallenge(){challenge=await get('/api/challenge')}
async function loadHistorical(){historical=await get('/api/historical')}
async function checkAdmin(){try{admin=(await get('/api/admin/session')).authenticated===true}catch{admin=false}}
async function openStudio(which){
 active=which;open=true;err='';
 app.innerHTML='<div class="ew-studio-loading">PREPARING THE EVENING WIRE ELECTION STUDIO…</div>';
 try{
  await window.EWRaceCatalogPromise;
  if(!states().length)throw Error('Candidate roster unavailable; retry when connected.');
  if(!window.EWMaps?.mount)throw Error('Official Census map library did not load. Reload the webpage.');
  if(which==='map'){await reloadMap();if(active==='map')mapView()}
  if(which==='swing'){await Promise.all([loadHistorical(),loadChallenge()]);if(active==='swing')swingView()}
  if(which==='challenge'){await Promise.all([loadChallenge(),checkAdmin()]);if(active==='challenge')predictionView()}
 }catch(e){err=e.message;app.innerHTML='<div class="ew-studio-panel"><h2>Unable to load election studio</h2><p>'+esc(err)+'</p><button id="ewStudioRetry">RETRY</button></div>';app.querySelector('#ewStudioRetry').onclick=()=>openStudio(which)}
}
setInterval(()=>{if(active==='map'&&document.body.dataset.ewView==='election-map'&&!document.hidden)reloadMap()},15000);
window.EWStudio={open:openStudio,refresh:()=>active==='map'?reloadMap(true):loadChallenge()};
})();