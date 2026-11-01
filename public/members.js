/* EVENING WIRE — reader accounts and private owner member directory */
(function(){
 'use strict';
 const host=document.getElementById('commandDesk');if(!host)return;
 const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const when=x=>x&&Number.isFinite(Date.parse(x))?new Date(x).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}):'Never';
 let panel='login',dbReady=false,member=null,admin=false,memberRows=[],total=0,status='',loading=false;
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
  if(panel==='admin'&&admin&&dbReady)await fetchMembers();
 }
 async function fetchMembers(){
  try{const data=await request('/api/admin/members');memberRows=data.members||[];total=data.total||0}
  catch(err){status=err.message;memberRows=[];total=0}
 }
 const tab=(id,label)=>'<button type="button" data-member-panel="'+id+'" class="'+(panel===id?'cmd-primary':'cmd-minibtn')+'">'+label+'</button>';
 const input=(type,name,autocomplete,placeholder,more='')=>'<input name="'+name+'" type="'+type+'" autocomplete="'+autocomplete+'" placeholder="'+placeholder+'" '+more+'>';
 function guestLogin(){
  return '<h2>MEMBER SIGN IN</h2><p>Sign in with your email and private four-digit code. Five incorrect attempts lock sign-in for 30 minutes.</p>'+
   '<form id="ewMemberLogin" class="ew-member-form">'+
   '<label>Email address'+input('email','email','email','you@example.com','required maxlength="254"')+'</label>'+
   '<label>Four-digit sign-in PIN'+input('password','pin','one-time-code','Four numbers','required inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4"')+'</label>'+
   '<button class="cmd-primary" type="submit" '+(!dbReady?'disabled':'')+'>SIGN IN</button></form>';
 }
 function signedIn(){
  return '<h2>YOUR MEMBER PROFILE</h2><div class="ew-member-profile">'+
   '<strong>'+safe(member.displayName)+'</strong><span>'+safe(member.email)+'</span><span>Joined '+when(member.joinedAt)+'</span></div>'+
   '<button type="button" class="cmd-primary" id="ewMemberLogout">SIGN OUT</button>';
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
   '<button class="cmd-primary" type="submit" '+(!dbReady?'disabled':'')+'>CREATE ACCOUNT</button></form>';
 }
 function adminContent(){
  if(!admin)return '<h2>OWNER ONLY · ADMIN LOGIN</h2><p>Use your private Races Called administrator password. Public readers cannot see registered members.</p>'+
   '<form id="ewMemberAdminLogin" class="ew-member-form"><label>Owner administrator password'+input('password','password','current-password','Private admin password','required')+'</label>'+
   '<button class="cmd-primary" type="submit">UNLOCK ADMIN DIRECTORY</button></form>';
  return '<div class="ew-members-head"><h2>REGISTERED READERS</h2><span>'+total+' total</span></div>'+
   (!dbReady?'<p>Permanent storage is not connected yet. No member accounts can be registered.</p>':
    '<p class="ew-members-disclosure">Private owner view · Email addresses are supplied by visitors, not verified. Passwords and password hashes are never shown.</p>'+
    '<div class="ew-members-table-wrap"><table class="ew-members-table"><thead><tr><th>Display name</th><th>Email address</th><th>Joined</th><th>Last login</th></tr></thead>'+
    '<tbody>'+(memberRows.length?memberRows.map(x=>'<tr><td>'+safe(x.displayName)+'</td><td>'+safe(x.email)+'</td><td>'+when(x.joinedAt)+'</td><td>'+when(x.lastLoginAt)+'</td></tr>').join(''):
    '<tr><td colspan="4">No registered readers yet.</td></tr>')+'</tbody></table></div>')+
   '<button type="button" class="cmd-minibtn" id="ewMembersReload">REFRESH MEMBER LIST</button>';
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
   const d=new FormData(login);const data=await request('/api/members/login','POST',{email:d.get('email'),pin:d.get('pin')});
   member=data.user;status='Welcome back!';render()
  })};
  const registration=host.querySelector('#ewMemberSignup');
  if(registration)registration.onsubmit=e=>{e.preventDefault();perform(async()=>{
   const d=new FormData(registration),data=await request('/api/members/signup','POST',{
    displayName:d.get('displayName'),email:d.get('email'),password:d.get('password'),pin:d.get('pin'),agreed:d.get('agreed')==='on'
   });
   member=data.user;panel='login';status='Your account has been created.';render()
  })};
  const adminForm=host.querySelector('#ewMemberAdminLogin');
  if(adminForm)adminForm.onsubmit=e=>{e.preventDefault();perform(async()=>{
   const d=new FormData(adminForm),data=await request('/api/admin/login','POST',{password:d.get('password')});
   admin=data.authenticated===true;status='Owner access confirmed.';await fetchMembers();render()
  })};
  const logout=host.querySelector('#ewMemberLogout');
  if(logout)logout.onclick=()=>perform(async()=>{await request('/api/members/logout','POST');member=null;status='Signed out.';render()});
  const reload=host.querySelector('#ewMembersReload');
  if(reload)reload.onclick=()=>perform(async()=>{await fetchMembers();status='Member list refreshed.';render()});
 }
 async function open(){status='';render();await sync();render()}
 window.EWMembers={open,sync,render,member:()=>member,loggedIn:()=>!!member};
})();
