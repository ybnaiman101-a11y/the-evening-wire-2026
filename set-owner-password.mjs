// THE EVENING WIRE: first-run Windows owner setup without a hidden typing prompt.
// A fresh cryptographic password is generated ON THIS COMPUTER, displayed once,
// and only its SHA-256 verifier is saved in private-data. Never commit secrets.
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const folder=join(dirname(fileURLToPath(import.meta.url)),'private-data');
const path=join(folder,'owner-admin.sha256');
let oldHash='';
try{oldHash=(await readFile(path,'utf8')).trim()}catch(e){if(e.code!=='ENOENT')throw e}
if(oldHash){
 if(!/^[a-f0-9]{64}$/.test(oldHash)){
  console.error('An existing owner password file is malformed. No changes were made.');
  process.exitCode=1;
 }else console.log('Your owner password is already configured; it was NOT changed.');
}else{
 // 144 bits of entropy; base64url is easy to select and copy on Windows.
 const password='EW-'+randomBytes(18).toString('base64url');
 const hash=createHash('sha256').update(password,'utf8').digest('hex');
 try{
  await mkdir(folder,{recursive:true,mode:0o700});
  await writeFile(path,hash+'\n',{flag:'wx',mode:0o600});
  console.log('');
  console.log('===========================================================');
  console.log(' YOUR PRIVATE OWNER PASSWORD (CREATED ON THIS COMPUTER):');
  console.log('');
  console.log(' '+password);
  console.log('');
  console.log(' WRITE IT DOWN OR COPY IT INTO A PASSWORD MANAGER.');
  console.log(' The password will NOT be shown again after this window closes.');
  console.log(' Do not send a screenshot showing it or share it with anyone.');
  console.log('===========================================================');
  console.log('OWNER SETUP COMPLETE. You are the administrator.');
 }catch(e){
  if(e.code==='EEXIST')console.error('An owner password was set while setup was running; no password was overwritten.');
  else console.error('Cannot save owner password verifier:',e.message);
  process.exitCode=1;
 }
}
