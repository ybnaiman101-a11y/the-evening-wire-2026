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
const password='test-owner-password-no-secrets-here';
await mkdir(dataDir,{recursive:true});
await writeFile(join(dataDir,'owner-admin.sha256'),createHash('sha256').update(password).digest('hex')+'\n');
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
 return {code:r.status,data,cookie:(r.headers.get('set-cookie')||'').split(';')[0]};
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
 const oldOwner=await call('/api/admin/session',{cookie:ownerCookie});
 assert.equal(oldOwner.data.authenticated,true,'Owner session persisted over restart');
 console.log('Persistent member and owner sessions survive restart PASS');
}finally{
 await stop();
 // This runner is restricted to fresh disposable CI checkouts only.
 await rm(dataDir,{recursive:true,force:true});
}
