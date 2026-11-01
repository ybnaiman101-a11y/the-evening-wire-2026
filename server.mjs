import http from 'node:http';
import {URL} from 'node:url';

const PORT = Number(process.env.PORT || 3000);
const POLL = Math.max(30000, Number(process.env.POLL_INTERVAL_MS || 60000));
const SOURCES = [
  ['fox','Fox News','foxnews.com','https://moxie.foxnews.com/google-publisher/politics.xml'],
  ['cnn','CNN','cnn.com'],
  ['nyt','The New York Times','nytimes.com','https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml'],
  ['nbc','NBC News','nbcnews.com','https://feeds.nbcnews.com/nbcnews/public/politics'],
  ['abc','ABC News','abcnews.go.com','https://abcnews.go.com/abcnews/politicsheadlines'],
  ['newsmax','Newsmax','newsmax.com','https://www.newsmax.com/rss/Politics/1/'],
  ['msnow','MS NOW','ms.now','https://www.ms.now/category/elections/feed'],
  ['dailywire','The Daily Wire','dailywire.com'],
  ['reuters','Reuters','reuters.com'],
  ['ap','Associated Press','apnews.com'],
  ['wapo','The Washington Post','washingtonpost.com','https://feeds.washingtonpost.com/rss/politics'],
  ['examiner','Washington Examiner','washingtonexaminer.com','https://www.washingtonexaminer.com/feed/'],
  ['politico','POLITICO','politico.com','https://rss.politico.com/politics-news.xml'],
  ['hill','The Hill','thehill.com','https://thehill.com/feed/'],
  ['cbs','CBS News','cbsnews.com','https://www.cbsnews.com/latest/rss/main'],
  ['npr','NPR','npr.org','https://feeds.npr.org/1014/rss.xml'],
  ['pbs','PBS NewsHour','pbs.org','https://www.pbs.org/newshour/feeds/rss/headlines'],
  ['usatoday','USA TODAY','usatoday.com'],
  ['wsj','The Wall Street Journal','wsj.com'],
  ['bloomberg','Bloomberg','bloomberg.com'],
  ['axios','Axios','axios.com','https://api.axios.com/feed/'],
  ['guardian','The Guardian','theguardian.com','https://www.theguardian.com/us-news/us-politics/rss'],
  ['breitbart','Breitbart','breitbart.com','https://www.breitbart.com/feed/'],
  ['nypost','New York Post','nypost.com','https://nypost.com/feed/'],
  ['natreview','National Review','nationalreview.com','https://www.nationalreview.com/feed/'],
  ['bbc','BBC News','bbc.com','https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml'],
  ['newsnation','NewsNation','newsnationnow.com']
].map(([id,name,domain,feed], i)=>({id,name,domain,feed:feed || null,group:i<12?'Requested':'Additional'}));
const ELECTION = /\b(election|midterm|vot(e|es|er|ers|ing|ed)|ballot|turnout|senate|senator|governor|congress|house race|house seat|campaign|candidate|polling|recount|precinct|primary)\b/i;
const TOPICS = {
 results:/\b(result|win(s|ner)?|victory|defeat|called|counting|recount|concedes?|projected|flips?)\b/i,
 voting:/\b(vot(e|es|er|ers|ing|ed)|ballot|turnout|polls|absentee|precinct)\b/i,
 senate:/\b(senate|senator)\b/i,
 house:/\b(house|congress|district)\b/i,
 governors:/\b(governor|gubernatorial)\b/i
};
let stories=[],seen=new Set(),lastScan=null,initialized=false,scanning=false;
const status=Object.fromEntries(SOURCES.map(s=>[s.id,{ok:false,attempt:null,checked:null,error:null,count:0,via:null}]));
const clients = new Set();

