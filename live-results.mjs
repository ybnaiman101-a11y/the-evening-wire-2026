// THE EVENING WIRE — verified, numerical 2026 election results.
// Race calls NEVER come from these providers. Only owner-authenticated editorial calls count.
// Public feeds: Open America, The People's Tally, official Arizona media export.
// Licensed AP is merged only when the owner supplies a valid API key.
// Ohio official results page is linked because a stable XML export URL was not verified.
import {readFileSync} from 'node:fs';
import {apSnapshot} from './ap-election-results.mjs';

const catalog=JSON.parse(readFileSync(new URL('./public/race-candidates.json',import.meta.url),'utf8'));
const validRaces=new Set(catalog.races.map(r=>r.key));
const officeNames={Senate:'senate',House:'house',Governor:'governor'};
const oaRoot='https://openamerica.io/elections/results.json?year=2026&office=';
const tallyURL='https://thepeoplestally.com/data/results.json';
const arizonaURL='https://app.enhancedvoting.com/cdn/results/Arizona/export-110326GeneralElection.json';
const arizonaSource='https://azsos.gov/press';
const ohioSource='https://liveresults.ohiosos.gov/Home/Index';
const goodURL=u=>{try{const p=new URL(u);return p.protocol==='https:'&&!p.username&&!p.password?p.href:null}catch{return null}};
const iso=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?new Date(s).toISOString():null;
const number=n=>n!==null&&n!==undefined&&n!==''&&Number.isSafeInteger(Number(n))&&Number(n)>=0?Number(n):null;
const pct=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))&&Number(n)>=0&&Number(n)<=100?Math.round(Number(n)*100)/100:null;
const trim=(v,max=130)=>String(v||'').trim().slice(0,max);
const party=p=>{
 const s=String(p||'').trim().toUpperCase();
 if(['R','REP','REPUBLICAN','GOP'].includes(s))return 'R';
 if(['D','DEM','DEMOCRAT','DEMOCRATIC'].includes(s))return 'D';
 if(['I','IND','INDEPENDENT','UNAFFILIATED'].includes(s))return 'I';
 if(['L','LIBERTARIAN'].includes(s))return 'L';
 if(['G','GRN','GREEN'].includes(s))return 'G';
 return s.slice(0,14)||'OTHER';
};
const officeKey=(office,state,district,special=false)=>{
 const s=trim(state,2).toUpperCase();
 if(!/^[A-Z]{2}$/.test(s))return null;
 const id=office+'-'+s+(office==='house'?'-'+Number(district):office==='senate'&&special?'-special':'');
 return validRaces.has(id)?id:null;
};
function candidates(input){
 if(!Array.isArray(input))return [];
 const list=input.slice(0,14).map(x=>({name:trim(x.name,125),party:party(x.party),votes:number(x.votes)})).filter(x=>x.name);
 const total=list.reduce((s,c)=>s+(c.votes||0),0);
 for(const c of list)c.percent=c.votes!==null&&total>0?Math.round((c.votes/total)*10000)/100:null;
 return list;
}
function record({id,office,state,district=null,special=false,sourceName,sourceUrl,updatedAt,reportingPct=null,estimatedVotePct=null,candidates:cs}){
 if(!id||!Array.isArray(cs)||!cs.length||!goodURL(sourceUrl))return null;
 const total=cs.reduce((s,c)=>s+(c.votes||0),0);
 return {id,office,state,district,special,candidates:cs,totalVotes:total,
   reportingPct:pct(reportingPct),estimatedVotePct:pct(estimatedVotePct),
   updatedAt:iso(updatedAt),sourceName,sourceUrl,leader:total>0?cs.slice().sort((a,b)=>(b.votes||0)-(a.votes||0))[0].name:null,
   status:total>0?'reporting':'awaiting-votes',winner:null,called:false};
}
export function parseOpenAmerica(payload,office){
 if(!payload||payload.api!==1||payload.year!==2026||String(payload.office).toLowerCase()!==office.toLowerCase()||
    !payload.races||Array.isArray(payload.races)||typeof payload.races!=='object')throw Error('Open America payload contract changed');
 const out=[];
 for(const [seat,r] of Object.entries(payload.races).slice(0,600)){
  if(!r||typeof r!=='object')continue;
  let state,district=null,special=false;
  if(office==='House'){
   const m=seat.match(/^([A-Z]{2})-([0-9]{2})$/);if(!m)continue;
   state=m[1];district=Number(m[2])||1;
  }else{
   const m=seat.match(/^([A-Z]{2})(-special)?$/);if(!m)continue;
   state=m[1];special=office==='Senate'&&!!m[2];
  }
  const name=officeNames[office],id=officeKey(name,state,district,special);
  const cs=candidates((r.cands||[]).map(c=>({name:c.n,party:c.p,votes:c.v})));
  const item=record({id,office:name,state,district,special,candidates:cs,
   sourceName:'Open America · official state counts',sourceUrl:'https://openamerica.io/elections/api/',
   reportingPct:r.pct_in,updatedAt:payload.as_of});
  if(item)out.push(item);
 }
 return out;
}
export function parsePeoplesTally(payload){
 if(!payload||!payload.races||typeof payload.races!=='object'||Array.isArray(payload.races))throw Error("People's Tally payload contract changed");
 const out=[];
 for(const [key,r] of Object.entries(payload.races).slice(0,650)){
  if(!r||typeof r!=='object')continue;
  const m=key.match(/^([SGH])-([A-Z]{2})(?:-([0-9]{1,2}|sp))?$/i);
  if(!m)continue;
  const office={S:'senate',G:'governor',H:'house'}[m[1].toUpperCase()];
  const state=m[2].toUpperCase(),special=office==='senate'&&String(m[3]).toLowerCase()==='sp';
  const district=office==='house'?Number(m[3]||0)||1:null;
  const id=officeKey(office,state,district,special);
  const cs=candidates((r.cands||[]).map(c=>({name:c.name,party:c.party,votes:c.votes})));
  const item=record({id,office,state,district,special,candidates:cs,reportingPct:null,estimatedVotePct:r.exp,
   sourceName:"The People's Tally · "+trim(r.src||'official state results',70),
   sourceUrl:goodURL(r.url)||'https://thepeoplestally.com/open-data/',
   updatedAt:r.asof||payload.generated_at});
  if(item)out.push(item);
 }
 return out;
}
function azOffice(text){
 const s=String(text||'').toLowerCase();
 if(/\bgovernor\b/.test(s))return {office:'governor'};
 if(/\b(u\.?s\.?\s*(house|representative)|congress|representative in congress)\b/.test(s)){
  const district=s.match(/(?:district|dist\.?|cd)\s*(?:no\.?|number|#)?\s*([0-9]{1,2})\b/);
  return district?{office:'house',district:Number(district[1])}:null;
 }
 return null;
}
export function parseArizona(payload){
 if(!payload||!String(payload.electionDate||'').includes('2026')||!payload.results)throw Error('Arizona election JSON is not the 2026 export');
 const roots=Array.isArray(payload.results)?payload.results:[payload.results];
 const out=[],seen=new Set();
 for(const root of roots){
  for(const item of (Array.isArray(root?.ballotItems)?root.ballotItems:[])){
   const info=azOffice(item.name);
   if(!info||item.contestType&&!/candidate/i.test(item.contestType))continue;
   const id=officeKey(info.office,'AZ',info.district,null);
   if(!id||seen.has(id))continue;
   const cs=candidates((item.ballotOptions||[]).map(c=>({name:c.name,party:c.politicalParty,votes:c.voteCount})));
   const row=record({id,office:info.office,state:'AZ',district:info.district,
     candidates:cs,sourceName:'Arizona Secretary of State · official media JSON',
     sourceUrl:arizonaSource,updatedAt:payload.createdAt});
   if(row){out.push(row);seen.add(id)}
  }
 }
 return out;
}
export function parseAP(snapshot){
 if(!snapshot?.configured||!snapshot.connected||!Array.isArray(snapshot.races))return [];
 return snapshot.races.map(r=>{
  const id=officeKey(r.office,r.state,r.district,r.special);
  return record({...r,id,candidates:candidates(r.candidates),sourceName:'Associated Press · licensed results',
   sourceUrl:'https://developer.ap.org/ap-elections-api/'});
 }).filter(Boolean);
}
const seedSources=()=>[
 {id:'arizona',name:'Arizona Secretary of State',url:arizonaSource,mode:'direct-json',connected:false,lastChecked:null,lastUpdated:null,count:0,error:null},
 {id:'openamerica-house',name:'Open America · House',url:'https://openamerica.io/elections/api/',mode:'public-json',connected:false,lastChecked:null,lastUpdated:null,count:0,error:null},
 {id:'openamerica-senate',name:'Open America · Senate',url:'https://openamerica.io/elections/api/',mode:'public-json',connected:false,lastChecked:null,lastUpdated:null,count:0,error:null},
 {id:'openamerica-governor',name:'Open America · Governor',url:'https://openamerica.io/elections/api/',mode:'public-json',connected:false,lastChecked:null,lastUpdated:null,count:0,error:null},
 {id:'peoples-tally',name:"The People's Tally",url:'https://thepeoplestally.com/open-data/',mode:'public-json',connected:false,lastChecked:null,lastUpdated:null,count:0,error:null},
 {id:'ap',name:'Associated Press',url:'https://developer.ap.org/ap-elections-api/',mode:'licensed-key-required',connected:false,lastChecked:null,lastUpdated:null,count:0,error:null},
 {id:'ohio',name:'Ohio Secretary of State',url:ohioSource,mode:'official-link-only',connected:false,lastChecked:null,lastUpdated:null,count:0,error:'Verified machine-readable feed URL not yet available'}
];
export function createLiveResultsHub({fetcher=fetch,now=()=>new Date(),apProvider=apSnapshot}={}){
 const sources=new Map(seedSources().map(x=>[x.id,x])),stored=new Map(),cache=new Map();
 let timer=null,running=false;
 const updated=()=>new Date(now()).toISOString();
 async function request(id,url,parse,delay=60000){
  const current=sources.get(id),last=current?.lastChecked?Date.parse(current.lastChecked):0;
  if(last&&Date.now()-last<delay)return;
  const next={...current,lastChecked:updated()};
  sources.set(id,next);
  try{
   const headers={Accept:'application/json','Accept-Encoding':'gzip','User-Agent':'TheEveningWire/2026 election-results connector'};
   if(cache.get(id)?.etag)headers['If-None-Match']=cache.get(id).etag;
   const resp=await fetcher(url,{headers,signal:AbortSignal.timeout(18000)});
   if(resp.status===304){
    sources.set(id,{...next,connected:true,error:null});
    return;
   }
   if(!resp.ok)throw Error('HTTP '+resp.status);
   const size=Number(resp.headers?.get?.('content-length')||0);
   if(size>16000000)throw Error('Feed larger than 16 MB');
   const raw=await resp.text();
   if(raw.length>16000000)throw Error('Feed larger than 16 MB');
   const payload=JSON.parse(raw);
   const rows=parse(payload);
   stored.set(id,rows);
   cache.set(id,{etag:resp.headers?.get?.('etag')||null});
   const newest=rows.map(x=>x.updatedAt).filter(Boolean).sort().at(-1)||null;
   sources.set(id,{...next,connected:true,error:null,count:rows.length,lastUpdated:newest});
  }catch(e){
   sources.set(id,{...next,connected:false,error:trim(e.message,150)});
  }
 }
 async function poll(){
  if(running)return;
  running=true;
  try{
   // Documented provider refresh limits: Open America >=60 sec during counts;
   // Arizona >=120 sec; People's Tally >=60 sec.
   const hasCount=[...stored.values()].some(rows=>rows.some(r=>r.totalVotes>0));
   const oaWait=hasCount?60000:600000;
   await Promise.all([
    request('openamerica-house',oaRoot+'House',p=>parseOpenAmerica(p,'House'),oaWait),
    request('openamerica-senate',oaRoot+'Senate',p=>parseOpenAmerica(p,'Senate'),oaWait),
    request('openamerica-governor',oaRoot+'Governor',p=>parseOpenAmerica(p,'Governor'),oaWait),
    request('peoples-tally',tallyURL,parsePeoplesTally,90000),
    request('arizona',arizonaURL,parseArizona,120000)
   ]);
  }finally{running=false}
 }
 function snapshot(){
  const ap=apProvider();
  sources.set('ap',{...sources.get('ap'),connected:Boolean(ap.connected),count:ap.races?.length||0,
    lastChecked:ap.checkedAt||null,lastUpdated:ap.updatedAt||null,error:ap.error||null,mode:ap.configured?'licensed-json':'licensed-key-required'});
  const choice=new Map(),rank={arizona:400,ap:300,'openamerica-house':200,'openamerica-senate':200,'openamerica-governor':200,'peoples-tally':100};
  const all=[...stored.entries(),['ap',parseAP(ap)]];
  for(const [provider,rows] of all){
   const source=sources.get(provider);
   for(const r of rows){
    const age=r.updatedAt?Date.parse(updated())-Date.parse(r.updatedAt):Infinity;
    // An unverified old total must never displace a fresh provider.
    const fresh=age>=0&&age<4*3600000;
    const priority=(fresh?1000:0)+(source?.connected?100:0)+(rank[provider]||0);
    const existing=choice.get(r.id);
    if(!existing||priority>existing.priority)choice.set(r.id,{priority,row:{...r,stale:!fresh||!source?.connected,providerId:provider}});
   }
  }
  const races=[...choice.values()].map(x=>x.row).sort((a,b)=>a.office.localeCompare(b.office)||a.state.localeCompare(b.state)||(a.district||0)-(b.district||0));
  return {electionDate:'2026-11-03',checkedAt:updated(),races,reportingRaces:races.filter(r=>r.totalVotes>0).length,
    sources:[...sources.values()],sourceCount:[...sources.values()].filter(s=>s.connected).length,
    raceCallsControlledBy:'THE EVENING WIRE OWNER ONLY',winnerFlagsIgnored:true,resultsUncertified:true};
 }
 function start(){
  if(timer)return;
  poll().catch(e=>console.warn('EW_LIVE_RESULTS_INIT_ERROR',String(e.message||e)));
  timer=setInterval(()=>poll().catch(e=>console.warn('EW_LIVE_RESULTS_POLL_ERROR',String(e.message||e))),60000);
  timer.unref?.();
 }
 function stop(){if(timer)clearInterval(timer);timer=null}
 return {poll,snapshot,start,stop};
}
export const liveResultsHub=createLiveResultsHub();
