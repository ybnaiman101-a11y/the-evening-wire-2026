// A deliberately local, single-process PostgreSQL-compatible store.
// PGlite writes to private-data/pglite on the owner's computer.
// Remote production continues to use the normal pg Pool.
import {Pool as RemotePool} from 'pg';
import {PGlite} from '@electric-sql/pglite';
import {mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const dataDir=join(root,'private-data','pglite');
let pglitePromise=null;
let waitLine=Promise.resolve();

function localDatabase(){
 if(!pglitePromise){
  pglitePromise=(async()=>{
   await mkdir(dirname(dataDir),{recursive:true,mode:0o700});
   const db=new PGlite(dataDir);
   await db.waitReady;
   return db;
  })();
 }
 return pglitePromise;
}
async function acquire(){
 const previous=waitLine;
 let unlock;
 const myTurn=new Promise(resolve=>{unlock=resolve});
 waitLine=previous.catch(()=>{}).then(()=>myTurn);
 await previous.catch(()=>{});
 return unlock;
}
function normalize(result){
 return {...result,rowCount:result.rows?.length>0?result.rows.length:(typeof result.affectedRows==='number'?result.affectedRows:0)};
}
export class Pool {
 constructor(config={}){
  this.remote=process.env.EW_LOCAL_DATABASE==='1'?null:new RemotePool(config);
 }
 async query(sql,params){
  if(this.remote)return this.remote.query(sql,params);
  const unlock=await acquire();
  try{return normalize(await (await localDatabase()).query(sql,params))}
  finally{unlock()}
 }
 async connect(){
  if(this.remote)return this.remote.connect();
  const unlock=await acquire();
  const db=await localDatabase();
  let released=false;
  return {
   query:async(sql,params)=>{
    if(released)throw new Error('Database client was released');
    return normalize(await db.query(sql,params));
   },
   release:()=>{if(!released){released=true;unlock()}},
  };
 }
 async end(){
  // All local modules share one in-process PGlite. Closing a pool must not
  // invalidate other modules' database access.
  if(this.remote)return this.remote.end();
 }
}
export async function localDatabaseStatus(){
 if(process.env.EW_LOCAL_DATABASE!=='1')return {local:false};
 const db=await localDatabase();
 const row=await db.query('SELECT current_database() AS database_name');
 return {local:true,ready:true,engine:'PGlite',name:row.rows[0]?.database_name,dir:dataDir};
}
