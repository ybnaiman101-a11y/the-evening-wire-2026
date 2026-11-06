/* LOUNGE CHAT — clean conversations and images using private OpenAI API. */
(function(){
'use strict';
const host=document.getElementById('commandDesk');if(!host)return;
const KEY='lounge_chat_threads_v1',BILLING='https://platform.openai.com/settings/organization/billing/overview';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ideas={chat:['Explain the causes of World War I.','How does the stock market work?','Quiz me on world geography.','Why did the Roman Empire fall?'],image:['Ancient Jerusalem at sunset, photorealistic','A detailed vintage world map','A futuristic city at night, cinematic','Mountains under the northern lights']};
const active=()=>document.body.dataset.ewView==='ai';
let threads=readThreads(),activeId=threads[0]?.id||null,mode='chat',reasoning='medium',aspect='1024x1024',drafts={chat:'',image:''},busy=false,error='',note='',connected=false,billing=false,model='GPT-6.1 Sol',imageModel='GPT Image 2.6 Sunburst';
const urls=new Set();
function id(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'chat'+Date.now()+Math.random().toString(36).slice(2)}
function readThreads(){
 try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(v))return [];
  return v.filter(t=>t&&typeof t.id==='string'&&Array.isArray(t.messages)&&typeof t.title==='string').slice(0,12).map(t=>({id:t.id,title:t.title.slice(0,65),messages:t.messages.filter(m=>m&&typeof m.text==='string'&&['user','assistant'].includes(m.role)&&m.kind!=='image').slice(-24).map(m=>({role:m.role,kind:m.kind==='text'?'text':'prompt',channel:m.channel==='image'?'image':'chat',text:m.text.slice(0,6500),model:String(m.model||'').slice(0,80)}))}));
 }catch{return []}
}
function save(){
 try{localStorage.setItem(KEY,JSON.stringify(threads.slice(0,12).map(t=>({id:t.id,title:t.title,messages:t.messages.filter(m=>m.kind!=='image').slice(-24)}))))}catch{}
}
function current(){return threads.find(t=>t.id===activeId)||null}
function create(){
 const t={id:id(),title:'New chat',messages:[]};
 threads.unshift(t);threads=threads.slice(0,12);activeId=t.id;save();return t
}
function ensure(){return current()||create()}
function shortTitle(q){return q.length>42?q.slice(0,42)+'…':q}
function inline(text){
 return esc(text).replace(/\[([^\]\n]{1,100})\]\((https?:\/\/[^\s)]+)\)/g,(_,label,u)=>'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>')
 .replace(/\x60([^\x60\n]{1,150})\x60/g,'<code>$1</code>')
 .replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>')
 .replace(/(^|[^\w])\*([^*\n]+)\*/g,'$1<em>$2</em>')
}
function markdown(src){
 const lines=String(src||'').replace(/\r\n?/g,'\n').split('\n');let out='',list='',inCode=false,code=[],para=[];
 const endPara=()=>{if(para.length){out+='<p>'+para.map(inline).join(' ')+'</p>';para=[]}};
 const endList=()=>{if(list){out+='</'+list+'>';list=''}};
 for(const line of lines){
  if(/^\s*\x60{3}/.test(line)){
   endPara();endList();
   if(inCode){out+='<pre class="lc-code"><code>'+esc(code.join('\n'))+'</code></pre>';code=[];inCode=false}else inCode=true;
   continue
  }
  if(inCode){code.push(line);continue}
  if(!line.trim()){endPara();endList();continue}
  const heading=line.match(/^(#{1,4})\s+(.+)$/);
  if(heading){endPara();endList();const n=Math.min(heading[1].length+1,5);out+='<h'+n+'>'+inline(heading[2])+'</h'+n+'>';continue}
  if(/^\s*---+\s*$/.test(line)){endPara();endList();out+='<hr>';continue}
  const bullet=line.match(/^\s*[-*]\s+(.+)$/),number=line.match(/^\s*\d+[.)]\s+(.+)$/);
  if(bullet||number){endPara();const type=bullet?'ul':'ol';if(list!==type){endList();list=type;out+='<'+type+'>'}out+='<li>'+inline((bullet||number)[1])+'</li>';continue}
  endList();
  if(/^\s*>\s+/.test(line)){endPara();out+='<blockquote>'+inline(line.replace(/^\s*>\s+/,''))+'</blockquote>'}else para.push(line.trim())
 }
 if(inCode)out+='<pre class="lc-code"><code>'+esc(code.join('\n'))+'</code></pre>';
 endPara();endList();return out||'<p>No response text was returned.</p>'
}
function leftPanel(){
 return '<aside class="lc-sidebar" aria-label="Conversation history"><div class="lc-brand"><span class="lc-brand-icon">✦</span> LOUNGE CHAT</div>'
 +'<button type="button" class="lc-new" data-chat-new>＋ <span>New chat</span></button>'
 +'<div class="lc-history-label">Recent chats</div><div class="lc-threads">'+threads.map(t=>'<div class="lc-thread-row"><button type="button" class="lc-thread '+(activeId===t.id?'selected':'')+'" data-chat-open="'+esc(t.id)+'" title="'+esc(t.title)+'">'+esc(t.title)+'</button><button type="button" class="lc-delete" data-chat-delete="'+esc(t.id)+'" title="Delete conversation" aria-label="Delete '+esc(t.title)+'">×</button></div>').join('')+'</div>'
 +'<div class="lc-sidebar-bottom">✦ <span>Powered by OpenAI<small>Chats saved in this browser</small></span></div></aside>'
}
function start(){
 return '<section class="lc-welcome"><div class="lc-welcome-icon">✦</div><h2>How can I help you today?</h2><p>Ask a question, start a discussion, or create an image.</p><div class="lc-prompts">'+ideas[mode].map((q,i)=>'<button type="button" data-chat-example="'+i+'">'+esc(q)+' <span>↗</span></button>').join('')+'</div></section>'
}
function conversation(){
 const t=current();if(!t?.messages.length)return start();
 return '<div class="ai-transcript lc-transcript">'+t.messages.map((m,i)=>{
  if(m.role==='user')return '<article class="lc-user ai-message-user"><div class="lc-user-bubble">'+esc(m.text)+'</div></article>';
  if(m.kind==='image')return '<article class="lc-answer ai-answer"><div class="lc-ai-icon">✦</div><div class="lc-response"><div class="lc-response-label">Lounge Chat</div><div class="ai-generated-image lc-picture"><img src="'+esc(m.url)+'" alt="'+esc(m.prompt||'Generated image')+'"><div class="ai-image-actions"><a href="'+esc(m.url)+'" download="lounge-chat-image.png">↓ Download PNG</a><small>Images stay available until the page reloads</small></div></div></div></article>';
  return '<article class="lc-answer ai-answer"><div class="lc-ai-icon">✦</div><div class="lc-response"><div class="lc-response-label">Lounge Chat <small>'+esc(m.model||model)+'</small></div><div class="lc-prose"'+(i===t.messages.length-1?' id="loungeAIAnswer"':'')+'>'+markdown(m.text)+'</div><div class="lc-actions"><button type="button" data-chat-copy="'+i+'">⧉ Copy</button></div></div></article>'
 }).join('')+'</div>'
}
function inputArea(){
 return '<form id="loungeAIForm" class="ai-composer lc-composer"><label class="lc-sr-only" for="loungeAIQuestion">'+(mode==='chat'?'Your message':'Image description')+'</label>'
 +'<textarea id="loungeAIQuestion" name="question" rows="2" maxlength="2000" minlength="'+(mode==='chat'?3:10)+'" placeholder="'+(mode==='chat'?'Message Lounge Chat':'Describe the image you want to create')+'" required '+(busy?'disabled':'')+'>'+esc(drafts[mode])+'</textarea>'
 +'<div class="lc-input-bottom"><div class="lc-tools"><button type="button" class="lc-tool" data-ai-mode="chat" aria-pressed="'+(mode==='chat')+'">✦ Chat</button><button type="button" class="lc-tool" data-ai-mode="image" aria-pressed="'+(mode==='image')+'">▧ Images</button>'
 +(mode==='chat'?'<label class="lc-setting">Reasoning <select id="aiReasoning" aria-label="Answer depth"><option value="medium"'+(reasoning==='medium'?' selected':'')+'>Standard</option><option value="high"'+(reasoning==='high'?' selected':'')+'>Deep analysis</option></select></label>'
 :'<label class="lc-setting">Size <select id="aiAspect" aria-label="Image size"><option value="1024x1024"'+(aspect==='1024x1024'?' selected':'')+'>Square</option><option value="1536x1024"'+(aspect==='1536x1024'?' selected':'')+'>Landscape</option><option value="1024x1536"'+(aspect==='1024x1536'?' selected':'')+'>Portrait</option></select></label>')
 +'</div><button type="submit" class="lc-send" aria-label="'+(mode==='chat'?'Send message':'Generate image')+'" title="'+(mode==='chat'?'Send message':'Generate image')+'" '+(busy?'disabled':'')+'>'+(busy?'···':'↑')+'</button></div></form>'
}
function render(){
 if(!active())return;
 host.innerHTML='<section class="ai-studio lc-shell">'+leftPanel()+'<main class="lc-main">'
 +'<header class="ai-studio-header lc-header"><div><h1>Lounge Chat</h1><span>'+esc(model)+' <span aria-hidden="true">⌄</span></span></div><span class="lc-status '+(billing?'lc-billing':connected?'lc-connected':'')+'">'+(billing?'API credits needed':connected?'Connected':'Checking…')+'</span></header>'
 +'<div class="ai-conversation lc-conversation" id="aiConversation">'+conversation()+'</div>'
 +(busy?'<div class="lc-pending" role="status">✦ &nbsp; '+(mode==='image'?'Creating your image':'Thinking')+'<span class="lc-pending-dots"> · · ·</span></div>':'')
 +(error?'<div class="ai-error-inline lc-error" role="alert">'+esc(error)+(billing?'<p><a class="ai-billing-link" href="'+BILLING+'" target="_blank" rel="noopener noreferrer">Add OpenAI API credits ↗</a></p>':'')+'</div>':'')
 +'<div class="lc-bottom">'+inputArea()+'<p class="lc-hint">'+esc(note||(mode==='image'?'Create images with OpenAI · 3 per day':reasoning==='high'?'Deep analysis can take longer':'Lounge Chat can make mistakes. Verify important information.'))+'</p></div>'
 +'</main></section>'
}
function scrollToEnd(){const t=host.querySelector('.lc-pending, .lc-answer:last-child, .lc-user:last-child');if(t)t.scrollIntoView({block:'nearest',behavior:'auto'})}
async function send(){
 if(busy)return;const task=mode,q=drafts[task].trim(),min=task==='chat'?3:10;
 if(q.length<min||q.length>2000){error='Please enter at least '+min+' characters.';render();return}
 const t=ensure();
 const prior=t.messages.filter(m=>m.channel==='chat'&&m.kind!=='image').slice(-8).map(m=>({role:m.role,content:m.text.slice(0,1200)}));
 busy=true;error='';note=task==='image'?'Generating image…':'Preparing your answer…';
 t.messages.push({role:'user',kind:'prompt',channel:task,text:q});drafts[task]='';render();scrollToEnd();
 try{
  if(task==='chat'){
   const res=await fetch('/api/ask-ai',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,history:prior,reasoningEffort:reasoning}),signal:AbortSignal.timeout(158000)});
   const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||'The AI could not answer.');
   const answer=String(data.answer||'').trim();if(!answer)throw Error('OpenAI returned an empty answer.');
   t.messages.push({role:'assistant',kind:'text',channel:'chat',text:answer,model:data.model||model});billing=false;note='';
  }else{
   const res=await fetch('/api/ask-ai/image',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:q,size:aspect}),signal:AbortSignal.timeout(145000)});
   if(!res.ok){const data=await res.json().catch(()=>({}));throw Error(data.error||'Image generation failed.')}
   const blob=await res.blob();if(!blob.type.startsWith('image/')||blob.size<64)throw Error('Image data was invalid.');
   const url=URL.createObjectURL(blob);urls.add(url);
   t.messages.push({role:'assistant',kind:'image',channel:'image',url,prompt:q,model:res.headers.get('X-Lounge-Image-Model')||imageModel});billing=false;note='Image ready · Download PNG above';
  }
  if(t.title==='New chat')t.title=q.length>44?q.slice(0,44)+'…':q;
  const index=threads.indexOf(t);if(index>0){threads.splice(index,1);threads.unshift(t)}
  save();
 }catch(ex){
  const timed=ex?.name==='TimeoutError'||ex?.name==='AbortError'||/timeout/i.test(String(ex?.message||''));
  error=timed?'OpenAI took too long. Try Standard reasoning or a shorter message.':String(ex?.message||ex);
  billing=/credit balance is exhausted|API credits|billing credit|credit_balance_exhausted/i.test(error);
  const last=t.messages[t.messages.length-1];if(last?.role==='user'&&last.text===q)t.messages.pop();
  drafts[task]=q;note='Your message is still in the box to try again.';
 }finally{busy=false;render();scrollToEnd()}
}
function newChat(){if(busy)return;create();drafts={chat:'',image:''};mode='chat';error='';note='';render()}
function switchTo(k){if(busy||!threads.some(t=>t.id===k))return;activeId=k;drafts={chat:'',image:''};error='';note='';render()}
function deleteChat(k){
 if(busy)return;const t=threads.find(t=>t.id===k);if(!t)return;
 for(const m of t.messages)if(m.kind==='image'&&urls.has(m.url)){URL.revokeObjectURL(m.url);urls.delete(m.url)}
 threads=threads.filter(t=>t.id!==k);if(activeId===k)activeId=threads[0]?.id||null;save();render()
}
host.addEventListener('input',e=>{if(active()&&e.target.id==='loungeAIQuestion')drafts[mode]=e.target.value});
host.addEventListener('change',e=>{
 if(!active())return;
 if(e.target.id==='aiReasoning')reasoning=e.target.value==='high'?'high':'medium';
 if(e.target.id==='aiAspect')aspect=e.target.value
});
host.addEventListener('keydown',e=>{
 if(!active()||e.target.id!=='loungeAIQuestion'||e.key!=='Enter'||e.shiftKey||e.isComposing)return;
 e.preventDefault();if(!busy)host.querySelector('#loungeAIForm')?.requestSubmit()
});
host.addEventListener('click',e=>{
 if(!active())return;const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-chat-new')){newChat();return}
 if(b.dataset.chatOpen){switchTo(b.dataset.chatOpen);return}
 if(b.dataset.chatDelete){deleteChat(b.dataset.chatDelete);return}
 if(b.dataset.aiMode&&!busy){mode=b.dataset.aiMode;error='';note='';render();return}
 if(b.dataset.chatExample!==undefined&&!busy){const q=ideas[mode][Number(b.dataset.chatExample)];if(q){drafts[mode]=q;render();host.querySelector('#loungeAIQuestion')?.focus()}return}
 if(b.dataset.chatCopy!==undefined){
  const m=current()?.messages[Number(b.dataset.chatCopy)];
  if(m?.kind==='text'&&navigator.clipboard?.writeText)void navigator.clipboard.writeText(m.text).then(()=>{const n=host.querySelector('.lc-hint');if(n)n.textContent='Answer copied.'}).catch(()=>{})
 }
});
host.addEventListener('submit',e=>{
 if(!active()||e.target.id!=='loungeAIForm')return;
 e.preventDefault();drafts[mode]=e.target.querySelector('textarea')?.value||drafts[mode];void send()
});
async function check(){
 try{
  const r=await fetch('/api/ask-ai/status',{credentials:'same-origin',cache:'no-store'});const data=await r.json();
  connected=r.ok&&data.available===true;billing=data.billingRequired===true;
  if(data.model)model=String(data.model);if(data.imageModel)imageModel=String(data.imageModel);
  if(billing)error='OpenAI API credits are exhausted. The owner must add credits before new answers or images can be created.';
  else if(!connected)error='OpenAI is not connected. The owner must configure OPENAI_API_KEY in Railway.';
  else if(/credits are exhausted|not connected/i.test(error))error='';
 }catch{connected=false;error='Could not check the OpenAI API connection.'}
 if(active())render()
}
window.LoungeAI={open(){if(active()){render();void check()}}};
})();
