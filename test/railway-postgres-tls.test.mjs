import test from 'node:test';
import assert from 'node:assert/strict';
import {postgresTLS,postgresConnectionString} from '../postgres-tls.mjs';
const url='postgresql://privateuser:privatepass@postgres.railway.internal:5432/railway';
test('Railway private WireGuard network is permitted; external database always verifies TLS',()=>{
 const prior={NODE_ENV:process.env.NODE_ENV,RAILWAY_PROJECT_ID:process.env.RAILWAY_PROJECT_ID,RAILWAY_ENVIRONMENT_ID:process.env.RAILWAY_ENVIRONMENT_ID};
 try{
  process.env.NODE_ENV='production';
  process.env.RAILWAY_PROJECT_ID='test-project';
  process.env.RAILWAY_ENVIRONMENT_ID='test-environment';
  assert.equal(postgresTLS(url),false);
  assert.equal(typeof postgresTLS('postgresql://u:p@external.example.com:5432/railway'),'object');
  assert.equal(postgresTLS('postgresql://u:p@external.example.com:5432/railway').rejectUnauthorized,true);
  assert.throws(()=>postgresTLS(url+'?sslmode=disable'),/insecure/);
  assert.throws(()=>postgresTLS(url+'?sslmode=verify-full'),/conflicts/);
  assert.equal(new URL(postgresConnectionString(url)).hostname,'postgres.railway.internal');
  delete process.env.RAILWAY_PROJECT_ID;
  assert.equal(postgresTLS(url).rejectUnauthorized,true);
 } finally {
  for(const [key,value] of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value}
 }
});
