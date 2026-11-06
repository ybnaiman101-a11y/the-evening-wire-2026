/* THE LOUNGE / Premium OpenAI chat and image studio. */
(function(){
'use strict';
const host=document.getElementById('commandDesk');if(!host)return;
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ideas={
 chat:['Why did the Roman Empire fall?','Explain the causes of World War I in detail.','How do interest rates affect stock markets?','Give me a challenging geography quiz.'],
 image:['A cinematic reconstruction of ancient Rome at sunset','A highly detailed historical world-map poster','An extraordinary photorealistic mountain landscape','A futuristic American city at night, cinematic']
};
let mode='chat',drafts={chat:'',image:''},aspect='1024x1024',messages=[],history=[],busy=false,notice='',error='',connected=false,model='GPT-6 Astra',imageModel='GPT Image 2.6 Sunburst';
const urls=new Set();
const active=()=>document.body.dataset.ewView==='ai';
function inline(s){
 return escape(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^\w])\*([^*\n]+)\*/g,'$1<em>$2</em>');
}
function markdown(text){
 const lines=String(text||'').replace(/\r/g,'').split('\n');
 let out='',type='';
 const close=()=>{if(type){out+='</'+type+'>';type=''}};
 for(const line of lines){
  if(!line.trim()){close();continue}
  const h=line.match(/^(#{1,3})\s+(.+)$/);
  if(h){close();out+='<h3>'+inline(h[2])+'</h3>';continue}
  const b=line.match(/^\s*[-*]\s+(.+)$/),n=line.match(/^\s*\d+[.)]\s+(.+)$/);
  if(b||n){const next=b?'ul':'ol';if(type!==next){close();type=next;out+='<'+type+'>'}out+='<li>'+inline((b||n)[1])+'</li>';continue}
  close();out+='<p>'+inline(line)+'</p>'
 }
 close();return out||'<p>No answer was returned.</p>'
}
function transcript(){
 if(!messages.length)return '<div class="ai-empty"><span class="ai-empty-symbol">✦</span><h2>What would you like to explore?</h2><p>Ask a question, have a conversation, or create original images. Everything appears together in this studio.</p><div class="ai-idea-grid">'+ideas[mode].map((p,i)=>'<button type="button" data-ai-idea="'+i+'">'+escape(p)+'</button>').join('')+'</div></div>';
 return '<div class="ai-transcript">'+messages.map((m,index)=>{
  const user=m.role==='user',picture=m.kind==='image';
  let inside='';
  if(picture){
   inside='<div class="ai-generated-image"><img src="'+escape(m.url)+'" alt="'+escape(m.prompt)+'"><div class="ai-image-actions"><a href="'+escape(m.url)+'" download="lounge-ai-image.png">↓ Download PNG</a><span>'+escape(m.model||imageModel)+'</span></div></div>';
  }else if(!user){
   inside='<div class="ai-answer-text" '+(index===messages.length-1?'id="loungeAIAnswer"':'')+'>'+markdown(m.text)+'</div><div class="ai-response-actions"><button type="button" data-ai-copy="'+index+'">Copy answer</button><small>AI answers may contain mistakes</small></div>';
  }else inside='<div class="ai-user-text">'+escape(m.text)+'</div>';
  return '<article class="ai-message '+(user?'ai-message-user':'ai-message-assistant')+(!user?' ai-answer':'')+'"><div class="ai-message-identity"><span class="ai-avatar">'+(user?'●':'✦')+'</span><strong>'+(user?'YOU':picture?'IMAGE':'AI')+'</strong><small>'+(user?'Your message':escape(m.model||model))+'</small></div><div class="ai-message-body">'+inside+'</div></article>'
 }).join('')+'</div>'
}
function draw(){
 if(!active())return;
 host.innerHTML='<section class="ai-studio"><header class="ai-studio-header"><div><span class="lounge-eyebrow">THE LOUNGE · OPENAI</span><h1>AI Studio <span>✦</span></h1><p>A powerful AI conversation and image-creation space.</p></div><div class="ai-studio-status"><strong>'+(connected?'● Connected':'◌ Connecting')+'</strong><small>'+escape(model)+' · Premium</small></div></header>'
 +'<nav class="ai-mode-switch" aria-label="AI Studio modes"><button type="button" data-ai-mode="chat" aria-pressed="'+(mode==='chat')+'">✦ Chat & Research</button><button type="button" data-ai-mode="image" aria-pressed="'+(mode==='image')+'">▣ Create Images</button><button type="button" class="ai-reset" data-ai-reset '+(busy?'disabled':'')+'>↻ New conversation</button></nav>'
 +'<div id="aiConversation" class="ai-conversation" aria-live="polite">'+transcript()+'</div>'
 +(error?'<div class="ai-error-inline" role="alert">'+escape(error)+'</div>':'')
 +'<form id="loungeAIForm" class="ai-composer"><label for="loungeAIQuestion">'+(mode==='chat'?'ASK ANYTHING':'DESCRIBE THE IMAGE TO CREATE')+'</label><textarea id="loungeAIQuestion" name="question" rows="3" maxlength="2000" minlength="'+(mode==='chat'?3:10)+'" placeholder="'+(mode==='chat'?'Ask a question or continue the conversation…':'Describe the style, lighting, layout, subject and details…')+'" required '+(busy?'disabled':'')+'>'+escape(drafts[mode])+'</textarea>'
 +(mode==='image'?'<div class="ai-image-options"><label for="aiAspect">FORMAT</label><select id="aiAspect"><option value="1024x1024"'+(aspect==='1024x1024'?' selected':'')+'>Square</option><option value="1536x1024"'+(aspect==='1536x1024'?' selected':'')+'>Landscape</option><option value="1024x1536"'+(aspect==='1024x1536'?' selected':'')+'>Portrait</option></select><small>'+escape(imageModel)+' · High quality · Up to 3 per day</small></div>':'')
 +'<div class="ai-composer-footer"><p class="ai-composer-note" role="status">'+escape(notice||(mode==='chat'?'GPT-6 Astra · High-level reasoning':'Premium images use OpenAI API credits'))+'</p><button class="ai-primary" type="submit" '+(busy?'disabled':'')+'>'+(busy?'Working…':mode==='chat'?'Send message ↗':'Generate image ↗')+'</button></div></form>'
 +'<p class="ai-privacy">This studio uses the site owner’s private OpenAI API. Chat and image requests are billed to the owner. Content is sent securely from The Lounge to OpenAI.</p></section>';
}
function status(s){notice=String(s||'').slice(0,200);const el=host.querySelector('.ai-composer-note');if(el)el.textContent=notice}
function bottom(){const t=host.querySelector('#aiConversation');if(t)t.scrollTop=t.scrollHeight}
async function ask(){
 if(busy)return;
 const task=mode,q=drafts[task].trim(),min=task==='image'?10:3;
 if(q.length<min||q.length>2000){error='Please enter at least '+min+' characters.';draw();return}
 busy=true;error='';notice=task==='image'?'Creating your image…':'Thinking…';
 messages.push({role:'user',kind:'prompt',text:q});drafts[task]='';draw();bottom();
 try{
  if(task==='chat'){
   const r=await fetch('/api/ask-ai',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,history:history.slice(-8)}),signal:AbortSignal.timeout(110000)});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(data.error||'OpenAI could not answer.');
   const answer=String(data.answer||'').trim();if(!answer)throw Error('OpenAI returned an empty answer.');
   messages.push({role:'assistant',kind:'text',text:answer,model:data.model||model});
   history.push({role:'user',content:q.slice(0,1200)},{role:'assistant',content:answer.slice(0,2200)});
   history=history.slice(-8);notice='Answer ready';
  }else{
   const r=await fetch('/api/ask-ai/image',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:q,size:aspect}),signal:AbortSignal.timeout(145000)});
   if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.error||'Image generation failed.')}
   const blob=await r.blob();
   if(!blob.type.startsWith('image/')||blob.size<64)throw Error('Image data was invalid.');
   const url=URL.createObjectURL(blob);urls.add(url);
   messages.push({role:'assistant',kind:'image',url,prompt:q,model:r.headers.get('X-Lounge-Image-Model')||imageModel});
   notice='Image created · Download PNG below';
  }
 }catch(e){error=String(e?.message||e);drafts[task]=q;notice='Request not completed'}
 finally{busy=false;draw();bottom()}
}
function reset(){
 for(const u of urls)URL.revokeObjectURL(u);urls.clear();
 messages=[];history=[];drafts={chat:'',image:''};notice='';error='';draw()
}
host.addEventListener('input',e=>{if(active()&&e.target.id==='loungeAIQuestion')drafts[mode]=e.target.value});
host.addEventListener('change',e=>{if(active()&&e.target.id==='aiAspect')aspect=e.target.value});
host.addEventListener('keydown',e=>{
 if(!active()||e.target.id!=='loungeAIQuestion'||e.key!=='Enter'||e.shiftKey||e.isComposing)return;
 e.preventDefault();if(!busy)host.querySelector('#loungeAIForm')?.requestSubmit();
});
host.addEventListener('click',e=>{
 if(!active())return;const b=e.target.closest('button');if(!b)return;
 if(b.dataset.aiMode&&!busy){mode=b.dataset.aiMode;error='';notice='';draw();return}
 if(b.hasAttribute('data-ai-reset')&&!busy){reset();return}
 if(b.dataset.aiIdea!==undefined&&!busy){const p=ideas[mode][Number(b.dataset.aiIdea)];if(p){drafts[mode]=p;draw();host.querySelector('#loungeAIQuestion')?.focus()}return}
 if(b.dataset.aiCopy!==undefined){
  const m=messages[Number(b.dataset.aiCopy)];
  if(m?.kind==='text'&&navigator.clipboard?.writeText)void navigator.clipboard.writeText(m.text).then(()=>status('Answer copied.')).catch(()=>status('Could not copy this answer.'));
 }
});
host.addEventListener('submit',e=>{
 if(!active()||e.target.id!=='loungeAIForm')return;
 e.preventDefault();drafts[mode]=e.target.querySelector('textarea')?.value||drafts[mode];void ask()
});
async function check(){
 try{
  const r=await fetch('/api/ask-ai/status',{credentials:'same-origin',cache:'no-store'}),data=await r.json();
  connected=r.ok&&data.available===true;
  if(data.model)model=String(data.model);
  if(data.imageModel)imageModel=String(data.imageModel);
  if(!connected)error='OpenAI is not connected. Ask the owner to configure OPENAI_API_KEY in Railway.';
 }catch{connected=false;error='OpenAI connection status could not be checked.'}
 if(active())draw()
}
window.LoungeAI={open(){if(active()){draw();void check()}}};
})();