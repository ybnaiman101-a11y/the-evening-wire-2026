/* EVENING WIRE — reader accounts and private owner member directory */
(function(){
 'use strict';
 const host=document.getElementById('commandDesk');if(!host)return;
 const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const when=x=>x&&Number.isFinite(Date.parse(x))?new Date(x).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}):'Never';
 let panel='login',dbReady=false,member=null,admin=false,memberRows=[],total=0,status='',loading=false,adminUpdates=[],memberListLoaded=false,memberFetchError='',storageSource='',alternateDatabases=[];
 const shown=()=>document.body.dataset.ewView==='members';
 async function request(url,method='GET',body){
  const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',
    headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw Error(data.error||'Connection unavailable');return data;
 }
 async function sync(){
  const [m,a]=await Promise.allSettled([request('/api/members/session'),request('/api/admin/session')]);
  dbReady=m.status==='fulfilled'&&m.value.ready===true;member=m.status==='fulfilled'?m.value.user:null;
  admin=a.status==='fulfilled'&&a.value.authenticated===true;
  // An authenticated owner should see the real reader directory immediately,
  // rather than a login tab or a stale "0 members" placeholder.
  if(admin&&dbReady){
   if(panel==='login')panel='admin';
   await fetchMembers();
  }
 }
 async function fetchMembers(){
  try{
   const data=await request('/api/admin/members');
   if(!Array.isArray(data.members)||!Number.isSafeInteger(data.total))throw Error('Invalid response from the member directory');
   memberRows=data.members;total=data.total;memberListLoaded=true;memberFetchError='';
   storageSource=String(data.storageSource||'PostgreSQL');
   alternateDatabases=Array.isArray(data.alternateDatabases)?data.alternateDatabases:[];
  }catch(err){
   memberFetchError=String(err.message||err);
   // A rejected owner session should return the visitor to the owner sign-in form,
   // rather than displaying a stale directory and an unexplained permission error.
   if(/administrator authentication required|admin login required|owner authentication required/i.test(memberFetchError)){
    admin=false;panel='admin';
    status='Please sign in with your owner password to reopen your private reader list.';
   }else status='Unable to load member records: '+memberFetchError;
   memberListLoaded=false;
  }
  if(admin)await fetchUpdates();
  return !memberFetchError;
 }
 async function fetchUpdates(){
  try{const data=await request('/api/updates/admin');adminUpdates=Array.isArray(data.updates)?data.updates:[]}
  catch(err){status='Election Updates: '+err.message;adminUpdates=[]}
 }
 function updateAdminPanel(){
  const active=adminUpdates.filter(u=>!u.retractedAt&&Date.parse(u.expiresAt)>Date.now());
  const kinds={'breaking':'BREAKING','race-called':'RACE CALLED','results':'ELECTION RESULTS','important':'IMPORTANT'};
  return '<section class="ew-alert-owner"><div class="cmd-eyebrow">ADMIN ONLY · ALL SCREENS</div>'+
   '<h2>📣 ELECTION UPDATE</h2><p>Send a prominent announcement to every signed-in visitor, whichever tab they are using. Each Election Update flashes for ten seconds and then disappears automatically.</p>'+
   '<form id="ewBroadcastForm" class="ew-member-form">'+
   '<label>ANNOUNCEMENT TYPE<select name="category"><option value="race-called">RACE CALLED</option><option value="breaking">BREAKING</option><option value="results">ELECTION RESULTS</option><option value="important">IMPORTANT MESSAGE</option></select></label>'+
   '<label>YOUR ELECTION UPDATE MESSAGE<textarea name="message" placeholder="Example: The Evening Wire has called the Ohio Senate race for ..." minlength="8" maxlength="700" rows="4" required></textarea></label>'+
   '<label>ORIGINAL SOURCE LINK (OPTIONAL)<input name="sourceUrl" type="url" placeholder="https://..."></label>'+
   '<p class="ew-owner-alert-explain">10-SECOND POPUP · This notice appears briefly on every active reader screen and then automatically disappears. There is no lasting banner.</p>'+
   '<div class="ew-owner-broadcast-actions"><button type="submit" class="cmd-primary">📣 SEND TO EVERYONE NOW</button><button type="button" class="cmd-minibtn" id="ewPreviewBroadcast">TEST POPUP — ONLY MY SCREEN</button></div></form>'+
   '<p class="ew-owner-alert-explain"><b>Send to everyone</b> pushes instantly to connected members with a backup check. <b>Test popup</b> shows the same ten-second alert to you alone without publishing. This message never changes an official race result or calls a winner automatically.</p>'+
   '<div class="ew-owner-alert-list-head"><strong>RECENT ANNOUNCEMENTS</strong><span>'+active.length+' ACTIVE</span></div>'+
   (adminUpdates.length?adminUpdates.slice(0,12).map(u=>{
     const state=u.retractedAt?'WITHDRAWN':Date.parse(u.expiresAt)<=Date.now()?'EXPIRED':'ACTIVE';
     return '<article class="ew-owner-alert-item"><div class="ew-owner-alert-meta"><b>'+safe(kinds[u.category]||'ELECTION UPDATE')+' · '+state+'</b><span>'+when(u.createdAt)+'</span></div>'+
     '<p>'+safe(u.message)+'</p>'+(state==='ACTIVE'?'<button type="button" class="cmd-minibtn" data-ew-retract-update="'+safe(u.id)+'">WITHDRAW THIS ALERT</button>':'')+'</article>'
    }).join(''):'<p class="ew-members-disclosure">No Election Updates have been sent yet.</p>')+
   '</section>'
 }

 const tab=(id,label)=>'<button type="button" data-member-panel="'+id+'" class="'+(panel===id?'cmd-primary':'cmd-minibtn')+'">'+label+'</button>';
 const input=(type,name,autocomplete,placeholder,more='')=>'<input name="'+name+'" type="'+type+'" autocomplete="'+autocomplete+'" placeholder="'+placeholder+'" '+more+'>';
 function guestLogin(){
  return '<h2>MEMBER SIGN IN</h2><p>Sign in with your email and private four-digit code. Five incorrect attempts lock sign-in for 30 minutes.</p>'+
   '<form id="ewMemberLogin" class="ew-member-form">'+
   '<label>Email address'+input('email','email','email','you@example.com','required maxlength="254"')+'</label>'+
   '<label>Four-digit sign-in PIN'+input('password','pin','one-time-code','Four numbers','required inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4"')+'</label>'+
   '<label class="ew-member-check"><input type="checkbox" name="rememberDevice" checked><span>Remember this device for 90 days — no repeat PIN.</span></label>'+ 
   '<button class="cmd-primary" type="submit" '+(!dbReady?'disabled':'')+'>SIGN IN</button></form>';
 }
 function signedIn(){
  return '<h2>YOUR MEMBER PROFILE</h2><div class="ew-member-profile">'+
   '<strong>'+safe(member.displayName)+'</strong><span>'+safe(member.email)+'</span><span>Joined '+when(member.joinedAt)+'</span></div>'+
   '<section class="ew-profile-edit"><h3><span>✎</span> EDIT YOUR DISPLAY NAME</h3>'+
   '<p>This is the name attached to your messages and replies in the Reaction Hub. Updating it also changes the displayed name on earlier messages linked to your account.</p>'+
   '<form id="ewProfileForm" class="ew-member-form">'+
   '<label>YOUR PUBLIC DISPLAY NAME<input name="displayName" type="text" value="'+safe(member.displayName)+'" autocomplete="nickname" minlength="2" maxlength="40" required></label>'+
   '<button type="submit" class="cmd-primary">SAVE NEW DISPLAY NAME</button></form></section>'+
   '<button type="button" class="cmd-minibtn" id="ewMemberLogout">SIGN OUT</button> '+ 
    '<button type="button" class="cmd-minibtn" id="ewMemberLogoutAll">SIGN OUT ALL DEVICES</button>';
 }
 function signup(){
  if(member)return signedIn();
  return '<h2>REGISTER A MEMBER ACCOUNT</h2><p>Choose a permanent display name, a recovery password, and a four-digit PIN for future sign-ins.</p>'+
   '<form id="ewMemberSignup" class="ew-member-form">'+
   '<label>Display name'+input('text','displayName','nickname','Your public display name','required minlength="2" maxlength="40"')+'</label>'+
   '<label>Email address'+input('email','email','email','you@example.com','required maxlength="254"')+'</label>'+
   '<label>Account recovery password — at least 12 characters'+input('password','password','new-password','Choose a strong password','required minlength="12" maxlength="128"')+'</label>'+ '<label>Four-digit sign-in PIN'+input('password','pin','new-password','Four numbers','required inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4"')+'</label>'+
   '<label class="ew-member-check"><input type="checkbox" name="agreed" required>'+
   '<span>I understand the owner can see my account name, email, registration date and last login. Emails are not verified.</span></label>'+
   '<label class="ew-member-check"><input type="checkbox" name="rememberDevice" checked><span>Remember this device for 90 days.</span></label>'+ 
   '<button class="cmd-primary" type="submit" '+(!dbReady?'disabled':'')+'>CREATE ACCOUNT</button></form>';
 }
 function alternateRegistrations(){
  if(!memberListLoaded||total!==0)return '';
  const found=alternateDatabases.filter(s=>s.status==='connected'&&s.members>0);
  const inaccessible=alternateDatabases.filter(s=>s.status!=='connected');
  if(!found.length&&!inaccessible.length)return '<p class="ew-members-disclosure">No registrations were found in the active member table'+(alternateDatabases.length?' or other configured database connections':'')+'. If you expected existing readers, confirm this website is connected to the same database used when they registered.</p>';
  return '<section class="ew-members-panel" style="margin-top:18px"><h2>OLDER REGISTRATION SEARCH</h2>'+
   (found.length?'<p class="ew-members-disclosure">Existing reader records were found in another database configured for this deployment. These are read-only records; those readers must be migrated to the active member database to sign in here. No accounts were moved or deleted.</p>'+
   found.map(db=>'<div class="ew-members-head"><h3>'+safe(db.source)+'</h3><span>'+Number(db.members)+' old registrations</span></div>'+
     '<div class="ew-members-table-wrap"><table class="ew-members-table"><thead><tr><th>Display name</th><th>Email address</th><th>Joined</th><th>Last login</th></tr></thead><tbody>'+
     (db.users||[]).map(u=>'<tr><td>'+safe(u.displayName)+'</td><td>'+safe(u.email)+'</td><td>'+when(u.joinedAt)+'</td><td>'+when(u.lastLoginAt)+'</td></tr>').join('')+'</tbody></table></div>').join(''):'')+
   (inaccessible.length?'<p class="ew-members-offline">Additional configured database sources could not be checked: '+inaccessible.map(s=>safe(s.source)).join(', ')+'.</p>':'')+
   '</section>';
 }
 function adminContent(){
  if(!admin)return '<h2>OWNER ONLY · ADMIN LOGIN</h2><p>Use your private Races Called administrator password. Public readers cannot see registered members.</p>'+
   '<form id="ewMemberAdminLogin" class="ew-member-form"><label>Owner administrator password'+input('password','password','current-password','Private admin password','required')+'</label>'+
    '<label class="ew-member-check"><input type="checkbox" name="rememberDevice" checked><span>Remember this trusted owner device for 30 days.</span></label>'+
   '<button class="cmd-primary" type="submit">UNLOCK ADMIN DIRECTORY</button></form>';
  return '<div class="ew-members-head"><h2>REGISTERED READERS</h2><span>'+(memberListLoaded&&!memberFetchError?total+' total':'COUNT UNAVAILABLE')+'</span></div>'+
   (!dbReady?'<p class="ew-members-offline">The member database is not connected. Existing accounts cannot be verified until the connection is restored.</p>':
    memberFetchError?'<div class="ew-members-offline"><strong>MEMBER LIST COULD NOT BE LOADED</strong><p>'+safe(memberFetchError)+'</p><p>This is not a confirmed zero-member count. Check the database and try Refresh.</p></div>':
    !memberListLoaded?'<p class="ew-members-disclosure">Loading registered readers from PostgreSQL…</p>':
    '<p class="ew-members-disclosure">Private owner view · Display names and emails are from the active '+safe(storageSource)+' database. Emails are not verified. Passwords are never shown.</p>'+
    (total===0?'<p class="ew-members-offline">No member records were found in the database currently connected to this deployment. If readers previously registered, confirm this is the same PostgreSQL database used when they signed up; do not create fake entries or reset your accounts.</p>':'')+
    '<div class="ew-members-table-wrap"><table class="ew-members-table"><thead><tr><th>Display name</th><th>Email address</th><th>Joined</th><th>Last login</th></tr></thead>'+
    '<tbody>'+(memberRows.length?memberRows.map(x=>'<tr><td>'+safe(x.displayName)+'</td><td>'+safe(x.email)+'</td><td>'+when(x.joinedAt)+'</td><td>'+when(x.lastLoginAt)+'</td></tr>').join(''):
    '<tr><td colspan="4">No records found in the connected database.</td></tr>')+'</tbody></table></div>')+
   '<button type="button" class="cmd-minibtn" id="ewMembersReload">REFRESH MEMBER LIST</button>'+alternateRegistrations()+updateAdminPanel();
 }
 function render(){
  if(!shown())return;
  const available=dbReady?'<div class="ew-members-online">MEMBER DATABASE CONNECTED</div>':
   '<div class="ew-members-offline"><strong>MEMBER SIGNUPS PAUSED</strong><p>Registration and reader login require your permanent PostgreSQL database to be connected. No temporary user accounts will be created or lost.</p></div>';
  host.innerHTML='<section class="ew-members-hero"><span class="cmd-kicker">THE EVENING WIRE / MEMBER ACCESS</span>'+
   '<h1>MEMBERS <em>&amp; LOGIN</em></h1><p>Create a reader account or access your protected owner directory.</p>'+
   '<div class="ew-members-tabs">'+tab('login','SIGN IN')+tab('register','JOIN THE WIRE')+tab('admin','OWNER ADMIN')+'</div></section>'+
   '<div class="ew-members-grid"><section class="ew-members-panel">'+
   (panel==='admin'?adminContent():panel==='register'?signup():member?signedIn():guestLogin())+
   '<p id="ewMemberFeedback" class="reaction-status" role="status">'+safe(status)+'</p></section>'+
   '<aside class="ew-members-panel"><span class="cmd-eyebrow">MEMBER ACCOUNT STATUS</span>'+available+
   '<h2>PRIVATE BY DESIGN</h2><p>The administrator can view only account details: display name, email, joined date and last login. No passwords are displayed.</p>'+
   '<p>Only your separate Race Calls admin login can publish winners. Member accounts never receive permission to call races.</p></aside></div>';
  host.querySelectorAll('[data-member-panel]').forEach(b=>b.onclick=async()=>{
   panel=b.dataset.memberPanel;status='';if(panel==='admin'&&admin)await fetchMembers();render()
  });
  const feedback=()=>host.querySelector('#ewMemberFeedback');
  const perform=async(fn)=>{
   if(loading)return;loading=true;try{await fn()}catch(err){status=String(err.message||err);const el=feedback();if(el)el.textContent=status}
   finally{loading=false}
  };
  const login=host.querySelector('#ewMemberLogin');
  if(login)login.onsubmit=e=>{e.preventDefault();perform(async()=>{
   const d=new FormData(login);const data=await request('/api/members/login','POST',{email:d.get('email'),pin:d.get('pin'),rememberDevice:d.get('rememberDevice')==='on'});
   member=data.user;status='Welcome back!';render()
  })};
  const registration=host.querySelector('#ewMemberSignup');
  if(registration)registration.onsubmit=e=>{e.preventDefault();perform(async()=>{
   const d=new FormData(registration),data=await request('/api/members/signup','POST',{
    displayName:d.get('displayName'),email:d.get('email'),password:d.get('password'),pin:d.get('pin'),agreed:d.get('agreed')==='on',rememberDevice:d.get('rememberDevice')==='on'
   });
   member=data.user;panel='login';status='Your account has been created.';render()
  })};
  const adminForm=host.querySelector('#ewMemberAdminLogin');
  if(adminForm)adminForm.onsubmit=e=>{e.preventDefault();perform(async()=>{
   const d=new FormData(adminForm),data=await request('/api/admin/login','POST',{password:d.get('password'),rememberDevice:d.get('rememberDevice')==='on'});
   admin=data.authenticated===true;status='Owner access confirmed.';await fetchMembers();render()
  })};
  const profile=host.querySelector('#ewProfileForm');
  if(profile)profile.onsubmit=e=>{e.preventDefault();perform(async()=>{
   const displayName=new FormData(profile).get('displayName');
   const result=await request('/api/members/profile','POST',{displayName});
   member=result.user;status=result.message||'Name saved';render();
   window.dispatchEvent(new CustomEvent('ew-member-name-updated',{detail:{displayName:member.displayName}}));
  })};
  const preview=host.querySelector('#ewPreviewBroadcast');
  if(preview)preview.onclick=()=>{
   const form=host.querySelector('#ewBroadcastForm'),data=new FormData(form);
   const message=String(data.get('message')||'').trim()||'TEST MESSAGE: This is what your ten-second Election Update looks like.';
   const ok=window.EWElectionUpdates?.preview({category:String(data.get('category')||'important'),message,sourceUrl:String(data.get('sourceUrl')||'')});
   const el=host.querySelector('#ewMemberFeedback');
   if(el)el.textContent=ok?'✓ LOCAL TEST WORKED — This message appeared only on your screen. No visitor was notified.':'Unable to show the test popup. Reload the page and try again.';
  };
  const broadcast=host.querySelector('#ewBroadcastForm');
  if(broadcast)broadcast.onsubmit=e=>{e.preventDefault();perform(async()=>{
   const data=new FormData(broadcast),message=String(data.get('message')||'').trim();
   if(!window.confirm('Broadcast this ELECTION UPDATE to every signed-in visitor right now?'))return;
   const result=await request('/api/updates','POST',{category:data.get('category'),message,sourceUrl:data.get('sourceUrl')});
   status='✓ ELECTION UPDATE SENT. The server confirmed publication to '+Number(result.connectedReceivers||0)+' currently connected live streams. Other visitors receive it through the backup feed. Each screen shows the popup for ten seconds.';
   window.dispatchEvent(new CustomEvent('ew-owner-update-posted',{detail:{update:result.update}}));
   await fetchUpdates();render();
  })};
  host.querySelectorAll('[data-ew-retract-update]').forEach(btn=>btn.onclick=()=>perform(async()=>{
   if(!window.confirm('Withdraw this Election Update for all visitors?'))return;
   await request('/api/updates/'+encodeURIComponent(btn.dataset.ewRetractUpdate)+'/retract','POST',{});
   status='Election Update withdrawn.';await fetchUpdates();render();
   window.dispatchEvent(new Event('ew-owner-update-posted'));
  }));
  const logout=host.querySelector('#ewMemberLogout');
  if(logout)logout.onclick=()=>perform(async()=>{await request('/api/members/logout','POST');member=null;status='Signed out.';render()});
  const logoutAll=host.querySelector('#ewMemberLogoutAll');
  if(logoutAll)logoutAll.onclick=()=>{if(!confirm('Sign out this account on every device?'))return;perform(async()=>{await request('/api/members/logout-all','POST');member=null;status='All remembered devices were signed out.';render()})};
  const reload=host.querySelector('#ewMembersReload');
  if(reload)reload.onclick=()=>perform(async()=>{status='Checking registered readers…';const ok=await fetchMembers();if(ok)status='Member directory refreshed: '+total+' registered readers found.';render()});
 }
 async function open(){status='';render();await sync();render()}
 window.EWMembers={open,sync,render,member:()=>member,loggedIn:()=>!!member};
})();
