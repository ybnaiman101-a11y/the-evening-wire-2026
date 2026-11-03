// Interactive first-run setup: type an administrator password locally.
// Only its SHA-256 digest is saved, never the password itself.
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const folder=join(dirname(fileURLToPath(import.meta.url)),'private-data');
const path=join(folder,'owner-admin.sha256');
try{const current=(await readFile(path,'utf8')).trim();if(/^[a-f0-9]{64}$/.test(current)){console.log('Owner password is already configured.');process.exit(0)}}catch{}
if(!process.stdin.isTTY||!process.stdin.setRawMode){
 console.error('Owner setup needs an interactive Windows Command Prompt.');
 process.exit(1);
}
function hidden(question){
 return new Promise((resolve,reject)=>{
  process.stdout.write(question);
  let buf='';
  const terminal=process.stdin;
  terminal.setEncoding('utf8');
  terminal.setRawMode(true);
  terminal.resume();
  function finish(err=null){
   terminal.off('data',onData);
   terminal.setRawMode(false);
   terminal.pause();
   process.stdout.write('\n');
   err?reject(err):resolve(buf);
  }
  function onData(data){
   for(const c of data){
    if(c==='\r'||c==='\n'){finish();return}
    if(c==='\u0003'){finish(new Error('Setup cancelled'));return}
    if(c==='\u007f'||c==='\b'){buf=buf.slice(0,-1);continue}
    if(c>=' '&&buf.length<128)buf+=c;
   }
  }
  terminal.on('data',onData);
 });
}
try{
 console.log('THE EVENING WIRE — PRIVATE OWNER SETUP');
 console.log('Choose a unique administrator password of at least 16 characters.');
 console.log('Typing is intentionally hidden. Do not share your password.');
 const first=await hidden('New owner password: ');
 if(first.length<16||first.length>128)throw Error('Use between 16 and 128 characters. Restart setup.');
 const second=await hidden('Re-enter owner password: ');
 if(first!==second)throw Error('Passwords did not match. Restart setup.');
 const hash=createHash('sha256').update(first,'utf8').digest('hex');
 await mkdir(folder,{recursive:true,mode:0o700});
 await writeFile(path,hash+'\n',{flag:'wx',mode:0o600});
 console.log('OWNER SETUP COMPLETE. You are the administrator.');
}catch(e){console.error('Owner setup stopped:',e.message);process.exitCode=1}
