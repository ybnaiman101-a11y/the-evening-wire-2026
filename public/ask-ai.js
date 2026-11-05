/* THE LOUNGE / Ask AI main-page panel. */
(function(){
'use strict';
const desk=document.getElementById('commandDesk');if(!desk)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let configured=false,checking=false,question='',answer='',error='',asking=false;
const active=()=>document.body.dataset.ewView==='ai';
const standardPrompts=[
 'Explain an important event that happened on this day in history.',
 'What are the main arguments for and against term limits for Congress?',
 'Give me a five-question world geography quiz.',
 'Explain how the stock market works in simple terms.'
];
function view(){
 if(!active())return;
 desk.innerHTML='<div class="lounge-panel-head"><span class="lounge-eyebrow">THE LOUNGE / ASK AI</span><h1>Ask AI <span aria-hidden="true">✦</span></h1><p>Have a question about history, politics, science, geography or anything else? Ask an AI assistant.</p></div>'
 +'<section class="lounge-surface ai-panel"><div class="ai-topline"><span class="ai-badge">'+(configured?'● AI CONNECTED':'◌ CHATGPT AVAILABLE')+'</span><span class="ai-subtext">'+(configured?'Answers appear here inside the Lounge.':'ChatGPT opens separately until the owner adds an API key.')+'</span></div>'
 +'<form id="loungeAIForm"><label for="loungeAIQuestion">YOUR QUESTION</label><textarea name="question" id="loungeAIQuestion" rows="5" maxlength="2000" minlength="3" placeholder="Ask about a historical event, a country, a current issue, or anything else…" required>'+esc(question)+'</textarea>'
 +'<div class="ai-actions"><button type="submit" class="ai-primary" '+(asking?'disabled':'')+'>'+(asking?'ASKING AI…':configured?'ASK AI NOW':'COPY QUESTION & OPEN CHATGPT')+'</button>'
 +'<button type="button" data-ai-copy>Copy question</button><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">OPEN CHATGPT ↗</a></div></form>'
 +'<p class="ai-notice" role="status" aria-live="polite">'+esc(error||(configured?'AI answers may be mistaken. Verify significant facts before sharing.':'In-Lounge AI responses require an OpenAI API key configured by the site owner in Railway. No key is currently connected.'))+'</p></section>'
 +'<section class="lounge-surface ai-answer" '+(answer?'':'hidden')+'><h2>AI answer</h2><div id="loungeAIAnswer"></div><p class="ai-disclaimer">AI-generated information should be verified for important decisions.</p></section>'
 +'<section class="lounge-surface ai-prompts"><h2>Try asking</h2><div class="ai-suggestions">'+standardPrompts.map((q,i)=>'<button type="button" data-ai-suggestion="'+i+'">'+esc(q)+'</button>').join('')+'</div></section>';
 if(answer){const el=desk.querySelector('#loungeAIAnswer');if(el)el.textContent=answer}
}
async function check(){
 if(checking)return;checking=true;
 try{const r=await fetch('/api/ask-ai/status',{credentials:'same-origin',cache:'no-store'});const data=await r.json();configured=r.ok&&data.available===true}
 catch{configured=false;error='Unable to check the AI service. ChatGPT can still open separately.'}
 finally{checking=false;view()}
}
function open(){if(!active())return;view();check()}
async function copy(){
 const el=desk.querySelector('#loungeAIQuestion');
 const text=(el?.value||question||'').trim();
 if(!text){error='Write a question first.';view();return false}
 question=text;
 try{
  if(!navigator.clipboard?.writeText)throw Error('Clipboard not available');
  await navigator.clipboard.writeText(text);
  error='Question copied. Paste it into ChatGPT.';view();return true;
 }catch{
  error='Your browser could not copy automatically. Select your question and copy it manually before opening ChatGPT.';view();return false
 }
}
desk.addEventListener('click',async event=>{
 if(!active())return;
 const suggestion=event.target.closest('[data-ai-suggestion]');
 if(suggestion){
  const item=standardPrompts[Number(suggestion.dataset.aiSuggestion)];
  if(item){question=item;error='';answer='';view();desk.querySelector('#loungeAIQuestion')?.focus()}
  return
 }
 if(event.target.closest('[data-ai-copy]')){await copy();return}
});
desk.addEventListener('input',event=>{
 if(!active()||event.target.id!=='loungeAIQuestion')return;
 question=event.target.value;
});
desk.addEventListener('submit',async event=>{
 if(!active()||event.target.id!=='loungeAIForm')return;
 event.preventDefault();
 if(asking)return;
 const el=event.target.querySelector('textarea');
 question=(el?.value||'').trim();
 if(question.length<3||question.length>2000){error='Write a question between 3 and 2,000 characters.';view();return}
 if(!configured){
  // Open during the actual click event, before any await, to avoid popup blockers.
  window.open('https://chatgpt.com/','_blank','noopener,noreferrer');
  await copy();
  return
 }
 asking=true;answer='';error='';view();
 try{
  const r=await fetch('/api/ask-ai',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({question}),signal:AbortSignal.timeout(38000)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.error||'AI request could not be completed.');
  answer=String(data.answer||'').slice(0,10000);
  if(!answer)throw Error('No answer was returned.');
 }catch(e){
  error=String(e.message||'AI request failed. Try again.');
 }finally{asking=false;view()}
});
window.LoungeAI={open};
})();
