// Small in-memory health indicator for OpenAI usage on The Lounge.
// Exposes no credentials or member data and never prevents trying again after top-up.
let lastProblem=null;
export const BILLING_URL='https://platform.openai.com/settings/organization/billing/overview';
export function isBillingExhausted(status,code){
 const c=String(code||'').toLowerCase();
 return status===429&&(/credit_balance_exhausted|insufficient_quota|billing|hard_limit|quota_exceeded/.test(c));
}
export function publicAIProblem(status,code,kind='chat'){
 if(isBillingExhausted(status,code))return 'Your OpenAI API credit balance is exhausted. The website is connected, but OpenAI cannot generate '+(kind==='image'?'images':'answers')+' until the account owner adds API credits in OpenAI Billing.';
 if(status===429)return 'OpenAI has reached its rate limit. Try again shortly.';
 if(status===401)return 'The OpenAI API key was rejected. Check the saved API key in Railway.';
 if(status===403||status===404)return 'Your OpenAI API project may not have access to this model. Review model access and project settings.';
 if(status===400)return 'OpenAI rejected the request or selected model. The site owner should check the model configuration.';
 if(status>=500)return 'The OpenAI service is temporarily unavailable. Try again shortly.';
 return kind==='image'?'Image generation could not be completed.':'The AI answer could not be completed.';
}
export function recordOpenAIProblem(status,code,kind){
 const billingRequired=isBillingExhausted(status,code);
 lastProblem={at:Date.now(),billingRequired,kind:kind==='image'?'image':'chat'};
}
export function clearOpenAIProblem(){lastProblem=null}
export function currentOpenAIHealth(){
 if(!lastProblem||Date.now()-lastProblem.at>30*60000)return {billingRequired:false};
 return {billingRequired:lastProblem.billingRequired,lastIssue:lastProblem.kind};
}
