// THE LOUNGE / Ask AI.
// No API credentials are sent to the browser. Actual AI replies require
// OPENAI_API_KEY configured securely in the Railway service Variables.
import {authenticatedMember} from './members.mjs';
const endpoint='https://api.openai.com/v1/responses';
const bucket=new Map();
const allowedOrigin=req=>!req.headers.origin||req.headers.origin==='https://'+req.headers.host||req.headers.origin==='http://'+req.headers.host;
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
export function aiStatus(){return {available:!!(process.env.OPENAI_API_KEY||'').trim(),requiresMemberLogin:true,provider:'OpenAI',externalUrl:'https://chatgpt.com/',message:process.env.OPENAI_API_KEY?'Ask AI is ready.':'AI answers inside The Lounge require an OpenAI API key in Railway Variables. You can still ask in ChatGPT.'}}
const take=(memberId)=>{
 const now=Date.now(),windowMs=3600000;
 const v=bucket.get(memberId)||{start:now,count:0};
 if(now-v.start>windowMs){v.start=now;v.count=0}
 bucket.set(memberId,v);
 if(v.count>=12)return false;
 v.count++;return true;
};
setInterval(()=>{for(const [id,v] of bucket)if(Date.now()-v.start>7200000)bucket.delete(id)},900000).unref();
const read=async(req)=>{
 let raw='';
 for await(const chunk of req){raw+=chunk;if(raw.length>4500)throw Error('Question too long')}
 let x;try{x=JSON.parse(raw||'{}')}catch{throw Error('Invalid question')}
 const question=String(x.question||'').trim();
 if(question.length<3||question.length>2000)throw Error('Please enter a question of 3–2,000 characters.');
 return question;
};
export async function askAIRoute(req,res,path){
 if(path==='/api/ask-ai/status'&&req.method==='GET'){json(res,200,aiStatus());return true}
 if(path!=='/api/ask-ai'||req.method!=='POST'){json(res,404,{error:'Not found'});return true}
 if(!allowedOrigin(req)){json(res,403,{error:'Origin not allowed'});return true}
 const key=(process.env.OPENAI_API_KEY||'').trim();
 if(!key){json(res,503,{error:'AI is not connected inside The Lounge yet. The site owner must configure OPENAI_API_KEY in Railway. You can open ChatGPT and ask your question there.',chatgpt:'https://chatgpt.com/'});return true}
 const member=await authenticatedMember(req);
 if(!member){json(res,401,{error:'Sign in to use Ask AI within The Lounge.',login:'/login'});return true}
 if(!take(member.id)){json(res,429,{error:'Hourly Ask AI limit reached. Try again later.'});return true}
 let question;
 try{question=await read(req)}catch(err){json(res,400,{error:err.message});return true}
 try{
  const response=await fetch(endpoint,{
   method:'POST',signal:AbortSignal.timeout(30000),
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({
    model:process.env.OPENAI_MODEL||'gpt-6-astra',
    store:false,
    instructions:'You are the friendly AI assistant for THE LOUNGE, a social discussion website. Respond helpfully and accurately, distinguish facts from speculation, be fair-minded on politics, and avoid making up current news or sources. Brief but substantive answers. The current calendar date is '+new Date().toISOString().slice(0,10)+'.',
    input:question,max_output_tokens:1500
   })
  });
  const value=await response.json().catch(()=>null);
  if(!response.ok){
   console.warn('LOUNGE_AI_PROVIDER_FAILURE',response.status,typeof value?.error?.code==='string'?value.error.code:'unknown');
   json(res,502,{error:'The AI service is unavailable at the moment. Please try again or use ChatGPT.'});return true
  }
  const output=(Array.isArray(value?.output)?value.output:[]).filter(x=>x?.type==='message').flatMap(x=>Array.isArray(x.content)?x.content:[]).filter(x=>x?.type==='output_text'&&typeof x.text==='string').map(x=>x.text).join('\n\n').trim();
  if(!output){json(res,502,{error:'The AI did not return a readable answer. Please try again.'});return true}
  json(res,200,{answer:output.slice(0,10000),provider:'OpenAI',note:'AI-generated answers can contain mistakes. Verify important facts.'});return true
 }catch(err){
  console.error('LOUNGE_AI_REQUEST_FAILED',String(err?.message||err).slice(0,140));
  json(res,503,{error:'AI connection timed out or failed. Please try ChatGPT directly.'});return true
 }
}
