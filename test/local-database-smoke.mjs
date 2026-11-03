// Runs ONLY in disposable GitHub Actions: never test against an owner's real DB.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir=join(root,'private-data');
if(process.env.CI!=='true')throw Error('Refusing test outside disposable CI');
try{await readFile(join(dataDir,'owner-admin.sha256'));throw Error('Refusing to overwrite existing owner database!')}catch(e){if(e.code!=='ENOENT')throw e}
async function runOwnerSetup(){
 return await new Promise((resolve,reject)=>{
  const command=spawn(process.execPath,['set-owner-password.mjs'],{cwd:root,stdio:['ignore','pipe','pipe']});
  let output='';
  command.stdout.on('data',part=>{output+=String(part)});
  command.stderr.on('data',part=>{output+=String(part)});
  command.on('error',reject);
  command.on('exit',code=>code===0?resolve(output):reject(new Error('Owner password generation failed: '+output)));
 });
}
const output=await runOwnerSetup();
const password=output.match(/\bEW-[A-Za-z0-9_-]{24}(?=\s|$)/)?.[0];
assert.ok(password,'A strong owner password should be generated without typing');
assert.equal((await readFile(join(dataDir,'owner-admin.sha256'),'utf8')).trim(),createHash('sha256').update(password).digest('hex'));
const again=await runOwnerSetup();
assert.match(again,/already configured/,'Subsequent launches must not reset the owner password');
console.log('Owner setup creates a secure credential without interactive input PASS');
const base='http://127.0.0.1:3000';
let child=null,logs='';
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
function start(){
 logs='';
 child=spawn(process.execPath,['start-local.mjs'],{cwd:root,env:{...process.env},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',d=>{logs+=String(d).slice(-2500)});
 child.stderr.on('data',d=>{logs+=String(d).slice(-2500)});
}
async function waitReady(){
 for(let i=0;i<55;i++){
  if(child.exitCode!==null)throw Error('Server exited: '+logs.slice(-6000));
  try{
   const r=await fetch(base+'/api/members/status');
   if(r.ok&&(await r.json()).ready===true)return;
  }catch{}
  await sleep(500);
 }
 throw Error('Database never became ready: '+logs.slice(-7000));
}
async function stop(){
 if(!child)return;
 const c=child;child=null;
 c.kill();
 await Promise.race([new Promise(resolve=>c.once('exit',resolve)),sleep(5000)]);
 if(c.exitCode===null)c.kill('SIGKILL');
 await sleep(500);
}
async function call(path,{method='GET',body,cookie}={}){
 const headers={};
 if(body)headers['Content-Type']='application/json';
 if(cookie)headers.Cookie=cookie;
 if(method!=='GET')headers.Origin=base;
 const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});
 let data=null;try{data=await r.json()}catch{}
 return {code:r.status,data,cookie:(r.headers.get('set-cookie')||'').split(';')[0],setCookie:r.headers.get('set-cookie')||''};
}
try{
 start();
 await waitReady();
 console.log('Local DB initialized');
 const unauthed=await call('/api/admin/members');
 assert.equal(unauthed.code,403,'Owner directory must not be public');
 const signedIn=await call('/api/admin/login',{method:'POST',body:{password}});
 assert.equal(signedIn.code,200,'Owner sign-in: '+JSON.stringify(signedIn.data));
 assert.equal(signedIn.data.authenticated,true);
 const ownerCookie=signedIn.cookie;
 assert.match(ownerCookie,/^ew_editor_session=/);
 const ownerCheck=await call('/api/admin/session',{cookie:ownerCookie});
 assert.equal(ownerCheck.data.authenticated,true);
 const member=await call('/api/members/signup',{method:'POST',body:{
  displayName:'Test Election Reader',email:'smoke-reader@example.invalid',
  password:'testing-long-member-password',pin:'2816',agreed:true
 }});
 assert.equal(member.code,200,'Member registration: '+JSON.stringify(member.data));
 assert.equal(member.data.user.displayName,'Test Election Reader');
 assert.match(member.setCookie,/Max-Age=7776000/,'Remembered devices use 90-day cookies');
 const memberCookie=member.cookie;
 const session=await call('/api/members/session',{cookie:memberCookie});
 assert.equal(session.data.user.displayName,'Test Election Reader','Member cookie should work on localhost');
 const directory=await call('/api/admin/members',{cookie:ownerCookie});
 assert.equal(directory.code,200,'Owner directory: '+JSON.stringify(directory.data));
 assert.equal(Number(directory.data.total),1);
 const calls=await call('/api/editor/calls');
 assert.equal(calls.data.storage,'postgresql','Calls must use persistent embedded database');
 const noOwner=await call('/api/admin/members',{cookie:memberCookie});
 assert.equal(noOwner.code,403,'Ordinary member cannot see admin directory');
 const reaction=await call('/api/community/posts',{method:'POST',cookie:memberCookie,body:{
  topic:'general',message:'Testing that the local database saves this election discussion.'
 }});
 assert.equal(reaction.code,201,'Reaction posting: '+JSON.stringify(reaction.data));
 const readReactions=await call('/api/community/posts',{cookie:memberCookie});
 assert.equal(readReactions.code,200,'Reaction reading: '+JSON.stringify(readReactions.data));
 assert.equal(readReactions.data.posts.some(p=>p.id===reaction.data.id),true);
 // New rooms are readable without membership; member actions remain protected.
 const publicPosts=await call('/api/community/posts');
 assert.equal(publicPosts.code,200,'Guest can read the public conversation');
 const react=await call('/api/community/'+reaction.data.id+'/react',{method:'POST',cookie:memberCookie,body:{emoji:'fire'}});
 assert.equal(react.code,200,'Member can react with an emoji');
 const reacted=await call('/api/community/posts',{cookie:memberCookie});
 assert.equal(reacted.data.posts.find(p=>p.id===reaction.data.id)?.reactions?.fire,1);
 const memberPresence=await call('/api/community/presence',{method:'POST',cookie:memberCookie});
 assert.equal(memberPresence.code,200);
 const online=await call('/api/community/presence');
 assert.ok(online.data.online>=1,'Active member count is server-side');
 const deniedPoll=await call('/api/community/admin/polls',{method:'POST',cookie:memberCookie,body:{question:'Which party will win this mock race?',options:['Republican','Democrat']}});
 assert.equal(deniedPoll.code,403,'Only owner can create polls');
 const poll=await call('/api/community/admin/polls',{method:'POST',cookie:ownerCookie,body:{question:'Which party wins this example race?',options:['Republican','Democrat'],durationHours:1}});
 assert.equal(poll.code,201,'Owner can create polls: '+JSON.stringify(poll.data));
 const vote=await call('/api/community/polls/'+poll.data.id+'/vote',{method:'POST',cookie:memberCookie,body:{choice:0}});
 assert.equal(vote.code,200,'Member can vote');
 const duplicateVote=await call('/api/community/polls/'+poll.data.id+'/vote',{method:'POST',cookie:memberCookie,body:{choice:1}});
 assert.equal(duplicateVote.code,409,'Members can vote only once per poll');
 const pollResults=await call('/api/community/polls',{cookie:memberCookie});
 assert.equal(pollResults.data.polls.find(p=>p.id===poll.data.id)?.counts?.[0],1);
 const announcement=await call('/api/community/admin/announcement',{method:'POST',cookie:ownerCookie,body:{topic:'general',message:'This is an official Evening Wire test alert.'}});
 assert.equal(announcement.code,201,'Owner can publish an official announcement');
 const publicNews=await call('/api/community/posts');
 assert.equal(publicNews.data.posts.find(p=>p.id===announcement.data.id)?.official,true);
 const hide=await call('/api/community/admin/posts/'+reaction.data.id+'/hide',{method:'POST',cookie:ownerCookie});
 assert.equal(hide.code,200,'Owner can moderate messages');
 const afterHide=await call('/api/community/posts');
 assert.equal(afterHide.data.posts.some(p=>p.id===reaction.data.id),false);
 const optionalSource=await call('/api/admin/calls',{method:'POST',cookie:ownerCookie,body:{
  office:'senate',state:'TX',candidate:'Example Election Test Candidate',party:'R',sourceName:'',sourceUrl:'',confirm:true
 }});
 assert.equal(optionalSource.code,200,'Owner editorial call can omit source: '+JSON.stringify(optionalSource.data));
 assert.equal(optionalSource.data.call.sourceUrl,'');
 const publicCalls=await call('/api/editor/calls');
 assert.equal(publicCalls.data.calls.some(c=>c.id==='senate-TX'&&!c.sourceName&&!c.sourceUrl),true);
 const invalidSource=await call('/api/admin/restore',{method:'POST',cookie:ownerCookie,body:{
  version:1,calls:[{office:'senate',state:'TX',candidate:'Example',party:'R',sourceUrl:'javascript:alert(1)',sourceName:'Not safe'}]
 }});
 assert.equal(invalidSource.code,400,'Unsafe source URL must still be rejected');
 const deniedUpdate=await call('/api/updates',{method:'POST',cookie:memberCookie,body:{
  category:'important',message:'Ordinary members should never publish owner alerts.'
 }});
 assert.equal(deniedUpdate.code,403,'Members may not publish owner alerts');
 const adminUpdate=await call('/api/updates',{method:'POST',cookie:ownerCookie,body:{
  category:'important',message:'Testing a private local election update.'
 }});
 assert.equal(adminUpdate.code,201,'Owner election update: '+JSON.stringify(adminUpdate.data));
 const challenge=await call('/api/challenge',{cookie:memberCookie});
 assert.equal(challenge.code,200,'Challenge read: '+JSON.stringify(challenge.data).slice(0,250));
 assert.equal(challenge.data.raceCount,506);
 console.log('Reaction Hub, owner election notices, prediction database PASS');
 console.log('Owner role, member registration, private directory, sessions PASS');
 await stop();
 start();await waitReady();
 const login=await call('/api/members/login',{method:'POST',body:{
  email:'smoke-reader@example.invalid',pin:'2816'
 }});
 assert.equal(login.code,200,'Member persisted over restart: '+JSON.stringify(login.data));
 assert.equal(login.data.user.displayName,'Test Election Reader');
 const allLogout=await call('/api/members/logout-all',{method:'POST',cookie:login.cookie});
 assert.equal(allLogout.code,200,'Remembered sessions can be revoked');
 const revoked=await call('/api/members/session',{cookie:login.cookie});
 assert.equal(revoked.data.user,null,'Revoked device no longer signed in');
 const oldOwner=await call('/api/admin/session',{cookie:ownerCookie});
 assert.equal(oldOwner.data.authenticated,true,'Owner session persisted over restart');
 console.log('Persistent member and owner sessions survive restart PASS');
}finally{
 await stop();
 // This runner is restricted to fresh disposable CI checkouts only.
 await rm(dataDir,{recursive:true,force:true});
}
