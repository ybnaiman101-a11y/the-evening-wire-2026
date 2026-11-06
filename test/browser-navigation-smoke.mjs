// Browser regression: loads the real HTML, JS and CSS in headless Chrome.
// Real DOM event handlers and hit-testing are exercised; API responses are
// mocked locally so no credentials or user data are needed.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'../public');
const fixture={date:'2026-11-05',signedIn:true,member:{id:'11111111-1111-4111-8111-111111111111',displayName:'Test Member'},bio:'Test bio',
posts:[
 {id:'11111111-1111-4111-8111-111111111112',kind:'room',room:'general',message:'Welcome to the Lounge',name:'Test Member',likes:2,parent_id:null,side:null,created_at:'2026-11-05T19:30:00Z',day_key:null},
 {id:'11111111-1111-4111-8111-111111111113',kind:'question',room:'general',message:'What should we discuss?',name:'Test Member',likes:1,parent_id:null,side:null,created_at:'2026-11-05T19:30:00Z',day_key:null},
 {id:'11111111-1111-4111-8111-111111111114',kind:'debate',room:'general',message:'I agree with the proposal',name:'Test Member',likes:0,parent_id:null,side:'yes',created_at:'2026-11-05T19:30:00Z',day_key:'2026-11-05'}
],
polls:[{id:'11111111-1111-4111-8111-111111111115',question:'Do you like our new Lounge?',options:'["Yes","No"]',counts:null,myVote:null,closed:false,closes_at:'2026-11-10T23:00:00Z',author:'Test Member'}],
predictions:[{id:'11111111-1111-4111-8111-111111111116',question:'Will the team meet this month?',counts:null,myVote:null,closed:false,outcome:null,closes_at:'2026-11-10T23:00:00Z',author:'Test Member'}],
leaderboard:[{id:'11111111-1111-4111-8111-111111111111',display_name:'Test Member',score:23,post_count:3,like_count:7,quiz_count:1,prediction_count:0}],
quiz:{},
debate:{date:'2026-11-05',question:'Can the members debate this topic?'}};
const apiStub=[
 '<script>',
 'Object.defineProperty(navigator,"gpu",{value:undefined,configurable:true});',
 'window.__aiTestRequests=[];',
 'window.fetch=async function(input,opts){',
 ' const path=new URL(String(input),location.href).pathname;let data={ok:true};',
 " if(path==='/api/ask-ai/image'){const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+iVPoAAAAASUVORK5CYII='),c=>c.charCodeAt(0));return new Response(bytes,{status:200,headers:{'Content-Type':'image/png','X-Lounge-Image-Model':'gpt-image-2.6-sunburst'}})}",
 " if(path==='/api/club/dashboard')data="+JSON.stringify(fixture)+';',
 " else if(path==='/api/club/news'||path==='/api/stories')data={stories:[{title:'Verified source headline for browser testing',url:'https://www.bbc.com/news/example',published:new Date().toISOString(),source:'BBC News',topic:'World',excerpt:'Sample news item only in test'}]};",
 " else if(path==='/api/club/daily')data={date:'2026-11-05',quiz:{question:'Which planet is famous for its rings?',options:['Mercury','Saturn','Venus','Mars']},debate:{question:'Should elected officials debate publicly?'}};",
 " else if(path==='/api/ask-ai/status')data={available:true,model:'gpt-6.1-sol',imageModel:'gpt-image-2.6-sunburst'};",
 " else if(path==='/api/ask-ai'){window.__aiTestRequests.push(JSON.parse(opts?.body||'{}'));data={answer:'## Answer\\n\\n**Canberra** is the capital of Australia, answered by OpenAI.',model:'gpt-6.1-sol'}}",
 " else if(path==='/api/ai-search')data={query:'capital of australia',results:[{title:'Canberra',url:'https://en.wikipedia.org/wiki/Canberra',source:'Wikipedia',snippet:'Canberra is the capital city of Australia.'}]};",
 " else if(path==='/api/admin/session')data={authenticated:true};",
 " else if(path==='/api/admin/members')data={total:1,members:[{id:'00000000-0000-0000-0000-000000000001',displayName:'Test Member',email:'test@example.invalid',joinedAt:'2026-11-01T10:00:00Z',lastLoginAt:'2026-11-05T15:00:00Z'}]};",
 " else if(path==='/api/traffic/summary')data={onlineMembers:1,pageviews:12,uniqueMembers:1,sections:[{section:'home',views:5,visitors:1}],days:[],referrers:[],outboundSites:[]};",
 " else if(path==='/api/club/history')data={events:[],source:'Unavailable'};",
 " else if(path==='/api/members/session')data={user:null};",
 " else if(path==='/api/community/posts')data={posts:[],ready:true};",
 " else if(path==='/api/community/polls')data={polls:[]};",
 " else if(path==='/api/lounge/people')data={people:[]};",
 " else if(path==='/api/lounge/me')data={user:null,visible:false};",
 " else if(path==='/api/community/presence')data={online:0};",
 ' return new Response(JSON.stringify(data),{status:200,headers:{"Content-Type":"application/json"}})',
 '};',
 '</script>'
].join('\n');
const clubTests=[['debate','Daily Debate'],['polls','Polling Station'],['leaderboard','Lounge Leaderboard'],['quiz','Quiz Arena'],['predictions','Prediction Center'],['rooms','Live Hangout Rooms'],['news','The News Desk'],['trending',"What's Trending"],['history','On This Day'],['questions','Ask the Lounge']];
const mainTests=[['rooms','Find your room'],['polls','The opinion corner'],['friends','Friends & familiar faces'],['discover','Discover'],['ai','Lounge Chat'],['profile','Member Profiles'],['owner','Owner Dashboard']];
function probe(kind){
 const tests=kind==='club'?clubTests:mainTests;
 const code=[
  '<script>',
  'window.addEventListener("load",()=>setTimeout(async()=>{',
  ' const items='+JSON.stringify(tests)+';',
  ' const problems=[];',
  ' for(const [id,title] of items){',
  '  const selector='+JSON.stringify(kind==='club'?'#clubNav a[data-tab="':'a[data-page="')+'+id+\'"]\';',
  '  const a=document.querySelector(selector);',
  '  if(!a){problems.push("MISSING "+id);continue}',
  '  a.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"});',
  '  const box=a.getBoundingClientRect();const hit=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);',
  '  if(!hit?.closest(selector)){problems.push("COVERED "+id);continue}',
  '  a.click();',
  '  await new Promise(r=>setTimeout(r,110));',
  '  const heading='+JSON.stringify(kind==='club'?'#clubContent .pagehead h1':'#commandDesk .lounge-panel-head h1')+';',
  '  const actual=document.querySelector(id==="ai"?"#commandDesk .ai-studio-header h1":heading)?.textContent||"";',
  '  if(location.hash!=="#"+id||!actual.includes(title))problems.push("BROKEN "+id+": "+actual+" / "+location.hash);',
  ' }',
  ' if('+JSON.stringify(kind)+'==="club"&&document.querySelector("#clubNav [data-tab=owner],#clubNav [data-tab=profiles]"))problems.push("OWNER PROFILE STILL IN CLUBHOUSE");',
  ' if('+JSON.stringify(kind)+'==="club"){',
  '  const quiz=document.querySelector("#clubContent .pagehead h1");',
  '  document.querySelector("#clubNav [data-tab=quiz]")?.click();',
  '  await new Promise(r=>setTimeout(r,140));',
  '  if(!document.querySelector("[data-quiz-answer]")||!document.body.textContent.includes("Which planet is famous for its rings?"))problems.push("DAILY QUIZ STILL PLACEHOLDER");',
  '  document.querySelector("#clubNav [data-tab=news]")?.click();',
  '  await new Promise(r=>setTimeout(r,140));',
  '  if(!document.querySelector(".post h3 a")||!document.body.textContent.includes("Verified source headline"))problems.push("NEWS STILL EMPTY");',
  '  document.querySelector("#clubNav [data-tab=history]")?.click();',
  '  await new Promise(r=>setTimeout(r,250));',
  '  if(!document.querySelector(".historymark")||!document.body.textContent.includes("Gunpowder Plot"))problems.push("HISTORY STILL EMPTY");',
  ' }',
  ' if('+JSON.stringify(kind)+'==="main"){',
  '  document.querySelector("[data-page=ai]")?.click();',
  '  await new Promise(r=>setTimeout(r,160));',
  '  const chatPanel=document.querySelector(".ai-conversation");',
  '  if(!document.querySelector(".lc-sidebar, .lc-new, .lc-brand"))problems.push("CHAT SIDEBAR MISSING");',
  '  const composer=document.querySelector(".ai-composer");',
  '  if(getComputedStyle(chatPanel).overflowY!=="visible")problems.push("CHAT STILL HAS SECOND SCROLLBAR");',
  '  if(getComputedStyle(composer).position!=="static")problems.push("COMPOSER STILL FLOATS WHILE SCROLLING");',
  '  if(document.querySelector("#aiReasoning")?.value!=="medium")problems.push("STANDARD REASONING NOT DEFAULT");',
  '  const searchField=document.querySelector("#loungeAIQuestion");',
  '  if(!searchField)problems.push("AI SEARCH INPUT MISSING");',
  '  else{searchField.value="capital of australia";searchField.dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("#loungeAIForm")?.requestSubmit();await new Promise(r=>setTimeout(r,500));if(document.querySelector(".ai-references, .ai-source"))problems.push("UNWANTED REFERENCE CARDS DISPLAYED");if(!document.querySelector(".lc-answer")||!document.querySelector("#loungeAIAnswer")?.textContent.includes("answered by OpenAI"))problems.push("OPENAI ANSWER NOT DISPLAYED");}',
  '  if(window.__aiTestRequests[0]?.reasoningEffort!=="medium")problems.push("REASONING REQUEST NOT STANDARD");',
  '  const effortSelect=document.querySelector("#aiReasoning");if(effortSelect){effortSelect.value="high";effortSelect.dispatchEvent(new Event("change",{bubbles:true}));}else problems.push("DEEP ANALYSIS OPTION MISSING");',
  '  if(!document.querySelector("#loungeAIAnswer h3")||!document.querySelector("#loungeAIAnswer strong"))problems.push("MARKDOWN ANSWER FORMATTING FAILED");',
  '  document.querySelector("[data-ai-mode=image]")?.click();',
  '  await new Promise(r=>setTimeout(r,70));',
  '  const imageField=document.querySelector("#loungeAIQuestion");',
  '  if(!imageField)problems.push("IMAGE PROMPT FIELD MISSING");',
  '  else{imageField.value="A cinematic historical painting of ancient Rome";imageField.dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("#loungeAIForm")?.requestSubmit();await new Promise(r=>setTimeout(r,400));if(!document.querySelector(".ai-generated-image img")||!document.querySelector(".ai-generated-image a[download]"))problems.push("GENERATED IMAGE PREVIEW OR DOWNLOAD MISSING");}',
  '  const oldChat=document.querySelector(".lc-thread.selected")?.dataset.chatOpen;',
  '  document.querySelector("[data-chat-new]")?.click();',
  '  if(!document.querySelector(".lc-welcome"))problems.push("NEW CHAT DID NOT CLEAR VIEW");',
  '  if(oldChat){[...document.querySelectorAll("[data-chat-open]")].find(b=>b.dataset.chatOpen===oldChat)?.click();if(!document.querySelector("#loungeAIAnswer")?.textContent.includes("answered by OpenAI"))problems.push("RECENT CHAT NOT RESTORED");}else problems.push("CHAT THREAD NOT SAVED");',
  '  const navLinks=[...document.querySelectorAll(".lounge-nav>a")];',
  '  if(navLinks.some(a=>a.scrollWidth>a.clientWidth+3))problems.push("NAV BUTTON TEXT OVERFLOW");',
  '  document.querySelector("[data-page=owner]")?.click();',
  '  await new Promise(r=>setTimeout(r,160));',
  '  if(!document.querySelector("[data-page=owner]")||!document.querySelector("[data-page=profile]"))problems.push("MAIN OWNER/PROFILES TAB MISSING");',
  '  for(const id of ["overview","members","traffic","posts","announcements","polls","predictions","security"]){',
  '   const b=document.querySelector("[data-owner-view="+id+"]");',
  '   if(!b){problems.push("OWNER PANEL MISSING "+id);continue;}',
  '   b.click();',
  '   if(document.querySelector("[data-owner-view="+id+"]")?.getAttribute("aria-pressed")!=="true"||!document.querySelector(".owner-content"))problems.push("OWNER PANEL BROKEN "+id);',
  '  }',
  ' }',
  ' document.body.dataset.browserQa=problems.length?"FAIL":"PASS";',
  ' const out=document.createElement("pre");out.id="browserQaResult";out.textContent=problems.join(" | ")||"ALL CLICKS PASSED";document.body.append(out);',
  '},1100));',
  '</script>'
 ].join('\n');
 return code;
}
const server=createServer((req,res)=>{
 const pathname=new URL(req.url||'/','http://localhost').pathname;
 const filename=pathname==='/club'?'/club.html':pathname==='/'?'/lounge.html':pathname;
 const path=resolve(root,'.'+filename);
 if(!path.startsWith(root+'/')||!existsSync(path)){res.writeHead(404);res.end('Not found');return}
 let payload=readFileSync(path);
 const ext=extname(path);
 if(ext==='.html'){
  const kind=pathname==='/club'?'club':'main';
  payload=Buffer.from(payload.toString().replace('<script src=',apiStub+'\n'+probe(kind)+'\n<script src='));
 }
 const mime=ext==='.html'?'text/html':ext==='.js'?'text/javascript':ext==='.css'?'text/css':'application/octet-stream';
 res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(payload);
});
function binary(){
 for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
  try{const b=execFileSync('which',[name],{encoding:'utf8'}).trim();if(b)return b}catch{}
 }
 throw Error('Chrome or Chromium is required to test actual tab clicks');
}
async function runBrowser(url){
 const child=spawn(binary(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check','--virtual-time-budget=6500','--dump-dom',url]);
 let html='',stderr='';
 child.stdout.on('data',chunk=>html+=chunk.toString());
 child.stderr.on('data',chunk=>stderr+=chunk.toString().slice(0,1000));
 const result=await new Promise((accept,reject)=>{
  const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Chrome timed out while testing '+url))},28000);
  child.on('error',reject);
  child.on('close',code=>{clearTimeout(timer);accept(code)});
 });
 if(result!==0)throw Error('Chrome exited '+result+' '+stderr.slice(-1000));
 const status=html.match(/data-browser-qa="(PASS|FAIL)"/)?.[1];
 const message=html.match(/<pre id="browserQaResult">([^<]*)<\/pre>/)?.[1]||'No test result was produced';
 assert.equal(status,'PASS','Browser tab-click test '+url+' FAILED: '+message);
 console.log('Browser tab clicks passed:',url);
}
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
try{
 const base='http://127.0.0.1:'+server.address().port;
 await runBrowser(base+'/club');
 await runBrowser(base+'/');
}finally{await new Promise(ok=>server.close(ok))}
