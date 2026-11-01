/* THE EVENING WIRE — private owner traffic dashboard */
(function(){
'use strict';
const host=document.getElementById('commandDesk');if(!host)return;
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
const shown=()=>document.body.dataset.ewView==='traffic';
let authed=false,status='',data=null;
async function req(path,method='GET',body){
 const r=await fetch(path,{credentials:'same-origin',method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const json=await r.json();if(!r.ok)throw Error(json.error||'Unable to load traffic');return json;
}
function table(rows,fields,empty){
 if(!rows?.length)return '<p class="ew-traffic-empty">'+safe(empty||'No activity recorded yet')+'</p>';
 return '<div class="ew-traffic-table-wrap"><table class="ew-traffic-table"><thead><tr>'+fields.map(f=>'<th>'+safe(f[1])+'</th>').join('')+'</tr></thead>'+
 '<tbody>'+rows.map(o=>'<tr>'+fields.map(f=>'<td>'+safe(o[f[0]])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function render(){
 if(!shown())return;
 host.innerHTML='<section class="reaction-header"><div><span class="cmd-eyebrow">THE EVENING WIRE / OWNER ONLY</span>'+
 '<h1>TRAFFIC <span>COMMAND</span></h1><p>Real member visits, active sessions, tab performance, and publisher links—private to the administrator.</p></div><span class="reaction-live">LIVE MEMBER INSIGHTS</span></section>'+
 (authed?'<div class="ew-traffic-grid">'+[
 ['MEMBERS ACTIVE NOW',data?.onlineMembers??'—','Unique signed-in members active in the past 2 minutes'],
 ['TRACKED TAB VIEWS',data?.pageviews??'—','Recorded navigations after analytics launched'],
 ['UNIQUE VISITORS',data?.uniqueMembers??'—','Distinct signed-in accounts with recorded visits']
 ].map(x=>'<div class="ew-traffic-card"><span>'+x[0]+'</span><strong>'+safe(x[1])+'</strong><small>'+x[2]+'</small></div>').join('')+'</div>'+
 '<div class="ew-traffic-two"><div class="reaction-panel"><h2>MOST VISITED TABS</h2>'+
 table(data?.sections,[['section','Website tab'],['views','Views'],['visitors','Members']])+'</div>'+
 '<div class="reaction-panel"><h2>OUTBOUND NEWS SITES</h2>'+
 table(data?.outboundSites,[['domain','News website'],['clicks','Link clicks']],'No publisher links clicked yet')+'</div></div>'+
 '<div class="ew-traffic-two"><div class="reaction-panel"><h2>LAST 30 DAYS</h2>'+
 table(data?.days,[['day','Date'],['views','Views'],['visitors','Visitors']])+'</div>'+
 '<div class="reaction-panel"><h2>VISITOR REFERRALS</h2>'+table(data?.referrers,[['referrer','Source domain'],['visits','Visits']],'No external referrer data yet')+'</div></div>'+
 '<p class="ew-traffic-disclosure">'+safe(data?.explanation||'Only aggregate activity is shown; individual browsing histories are not available.')+'</p>'+
 '<button type="button" class="cmd-primary" id="ewTrafficRefresh">↻ REFRESH DASHBOARD</button>':
 '<section class="ew-traffic-login reaction-panel"><h2>OWNER AUTHENTICATION REQUIRED</h2><p>Only the owner can view private website analytics. Enter the same administrator password used for Race Calls.</p>'+
 '<form id="ewTrafficLogin"><label>ADMINISTRATOR PASSWORD<input name="password" type="password" autocomplete="current-password" required></label><button class="cmd-primary" type="submit">UNLOCK TRAFFIC DASHBOARD</button></form></section>')+
 '<p class="reaction-status" id="ewTrafficStatus" role="status">'+safe(status)+'</p>';
 const login=document.getElementById('ewTrafficLogin');
 if(login)login.onsubmit=async event=>{
  event.preventDefault();
  try{const form=new FormData(login),answer=await req('/api/admin/login','POST',{password:form.get('password')});
   authed=answer.authenticated===true;status='Owner verified';await load();
  }catch(err){status=err.message;render()}
 };
 const refresh=document.getElementById('ewTrafficRefresh');
 if(refresh)refresh.onclick=()=>load();
}
async function load(){
 if(!authed)return;
 try{data=await req('/api/traffic/summary');status='Traffic updated.'}
 catch(e){status=e.message}
 render();
}
async function open(){
 try{const a=await req('/api/admin/session');authed=a.authenticated===true}catch{authed=false}
 if(authed)await load();else render();
}
setInterval(()=>{if(shown()&&authed&&!document.hidden)load()},30000);
window.EWTraffic={open};
})();