function entities(t){
 return String(t||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
  .replace(/<[^>]+>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{try{return String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))}catch{return ' '}})
  .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&apos;|&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();
}
function extract(body,tag){
 const m = body.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));
 return m?entities(m[1]):'';
}
function parse(xml){
 if(!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) throw Error('Invalid RSS or Atom feed');
 const found=[];
 for(const m of xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)){
  const b=m[2], atom=m[1].toLowerCase()==='entry';
  const href = atom ? (b.match(/<link\b[^>]*href\s*=\s*["']([^"']+)["']/i)||[])[1] : '';
  const title=extract(b,'title');
  const link=entities(href||extract(b,'link'));
  const date=extract(b,'pubDate')||extract(b,'published')||extract(b,'updated')||extract(b,'dc:date');
  const desc=extract(b,'description')||extract(b,'summary');
  if(title && /^https?:\/\//i.test(link))found.push({title,link,date,desc});
 }
 return found;
}
function googleNews(domain){
 const q='site:'+domain+' (election OR midterms OR voting OR senate OR governor OR "House race") when:3d';
 return 'https://news.google.com/rss/search?q='+encodeURIComponent(q)+'&hl=en-US&gl=US&ceid=US%3Aen';
}
async function fetchFeed(url){
 const res=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0 (compatible; EveningWireRSS/1.0)','Accept':'application/rss+xml, application/atom+xml, text/xml, */*'}});
 if(!res.ok)throw Error('HTTP '+res.status);
 const len=Number(res.headers.get('content-length')||0);if(len>3000000)throw Error('Feed too large');
 const xml=await res.text();if(xml.length>3000000)throw Error('Feed too large');
 return parse(xml);
}
function normalize(e,s,via){
 if(!ELECTION.test(e.title+' '+e.desc))return null;
 const ts=Date.parse(e.date);if(!Number.isFinite(ts)||ts>Date.now()+3600000||ts<Date.now()-4*86400000)return null;
 let url;try{url=new URL(e.link);if(!['https:','http:'].includes(url.protocol))return null}catch{return null}
 const hay=e.title+' '+e.desc;
 const topics=Object.keys(TOPICS).filter(k=>TOPICS[k].test(hay));if(!topics.length)topics.push('national');
 const id=s.id+'|'+e.title.toLowerCase().replace(/\W+/g,' ').slice(0,150)+'|'+ts;
 return {id,title:e.title,excerpt:e.desc.slice(0,230),url:url.href,published:new Date(ts).toISOString(),source:s.name,sourceId:s.id,domain:s.domain,via,topics};
}
function snapshot(){
 return {stories:stories.slice(0,500),sources:SOURCES.map(s=>({...s,...status[s.id]})),initialized,lastScan,pollIntervalMs:POLL};
}
function send(client,event,body){try{client.write('event: '+event+'\ndata: '+JSON.stringify(body)+'\n\n')}catch{clients.delete(client)}}
function broadcast(event,body){for(const c of clients)send(c,event,body)}
async function check(s){
 const entry=status[s.id];entry.attempt=new Date().toISOString();
 let via=s.feed?'Publisher RSS':'Google News', raw;
 try{raw=await fetchFeed(s.feed||googleNews(s.domain))}
 catch(e){
  if(!s.feed){entry.ok=false;entry.error=String(e.message||e);return []}
  try{raw=await fetchFeed(googleNews(s.domain));via='Google News fallback'}
  catch(e2){entry.ok=false;entry.error=String(e.message||e)+' / '+String(e2.message||e2);return []}
 }
 entry.ok=true;entry.checked=new Date().toISOString();entry.error=null;entry.count=raw.length;entry.via=via;
 return raw.map(x=>normalize(x,s,via)).filter(Boolean);
}
async function runScan(){
 if(scanning)return;scanning=true;
 try{
  const fresh=[];
  for(let i=0;i<SOURCES.length;i+=5){
   const batch=await Promise.all(SOURCES.slice(i,i+5).map(check));
   for(const set of batch)for(const item of set){
    if(seen.has(item.id))continue;
    seen.add(item.id);fresh.push(item);
   }
  }
  if(fresh.length){
   stories=[...fresh,...stories].sort((a,b)=>Date.parse(b.published)-Date.parse(a.published)).slice(0,750);
   if(initialized)broadcast('new',fresh.slice(0,80));
  }
  initialized=true;lastScan=new Date().toISOString();
  broadcast('status',{sources:snapshot().sources,lastScan,initialized});
 }catch(e){console.error('Feed scan error',e)}
 finally{scanning=false}
}

// EVENING WIRE ELECTION FEED — verified-source-only result ingestion.
// Optional, explicitly configured licensed/official data source; NEVER parse news headlines as race calls.
const resultsFeedURL=process.env.ELECTION_RESULTS_FEED_URL||'';
const resultsFeedToken=process.env.ELECTION_RESULTS_FEED_TOKEN||'';
const resultsPollingMS=Math.max(30000,Number(process.env.ELECTION_RESULTS_POLL_MS||60000));
let electionData={configured:Boolean(resultsFeedURL),updatedAt:null,checkedAt:null,error:null,races:[],calls:[],turnout:[],source:null};
let electionScanning=false;
function urlAllowed(x){try{const u=new URL(x);return u.protocol==='https:'}catch{return false}}
function validDate(s){return typeof s==='string'&&Number.isFinite(Date.parse(s))}
function cleanRace(row){
 if(!row||typeof row!=='object')return null;
 const office=String(row.office||'').toLowerCase();
 if(!['senate','governor','house'].includes(office))return null;
 const state=String(row.state||'').toUpperCase();
 if(!/^[A-Z]{2}$/.test(state))return null;
 const district=office==='house'?Number(row.district):null;
 if(office==='house'&&(!Number.isInteger(district)||district<1||district>53))return null;
 const id=String(row.id||(office+'-'+state+(office==='house'?'-'+district:'')));
 const sourceName=String(row.sourceName||'').trim(),sourceUrl=String(row.sourceUrl||'');
 if(!sourceName||!urlAllowed(sourceUrl)||!validDate(row.updatedAt))return null;
 const candidates=Array.isArray(row.candidates)?row.candidates.slice(0,12).filter(c=>c&&typeof c.name==='string'&&c.name.trim()).map(c=>({
  name:String(c.name).slice(0,130),party:String(c.party||'Other').slice(0,40),
  votes:Number.isSafeInteger(Number(c.votes))&&Number(c.votes)>=0?Number(c.votes):null,
  percent:typeof c.percent==='number'&&c.percent>=0&&c.percent<=100?c.percent:null
 })):[];
 const pct=typeof row.reportingPct==='number'&&row.reportingPct>=0&&row.reportingPct<=100?row.reportingPct:null;
 return {id,office,state,district,candidates,reportingPct:pct,sourceName,sourceUrl,updatedAt:row.updatedAt,status:'reporting'};
}
function cleanCall(c){
 if(!c||typeof c!=='object')return null;
 const office=String(c.office||'').toLowerCase();
 if(!['senate','governor','house'].includes(office))return null;
 const state=String(c.state||'').toUpperCase();
 if(!/^[A-Z]{2}$/.test(state))return null;
 const district=office==='house'?Number(c.district):null;
 if(office==='house'&&(!Number.isInteger(district)||district<1||district>53))return null;
 const party=String(c.party||'').toUpperCase(),candidate=String(c.candidate||'').trim();
 const sourceName=String(c.sourceName||'').trim(),sourceUrl=String(c.sourceUrl||'');
 if(!candidate||!sourceName||!urlAllowed(sourceUrl)||!validDate(c.calledAt))return null;
 if(!['R','D','OTHER','I'].includes(party))return null;
 return {id:String(c.id||(office+'-'+state+(office==='house'?'-'+district:''))),office,state,district,
  candidate:candidate.slice(0,130),party,sourceName,sourceUrl,calledAt:c.calledAt,callType:'publisher projection'};
}
async function updateElectionData(){
 if(!resultsFeedURL||electionScanning)return;
 electionScanning=true;const state={...electionData,checkedAt:new Date().toISOString()};
 try{
  if(!urlAllowed(resultsFeedURL))throw Error('ELECTION_RESULTS_FEED_URL must use HTTPS');
  const headers={Accept:'application/json'};if(resultsFeedToken)headers.Authorization='Bearer '+resultsFeedToken;
  const response=await fetch(resultsFeedURL,{headers,signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Election data provider HTTP '+response.status);
  const payload=await response.json();
  if(!payload||typeof payload!=='object'||!Array.isArray(payload.races)||!Array.isArray(payload.calls))throw Error('Provider must return races[] and calls[] arrays');
  const races=payload.races.slice(0,1000).map(cleanRace).filter(Boolean);
  const calls=payload.calls.slice(0,1000).map(cleanCall).filter(Boolean);
  electionData={...state,updatedAt:new Date().toISOString(),error:null,source:String(payload.source||new URL(resultsFeedURL).hostname).slice(0,130),races,calls};
  broadcast('election',electionData);
 }catch(err){electionData={...state,error:String(err.message||err).slice(0,220)};broadcast('election',electionData)}
 finally{electionScanning=false}
}


// EVENING_WIRE_CENSUS_MAP_PROXY_V1 — official Census 2026 map geometries.
// Never use news stories to infer a win or to color uncalled districts.
const GEO_BASE="https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/";
const FIPS_TO_CODE={
 "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","12":"FL","13":"GA",
 "15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD",
 "25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ",
 "35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
 "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"};
const CODE_TO_FIPS=Object.fromEntries(Object.entries(FIPS_TO_CODE).map(([id,c])=>[c,id]));
const censusGeoCache=new Map();
async function fetchCensusLayer(path,where,fields,offset){
 const url=new URL(GEO_BASE+path);
 for(const [k,v] of Object.entries({where,outFields:fields,returnGeometry:"true",outSR:"4326",geometryPrecision:"5",maxAllowableOffset:String(offset),f:"geojson"}))url.searchParams.set(k,v);
 const reply=await fetch(url,{signal:AbortSignal.timeout(50000),headers:{Accept:"application/geo+json,application/json"}});
 if(!reply.ok)throw Error("Census geography service returned "+reply.status);
 const body=await reply.json();
 if(body.error||body.type!=="FeatureCollection"||!Array.isArray(body.features))throw Error("Census geographic layer did not return valid GeoJSON");
 return body.features;
}
async function censusMap(kind,state){
 const key=kind+":"+(state||"US");
 const existing=censusGeoCache.get(key);
 if(existing&&existing.value&&Date.now()-existing.at<86400000)return existing.value;
 if(existing&&existing.pending)return existing.pending;
 const pending=(async()=>{
  let features=[],caveat=null;
  const fips=state?CODE_TO_FIPS[state]:null;
  const where=state?"STATE = '"+fips+"'":"1=1";
  if(kind==="states"){
    features=await fetchCensusLayer("State_County/MapServer/0/query","1=1","GEOID,NAME,STATE",state?".001":".012");
  }else if(kind==="districts"){
    features=await fetchCensusLayer("Legislative/MapServer/0/query",where,"GEOID,STATE,CD120,NAME",state?".0009":".012");
    // Missouri's 2026 election uses the 2022/2024 map following the September 2026 court decision.
    // Layer 8 is the 119th congressional districts in Census TIGERweb/Legislative.
    if(!state||state==="MO"){
      let old=[];
      try{old=await fetchCensusLayer("Legislative/MapServer/8/query","STATE = '29'","GEOID,STATE,CD119,NAME",state?".0009":".012")}catch(e){console.warn("Missouri historical district geometry unavailable",e.message)}
      if(old.length){features=features.filter(f=>String(f.properties?.STATE)!=="29");for(const f of old){f.properties={...f.properties,CD120:f.properties.CD119,geographyNote:"Missouri 2022/2024 boundaries used for 2026 election"};features.push(f)}}
      else caveat="Missouri Congressional boundaries could not be independently verified; not displayed as district geometry.";
    }
  }else if(kind==="counties"){
    if(!state)throw Error("State required for county boundaries");
    features=await fetchCensusLayer("State_County/MapServer/1/query",where,"GEOID,STATE,NAME",state?".001":".012");
  }else throw Error("Invalid geography type");
  features=features.filter(f=>f&&f.geometry&&FIPS_TO_CODE[String(f.properties?.STATE??f.properties?.GEOID?.slice(0,2))]);
  const value={type:"FeatureCollection",features,meta:{source:"U.S. Census Bureau TIGERweb",vintage:"2026 current / 120th Congressional Districts",layer:kind,updatedAt:new Date().toISOString(),caveat}};
  censusGeoCache.set(key,{value,at:Date.now()});
  return value;
 })();
 censusGeoCache.set(key,{pending,at:Date.now()});
 try{return await pending}catch(e){censusGeoCache.delete(key);throw e}
}

const page=await import('node:fs/promises').then(fs=>fs.readFile(new URL('./public/index.html',import.meta.url),'utf8'));
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const json=(obj,code=200)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
 if(u.pathname==='/api/election')return json(electionData);

 if(u.pathname==='/election-maps.js'||u.pathname==='/election-maps.css'){
   const filename=u.pathname.slice(1),ctype=filename.endsWith(".css")?"text/css; charset=utf-8":"text/javascript; charset=utf-8";
   import('node:fs/promises').then(fs=>fs.readFile(new URL('./public/'+filename,import.meta.url))).then(buf=>{
     res.writeHead(200,{'Content-Type':ctype,'Cache-Control':'public, max-age=180'});res.end(buf);
   }).catch(()=>json({error:'Asset not available'},404));return;
 }
 if(u.pathname.startsWith('/api/geo/')){
   const kind=u.pathname.slice('/api/geo/'.length);
   if(!['states','districts','counties'].includes(kind))return json({error:'Unknown geography'},404);
   const state=String(u.searchParams.get('state')||'').toUpperCase();
   if(state&&!CODE_TO_FIPS[state])return json({error:'Unknown state'},400);
   if(kind==='counties'&&!state)return json({error:'State required'},400);
   censusMap(kind,state||null).then(data=>json(data)).catch(err=>json({error:'Geography temporarily unavailable',detail:String(err.message)},503));return;
 }
 if(u.pathname==='/api/stories')return json({stories:stories.slice(0,500),initialized,lastScan});
 if(u.pathname==='/api/status')return json({sources:snapshot().sources,initialized,lastScan,pollIntervalMs:POLL});
 if(u.pathname==='/health')return json({ready:true,initialized,responding:Object.values(status).filter(x=>x.ok).length,lastScan});
 if(u.pathname==='/api/stream'){
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  res.write(': connected\n\n');clients.add(res);send(res,'snapshot',snapshot());
  const ping=setInterval(()=>{try{res.write(': keepalive\n\n')}catch{}},25000);
  req.on('close',()=>{clearInterval(ping);clients.delete(res)});
  return;
 }
 if(u.pathname==='/'||u.pathname==='/index.html'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});return res.end(page);
 }
 return json({error:'Not found'},404);
});
server.listen(PORT,'0.0.0.0',()=>{console.log('THE EVENING WIRE listening on '+PORT);runScan();setInterval(runScan,POLL).unref();updateElectionData();setInterval(updateElectionData,resultsPollingMS).unref()});

setTimeout(async()=>{
  for(const kind of ["states","districts"]){
    try{
      const value=await censusMap(kind,null);
      console.log("CENSUS_MAP_WARM",kind,"features="+value.features.length,"caveat="+(value.meta?.caveat||"none"));
      if(kind==="districts"){const byState={},duplicates={};for(const f of value.features){const k=String(f.properties?.STATE||"??");byState[k]=(byState[k]||0)+1;const id=String(f.properties?.GEOID||"");duplicates[id]=(duplicates[id]||0)+1}console.log("CENSUS_MAP_AUDIT",JSON.stringify(byState));console.log("CENSUS_MAP_DUPLICATE_GEOIDS",JSON.stringify(Object.entries(duplicates).filter(([,n])=>n>1)));console.log("CENSUS_MAP_UNEXPECTED_DISTRICTS",JSON.stringify(value.features.filter(f=>["09","17","33"].includes(String(f.properties?.STATE))).map(f=>({geoId:f.properties?.GEOID,cd:f.properties?.CD120,name:f.properties?.NAME}))));}
    }catch(err){
      console.warn("CENSUS_MAP_WARM_FAILED",kind,String(err.message||err).slice(0,350));
    }
  }
},1000).unref();

