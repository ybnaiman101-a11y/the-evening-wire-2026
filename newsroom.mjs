// The Lounge — resilient, attributed RSS news aggregation.
// Always show verified publisher headlines, never invented news or stale archives.
const FEEDS=[
 ['World','BBC News','https://feeds.bbci.co.uk/news/world/rss.xml'],
 ['United States','BBC News','https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml'],
 ['Business','BBC News','https://feeds.bbci.co.uk/news/business/rss.xml'],
 ['Technology','BBC News','https://feeds.bbci.co.uk/news/technology/rss.xml'],
 ['United States','NPR','https://feeds.npr.org/1001/rss.xml'],
 ['United States','The Guardian','https://www.theguardian.com/us-news/rss'],
 ['World','Sky News','https://feeds.skynews.com/feeds/rss/home.xml'],
 ['World','Google News','https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en']
];
const decode=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi,'$1').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&apos;|&#39;|&#x27;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([a-f\d]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
const plain=s=>decode(s).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
const field=(xml,tag)=>{
 const pattern=new RegExp('<'+tag+'(?:\\s[^>]*?)?>([\\s\\S]*?)<\\/'+tag+'>','i'),m=xml.match(pattern);
 return m?plain(m[1]):'';
};
export function parsePublisherRSS(xml,{topic='World',source='Publisher',now=Date.now(),maxAgeHours=72}={}){
 if(typeof xml!=='string'||xml.length>1600000)return [];
 const stories=[],limit=Math.max(1,Math.min(72,Number(maxAgeHours)||72))*3600000;
 for(const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
  const part=match[1],title=field(part,'title'),link=field(part,'link'),publication=field(part,'pubDate')||field(part,'dc:date');
  const time=Date.parse(publication),published=Number.isFinite(time)?new Date(time).toISOString():null;
  const excerpt=field(part,'description').slice(0,220),attribution=field(part,'source')||source;
  if(title.length<8||!link.startsWith('https://')||!published||time<now-limit||time>now+3600000)continue;
  stories.push({title:title.slice(0,240),url:link,published,source:attribution.slice(0,75),topic,excerpt});
 }
 return stories;
}
export function createNewsReader({feeds=FEEDS,fetchImpl=fetch,clock=Date.now,logger=console}={}){
 let cache={at:0,stories:[],errors:[],sourceResults:[],updatedAt:null,stale:false};
 return async function getNews({force=false}={}){
  const now=clock(),live=cache.stories.length>0,ttl=live?5*60000:30*1000;
  if(!force&&cache.at&&now-cache.at<ttl)return cache;
  const results=await Promise.all(feeds.map(async([topic,source,url])=>{
   try{
    const response=await fetchImpl(url,{headers:{'User-Agent':'TheLoungeRSS/1.1 (+publisher links)'},signal:AbortSignal.timeout(9000),redirect:'follow'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const content=await response.text();
    if(content.length>1600000)throw Error('Feed too large');
    const stories=parsePublisherRSS(content,{topic,source,now});
    if(!stories.length)throw Error('No recent valid RSS items');
    return {source,topic,stories:stories.slice(0,24),ok:true};
   }catch(error){
    const reason=String(error?.message||error).slice(0,100);
    return {source,topic,stories:[],ok:false,error:reason};
   }
  }));
  const found=new Map();
  for(const row of results)for(const story of row.stories){
   const key=story.title.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,120);
   if(!found.has(key))found.set(key,story);
  }
  const sorted=[...found.values()].sort((a,b)=>Date.parse(b.published)-Date.parse(a.published)).slice(0,70);
  const errors=results.filter(x=>!x.ok).map(x=>x.source+' / '+x.topic+': '+x.error);
  if(errors.length)logger.warn('CLUBHOUSE_NEWS_SOURCES',JSON.stringify({ok:results.length-errors.length,total:results.length,failures:errors}).slice(0,950));
  // Preserve previously retrieved real headlines if a publisher has a temporary outage.
  // Discard anything older than 72 hours rather than presenting outdated news as current.
  const stale=sorted.length===0;
  const fallback=stale?cache.stories.filter(x=>Date.parse(x.published)>=now-72*3600000):[];
  cache={
   at:now,
   stories:sorted.length?sorted:fallback,
   errors,
   sourceResults:results.map(x=>({source:x.source,topic:x.topic,ok:x.ok,count:x.stories.length})),
   updatedAt:sorted.length?new Date(now).toISOString():cache.updatedAt,
   stale:stale&&fallback.length>0,
   unavailable:sorted.length===0&&fallback.length===0
  };
  return cache;
 };
}
export const newsroom=createNewsReader();
