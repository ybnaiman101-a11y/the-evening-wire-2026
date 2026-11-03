// THE EVENING WIRE: full-feature local-only launch.
// The server is never exposed to the Internet by this launcher.
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const folder=dirname(fileURLToPath(import.meta.url));
let hash='';
try{hash=(await readFile(join(folder,'private-data','owner-admin.sha256'),'utf8')).trim()}catch{}
if(!/^[a-f0-9]{64}$/.test(hash)){
 console.error('OWNER PASSWORD NOT SET. Run START-NEW-DATABASE.cmd to set it up.');
 process.exit(1);
}
process.env.EW_ADMIN_PASSWORD_SHA256=hash;
process.env.EW_LOCAL_DATABASE='1';
// This is only a compatibility marker: local-db-pool.mjs uses embedded PGlite,
// not a TCP connection or a real localhost Postgres server.
process.env.DATABASE_URL='postgresql://localhost:5432/evening_wire_embedded';
process.env.NODE_ENV='development';
process.env.HOST='127.0.0.1';
process.env.PORT='3000';
process.env.EW_READ_ONLY_PREVIEW='0';
try{
 // Optional AP license key stored on the owner's PC, never in GitHub or client JS.
 if(!process.env.AP_ELECTIONS_API_KEY){
  const key=(await readFile(join(folder,'private-data','ap-api-key.txt'),'utf8')).trim();
  if(key.length>=10&&key.length<=512&&!/\s/.test(key))process.env.AP_ELECTIONS_API_KEY=key;
  else console.warn('AP_LICENSE_KEY_FILE_INVALID: expected a single non-empty API key');
 }
}catch(e){if(e.code!=='ENOENT')console.warn('AP_LICENSE_KEY_FILE_UNREADABLE')}

console.log('THE EVENING WIRE — LOCAL DATABASE ENABLED');
console.log('Owner-only access: http://127.0.0.1:3000');
console.log('Database files: private-data/pglite');
console.log('This version is private to this computer, NOT publicly hosted.');
await import('./server.mjs');
