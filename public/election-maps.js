/* THE EVENING WIRE — AUTHENTIC THREE-MAP ENGINE */
(function(){
'use strict';
const API={states:'/api/geo/states',districts:'/api/geo/districts'};
const FIPS={
'01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','12':'FL','13':'GA',
'15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
'25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ',
'35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC',
'46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY'};
const FIPSBY=Object.fromEntries(Object.entries(FIPS).map(([k,v])=>[v,k]));
const NAMES={
AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',
DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',
KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',
PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',
UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
const palette={uncalled:'#586f82',inactive:'#253b4d',R:'#df5666',D:'#448ce0',OTHER:'#d7b57e',I:'#d7b57e'};
let d3Load=null;
const geoCache=new Map();
function loadD3(){
 if(window.d3)return Promise.resolve(window.d3);
 if(d3Load)return d3Load;
 d3Load=new Promise((resolve,reject)=>{
  const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
  sc.onload=()=>window.d3?resolve(window.d3):reject(Error('Map library did not load'));
  sc.onerror=()=>reject(Error('Map library unavailable'));
  document.head.append(sc);
 });
 return d3Load;
}
function geo(kind,state){
 const key=kind+(state?':'+state:'');
 if(!geoCache.has(key)){
  const q=API[kind]||(kind==='counties'?'/api/geo/counties':'');
  const url=q+(state?'?state='+encodeURIComponent(state):'');
  const promise=fetch(url,{cache:'default'}).then(async response=>{
    const v=await response.json();
    if(!response.ok)throw Error(v.detail||v.error||'Geography service unavailable');
    if(v.type!=='FeatureCollection'||!Array.isArray(v.features))throw Error('Unexpected map format');
    return v;
  }).catch(err=>{geoCache.delete(key);throw err});
  geoCache.set(key,promise);
 }
 return geoCache.get(key);
}
const element=(tag,className,text)=>{
 const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=String(text);return el;
};
const stateOf=feature=>{
 const p=feature.properties||{};return FIPS[String(p.STATE||String(p.GEOID||'').slice(0,2)).padStart(2,'0')]||null;
};
const districtOf=feature=>{
 const p=feature.properties||{};
 const raw=String(p.CD120??p.CD119??String(p.GEOID||'').slice(-2)).padStart(2,'0');
 return /^(00|\d\d)$/.test(raw)?(Number(raw)||1):null;
};
const districtKey=feature=>{const st=stateOf(feature),n=districtOf(feature);return st&&n?'house-'+st+'-'+n:null};
function displayName(feature,type){
 const st=stateOf(feature)||'Unknown';
 if(type==='house'){const n=districtOf(feature),raw=String(feature.properties?.CD120??feature.properties?.CD119??'').padStart(2,'0');return (NAMES[st]||st)+(raw==='00'?' · At-large':n?' · District '+n:' · District not provided');}
 return NAMES[st]||st;
}
function validCall(c,mode,st,district){
 if(!c||c.office!==mode||c.state!==st)return false;
 if(mode==='house'&&Number(c.district)!==Number(district))return false;
 return ['R','D','I','OTHER'].includes(c.party)&&typeof c.candidate==='string'&&!!c.candidate.trim()&&Number.isFinite(Date.parse(c.calledAt));
}
function fillFor(f,mode,config){
 const state=stateOf(f),district=districtOf(f);
 if(!state)return palette.inactive;
 const active=mode==='senate'?config.senateStates?.includes(state):mode==='governor'?config.governorStates?.includes(state):true;
 if(!active)return palette.inactive;
 const calls=(config.results?.calls||[]).filter(c=>validCall(c,mode,state,district));
 if(calls.length===1)return palette[calls[0].party]||palette.uncalled;
 if(calls.length>1&&calls.every(c=>c.party===calls[0].party))return palette[calls[0].party]||palette.uncalled;
 return palette.uncalled;
}
function callLabel(f,mode,config){
 const st=stateOf(f),num=districtOf(f);
 const calls=(config.results?.calls||[]).filter(c=>validCall(c,mode,st,num));
 if(!calls.length)return 'Not called · verified result unavailable';
 if(calls.length===1)return 'Evening Wire call: '+calls[0].candidate+(calls[0].sourceName?' · '+calls[0].sourceName:' · Owner editorial call');
 return 'Multiple race calls; see individual races';
}
const makeButton=(text,title,action)=>{
 const b=element('button','',text);b.type='button';b.setAttribute('aria-label',title);b.title=title;b.addEventListener('click',action);return b;
};
function showError(host,message){
 host.replaceChildren();
 const block=element('div','ew-map-message');block.append(element('b','', 'Geographic map temporarily unavailable'),element('div','',message));
 const retry=makeButton('RETRY MAP','Retry loading map',()=>mount(host,host.__ewOptions));retry.style.marginTop='8px';block.append(retry);host.append(block);
}
async function mount(host,options={}){
 if(!host)return;host.__ewOptions=options;host.dataset.mapType=options.mode||'senate';host.classList.add('ew-map');
 host.classList.toggle('mini',Boolean(options.mini));host.classList.toggle('large',!options.mini);
 host.replaceChildren(element('div','ew-map-message','Loading official 2026 Census boundaries…'));
 const token={};host.__renderToken=token;
 const mode=options.mode||'senate';
 try{
  const needDistrict=mode==='house';
  const [lib,states,...other]=await Promise.all([loadD3(),geo('states'),...(needDistrict?[geo('districts')]:[])]);
  if(!host.isConnected||host.__renderToken!==token)return;
  const districtData=needDistrict?other[0]:null;
  const features=needDistrict?districtData.features:states.features;
  if(!features.length)throw Error('No verified boundaries were returned');
  const isMini=Boolean(options.mini);
  const width=960,height=580,pad=isMini?12:22;
  const featureCollection={type:'FeatureCollection',features:states.features};
  const projection=lib.geoAlbersUsa().fitExtent([[pad,pad],[width-pad,height-pad]],featureCollection);
  const path=lib.geoPath(projection);
  host.replaceChildren();
  const tip=element('div','ew-map-tip');tip.setAttribute('role','status');host.append(tip);
  const svg=lib.select(host).append('svg').attr('class','ew-map-svg').attr('viewBox','0 0 960 580')
    .attr('role','img').attr('aria-label',(mode==='house'?'2026 House district boundaries':mode==='senate'?'2026 U.S. Senate election states':'2026 governor election states')+'. Click a shape for race details.');
  const bg=svg.append('g').attr('class','ew-map-shapes');
  const selection=bg.selectAll('path').data(features).join('path')
   .attr('class',mode==='house'?'ew-district':'ew-state')
   .classed('has-election',f=>mode==='house'||(mode==='senate'?options.senateStates?.includes(stateOf(f)):options.governorStates?.includes(stateOf(f))))
   .attr('d',path).attr('fill',f=>fillFor(f,mode,options))
   .attr('tabindex',isMini?null:0).attr('role','button')
   .attr('aria-label',f=>displayName(f,mode)+', '+callLabel(f,mode,options))
   .on('click',(event,f)=>{
      const state=stateOf(f),district=mode==='house'?districtOf(f):null;
      if(state&&typeof options.onSelect==='function')options.onSelect({state,district,office:mode,key:mode==='house'?districtKey(f):mode+'-'+state+(mode==='senate'&&options.senateSpecialStates?.includes(state)?'-special':'')});
   })
   .on('keydown',(event,f)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.currentTarget.dispatchEvent(new MouseEvent('click',{bubbles:true}))}})
   .on('mouseenter',(event,f)=>{
      tip.replaceChildren(element('b','',displayName(f,mode)),element('div','',callLabel(f,mode,options)));
      tip.style.display='block';
   })
   .on('mousemove',event=>{
      const area=host.getBoundingClientRect();
      tip.style.left=Math.min(area.width-200,Math.max(4,event.clientX-area.left+12))+'px';
      tip.style.top=Math.min(area.height-68,Math.max(4,event.clientY-area.top+12))+'px';
   })
   .on('mouseleave',()=>{tip.style.display='none'});
  selection.append('title').text(f=>displayName(f,mode)+' — '+callLabel(f,mode,options));
  if(mode==='house'){
    bg.selectAll('path.ew-state-borders').data(states.features).join('path')
      .attr('d',path).attr('fill','none').attr('stroke','#a3c6dd').attr('stroke-width',1.1).attr('vector-effect','non-scaling-stroke').attr('pointer-events','none');
  }
  const tools=element('div','ew-map-tools');
  let zoom=lib.zoom().scaleExtent([1,20]).on('zoom',ev=>bg.attr('transform',ev.transform));
  svg.call(zoom);
  if(isMini){svg.on('.zoom',null)}
  else{
    tools.append(makeButton('+','Zoom in',()=>svg.transition().duration(160).call(zoom.scaleBy,1.6)));
    tools.append(makeButton('−','Zoom out',()=>svg.transition().duration(160).call(zoom.scaleBy,1/1.6)));
    tools.append(makeButton('⌖','Reset map',()=>svg.transition().duration(200).call(zoom.transform,lib.zoomIdentity)));
    tools.append(makeButton('⛶','Full-screen election map',()=>{
      if(document.fullscreenElement)document.exitFullscreen?.();
      else host.requestFullscreen?.().catch(()=>{});
    }));
    host.append(tools);
  }
  host.append(element('div','ew-map-attribution','U.S. CENSUS TIGERweb · 2026'));
  const caveat=needDistrict?districtData.meta?.caveat:null;
  if(caveat){const p=element('p','ew-map-caption',caveat);host.append(p)}
 }catch(error){if(host.isConnected&&host.__renderToken===token)showError(host,String(error.message||error))}
}
window.EWMaps={mount,clearCache:()=>geoCache.clear(),FIPS,NAMES};
})();
