import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOpenAmerica,parsePeoplesTally,parseArizona,createLiveResultsHub,parseAP} from '../live-results.mjs';

const at='2026-11-03T23:15:00Z';
const openFeed={
 api:1,year:2026,office:'Senate',as_of:at,
 live:true,stale:false,races:{
  'TX':{pct_in:12,cands:[{n:'Candidate R',p:'R',v:120000},{n:'Candidate D',p:'D',v:100000}],
   winner:'R',called:true}, // Ignored vendor race call
  'OH-special':{pct_in:14,cands:[{n:'Candidate D',p:'D',v:90000},{n:'Candidate R',p:'R',v:89000}]},
  'OH':{pct_in:12,cands:[{n:'Wrong race',p:'R',v:200}]}, // Ohio regular 2026 does NOT exist
  'FAKE-01':{pct_in:100,cands:[{n:'Invalid district',p:'D',v:9999999}]}
 }};
test('Open America maps real regular and special Senate races, no winners',()=>{
 const rows=parseOpenAmerica(openFeed,'Senate');
 assert.deepEqual(rows.map(r=>r.id).sort(),['senate-OH-special','senate-TX']);
 const tx=rows.find(r=>r.state==='TX');
 assert.equal(tx.totalVotes,220000);
 assert.equal(tx.candidates[0].percent,54.55);
 assert.equal(tx.called,false);assert.equal(tx.winner,null);
 assert.equal(tx.reportingPct,12);
});
test('Open America house at-large seat is district 1 and missing votes are null',()=>{
 const feed={...openFeed,office:'House',races:{'AK-00':{cands:[{n:'An Alaskan',p:'I',v:0}]}}};
 const [row]=parseOpenAmerica(feed,'House');
 assert.equal(row.id,'house-AK-1');assert.equal(row.totalVotes,0);
 assert.equal(row.candidates[0].percent,null);
 assert.throws(()=>parseOpenAmerica({...feed,year:2024},'House'),/contract changed/);
});
test("People's Tally maps correctly without inheriting upstream calls",()=>{
 const payload={generated_at:at,races:{
  'G-OH':{cands:[{name:'Person D',party:'D',votes:199},{name:'Person R',party:'R',votes:201}],exp:8,
   asof:at,src:'Ohio official',url:'https://ohiosos.gov/',winner_name:'Person R'},
  'S-OH-sp':{cands:[{name:'Special person',party:'R',votes:999}]},
  'S-OH':{cands:[{name:'Not on 2026 ballot',party:'D',votes:1000}]}
 }};
 const rows=parsePeoplesTally(payload);
 assert.deepEqual(rows.map(r=>r.id).sort(),['governor-OH','senate-OH-special']);
 assert.equal(rows[0].winner,null);
 assert.equal(rows[0].estimatedVotePct,8);
});
test('Arizona official statewide media JSON is mapped only for known 2026 races',()=>{
 const rows=parseArizona({
  electionDate:'2026-11-03',createdAt:at,
  results:{name:'Arizona',ballotItems:[
   {name:'Governor and Lieutenant Governor',contestType:'Candidate',ballotOptions:[
    {name:'Candidate One',voteCount:900,politicalParty:'Republican'},
    {name:'Candidate Two',voteCount:1000,politicalParty:'Democrat'}]},
   {name:'U.S. Representative in Congress District 3',contestType:'Candidate',ballotOptions:[
    {name:'Candidate Three',voteCount:33,politicalParty:'Republican'}]},
   {name:'Proposition 350',contestType:'Question',ballotOptions:[{name:'Yes',voteCount:500000}]}
  ]}
 });
 assert.deepEqual(rows.map(r=>r.id).sort(),['governor-AZ','house-AZ-3']);
 assert.equal(rows[0].winner,null);
 assert.throws(()=>parseArizona({electionDate:'2024-11-05',results:{ballotItems:[]}}),/not the 2026/);
});
test('AP licensed feed only loads with a real configured connection',()=>{
 const row={id:'senate-TX',office:'senate',state:'TX',candidates:[{name:'AP person',party:'R',votes:4}],updatedAt:at};
 assert.deepEqual(parseAP({configured:false,connected:false,races:[row]}),[]);
 assert.equal(parseAP({configured:true,connected:true,races:[row]})[0].winner,null);
});
test('Feed hub credits sources, does not double-count races, and flags missing AP key',async()=>{
 const urls=[];
 const fetcher=async url=>{
  urls.push(url);
  const obj=String(url).includes('openamerica.io')?
    String(url).includes('Senate')?openFeed:
      {api:1,year:2026,office:String(url).includes('House')?'House':'Governor',as_of:at,races:{}}:
    String(url).includes('thepeoplestally.com')?
      {generated_at:at,races:{'S-TX':{asof:at,cands:[{name:'Tally R',party:'R',votes:5},{name:'Tally D',party:'D',votes:4}]}}}:
    {electionDate:'2026-11-03',createdAt:at,results:{ballotItems:[]}};
  return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(obj)};
 };
 const hub=createLiveResultsHub({fetcher,now:()=>new Date('2026-11-03T23:16:00Z'),
  apProvider:()=>({configured:false,connected:false,races:[],checkedAt:null,updatedAt:null,error:null})});
 await hub.poll();
 const snapshot=hub.snapshot();
 assert.equal(urls.length,5);
 assert.equal(snapshot.sourceCount,5);
 assert.equal(snapshot.races.filter(r=>r.id==='senate-TX').length,1);
 assert.equal(snapshot.races.find(r=>r.id==='senate-TX').sourceName,'Open America · official state counts');
 assert.equal(snapshot.races.find(r=>r.id==='senate-TX').stale,false);
 assert.equal(snapshot.races.every(r=>r.called===false&&r.winner===null),true);
 assert.equal(snapshot.sources.find(s=>s.id==='ap').mode,'licensed-key-required');
 assert.equal(snapshot.sources.find(s=>s.id==='ohio').mode,'official-link-only');
});
