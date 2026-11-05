// THE LOUNGE — browser-only open-source AI. No inference API, no paid key.
// The model and WebLLM runtime are fetched once and cached by the browser.
// All user prompts and source excerpts remain on this device during inference.
const MODEL='SmolLM2-360M-Instruct-q4f32_1-MLC';
let modelPromise=null;
export function localAIAvailability(){
 return {webgpu:!!navigator.gpu,secure:location.protocol==='https:'||location.hostname==='localhost',model:MODEL}
}
export async function answerLocally(question,sources=[],update=()=>{}){
 if(!navigator.gpu)throw Error('This browser does not support WebGPU, which is required for private on-device AI. Search results can still be read below. Try the latest Chrome on a computer with GPU acceleration enabled.');
 if(location.protocol!=='https:'&&location.hostname!=='localhost')throw Error('Private AI needs an HTTPS website.');
 const adapter=await navigator.gpu.requestAdapter().catch(()=>null);
 if(!adapter)throw Error('No compatible GPU adapter is available. Enable hardware acceleration in Chrome, or use the reference search results without AI.');
 if(!modelPromise){
  modelPromise=(async()=>{
   update('Preparing local AI runtime…');
   const mod=await import('https://esm.run/@mlc-ai/web-llm');
   update('Downloading the compact open-source language model to this browser (first use only).');
   return await mod.CreateMLCEngine(MODEL,{initProgressCallback:p=>{
    const percent=typeof p?.progress==='number'?' '+Math.floor(p.progress*100)+'%':'';
    update((p?.text||'Loading local model…')+percent);
   }});
  })().catch(e=>{modelPromise=null;throw e});
 }
 const engine=await modelPromise;
 const facts=(Array.isArray(sources)?sources:[]).slice(0,6).map((x,i)=>'['+(i+1)+'] '+x.title+'\n'+(x.snippet||'')+'\nSource: '+x.source+' '+x.url).join('\n\n');
 const system='You are THE LOUNGE private, on-device AI search assistant. Respond clearly and factually. Today is '+new Date().toISOString().slice(0,10)+'. You have no direct live web access. Use ONLY the provided source excerpts for up-to-date or niche factual claims; cite sources as [1], [2]. Say when source evidence is missing. Never invent citations or claim to have browsed sites. If there are no sources, answer from general knowledge with a prominent caveat that it has not been verified live. The small local model may be inaccurate.';
 const user='Question: '+question+'\n\nAvailable reference search results:\n'+(facts||'No verified reference search results were available.')+'\n\nProvide a helpful answer, under 260 words. If no sources were found, be explicit that it is based on general model knowledge.';
 update('Generating your answer privately inside this browser…');
 const response=await engine.chat.completions.create({messages:[{role:'system',content:system},{role:'user',content:user}],temperature:0.25,max_tokens:440,stream:false});
 const output=String(response?.choices?.[0]?.message?.content||'').trim();
 if(!output)throw Error('The local model did not produce an answer. Please try a shorter question.');
 return {answer:output,model:MODEL,onDevice:true}
}
