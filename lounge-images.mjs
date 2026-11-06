// Premium image generation for THE LOUNGE.
// Calls OpenAI from the server; browser clients never receive the API key.
import {authenticatedMember} from './members.mjs';
import {isEditorAdmin} from './editor-calls.mjs';

const IMAGE_ENDPOINT='https://api.openai.com/v1/images/generations';
export const IMAGE_MODEL='gpt-image-2.6-sunburst';
const dailyQuota=new Map();
const MAX_IMAGES_PER_DAY=3;
const json=(res,status,body)=>{
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify(body));
};
export function imageRequest(prompt,size='1024x1024',model=IMAGE_MODEL){
 const allowedSizes=new Set(['1024x1024','1536x1024','1024x1536']);
 if(typeof prompt!=='string'||prompt.trim().length<10||prompt.length>2200)throw Error('Please describe your image in 10–2,200 characters.');
 if(!allowedSizes.has(size))throw Error('Choose square, landscape, or portrait.');
 return {model,prompt:prompt.trim(),n:1,size,quality:'high',complexity:'high',output_format:'png',background:'opaque'};
}
export function decodeImageResponse(data){
 const item=Array.isArray(data?.data)?data.data[0]:null;
 const encoded=item?.b64_json;
 if(typeof encoded!=='string'||encoded.length<100||!/^[a-zA-Z0-9+/=]+$/.test(encoded))throw Error('OpenAI did not return a valid image.');
 const buffer=Buffer.from(encoded,'base64');
 if(buffer.length<64||buffer.length>18*1024*1024)throw Error('The returned image was invalid or too large.');
 if(!buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw Error('OpenAI returned an unexpected image format.');
 return buffer;
}
async function body(req){
 let raw='';
 for await(const chunk of req){
  raw+=chunk;
  if(raw.length>5500)throw Error('Image request too long.');
 }
 let data;try{data=JSON.parse(raw||'{}')}catch{throw Error('Invalid image request.')}
 return imageRequest(data.prompt,data.size||'1024x1024',process.env.OPENAI_IMAGE_MODEL||IMAGE_MODEL);
}
function spendSlot(id){
 const day=new Date().toISOString().slice(0,10),state=dailyQuota.get(id);
 const count=state?.day===day?state.count:0;
 if(count>=MAX_IMAGES_PER_DAY)return false;
 dailyQuota.set(id,{day,count:count+1});
 return true;
}
function rollback(id){
 const state=dailyQuota.get(id);
 if(state&&state.count>0)state.count--;
}
setInterval(()=>{const day=new Date().toISOString().slice(0,10);for(const [id,x] of dailyQuota)if(x.day!==day)dailyQuota.delete(id)},3600000).unref();

export async function generateLoungeImage(req,res,path){
 if(path!=='/api/ask-ai/image'||req.method!=='POST'){json(res,404,{error:'Not found'});return true;}
 const origin=req.headers.origin;
 if(origin&&origin!=='https://'+req.headers.host&&origin!=='http://'+req.headers.host){
  json(res,403,{error:'Origin not allowed.'});return true;
 }
 const key=(process.env.OPENAI_API_KEY||'').trim();
 if(!key){json(res,503,{error:'OpenAI is not connected to this Lounge service.'});return true;}
 const member=await authenticatedMember(req);
 const owner=!member&&isEditorAdmin(req);
 if(!member&&!owner){json(res,401,{error:'Sign in as a Lounge member or owner to create images.'});return true;}
 let request;try{request=await body(req)}catch(e){json(res,400,{error:e.message});return true;}
 const identity=member?.id||'admin-owner';
 if(!spendSlot(identity)){json(res,429,{error:'Daily image limit reached: 3 images per member. Try again tomorrow.'});return true;}
 try{
  const response=await fetch(IMAGE_ENDPOINT,{
   method:'POST',signal:AbortSignal.timeout(130000),
   headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify(request)
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok){
   rollback(identity);
   const code=String(data?.error?.code||data?.error?.type||'unknown').slice(0,90);
   console.warn('LOUNGE_IMAGE_API_ERROR',JSON.stringify({status:response.status,code}));
   let reason='Image generation could not be completed. Please try again.';
   if(response.status===401)reason='The OpenAI API key was rejected. Please check the Railway key.';
   if(response.status===403||response.status===404)reason='Your OpenAI API project may not have access to this image model.';
   if(response.status===429)reason='OpenAI image generation has reached a rate or billing limit.';
   if(response.status===400)reason='OpenAI rejected the image request or this model setting.';
   json(res,502,{error:reason});return true;
  }
  const png=decodeImageResponse(data);
  res.writeHead(200,{
   'Content-Type':'image/png',
   'Content-Length':String(png.length),
   'Cache-Control':'private, no-store',
   'Content-Disposition':'inline; filename="lounge-ai-image.png"',
   'X-Lounge-Image-Model':request.model,
   'X-Content-Type-Options':'nosniff'
  });
  res.end(png);
  return true;
 }catch(error){
  rollback(identity);
  console.error('LOUNGE_IMAGE_API_FAILED',String(error?.message||error).slice(0,150));
  json(res,503,{error:'Image generation failed or timed out. No image was delivered.'});return true;
 }
}
