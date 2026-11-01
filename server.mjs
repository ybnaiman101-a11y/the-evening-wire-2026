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
const page=await import('node:fs/promises').then(fs=>fs.readFile(new URL('./public/index.html',import.meta.url),'utf8'));
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const json=(obj,code=200)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
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
server.listen(PORT,'0.0.0.0',()=>{console.log('THE EVENING WIRE listening on '+PORT);runScan();setInterval(runScan,POLL).unref()});
