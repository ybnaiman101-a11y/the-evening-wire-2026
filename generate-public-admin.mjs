// Run ON YOUR OWN COMPUTER. The administrator's public password and its hash
// never leave this machine and are NEVER committed to GitHub.
import {randomBytes,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const dir=join(root,'private-data');
const file=join(dir,'PUBLIC-ADMIN-CREDENTIALS-KEEP-PRIVATE.txt');
await mkdir(dir,{recursive:true,mode:0o700});
const password='EW-PUBLIC-'+randomBytes(24).toString('base64url');
const hash=createHash('sha256').update(password).digest('hex');
const text='THE EVENING WIRE — PUBLIC OWNER LOGIN\n\n' +
 'IMPORTANT: This is NOT your local website password.\n' +
 'Your NEW public owner password:\n'+password+'\n\n' +
 'Set this value in Railway service Variables:\n' +
 'NAME: EW_ADMIN_PASSWORD_SHA256\nVALUE: '+hash+'\n\n' +
 'Never send this file or a screenshot to anyone. Store it privately.\n';
try {
 await writeFile(file,text,{flag:'wx',mode:0o600});
 console.log('SUCCESS: Strong independent public admin credential created in:');
 console.log(file);
 console.log('Keep this file private. Never upload it or paste its contents into chat.');
}catch(e){
 if(e.code==='EEXIST')console.log('EXISTING CREDENTIAL NOT CHANGED: '+file);
 else {console.error('Cannot create private credential file: '+e.message);process.exitCode=1}
}
