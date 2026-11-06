/* THE LOUNGE — secure OpenAI API answers inside the website. */
(function(){
'use strict';
const desk=document.getElementById('commandDesk');if(!desk)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const suggestions=[
 'Why did the Roman Empire fall?',
 'What is the capital of Australia, and why?',
 'Explain the relationship between inflation and interest rates.',
 'What were the main causes of World War I?'
];
let question='',answer='',results=[],message='',busy=false,searchDone=false,model='',lastError='',openaiReady=false,openaiModel='',priorMessages=[];
const active=()=>document.body.dataset.ewView==='ai';
function sourcesHtml(){
 if(!searchDone)return '';
 if(!results.length)return '<div class="owner-empty">No verified reference results were returned. OpenAI can still answer from general knowledge; verify important facts.</div>';
 return '<div class="ai-search-results">'+results.map((r,i)=>'<article class="ai-source"><span class="ai-source-label">SOURCE '+(i+1)+' · '+esc(r.source)+'</span><h3><a href="'+esc(r.url)+'" target="_blank" rel="noopener noreferrer">'+esc(r.title)+' ↗</a></h3>'+(r.snippet?'<p>'+esc(r.snippet)+'</p>':'')+'</article>').join('')+'</div>'
}
function view(){
 if(!active())return;
 desk.innerHTML='<div class="lounge-panel-head"><span class="lounge-eyebrow">THE LOUNGE / PRIVATE RESEARCH DESK</span><h1>AI Search <span aria-hidden="true">✦</span></h1><p>Search reference sources and ask OpenAI directly inside The Lounge. Answers appear here, not on another website.</p></div>'
 +'<section class="lounge-surface ai-panel"><div class="ai-topline"><span class="ai-badge">'+(openaiReady?'● OPENAI CONNECTED':'◌ CONNECTING TO OPENAI')+'</span><span class="ai-subtext">'+(openaiReady?'Answers generated through your server’s private OpenAI API connection':'OpenAI answers work here after the server connection is ready')+'</span></div>'
 +'<form id="loungeAIForm"><label for="loungeAIQuestion">SEARCH AND ASK A QUESTION</label><textarea name="question" id="loungeAIQuestion" rows="4" maxlength="2000" minlength="2" placeholder="Search history, politics, countries, science, economics and more…" required>'+esc(question)+'</textarea>'
 +'<div class="ai-actions"><button type="submit" class="ai-primary" '+(busy?'disabled':'')+'>'+(busy?'ASKING OPENAI…':'ASK OPENAI')+'</button><button type="button" data-ai-clear '+(busy?'disabled':'')+'>CLEAR</button></div></form>'
 +'<p class="ai-notice" id="aiStatus" role="status" aria-live="polite">'+esc(message||(openaiReady?'Ask a question. OpenAI answers appear directly below.':'Checking the server’s OpenAI connection. The old browser AI model is no longer used.'))+'</p></section>'
 +(searchDone?'<section class="lounge-surface ai-references"><h2>Reference search results</h2>'+sourcesHtml()+'</section>':'')
 +(answer?'<section class="lounge-surface ai-answer"><h2>AI-generated answer</h2><p class="ai-notice">Answered by '+esc(model||'AI')+'. Verify significant facts using the links above.</p><div id="loungeAIAnswer"></div></section>':'')
 +(lastError?'<section class="lounge-surface ai-error" role="alert"><h2>AI connection status</h2><p>'+esc(lastError)+'</p><p>Source links above remain available. OpenAI connection or billing issues are shown here.</p></section>':'')
 +'<section class="lounge-surface ai-prompts"><h2>Try these searches</h2><div class="ai-suggestions">'+suggestions.map((s,i)=>'<button type="button" data-ai-suggestion="'+i+'">'+esc(s)+'</button>').join('')+'</div><p class="ai-disclaimer">AI responses may be inaccurate. When OpenAI is connected, questions are sent through our private server to OpenAI. Only the owner manages the API key.</p></section>';
 if(answer){const el=desk.querySelector('#loungeAIAnswer');if(el)el.textContent=answer}
}
function notice(text){
 message=String(text||'').slice(0,260);
 if(!active())return;
 const el=desk.querySelector('#aiStatus');if(el)el.textContent=message;
}
async function run(){
 if(busy)return;
 const query=question.trim();
 if(query.length<2||query.length>2000){lastError='Enter a question at least two characters long.';view();return}
 busy=true;answer='';results=[];searchDone=false;lastError='';notice('Finding relevant references before asking OpenAI…');view();
 try{
  const r=await fetch('/api/ai-search?q='+encodeURIComponent(query.slice(0,160)),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(14000)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.error||'Reference search request failed.');
  results=Array.isArray(data.results)?data.results.filter(x=>x&&x.title&&x.url).slice(0,12):[];
  searchDone=true;notice(results.length?results.length+' reference results found. Ready to ask OpenAI…':'No matching reference links were found. Ready to ask OpenAI…');view();
 }catch(e){
  searchDone=true;results=[];notice('Reference search could not connect: '+String(e.message||e)+'. OpenAI may still answer from general knowledge.');view();
 }
 try{
  notice('Sending question to OpenAI securely through The Lounge…');
  const response=await fetch('/api/ask-ai',{
   method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({question:query,references:results.slice(0,5),history:priorMessages.slice(-8)}),
   signal:AbortSignal.timeout(46000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
   if(response.status===401)throw Error('Please sign in to The Lounge first. You can then ask AI questions here.');
   throw Error(data.error||'OpenAI could not answer. Please try again.');
  }
  answer=String(data.answer||'').trim();
  if(!answer)throw Error('OpenAI returned an empty answer.');
  model=data.model||openaiModel||'OpenAI';
  priorMessages.push({role:'user',content:query.slice(0,1200)},{role:'assistant',content:answer.slice(0,1200)});
  priorMessages=priorMessages.slice(-8);
  openaiReady=true;
  lastError='';
  message='Answer received from OpenAI.';
 }catch(error){
  lastError=String(error?.message||error);
  message='OpenAI could not complete the request.';
  if(/not connected|key|railway/i.test(lastError))openaiReady=false;
 }finally{busy=false;view()}
}
desk.addEventListener('input',e=>{
 if(active()&&e.target.id==='loungeAIQuestion')question=e.target.value
});
desk.addEventListener('click',e=>{
 if(!active())return;
 const choice=e.target.closest('[data-ai-suggestion]');
 if(choice){
  const q=suggestions[Number(choice.dataset.aiSuggestion)];
  if(q&&!busy){question=q;answer='';results=[];searchDone=false;lastError='';message='';view();desk.querySelector('#loungeAIQuestion')?.focus()}
  return
 }
 if(e.target.closest('[data-ai-clear]')&&!busy){question='';answer='';results=[];searchDone=false;lastError='';message='';priorMessages=[];view()}
});
desk.addEventListener('submit',e=>{
 if(!active()||e.target.id!=='loungeAIForm')return;
 e.preventDefault();
 question=e.target.querySelector('textarea')?.value||question;
 void run()
});
async function checkConnection(){
 try{
  const response=await fetch('/api/ask-ai/status',{credentials:'same-origin',cache:'no-store'});
  const status=await response.json();
  openaiReady=response.ok&&status.available===true;
  openaiModel=openaiReady?String(status.model||'OpenAI'):'';
  message=openaiReady?'OpenAI connected. Answers will appear directly on this page.':'OpenAI API setup is pending. Add OPENAI_API_KEY to the website’s Railway Variables.';
 }catch{openaiReady=false;message='Could not check the OpenAI connection. Reference search remains available.'}
 if(active())view();
}
function open(){if(active()){view();void checkConnection()}}
window.LoungeAI={open};
})();
