/* THE LOUNGE — owner-only command center on the main website.
   Uses the existing owner session and server-authorized administrative endpoints. */
(function(){
'use strict';
const host=document.getElementById('commandDesk');if(!host)return;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=s=>{const d=new Date(s);return isNaN(d.getTime())?'—':d.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})};
const num=n=>Number(n||0).toLocaleString('en-US');
const active=()=>document.body.dataset.ewView==='owner';
const sections=[['overview','⌂','Overview'],['members','👥','Members'],['traffic','📊','Traffic'],['posts','💬','Moderation'],['announcements','📢','Announcements'],['polls','🗳','Polls'],['predictions','🎯','Predictions'],['security','🔐','Security']];
const topics=[['general','General Discussion'],['politics','Politics'],['jewish','Hasidic & Jewish Life'],['world','World Affairs'],['history','History & Geography'],['economics','Economics & Markets'],['science','Science & Ideas'],['questions','Questions & Debates']];
let authed=false,loading=false,view='overview',notice='',members=null,traffic=null,pulse=null,club=null,adminInfo=null,search='';
async function api(path,method='GET',body){
 const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 let data={};try{data=await r.json()}catch{}if(!r.ok)throw Error(data.error||'Owner action failed ('+r.status+').');return data
}
const link=(href,title)=>'<a class="owner-link" href="'+href+'">'+escape(title)+' ↗</a>';
function top(){
 return '<div class="lounge-panel-head"><span class="lounge-eyebrow">THE LOUNGE / PRIVATE OWNER ACCESS</span><h1>Owner Dashboard</h1><p>Members, traffic, discussions, announcements, predictions and community controls. Only an authenticated owner can see private data.</p></div>'
}
function login(){
 host.innerHTML=top()+'<section class="owner-card owner-login"><div class="owner-icon">🔐</div><h2>Owner sign-in</h2><p>Enter your existing site administrator password to open the private dashboard. Your regular member password is not the same as the owner password.</p><form id="ownerLoginForm"><label>OWNER PASSWORD<input type="password" name="password" minlength="1" autocomplete="current-password" required></label><label class="owner-check"><input name="rememberDevice" type="checkbox" checked> Remember this device securely</label><button type="submit" class="owner-primary">UNLOCK OWNER DASHBOARD</button></form><p id="ownerLoginError" class="owner-error" role="alert"></p></section>'
}
function score(n,label){return '<div class="owner-stat"><span>'+escape(label)+'</span><strong>'+num(n)+'</strong></div>'}
function tabs(){return '<nav class="owner-subnav" aria-label="Owner dashboard sections">'+sections.map(([id,icon,label])=>'<button type="button" data-owner-view="'+id+'" aria-pressed="'+String(id===view)+'">'+icon+' '+label+'</button>').join('')+'</nav>'}
function overview(){
 return '<div class="owner-stats">'+score(members?.total,'Registered members')+score(traffic?.onlineMembers,'Online members')+score(traffic?.uniqueMembers,'Members tracked')+score(traffic?.pageviews,'Tracked pageviews')+'</div>'
 +'<div class="owner-two"><section class="owner-card"><h2>Community overview</h2><div class="owner-snapshot">'+score(pulse?.posts?.length,'Recent Pulse posts')+score(club?.posts?.length,'Recent Clubhouse posts')+score(club?.polls?.length,'Clubhouse polls')+score(club?.predictions?.length,'Predictions')+'</div><p class="owner-note">Recent posts reflect available feed limits, not lifetime totals. Traffic figures reflect signed-in activity recorded by the site.</p></section><section class="owner-card"><h2>Quick actions</h2><div class="owner-actions"><button data-owner-view="announcements">📢 Post an announcement</button><button data-owner-view="members">👥 View members</button><button data-owner-view="traffic">📊 View traffic reports</button><button data-owner-view="posts">🛡 Moderate conversations</button><button data-owner-view="polls">🗳 Create a poll</button><button data-owner-view="predictions">🎯 Resolve predictions</button></div></section></div>'
 +'<section class="owner-card"><h2>Recent registrations</h2>'+membersTable((members?.members||[]).slice(0,8),false)+'</section>';
}
function membersTable(arr,showSearch=true){
 if(!arr.length)return '<div class="owner-empty">No matching members.</div>';
 return '<div class="owner-table-wrap"><table class="owner-table"><thead><tr><th>Member</th><th>Email (owner only)</th><th>Joined</th><th>Last login</th></tr></thead><tbody>'
 +arr.map(m=>'<tr><td><strong>'+escape(m.displayName)+'</strong></td><td>'+escape(m.email||'—')+'</td><td>'+escape(when(m.joinedAt))+'</td><td>'+escape(when(m.lastLoginAt))+'</td></tr>').join('')+'</tbody></table></div>'
}
function memberList(){
 const list=(members?.members||[]).filter(m=>(m.displayName+' '+m.email).toLowerCase().includes(search.toLowerCase()));
 return '<section class="owner-card"><div class="owner-section-head"><h2>Member directory</h2><span class="owner-pill">'+num(members?.total)+' accounts</span></div><p>Private registration information is visible only after owner authentication. Passwords and PINs are never shown.</p><label>SEARCH MEMBERS<input id="ownerMemberSearch" placeholder="Search name or email" value="'+escape(search)+'" maxlength="90"></label><div id="ownerMemberResults">'+membersTable(list)+'</div><p class="owner-note">Showing '+num(list.length)+' of '+num(members?.total)+' registered accounts (latest 200 stored records).</p></section>';
}
function trafficView(){
 if(!traffic)return '<div class="owner-card">Traffic data is not available. Sign in to a regular member account as well if prompted.</div>';
 return '<div class="owner-stats">'+score(traffic.onlineMembers,'Online now')+score(traffic.pageviews,'Pageviews')+score(traffic.uniqueMembers,'Unique members tracked')+'</div>'
 +'<div class="owner-two"><section class="owner-card"><h2>Pages members use</h2>'+table(traffic.sections,['Section','Views','Members'],['section','views','visitors'])+'</section><section class="owner-card"><h2>Recent daily activity</h2>'+table(traffic.days,['Date','Views','Members'],['day','views','visitors'])+'</section></div>'
 +'<div class="owner-two"><section class="owner-card"><h2>Referring websites</h2>'+table(traffic.referrers,['Source','Visits'],['referrer','visits'])+'</section><section class="owner-card"><h2>Outbound website clicks</h2>'+table(traffic.outboundSites,['Website','Clicks'],['domain','clicks'])+'</section></div><p class="owner-note">'+escape(traffic.explanation||'')+'</p>';
}
function table(rows,headers,keys){
 if(!Array.isArray(rows)||!rows.length)return '<div class="owner-empty">No tracked activity yet.</div>';
 return '<div class="owner-table-wrap"><table class="owner-table"><thead><tr>'+headers.map(x=>'<th>'+escape(x)+'</th>').join('')+'</tr></thead><tbody>'
 +rows.slice(0,35).map(row=>'<tr>'+keys.map(key=>'<td>'+escape(row[key]??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function moderate(){
 const pulsePosts=(pulse?.posts||[]).filter(p=>p.id&&p.site_section!=='legacy').slice(0,45);
 const clubPosts=(club?.posts||[]).filter(p=>p.id).slice(0,35);
 return '<div class="owner-two"><section class="owner-card"><h2>The Pulse · recent posts</h2><p class="owner-note">Hide unsuitable posts or pin useful discussions for members. Actions take effect on the existing public Pulse.</p>'
 +(pulsePosts.length?pulsePosts.map(p=>'<div class="owner-post"><div><b>'+escape(p.name||'Member')+'</b><small>'+escape(p.topic||'general')+' · '+escape(when(p.created_at))+'</small></div><p>'+escape(p.message||'[media post]')+'</p><div class="owner-row"><button data-owner-post="'+escape(p.id)+'" data-owner-action="pin">📌 '+(p.pinned?'Unpin':'Pin')+'</button><button data-owner-post="'+escape(p.id)+'" data-owner-action="hide" class="owner-danger">Hide</button></div></div>').join(''):'<div class="owner-empty">No recent Pulse posts.</div>')+'</section>'
 +'<section class="owner-card"><h2>Clubhouse · recent posts</h2><p class="owner-note">Review debate, discussion and question posts. Owner-only hiding removes the post from the public view without deleting its database record.</p>'
 +(clubPosts.length?clubPosts.map(p=>'<div class="owner-post"><div><b>'+escape(p.name||'Member')+'</b><small>'+escape(p.kind)+' · '+escape(when(p.created_at))+'</small></div><p>'+escape(p.message||'')+'</p><button data-owner-club-hide="'+escape(p.id)+'" class="owner-danger">Hide Clubhouse post</button></div>').join(''):'<div class="owner-empty">No recent Clubhouse posts.</div>')+'</section></div>';
}
function announcements(){
 return '<div class="owner-two"><section class="owner-card"><h2>Official announcement</h2><p>Publish a pinned owner announcement to The Pulse, visible across devices.</p><form id="ownerAnnouncementForm"><label>MESSAGE<textarea name="message" rows="5" maxlength="700" required placeholder="An announcement for the whole Lounge…"></textarea></label><label>POST TO ROOM<select name="topic">'+topics.map(([id,t])=>'<option value="'+id+'">'+escape(t)+'</option>').join('')+'</select></label><button class="owner-primary" type="submit">PUBLISH ANNOUNCEMENT</button></form></section><section class="owner-card"><h2>Announcement controls</h2><p>The Pulse currently supports official pinned announcements from the owner. To change an announcement, publish a new one or use Moderation to unpin or hide the previous message.</p>'+link('/#pulse','Open The Pulse')+'</section></div>'
}
function pollsView(){
 return '<div class="owner-two"><section class="owner-card"><h2>Create a Pulse poll</h2><form id="ownerPollForm"><label>QUESTION<input name="question" maxlength="180" minlength="8" required placeholder="Ask the Lounge a question…"></label><label>CHOICE 1<input name="one" required maxlength="100"></label><label>CHOICE 2<input name="two" required maxlength="100"></label><label>CHOICE 3 (OPTIONAL)<input name="three" maxlength="100"></label><label>CHOICE 4 (OPTIONAL)<input name="four" maxlength="100"></label><label>DURATION<select name="durationHours"><option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option></select></label><button class="owner-primary" type="submit">PUBLISH POLL TO PULSE</button></form></section><section class="owner-card"><h2>Other voting tools</h2><p>Members can also create their own polls and vote from the Clubhouse Polling Station.</p>'+link('/club#polls','Open Clubhouse polls')+'</section></div>';
}
function predictionsView(){
 const predictions=(club?.predictions||[]).filter(p=>p.closed&&p.outcome===null);
 return '<section class="owner-card"><h2>Resolve predictions</h2><p>Once voting closes, verify the real-world outcome and mark YES or NO. Correct predictors earn points automatically.</p>'
 +(predictions.length?predictions.map(p=>'<div class="owner-post"><b>'+escape(p.question)+'</b><small>Deadline: '+escape(when(p.closes_at))+'</small><div class="owner-row"><button data-owner-resolve="'+escape(p.id)+'" data-outcome="true">Verified YES</button><button data-owner-resolve="'+escape(p.id)+'" data-outcome="false">Verified NO</button></div></div>').join(''):'<div class="owner-empty">No unresolved predictions have reached their deadline yet.</div>')+'</section>';
}
function security(){
 return '<div class="owner-two"><section class="owner-card"><h2>Owner access</h2><p>This dashboard uses the existing owner password and secure HTTP-only administrator session. Public visitors and ordinary member accounts cannot see the private member list or traffic statistics.</p><button data-owner-logout class="owner-danger">SIGN OUT OF OWNER MODE</button></section><section class="owner-card"><h2>Accounts and privacy</h2><p>Members can change their own display names and profile pictures. The Friends directory remains opt-in.</p>'+link('/#profile','Open Member Profiles')+link('/about-security','Read privacy and account safety')+'<p class="owner-note">Traffic data is aggregated; this dashboard does not expose private browsing histories or member passwords.</p></section></div>';
}
function render(){
 if(!active()||!authed)return;
 host.innerHTML=top()+'<div class="owner-toolbar"><span class="owner-pill">🔒 OWNER VERIFIED</span><button data-owner-refresh>↻ Refresh data</button><button data-owner-logout class="owner-danger">Log out owner</button></div>'
 +(notice?'<div class="owner-banner" role="status">'+escape(notice)+'</div>':'')+tabs()
 +'<div class="owner-content">'+({overview,members:memberList,traffic:trafficView,posts:moderate,announcements,polls:pollsView,predictions:predictionsView,security})[view]()+'</div>';
}
async function load(){
 if(loading)return;loading=true;notice='';
 try{
  const r=await Promise.allSettled([api('/api/admin/members'),api('/api/traffic/summary'),api('/api/community/posts?scope=social'),api('/api/club/dashboard')]);
  [members,traffic,pulse,club]=r.map(x=>x.status==='fulfilled'?x.value:null);
  const err=r.map((x,i)=>x.status==='rejected'?['Member list','Traffic','Pulse','Clubhouse'][i]+': '+x.reason.message:'').filter(Boolean);
  if(err.length)notice='Some data unavailable: '+err.join(' · ');
  render()
 }finally{loading=false}
}
async function open(){
 if(!active())return;
 host.innerHTML=top()+'<div class="owner-card">Checking owner access…</div>';
 try{adminInfo=await api('/api/admin/session');authed=adminInfo.authenticated===true}catch{authed=false}
 if(!active())return;
 if(!authed){login();return}
 await load()
}
async function action(target,body){
 const result=await api(target,'POST',body);
 notice='Action completed successfully.';await load();
 notice='Action completed successfully.';render();return result
}
host.addEventListener('click',async e=>{
 if(!active())return;
 const b=e.target.closest('button');if(!b)return;
 try{
  if(b.dataset.ownerView){view=b.dataset.ownerView;render();return}
  if(b.hasAttribute('data-owner-refresh')){await load();return}
  if(b.hasAttribute('data-owner-logout')){await api('/api/admin/logout','POST',{});authed=false;members=traffic=pulse=club=null;login();return}
  if(b.dataset.ownerPost){
   if(b.dataset.ownerAction==='hide'&&!confirm('Hide this post from all readers?'))return;
   await action('/api/community/admin/posts/'+b.dataset.ownerPost+'/'+b.dataset.ownerAction,{});return
  }
  if(b.dataset.ownerClubHide){
   if(!confirm('Hide this Clubhouse message?'))return;
   await action('/api/club/posts/'+b.dataset.ownerClubHide+'/hide',{});return
  }
  if(b.dataset.ownerResolve){
   if(!confirm('Have you verified this outcome using reliable evidence?'))return;
   await action('/api/club/predictions/'+b.dataset.ownerResolve+'/resolve',{outcome:b.dataset.outcome==='true'});return
  }
 }catch(err){notice='Error: '+err.message;render()}
});
host.addEventListener('input',e=>{
 if(!active()||e.target.id!=='ownerMemberSearch')return;
 search=e.target.value;
 const matching=(members?.members||[]).filter(m=>(m.displayName+' '+m.email).toLowerCase().includes(search.toLowerCase()));
 const target=host.querySelector('#ownerMemberResults');if(target)target.innerHTML=membersTable(matching)
});
host.addEventListener('submit',async e=>{
 if(!active())return;
 const id=e.target.id;
 if(!['ownerLoginForm','ownerAnnouncementForm','ownerPollForm'].includes(id))return;
 e.preventDefault();
 const form=e.target,button=form.querySelector('button[type=submit]'),v=new FormData(form);
 if(button)button.disabled=true;
 try{
  if(id==='ownerLoginForm'){
   await api('/api/admin/login','POST',{password:v.get('password'),rememberDevice:v.get('rememberDevice')==='on'});
   authed=true;view='overview';await load();return
  }
  if(id==='ownerAnnouncementForm'){
   await action('/api/community/admin/announcement',{message:v.get('message'),topic:v.get('topic')});return
  }
  if(id==='ownerPollForm'){
   await action('/api/community/admin/polls',{question:v.get('question'),options:['one','two','three','four'].map(k=>String(v.get(k)||'').trim()).filter(Boolean),durationHours:Number(v.get('durationHours'))});return
  }
 }catch(err){
  const error=host.querySelector('#ownerLoginError');if(error)error.textContent=err.message;
  else{notice='Error: '+err.message;render()}
 }finally{if(button)button.disabled=false}
});
window.LoungeOwner={open};
})();
