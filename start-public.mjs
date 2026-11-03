// THE EVENING WIRE — public production entrypoint for electionhub2026.com.co.
// Public starts fail closed. Never launch local PGlite or weakly configured
// administrator access on an internet-facing port.
import {Pool} from 'pg';
import {postgresTLS,postgresConnectionString} from './postgres-tls.mjs';

function fail(message) {
 console.error('PUBLIC_LAUNCH_BLOCKED: '+message);
 process.exit(1);
}
if(process.env.EW_LOCAL_DATABASE==='1')fail('Local PGlite cannot be exposed publicly.');
if(process.env.NODE_ENV!=='production')fail('NODE_ENV must equal production.');
if(process.env.EW_READ_ONLY_PREVIEW==='1')fail('Public interactive host must not use read-only preview mode.');
if(!/^[a-f0-9]{64}$/.test(process.env.EW_ADMIN_PASSWORD_SHA256||''))fail('Set an independent private EW_ADMIN_PASSWORD_SHA256 value in Railway service Variables.');
const databaseURL=process.env.DATABASE_URL||'';
let host;
try {
 const u=new URL(databaseURL);
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname||u.username===''||u.password==='')
  throw Error('Invalid or incomplete PostgreSQL connection string');
 host=u.hostname.toLowerCase();
 if(['localhost','127.0.0.1','::1','[::1]'].includes(host))throw Error('Localhost database cannot be used in the Railway service');
} catch(e){fail('DATABASE_URL must be set to a working private PostgreSQL connection string. '+String(e.message||e))}
process.env.HOST='0.0.0.0';
process.env.EW_READ_ONLY_PREVIEW='0';
let pool;
try {
 pool=new Pool({connectionString:postgresConnectionString(databaseURL),ssl:postgresTLS(databaseURL),
  max:1,connectionTimeoutMillis:10000,idleTimeoutMillis:2000});
 await pool.query('SELECT 1 AS ready');
 console.log('PUBLIC_DATABASE_TLS_CHECK_OK');
} catch(e) {
 fail('Cannot authenticate to the PostgreSQL database using verified TLS. '+String(e.message||e).slice(0,180));
} finally {await pool?.end().catch(()=>{})}
console.log('PUBLIC_LAUNCH_CHECKS_OK owner=configured database=ready mode=production');
await import('./server.mjs');
