// THE EVENING WIRE — AP Elections API v3 (results ONLY).
// AP race calls / winner flags are deliberately ignored. Only the authenticated
// Evening Wire owner may publish calls via editor-calls.mjs.
const apKey=process.env.AP_ELECTIONS_API_KEY||'';
const electionDate='2026-11-03';
const endpoint='https://api.ap.org/v3/elections/'+electionDate+'?format=json&officeID=S,H,G&raceTypeID=G&level=state&resultsType=l';
const pollMs=Math.max(30000,Number(process.env.AP_RESULTS_POLL_MS||60000));
const houseCounts=Object.fromEntries('AL:7 AK:1 AZ:9 AR:4 CA:52 CO:8 CT:5 DE:1 FL:28 GA:14 HI:2 ID:2 IL:17 IN:9 IA:4 KS:4 KY:6 LA:6 ME:2 MD:8 MA:9 MI:13 MN:8 MS:4 MO:8 MT:2 NE:3 NV:4 NH:2 NJ:12 NM:3 NY:26 NC:14 ND:1 OH:15 OK:5 OR:6 PA:17 RI:2 SC:7 SD:1 TN:9 TX:38 UT:4 VT:1 VA:11 WA:10 WV:2 WI:8 WY:1'.split(' ').map(x=>{const [c,n]=x.split(':');return[c,Number(n)]}));
const officeMap={S:'senate',G:'governor',H:'house'};
const raceData=new Map();
let lastSuccess=null,lastCheck=null,error=null,working=false,connection=false,nextURL=null,etag=null;
function safeDate(x){return typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null}
function validateURL(raw){
 try{const u=new URL(String(raw));return u.protocol==='https:'&&u.hostname==='api.ap.org'&&u.pathname.startsWith('/v3/elections/'+electionDate)?u.href:null}
 catch{return null}
}
function partyName(s){const x=String(s||'').toUpperCase();return x==='GOP'||x==='REP'?'Republican':x==='DEM'?'Democrat':x==='IND'?'Independent':String(s||'Other').slice(0,40)}
function candidateName(c){return [c.first,c.middle,c.last,c.suffix].map(x=>String(x||'').trim()).filter(Boolean).join(' ').slice(0,130)}
function mapRace(r,payloadTimestamp){
 if(!r||typeof r!=='object'||r.raceTypeID!=='G'||!Object.hasOwn(officeMap,String(r.officeID||'')))return null;
 if(['test','t'].includes(String(r.resultsType||'').toLowerCase()))return null;
 const unit=(Array.isArray(r.reportingUnits)?r.reportingUnits:[]).find(u=>u?.level==='state'||Number(u?.reportingunitLevel)===1);
 if(!unit)return null;
 const state=String(unit.statePostal||'').toUpperCase();if(!houseCounts[state])return null;
 const office=officeMap[r.officeID];
 let district=null;
 if(office==='house'){
  district=Number(r.seatNum||r.censusDistrict);
  if((!Number.isInteger(district)||district<1)&&houseCounts[state]===1)district=1;
  if(!Number.isInteger(district)||district<1||district>houseCounts[state])return null;
 }
 // AP reports a separate raceID for a Senate special election; never map it to
 // the regular race. Special races are identified only when explicitly labeled.
 const special=office==='senate'&&/special/i.test(String(r.raceType||'')+' '+String(r.description||'')+' '+String(r.seatName||''));
 const id=office+'-'+state+(office==='house'?'-'+district:special?'-special':'');
 const cs=Array.isArray(unit.candidates)?unit.candidates:[];
 const candidates=cs.map(c=>{
  const name=candidateName(c);
  const votes=Number(c.voteCount);
  return{name,party:partyName(c.party),votes:c.voteCount!==undefined&&Number.isSafeInteger(votes)&&votes>=0?votes:null}
 }).filter(c=>c.name);
 const total=candidates.reduce((acc,c)=>acc+(c.votes===null?0:c.votes),0);
 for(const c of candidates)c.percent=c.votes!==null&&total>0?Math.round(1000*c.votes/total)/10:null;
 const reportingPct=Number(unit.precinctsReportingPct);
 const eevp=Number(unit.eevp??r.eevp);
 const updatedAt=safeDate(unit.lastUpdated)||safeDate(payloadTimestamp);
 if(!updatedAt)return null;
 return {
  id,office,state,district,special,
  apRaceID:String(r.raceID||''),candidates,
  reportingPct:unit.precinctsReportingPct!==undefined&&Number.isFinite(reportingPct)&&reportingPct>=0&&reportingPct<=100?reportingPct:null,
  estimatedVotePct:(unit.eevp!==undefined||r.eevp!==undefined)&&Number.isFinite(eevp)&&eevp>=0&&eevp<=100?eevp:null,
  sourceName:'Associated Press (AP)',
  sourceUrl:'https://developer.ap.org/ap-elections-api/',
  updatedAt,
  status:total>0?'reporting':'awaiting-votes',
  // winner, winnerDateTime, raceCallStatus, AP decision signals are NEVER copied.
 };
}
async function poll(){
 if(!apKey||working)return;
 working=true;lastCheck=new Date().toISOString();
 const url=nextURL||endpoint,headers={'x-api-key':apKey,'Accept':'application/json','Accept-Encoding':'gzip'};
 if(etag)headers['If-None-Match']=etag;
 try{
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
  if(response.status===304){connection=true;error=null;lastSuccess=new Date().toISOString();return}
  if(!response.ok)throw Error('AP API returned HTTP '+response.status);
  const raw=await response.text();
  if(raw.length>14000000)throw Error('AP results exceeded safe response size');
  const payload=JSON.parse(raw);
  if(payload.electionDate&&payload.electionDate!==electionDate)throw Error('AP election date does not match November 3, 2026');
  if(!Array.isArray(payload.races))throw Error('Unexpected AP elections response (races missing)');
  const full=!(nextURL&&url===nextURL);
  const incoming=payload.races.map(r=>mapRace(r,payload.timestamp)).filter(Boolean);
  // The first request is a full snapshot. Later AP nextrequest responses contain only updates.
  // Keep unaffected races when merging an AP delta.
  if(full)raceData.clear();
  for(const row of incoming){
   const previous=raceData.get(row.id);
   if(!previous||previous.apRaceID===row.apRaceID||Date.parse(row.updatedAt)>=Date.parse(previous.updatedAt)){
    raceData.set(row.id,row);
   }
  }
  const next=validateURL(typeof payload.nextrequest==='string'?payload.nextrequest:payload.nextrequest?.href);
  nextURL=next&&next!==url?next:nextURL;
  if(!next){nextURL=null}
  etag=response.headers.get('etag')||null;
  connection=true;error=null;lastSuccess=new Date().toISOString();
  console.log('AP_RESULTS_CONNECTED races='+raceData.size+' updates='+incoming.length);
 }catch(e){
  connection=false;error=String(e.message||e).slice(0,160);
  console.warn('AP_RESULTS_FETCH_ERROR '+error);
 }finally{working=false}
}
export function apSnapshot(){
 return {
  configured:Boolean(apKey),connected:connection,provider:'Associated Press (AP)',
  updatedAt:lastSuccess,checkedAt:lastCheck,error,
  races:apKey?[...raceData.values()].sort((a,b)=>a.state.localeCompare(b.state)||a.office.localeCompare(b.office)||(a.district||0)-(b.district||0)):[],
  calls:[],
  pollIntervalMs:pollMs
 };
}
console.log('AP_RESULTS_CONFIG key_present='+Boolean(apKey)+' source=ap-only calls=admin-only');
if(apKey){poll();setInterval(poll,pollMs).unref()}
