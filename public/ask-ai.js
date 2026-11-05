/* THE LOUNGE — integrated on-device AI search, without external chat redirects. */
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
let question='',answer='',results=[],message='',busy=false,searchDone=false,model='',lastError='';
const active=()=>document.body.dataset.ewView==='ai';
function sourcesHtml(){
 if(!searchDone)return '';
 if(!results.length)return '<div class="owner-empty">No verified reference results were returned. You can still ask the local model, but its answers will not be live-verified.</div>';
 return '<div class="ai-search-results">'+results.map((r,i)=>'<article class="ai-source"><span class="ai-source-label">SOURCE '+(i+1)+' · '+esc(r.source)+'</span><h3><a href="'+esc(r.url)+'" target="_blank" rel="noopener noreferrer">'+esc(r.title)+' ↗</a></h3>'+(r.snippet?'<p>'+esc(r.snippet)+'</p>':'')+'</article>').join('')+'</div>'
}
function view(){
 if(!active())return;
 const gpu=!!navigator.gpu;
 desk.innerHTML='<div class="lounge-panel-head"><span class="lounge-eyebrow">THE LOUNGE / PRIVATE RESEARCH DESK</span><h1>AI Search <span aria-hidden="true">✦</span></h1><p>Find source links and ask an AI model right here inside The Lounge. It runs on your device—not another chat website.</p></div>'
 +'<section class="lounge-surface ai-panel"><div class="ai-topline"><span class="ai-badge">'+(gpu?'● ON-DEVICE AI AVAILABLE':'◌ REFERENCE SEARCH AVAILABLE')+'</span><span class="ai-subtext">'+(gpu?'Compact open-source AI · processed locally in your browser':'AI generation requires a WebGPU-capable computer/browser; reference search still works')+'</span></div>'
 +'<form id="loungeAIForm"><label for="loungeAIQuestion">SEARCH AND ASK A QUESTION</label><textarea name="question" id="loungeAIQuestion" rows="4" maxlength="2000" minlength="2" placeholder="Search history, politics, countries, science, economics and more…" required>'+esc(question)+'</textarea>'
 +'<div class="ai-actions"><button type="submit" class="ai-primary" '+(busy?'disabled':'')+'>'+(busy?'SEARCHING / THINKING…':'SEARCH WITH LOUNGE AI')+'</button><button type="button" data-ai-clear '+(busy?'disabled':'')+'>CLEAR</button></div></form>'
 +'<p class="ai-notice" id="aiStatus" role="status" aria-live="polite">'+esc(message||(gpu?'The local AI model downloads once to your browser on first use; it may be several hundred MB. Source lookup uses Wikipedia and available publisher headlines.':'Search works without AI. For on-device answers, use a current WebGPU-enabled browser with graphics acceleration.'))+'</p></section>'
 +(searchDone?'<section class="lounge-surface ai-references"><h2>Reference search results</h2>'+sourcesHtml()+'</section>':'')
 +(answer?'<section class="lounge-surface ai-answer"><h2>AI-generated answer</h2><p class="ai-notice">Generated locally by '+esc(model||'an open-source AI model')+'. Verify significant facts using the links above.</p><div id="loungeAIAnswer"></div></section>':'')
 +(lastError?'<section class="lounge-surface ai-error" role="alert"><h2>Local AI unavailable</h2><p>'+esc(lastError)+'</p><p>Source links above remain available. A faster computer or Chrome with WebGPU enabled may be needed.</p></section>':'')
 +'<section class="lounge-surface ai-prompts"><h2>Try these searches</h2><div class="ai-suggestions">'+suggestions.map((s,i)=>'<button type="button" data-ai-suggestion="'+i+'">'+esc(s)+'</button>').join('')+'</div><p class="ai-disclaimer">Small on-device models can make mistakes. Live coverage is limited to the listed reference sources, not the whole internet. No AI provider key is required.</p></section>';
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
 busy=true;answer='';results=[];searchDone=false;lastError='';notice('Searching available reference sources…');view();
 try{
  const r=await fetch('/api/ai-search?q='+encodeURIComponent(query.slice(0,160)),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(14000)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.error||'Reference search request failed.');
  results=Array.isArray(data.results)?data.results.filter(x=>x&&x.title&&x.url).slice(0,12):[];
  searchDone=true;notice(results.length?results.length+' reference results found. Preparing on-device AI…':'No matching reference links were found. Checking the local AI model…');view();
 }catch(e){
  searchDone=true;results=[];notice('Reference search could not connect: '+String(e.message||e)+'. Local AI may still answer from general knowledge.');view();
 }
 if(!navigator.gpu){
  lastError='Your browser has no WebGPU support, so a local language model cannot run here. Source search is ready above.';
  busy=false;view();return
 }
 try{
  const module=await import('/local-ai.js?v=1');
  const r=await module.answerLocally(query,results,notice);
  answer=String(r.answer||'');model=r.model||'Open-source model';lastError='';
 }catch(e){
  lastError=String(e?.message||e);
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
 if(e.target.closest('[data-ai-clear]')&&!busy){question='';answer='';results=[];searchDone=false;lastError='';message='';view()}
});
desk.addEventListener('submit',e=>{
 if(!active()||e.target.id!=='loungeAIForm')return;
 e.preventDefault();
 question=e.target.querySelector('textarea')?.value||question;
 void run()
});
function open(){if(active())view()}
window.LoungeAI={open};
})();
