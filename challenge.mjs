// THE EVENING WIRE — member prediction challenge & separately sourced final results.
// Owner race calls are NEVER final-result inputs and NEVER used for scoring.
import {readFileSync} from 'node:fs';
import {Pool} from './local-db-pool.mjs';
import {postgresTLS,postgresConnectionString} from './postgres-tls.mjs';
import {isEditorAdmin} from './editor-calls.mjs';
import {authenticatedMember} from './members.mjs';

const dbURL=process.env.DATABASE_URL||process.env.REACTION_DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRESQL_URL||process.env.DB_URL||'';
const deadline='2026-11-03T05:00:00.000Z'; // Nov 3 at midnight New York (EST).
const deadlineMs=Date.parse(deadline);
const catalog=JSON.parse(readFileSync(new URL('./public/race-candidates.json',import.meta.url),'utf8'));
const races=new Map(catalog.races.map(x=>[x.key,x]));
if(races.size!==506)throw Error('Incomplete 2026 prediction race catalog');
const choiceFor=c=>c.party+'|'+c.name;
let pool=null,ready=false,connecting=false,reason=null;
const rate=new Map();
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
function sameOrigin(req){
 const h=String(req.headers.host||''),o=String(req.headers.origin||'');
 return !o||(o==='https://'+h||o==='http://'+h);
}
async function input(req){
 let body='';for await(const chunk of req){body+=chunk;if(body.length>6000)throw Error('Request too large')}
 try{return JSON.parse(body||'{}')}catch{throw Error('Invalid JSON')}
}
function limit(memberId){const now=Date.now(),row=rate.get(memberId);if(!row||now-row.start>60000){rate.set(memberId,{start:now,count:1});return true}row.count++;return row.count<=20}
function pick(x){
 const race=races.get(String(x.raceKey||''));
 const candidate=race?.candidates?.find(c=>choiceFor(c)===x.choice);
 return race&&candidate?{race,candidate,choice:choiceFor(candidate)}:null;
}
function source(x){
 const sourceName=String(x.sourceName||'').trim();
 let sourceUrl;
 try{const u=new URL(String(x.sourceUrl||''));if(u.protocol!=='https:'||u.username||u.password||u.href.length>650||!u.hostname.includes('.'))throw Error();sourceUrl=u.href}
 catch{throw Error('Provide the original official HTTPS results-source URL')}
 if(sourceName.length<4||sourceName.length>120)throw Error('Provide the issuing election office or official results-source name');
 return {sourceName,sourceUrl}
}
function totals(body){
 const fields=['repVotes','demVotes','totalVotes'];
 if(fields.every(k=>body[k]===undefined||body[k]===null||body[k]===''))return [null,null,null];
 if(!fields.every(k=>body[k]!==undefined&&body[k]!==null&&body[k]!==''))throw Error('To publish vote counts, provide Republican, Democrat AND total ballots');
 const v=fields.map(k=>Number(body[k]));
 if(v.some(x=>!Number.isSafeInteger(x)||x<0)||v[0]+v[1]>v[2]||v[2]===0)throw Error('Vote totals must be nonnegative integers and total votes must cover both major parties');
 return v;
}
async function init(){
 if(!dbURL||connecting||ready)return;
 connecting=true;
 try{
  pool=new Pool({connectionString:postgresConnectionString(dbURL),max:4,connectionTimeoutMillis:8000,ssl:postgresTLS(dbURL)});
  await pool.query("CREATE TABLE IF NOT EXISTS ew_challenge_predictions(member_id uuid NOT NULL REFERENCES ew_members(id) ON DELETE CASCADE,race_key varchar(55) NOT NULL,choice varchar(200) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(member_id,race_key))");
  await pool.query("CREATE INDEX IF NOT EXISTS ew_challenge_predictions_race_idx ON ew_challenge_predictions(race_key)");
  await pool.query("CREATE TABLE IF NOT EXISTS ew_challenge_finals(race_key varchar(55) PRIMARY KEY,choice varchar(200) NOT NULL,source_name varchar(120) NOT NULL,source_url varchar(650) NOT NULL,rep_votes bigint,dem_votes bigint,total_votes bigint,recorded_at timestamptz NOT NULL DEFAULT now(),correction_note text)");
  await pool.query("CREATE TABLE IF NOT EXISTS ew_challenge_final_audit(id bigserial PRIMARY KEY,race_key varchar(55) NOT NULL,old_data jsonb,new_data jsonb,changed_at timestamptz NOT NULL DEFAULT now())");
  ready=true;reason=null;console.log('EW_CHALLENGE_DATABASE_CONNECTED races=506 deadline='+deadline);
 }catch(e){
  ready=false;reason=String(e.message||e).slice(0,150);
  console.error('EW_CHALLENGE_DATABASE_UNAVAILABLE '+reason);
  await pool?.end().catch(()=>{});pool=null
 }finally{connecting=false}
}
init();
setInterval(()=>{if(!ready)init();const now=Date.now();for(const [k,v] of rate)if(now-v.start>180000)rate.delete(k)},120000).unref();
export async function challengeRoute(req,res,path){
 if(!path.startsWith('/api/challenge'))return false;
 const member=await authenticatedMember(req);
 if(!member){send(res,401,{error:'Member sign-in required'});return true}
 if(!ready){send(res,503,{error:'Prediction database is not available. No predictions can be accepted.'});return true}
 if(path==='/api/challenge'&&req.method==='GET'){
  const [own,groups,finals,leaders,counts]=await Promise.all([
   pool.query('SELECT race_key,choice,created_at FROM ew_challenge_predictions WHERE member_id=$1 ORDER BY created_at DESC',[member.id]),
   pool.query('SELECT race_key,choice,count(*)::int AS votes FROM ew_challenge_predictions GROUP BY race_key,choice'),
   pool.query('SELECT race_key,choice,source_name,source_url,rep_votes,dem_votes,total_votes,recorded_at FROM ew_challenge_finals ORDER BY recorded_at DESC'),
   pool.query("SELECT m.display_name,COUNT(*)::int AS predictions,COUNT(f.race_key)::int AS scored,COUNT(*) FILTER (WHERE f.choice=p.choice)::int AS correct FROM ew_challenge_predictions p JOIN ew_members m ON m.id=p.member_id LEFT JOIN ew_challenge_finals f ON p.race_key=f.race_key GROUP BY m.id,m.display_name ORDER BY correct DESC,scored DESC,predictions DESC,m.display_name ASC LIMIT 100"),
   pool.query('SELECT count(*)::int AS total,count(DISTINCT member_id)::int AS participants FROM ew_challenge_predictions')
  ]);
  send(res,200,{
   deadline,now:new Date().toISOString(),locked:Date.now()>=deadlineMs,
   allowNewPredictions:Date.now()<deadlineMs,
   raceCount:races.size,source:'Member guesses until deadline; scores only from owner-entered official final results',
   disclaimer:'The Evening Wire editorial race calls do NOT count as final outcomes. State election offices certify results. Entries labeled final are owner-entered and source-linked; review their original source.',
   my:own.rows.map(x=>({raceKey:x.race_key,choice:x.choice,createdAt:x.created_at})),
   poll:groups.rows.map(x=>({raceKey:x.race_key,choice:x.choice,count:x.votes})),
   finals:finals.rows.map(x=>({raceKey:x.race_key,choice:x.choice,sourceName:x.source_name,sourceUrl:x.source_url,repVotes:x.rep_votes===null?null:Number(x.rep_votes),demVotes:x.dem_votes===null?null:Number(x.dem_votes),totalVotes:x.total_votes===null?null:Number(x.total_votes),recordedAt:x.recorded_at})),
   leaderboard:leaders.rows.map(x=>({name:x.display_name,predictions:x.predictions,scored:x.scored,correct:x.correct})),
   stats:counts.rows[0]
  });return true
 }
 if(req.method!=='POST'){send(res,405,{error:'Method not allowed'});return true}
 if(!sameOrigin(req)){send(res,403,{error:'Request origin not allowed'});return true}
 if(path==='/api/challenge/predict'){
  if(Date.now()>=deadlineMs){send(res,409,{error:'Predictions closed at midnight Eastern on November 3, 2026'});return true}
  if(!limit(member.id)){send(res,429,{error:'Too many predictions per minute'});return true}
  let x;try{x=await input(req)}catch(e){send(res,400,{error:e.message});return true}
  const p=pick(x);
  if(!p){send(res,400,{error:'Choose a real candidate for a valid 2026 race'});return true}
  const inserted=await pool.query('INSERT INTO ew_challenge_predictions(member_id,race_key,choice) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING race_key',[member.id,p.race.key,p.choice]);
  if(!inserted.rowCount){send(res,409,{error:'You already predicted this race. Predictions are one-time and cannot be changed.'});return true}
  send(res,201,{ok:true,raceKey:p.race.key,choice:p.choice,locked:true,deadline});return true
 }
 // Final certification must be entered separately with an official results link.
 // It is NEVER inferred from AP, news headlines, member votes or owner editorial calls.
 if(path==='/api/challenge/admin/final'){
  if(!await isEditorAdmin(req)){send(res,403,{error:'Only the authenticated site owner can record final official results'});return true}
  if(Date.now()<deadlineMs){send(res,409,{error:'Election has not started; final results cannot be entered before election day'});return true}
  let x;try{x=await input(req)}catch(e){send(res,400,{error:e.message});return true}
  let p,src,v;
  try{
   p=pick(x);if(!p)throw Error('Select a race and the verified final winning candidate');
   if(x.confirmCertified!==true)throw Error('You must confirm you checked the official final results source, not just an election-night projection');
   src=source(x);v=totals(x)
  }catch(e){send(res,400,{error:e.message});return true}
  const inserted=await pool.query('INSERT INTO ew_challenge_finals(race_key,choice,source_name,source_url,rep_votes,dem_votes,total_votes) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING race_key',[p.race.key,p.choice,src.sourceName,src.sourceUrl,...v]);
  if(!inserted.rowCount){send(res,409,{error:'Final already recorded. Corrections need a separate documented correction, not a duplicate.'});return true}
  send(res,201,{ok:true,raceKey:p.race.key,choice:p.choice,sourceName:src.sourceName,sourceUrl:src.sourceUrl});return true
 }
 if(path==='/api/challenge/admin/correct'){
  if(!await isEditorAdmin(req)){send(res,403,{error:'Owner authorization required'});return true}
  let x;try{x=await input(req)}catch(e){send(res,400,{error:e.message});return true}
  let p,src,v,note;
  try{
   p=pick(x);if(!p)throw Error('Choose a valid 2026 race winner');
   if(x.confirmCertified!==true)throw Error('Confirm that the official source contains this corrected final result');
   src=source(x);v=totals(x);note=String(x.correctionNote||'').trim();
   if(note.length<12||note.length>500)throw Error('Provide a correction explanation of 12–500 characters')
  }catch(e){send(res,400,{error:e.message});return true}
  const conn=await pool.connect();
  try{
   await conn.query('BEGIN');
   const prior=await conn.query('SELECT * FROM ew_challenge_finals WHERE race_key=$1 FOR UPDATE',[p.race.key]);
   if(!prior.rowCount){await conn.query('ROLLBACK');send(res,404,{error:'No prior final exists for correction'});return true}
   const updated=await conn.query('UPDATE ew_challenge_finals SET choice=$2,source_name=$3,source_url=$4,rep_votes=$5,dem_votes=$6,total_votes=$7,correction_note=$8,recorded_at=now() WHERE race_key=$1 RETURNING *',[p.race.key,p.choice,src.sourceName,src.sourceUrl,...v,note]);
   await conn.query('INSERT INTO ew_challenge_final_audit(race_key,old_data,new_data) VALUES($1,$2::jsonb,$3::jsonb)',[p.race.key,JSON.stringify(prior.rows[0]),JSON.stringify(updated.rows[0])]);
   await conn.query('COMMIT');
   send(res,200,{ok:true,raceKey:p.race.key,choice:p.choice,notice:'Corrected final result; leaderboard automatically recalculates.'})
  }catch(e){await conn.query('ROLLBACK').catch(()=>{});throw e}finally{conn.release()}
  return true
 }
 send(res,404,{error:'Unknown prediction endpoint'});return true
}
