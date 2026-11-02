import test from 'node:test';
import assert from 'node:assert/strict';
import {postgresTLS} from '../postgres-tls.mjs';

test('remote PostgreSQL requires TLS certificate verification',()=>{
 const result=postgresTLS('postgres://ew:pw@db.example.net:25060/ew');
 assert.equal(result.rejectUnauthorized,true);
});
test('local development may use non-TLS localhost',()=>{
 const old=process.env.NODE_ENV;
 try{process.env.NODE_ENV='development';assert.equal(postgresTLS('postgres://local:pw@localhost:5432/ew'),false)}
 finally{if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old}
});
test('production localhost connections still require TLS',()=>{
 const old=process.env.NODE_ENV;
 try{process.env.NODE_ENV='production';assert.equal(postgresTLS('postgres://local:pw@localhost:5432/ew').rejectUnauthorized,true)}
 finally{if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old}
});
test('unverified and disabled database TLS modes are refused',()=>{
 for(const mode of ['disable','allow','prefer','no-verify']){
  assert.throws(()=>postgresTLS('postgres://ew:pw@db.example.net:5432/ew?sslmode='+mode),/insecure/i);
 }
});
