import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePublisherRSS,createNewsReader} from '../newsroom.mjs';
const NOW=Date.parse('2026-11-05T20:00:00Z');
const story=(title,at,url='https://www.bbc.com/news/example')=>'<item><title>'+title+'</title><link>'+url+'</link><pubDate>'+new Date(at).toUTCString()+'</pubDate><description><![CDATA[<p>Original published summary &amp; details</p>]]></description></item>';
const feed=(...rows)=>'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>BBC News</title>'+rows.join('')+'</channel></rss>';
test('RSS parser decodes titles, preserves source links and avoids stale or invented reports',()=>{
 const xml=feed(
  story('World &amp; politics headline',NOW-3600000),
  story('Stale headline',NOW-9*86400000),
  story('Unsafe link headline',NOW-60000,'javascript:alert(1)')
 );
 const stories=parsePublisherRSS(xml,{topic:'World',source:'BBC News',now:NOW});
 assert.equal(stories.length,1);
 assert.equal(stories[0].title,'World & politics headline');
 assert.equal(stories[0].topic,'World');
 assert.equal(stories[0].source,'BBC News');
 assert.equal(stories[0].excerpt,'Original published summary & details');
 assert.equal(stories[0].url,'https://www.bbc.com/news/example');
});
test('News reader tolerates blocked sources, merges active sources, deduplicates and caches briefly',async()=>{
 let calls=0;
 const feeds=[
  ['World','BBC News','https://feeds.example/world'],
  ['Technology','Sky News','https://feeds.example/tech'],
  ['Business','Unavailable','https://feeds.example/blocked']
 ];
 const reader=createNewsReader({feeds,clock:()=>NOW,logger:{warn(){}},fetchImpl:async url=>{
  calls++;
  if(url.endsWith('blocked'))throw Error('fetch failed');
  return {ok:true,text:async()=>feed(story(url.endsWith('world')?'Real world headline':'Real technology headline',NOW-3600000))};
 }});
 const first=await reader(),second=await reader();
 assert.equal(first.stories.length,2);
 assert.equal(first.unavailable,false);
 assert.equal(first.errors.length,1);
 assert.equal(first.sourceResults.length,3);
 assert.equal(calls,3,'repeat within cache lifetime should not cause a new request');
 assert.equal(second.stories.length,2);
});
test('News reader communicates total outage instead of claiming there are no current stories',async()=>{
 const reader=createNewsReader({feeds:[['World','Blocked','https://feeds.example/no']],clock:()=>NOW,logger:{warn(){}},fetchImpl:async()=>{throw Error('Network blocked')}});
 const out=await reader();
 assert.deepEqual(out.stories,[]);
 assert.equal(out.unavailable,true);
 assert.ok(out.errors.some(x=>x.includes('Network blocked')));
});
