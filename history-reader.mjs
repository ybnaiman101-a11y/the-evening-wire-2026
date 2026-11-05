// The Lounge: date-specific sourced history, multiple live APIs, Nov 5 verified fallback.
const eastern=now=>{
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return {date:parts.year+'-'+parts.month+'-'+parts.day,month:parts.month,day:parts.day};
};
const sources=(month,day)=>[
 {name:'Wikimedia',url:'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/'+month+'/'+day},
 {name:'Wikipedia',url:'https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/'+month+'/'+day},
 {name:'Byabbe (Wikipedia-derived)',url:'https://byabbe.se/on-this-day/'+Number(month)+'/'+Number(day)+'/events.json'}
];
// Source: Associated Press, Today in History, November 5, 2026.
// These are only shown for November 5 when all live history APIs are down.
const AP_NOV_5='https://apnews.com/article/29cf83e87186da2f92acd6453ce57086';
const NOV5=[
 {year:'1605',text:'The Gunpowder Plot to blow up the English Parliament was foiled after Guy Fawkes was seized.',url:AP_NOV_5,source:'Associated Press'},
 {year:'1872',text:'Susan B. Anthony cast a vote in the U.S. presidential election, defying laws that excluded women; she was later arrested.',url:AP_NOV_5,source:'Associated Press'},
 {year:'1912',text:'Woodrow Wilson was elected president of the United States, defeating Theodore Roosevelt, William Howard Taft and Eugene V. Debs.',url:AP_NOV_5,source:'Associated Press'},
 {year:'1930',text:'Sinclair Lewis became the first American awarded the Nobel Prize in Literature.',url:AP_NOV_5,source:'Associated Press'},
 {year:'1940',text:'Franklin D. Roosevelt won an unprecedented third term as president of the United States.',url:AP_NOV_5,source:'Associated Press'},
 {year:'1968',text:'Richard Nixon was elected U.S. president, defeating Hubert Humphrey and George Wallace.',url:AP_NOV_5,source:'Associated Press'},
 {year:'1994',text:'George Foreman became the oldest heavyweight boxing champion at age 45, defeating Michael Moorer.',url:AP_NOV_5,source:'Associated Press'}
];
export function normalizeHistoryEvents(payload,source='Wikipedia',currentYear=9999){
 const input=Array.isArray(payload?.events)?payload.events:[];
 const out=[];
 for(const item of input){
  const year=Number(item?.year),message=item?.text??item?.description;
  const text=typeof message==='string'?message.trim():'';
  if(!Number.isInteger(year)||year>currentYear||year< -3500||text.length<16)continue;
  let url='https://en.wikipedia.org/wiki/Portal:History';
  const pages=Array.isArray(item.pages)?item.pages:Array.isArray(item.wikipedia)?item.wikipedia:[];
  for(const page of pages){
   const candidate=page?.content_urls?.desktop?.page||page?.wikipedia||'';
   if(typeof candidate==='string'&&candidate.startsWith('https://en.wikipedia.org/wiki/')){url=candidate;break}
  }
  out.push({year:String(year),text:text.slice(0,500),url,source});
 }
 const unique=new Map();
 for(const event of out){
  const key=event.year+'|'+event.text.toLowerCase().replace(/[^a-z\d]/g,'').slice(0,80);
  if(!unique.has(key))unique.set(key,event);
 }
 const sorted=[...unique.values()].sort((a,b)=>Number(b.year)-Number(a.year));
 if(sorted.length<=18)return sorted;
 return [...sorted.slice(0,11),...sorted.slice(-7)].sort((a,b)=>Number(b.year)-Number(a.year));
}
export function createHistoryReader({fetchImpl=fetch,clock=()=>new Date(),logger=console}={}){
 let cache={date:'',at:0,events:[],source:'',sourceUrl:'',fallback:false,error:null};
 return async function getHistory({force=false}={}){
  const {date,month,day}=eastern(clock()),stamp=Date.now();
  if(!force&&cache.date===date&&stamp-cache.at<(cache.events.length?4*3600000:90000))return cache;
  const errors=[];
  for(const feed of sources(month,day)){
   try{
    const response=await fetchImpl(feed.url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'TheLoungeHistory/1.2 (historical references)'}});
    if(!response.ok)throw Error('HTTP '+response.status);
    const payload=await response.json();
    const events=normalizeHistoryEvents(payload,feed.name,Number(date.slice(0,4)));
    if(events.length<2)throw Error('No usable events');
    cache={date,at:stamp,events,source:feed.name,sourceUrl:feed.url,fallback:false,error:null};
    return cache;
   }catch(err){errors.push(feed.name+': '+String(err?.message||err).slice(0,90))}
  }
  logger.warn('CLUBHOUSE_HISTORY_FEEDS',JSON.stringify({date,errors}).slice(0,700));
  const previous=cache.date===date?cache.events:[];
  const seeded=month==='11'&&day==='05'?NOV5:[];
  const events=previous.length?previous:seeded;
  cache={date,at:stamp,events,source:previous.length?cache.source:seeded.length?'Associated Press':'Unavailable',sourceUrl:previous.length?cache.sourceUrl:seeded.length?AP_NOV_5:'',fallback:true,error:errors.join('; ').slice(0,300)};
  return cache;
 }
}
export const historicalEventsReader=createHistoryReader();
