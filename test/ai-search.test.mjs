import test from 'node:test';
import assert from 'node:assert/strict';
import {aiSearchRoute} from '../ai-search.mjs';
function response(){let code,body;return {writeHead(c){code=c},end(s){body=JSON.parse(s)},get(){return {code,body}}}}
test('Lounge AI search returns verified linked reference results within the site',async()=>{
 const previous=globalThis.fetch;
 try{
  globalThis.fetch=async url=>{
   if(String(url).includes('en.wikipedia.org'))return {ok:true,json:async()=>({query:{pages:[{title:'Canberra',fullurl:'https://en.wikipedia.org/wiki/Canberra',extract:'Canberra is the capital city of Australia.'}]}})};
   return {ok:true,json:async()=>({search:[{label:'Canberra',description:'Capital city of Australia',concepturi:'https://www.wikidata.org/wiki/Q3114'}]})}
  };
  const res=response();
  assert.equal(await aiSearchRoute({method:'GET',url:'/api/ai-search?q=Canberra'},res,'/api/ai-search',[]),true);
  const {code,body}=res.get();
  assert.equal(code,200);
  assert.equal(body.results.length,2);
  assert.equal(body.results[0].title,'Canberra');
  assert.ok(body.results.every(x=>x.url.startsWith('https://')));
  assert.ok(body.description.includes('browser'));
 }finally{globalThis.fetch=previous}
});
test('Lounge AI search preserves locally collected publisher headlines during source outages',async()=>{
 const prior=globalThis.fetch;try{
  globalThis.fetch=async()=>{throw Error('blocked')};
  const res=response();
  const news=[{title:'Roman Empire archaeology discovery',url:'https://www.bbc.com/news/roman-empire',published:new Date().toISOString(),source:'BBC News',excerpt:'New archaeology discovery about the Roman Empire.'}];
  await aiSearchRoute({method:'GET',url:'/api/ai-search?q=Roman%20Empire'},res,'/api/ai-search',news);
  const {code,body}=res.get();
  assert.equal(code,200);assert.equal(body.results.length,1);
  assert.equal(body.results[0].source,'BBC News');
  assert.equal(body.errors.length,2);
 }finally{globalThis.fetch=prior}
});
test('Search rejects empty questions',async()=>{
 const res=response();
 await aiSearchRoute({method:'GET',url:'/api/ai-search?q='},res,'/api/ai-search');
 assert.equal(res.get().code,400);
});
