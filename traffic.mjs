// Private, aggregated visitor analytics. Tracking is limited to signed-in account IDs,
// page section, timestamp and optional referrer domain. Never expose individual browsing histories.
import {Pool} from './local-db-pool.mjs';
import {postgresTLS,postgresConnectionString} from './postgres-tls.mjs';
import {authenticatedMember} from './members.mjs';
import {isEditorAdmin} from './editor-calls.mjs';
const connection=process.env.DATABASE_URL||process.env.REACTION_DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRESQL_URL||process.env.DB_URL||'';
let pool=null,ready=false;
const pages=new Set(['hq','news','senate','house','governor','calls','battleground','states','turnout','sources','mydesk','reactions','members','traffic','election-map','swing','predictions']);
const send=(res,n,o)=>{res.writeHead(n,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
const init=(async()=>{
 if(!connection)return;
 try{
  pool=new Pool({connectionString:postgresConnectionString(connection),max:3,connectionTimeoutMillis:8000,ssl:postgresTLS(connection)});
  await pool.query('CREATE TABLE IF NOT EXISTS ew_site_visits(id bigserial PRIMARY KEY, member_id uuid NOT NULL, section varchar(30) NOT NULL, referrer varchar(100), visited_at timestamptz NOT NULL DEFAULT now())');
  await pool.query('CREATE INDEX IF NOT EXISTS ew_visit_time_idx ON ew_site_visits(visited_at DESC)');
  await pool.query('CREATE TABLE IF NOT EXISTS ew_site_presence(member_id uuid PRIMARY KEY, section varchar(30) NOT NULL,last_seen timestamptz NOT NULL DEFAULT now())');
  await pool.query('CREATE TABLE IF NOT EXISTS ew_site_outbound(id bigserial PRIMARY KEY,member_id uuid NOT NULL,domain varchar(150) NOT NULL,section varchar(30),clicked_at timestamptz DEFAULT now())');
  ready=true;console.log('EW_ANALYTICS_DATABASE_CONNECTED');
 }catch(e){console.error('EW_ANALYTICS_DATABASE_ERROR '+e.message);ready=false}
})();
async function read(req){let s='';for await(const c of req){s+=c;if(s.length>2000)throw Error('Too long')}return JSON.parse(s||'{}')}
export async function trafficRoute(req,res,path){
 if(!path.startsWith('/api/traffic/'))return false;
 await init;
 const member=await authenticatedMember(req);
 if(!member){send(res,401,{error:'Member login required'});return true}
 if(!ready){send(res,503,{error:'Traffic statistics require the database'});return true}
 const part=path.slice('/api/traffic/'.length);
 if(part==='ping'&&req.method==='POST'){
  const data=await read(req),section=pages.has(data.section)?data.section:'hq';
  // Referrer is a hostname, not a URL containing paths or tracking parameters.
  let referrer=null;try{const u=new URL(String(data.referrer||''));if(u.protocol==='https:'||u.protocol==='http:')referrer=u.hostname.slice(0,100)}catch{}
  await pool.query('INSERT INTO ew_site_presence(member_id,section,last_seen) VALUES($1,$2,now()) ON CONFLICT(member_id) DO UPDATE SET section=$2,last_seen=now()',[member.id,section]);
  if(data.view===true){
   await pool.query('INSERT INTO ew_site_visits(member_id,section,referrer) VALUES($1,$2,$3)',[member.id,section,referrer]);
  }
  send(res,200,{ok:true});return true
 }
 if(part==='outbound'&&req.method==='POST'){
  const body=await read(req),section=pages.has(body.section)?body.section:'hq';
  const domain=String(body.domain||'').toLowerCase().slice(0,150);
  if(!/^[a-z0-9.-]{3,150}$/.test(domain)||!domain.includes('.')){send(res,400,{error:'Invalid site domain'});return true}
  await pool.query('INSERT INTO ew_site_outbound(member_id,domain,section) VALUES($1,$2,$3)',[member.id,domain,section]);
  send(res,200,{ok:true});return true
 }
 if(part==='summary'&&req.method==='GET'){
  if(!await isEditorAdmin(req)){send(res,403,{error:'Only the owner may view traffic statistics.'});return true}
  const [live,totals,bySection,day,referrers,outbound]=await Promise.all([
   pool.query("SELECT count(*)::int AS total FROM ew_site_presence WHERE last_seen>now()-interval '2 minutes'"),
   pool.query("SELECT count(*)::int AS pageviews,count(DISTINCT member_id)::int AS visitors FROM ew_site_visits"),
   pool.query("SELECT section,count(*)::int AS views,count(DISTINCT member_id)::int AS visitors FROM ew_site_visits GROUP BY section ORDER BY views DESC"),
   pool.query("SELECT date_trunc('day',visited_at AT TIME ZONE 'America/New_York')::date AS day,count(*)::int AS views,count(DISTINCT member_id)::int AS visitors FROM ew_site_visits WHERE visited_at>now()-interval '30 days' GROUP BY 1 ORDER BY 1 DESC"),
   pool.query("SELECT referrer,count(*)::int AS visits FROM ew_site_visits WHERE referrer IS NOT NULL GROUP BY referrer ORDER BY visits DESC LIMIT 15"),
   pool.query("SELECT domain,count(*)::int AS clicks FROM ew_site_outbound GROUP BY domain ORDER BY clicks DESC LIMIT 20")
  ]);
  send(res,200,{onlineMembers:live.rows[0].total,pageviews:totals.rows[0].pageviews,uniqueMembers:totals.rows[0].visitors,sections:bySection.rows,days:day.rows,referrers:referrers.rows,outboundSites:outbound.rows,explanation:'Online is distinct signed-in members active in the past two minutes. Pageviews count tracked tab openings, with separate aggregated outgoing news-source clicks. Private individual browsing histories are not exposed.'});return true
 }
 send(res,404,{error:'Unknown traffic endpoint'});return true
}
