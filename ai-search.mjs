// THE LOUNGE — grounded AI search results, returned to the on-device model.
// Searches publicly accessible reference sources. Inference happens only in the browser.
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
function clean(s,n=300){return String(s||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,n)}
function trusted(link){
 try{const x=new URL(link);return x.protocol==='https:'&&['en.wikipedia.org','www.wikidata.org'].includes(x.hostname)?x.href:null}catch{return null}
}
const timeout=()=>AbortSignal.timeout(6500);
async function wiki(q){
 const url=new URL('https://en.wikipedia.org/w/api.php');
 for(const [key,value] of Object.entries({action:'query',generator:'search',gsrsearch:q,gsrlimit:'6',prop:'extracts|info',exintro:'1',explaintext:'1',exsentences:'3',inprop:'url',format:'json',redirects:'1',formatversion:'2'}))url.searchParams.set(key,value);
 const res=await fetch(url,{headers:{'User-Agent':'TheLoungeSearch/1.0 (educational search feature)','Accept':'application/json'},signal:timeout()});
 if(!res.ok)throw Error('Wikipedia HTTP '+res.status);
 const body=await res.json();
 if(body.error)throw Error(String(body.error?.info||'Wikipedia search unavailable'));
 return (Array.isArray(body?.query?.pages)?body.query.pages:[]).filter(x=>x?.title&&x?.fullurl).map(x=>({title:clean(x.title,140),snippet:clean(x.extract||'',850),url:trusted(x.fullurl),source:'Wikipedia'})).filter(x=>x.url).slice(0,6)
}
async function wikidata(q){
 const url=new URL('https://www.wikidata.org/w/api.php');
 for(const [key,value] of Object.entries({action:'wbsearchentities',search:q,language:'en',format:'json',limit:'5'}))url.searchParams.set(key,value);
 const res=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'TheLoungeSearch/1.0 (educational search feature)'},signal:timeout()});
 if(!res.ok)throw Error('Wikidata HTTP '+res.status);
 const body=await res.json();
 return (Array.isArray(body.search)?body.search:[]).map(x=>({title:clean(x.label,140),snippet:clean(x.description||'',650),url:trusted(x.concepturi),source:'Wikidata'})).filter(x=>x.url&&x.snippet).slice(0,5)
}
function localNews(q,news){
 const terms=q.toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>3).slice(0,8);
 return (Array.isArray(news)?news:[]).filter(x=>x&&typeof x.title==='string'&&typeof x.url==='string'&&/^https:\/\//.test(x.url)&&Date.now()-Date.parse(x.published)<72*3600000).map(x=>{
  const hay=(x.title+' '+(x.excerpt||'')).toLowerCase();
  const score=terms.reduce((n,t)=>n+(hay.includes(t)?1:0),0);
  return {...x,score}
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5).map(x=>({title:clean(x.title,180),snippet:clean(x.excerpt||'',600),url:x.url,source:clean(x.source||'News publisher',80),published:x.published}));
}
export async function aiSearchRoute(req,res,path,news=[]){
 if(path!=='/api/ai-search'||req.method!=='GET')return false;
 const input=new URL(req.url,'http://localhost').searchParams.get('q')||'';
 const query=clean(input,160);
 if(query.length<2){send(res,400,{error:'Enter at least two characters to search.'});return true}
 const newsResults=localNews(query,news);
 const checks=await Promise.allSettled([wiki(query),wikidata(query)]);
 const errors=checks.map((r,i)=>r.status==='rejected'?['Wikipedia','Wikidata'][i]+' unavailable':null).filter(Boolean);
 const all=[...newsResults,...checks.flatMap(x=>x.status==='fulfilled'?x.value:[])];
 const unique=new Map();
 for(const item of all){
  const url=item.url;
  if(!unique.has(url))unique.set(url,item);
 }
 const results=[...unique.values()].slice(0,12);
 send(res,200,{query,results,sourceCount:results.length,errors,description:'Reference search only. AI answers are generated inside this browser; current web information is limited to the linked sources.'});
 return true;
}
