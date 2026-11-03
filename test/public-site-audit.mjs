// Read-only public verification. Runs in a separate GitHub branch and never
// authenticates, creates user records, edits votes, or changes DNS.
import {lookup} from 'node:dns/promises';
import assert from 'node:assert/strict';
const host='electionhub2026.com.co';
const base='https://'+host;
let passed=0,failed=0,uncertain=0;
const log=(status,name,info='')=>{console.log(status.padEnd(9),name,info);if(status==='PASS')passed++;else if(status==='FAIL')failed++;else uncertain++};
async function get(path){
 const response=await fetch(base+path,{signal:AbortSignal.timeout(13000),redirect:'manual',headers:{'User-Agent':'EveningWire-ReadOnly-PublicAudit/1.0'}});
 const body=await response.text();
 let json;try{json=JSON.parse(body)}catch{}
 return {response,body,json};
}
try{
 const result=await lookup(host);log('PASS','public DNS lookup',result.address?'A/AAAA record found':'');
}catch(e){log('FAIL','public DNS lookup',e.code||e.message)}
for(const [name,path,check] of [
 ['homepage','/',({response,body})=>response.status===200&&/THE EVENING WIRE/i.test(body)],
 ['health','/health',({response,json})=>response.status===200&&json?.ready===true],
 ['reader sign-in page','/login',({response,body})=>response.status===200&&/SIGN IN/i.test(body)&&/CREATE ACCOUNT/i.test(body)],
 ['member database readiness','/api/members/status',({response,json})=>response.status===200&&json?.ready===true],
 ['unauthenticated owner session','/api/admin/session',({response,json})=>response.status===200&&json?.authenticated===false],
 ['unauthenticated member directory denied','/api/admin/members',({response})=>response.status===403],
 ['live results API','/api/live-results',({response,json})=>response.status===200&&Array.isArray(json?.sources)&&typeof json.reportingRaces==='number'],
 ['election dashboard vote feed','/api/election',({response,json})=>response.status===200&&Array.isArray(json?.liveSources)&&json?.raceCallsControlledBy==='Evening Wire administrator']
]){
 try{
  const data=await get(path);
  log(check(data)?'PASS':'FAIL',name,'HTTP '+data.response.status+(name==='live results API'?' sources='+data.json?.sources?.length+' connected='+data.json?.sources?.filter(s=>s.connected).length+' reporting='+data.json?.reportingRaces:''));
  if(name==='homepage'&&data.response.ok){
   const headers=data.response.headers;
   for(const [h,required] of [['content-security-policy',true],['strict-transport-security',true],['x-frame-options',true],['x-content-type-options',true]]){
    log(headers.get(h)?'PASS':'FAIL','response security header: '+h);
   }
  }
 }catch(e){log('FAIL',name,String(e.cause?.code||e.name||'request failed'))}
}
try{
 const r=await fetch('http://'+host+'/health',{signal:AbortSignal.timeout(13000),redirect:'manual'});
 log([301,302,307,308].includes(r.status)&&String(r.headers.get('location')).startsWith('https://')?'PASS':'FAIL','HTTP to HTTPS redirect','HTTP '+r.status);
}catch(e){log('UNKNOWN','HTTP to HTTPS redirect',e.cause?.code||e.name)}
console.log('AUDIT_RESULT passes='+passed+' failures='+failed+' unknown='+uncertain);
if(failed>0)process.exitCode=1;
