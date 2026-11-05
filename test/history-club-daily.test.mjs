import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistoryReader,normalizeHistoryEvents} from '../history-reader.mjs';
import {clubRoute} from '../club.mjs';
function response(){let status=0,result=null;return {writeHead(code){status=code},end(text){result=JSON.parse(text)},read(){return {status,result}}}}
const midday=new Date('2026-11-05T20:30:00Z');
test('November 5 has verified AP-backed history events when all external history services fail',async()=>{
 const reader=createHistoryReader({clock:()=>midday,fetchImpl:async()=>{throw Error('publisher outage')},logger:{warn(){}}});
 const result=await reader();
 assert.equal(result.date,'2026-11-05');
 assert.equal(result.fallback,true);
 assert.ok(result.events.length>=5,'AP backup must contain documented events');
 assert.equal(result.source,'Associated Press');
 assert.ok(result.events.every(x=>x.url.startsWith('https://apnews.com/article/')&&Number.isInteger(Number(x.year))));
 assert.ok(result.events.some(x=>x.year==='1605'&&x.text.includes('Gunpowder Plot')));
 assert.ok(result.events.some(x=>x.year==='1872'&&x.text.includes('Susan B. Anthony')));
});
test('History prefers the live Wikipedia events and includes source attribution',async()=>{
 const reader=createHistoryReader({
  clock:()=>midday,logger:{warn(){}},
  fetchImpl:async()=>({ok:true,json:async()=>({events:[
   {year:1605,text:'Gunpowder Plot was discovered in London, England, and Guy Fawkes was detained.',pages:[]},
   {year:1872,text:'Susan B. Anthony voted in a presidential election in the United States.',pages:[]}
  ]})})
 });
 const result=await reader();
 assert.equal(result.fallback,false);
 assert.equal(result.events.length,2);
 assert.equal(result.source,'Wikimedia');
 assert.ok(result.events.every(x=>x.source==='Wikimedia'));
});
test('History excludes malformed and future-dated events',()=>{
 const out=normalizeHistoryEvents({events:[
  {year:9000,text:'A future event that has not happened yet.'},
  {year:1605,text:'Guy Fawkes and the Gunpowder Plot were discovered in London.'},
  {year:1400,text:'Short'},
  {year:'garbage',text:'Some event with a bad year number.'}
 ]},'Wikipedia',2026);
 assert.equal(out.length,1);
 assert.equal(out[0].year,'1605');
});
test('Quiz is available independently of any database or external publisher',async()=>{
 const req={method:'GET',url:'/api/club/daily',headers:{}},res=response();
 const handled=await clubRoute(req,res,'/api/club/daily');
 const out=res.read();
 assert.equal(handled,true);
 assert.equal(out.status,200);
 assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(out.result.date));
 assert.ok(out.result.quiz.question.length>15);
 assert.equal(out.result.quiz.options.length,4);
 assert.ok(out.result.debate.question.length>15);
 assert.ok(!Object.hasOwn(out.result.quiz,'correctAnswer'));
});
