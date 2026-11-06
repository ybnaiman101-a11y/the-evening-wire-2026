import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isBillingExhausted,publicAIProblem,recordOpenAIProblem,clearOpenAIProblem,currentOpenAIHealth} from '../ai-health.mjs';

test('OpenAI exhausted credits are not misreported as a generic rate limit',()=>{
 assert.equal(isBillingExhausted(429,'credit_balance_exhausted'),true);
 assert.equal(isBillingExhausted(429,'rate_limit_exceeded'),false);
 assert.match(publicAIProblem(429,'credit_balance_exhausted','chat'),/API credit balance is exhausted/);
 assert.match(publicAIProblem(429,'credit_balance_exhausted','image'),/cannot generate images/);
 assert.match(publicAIProblem(429,'rate_limit_exceeded','chat'),/rate limit/);
 recordOpenAIProblem(429,'credit_balance_exhausted','image');
 assert.equal(currentOpenAIHealth().billingRequired,true);
 clearOpenAIProblem();
 assert.equal(currentOpenAIHealth().billingRequired,false);
});
test('AI Studio has one scrolling page and no independent chat scrollbar or sticky composer',()=>{
 const css=readFileSync(new URL('../public/lounge.css',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/ask-ai.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/lounge.html',import.meta.url),'utf8');
 assert.match(css,/body\[data-ew-view="ai"\] \.ai-conversation\s*\{[^}]*max-height:none!important/);
 assert.match(css,/body\[data-ew-view="ai"\] \.ai-conversation\s*\{[^}]*overflow-y:visible!important/);
 assert.match(css,/body\[data-ew-view="ai"\] \.ai-composer\s*\{[^}]*position:static!important/);
 assert.doesNotMatch(js,/\.scrollTop\s*=/);
 assert.match(js,/scrollIntoView/);
 assert.match(js,/Add OpenAI API credits/);
 assert.match(html,/\/ask-ai\.js\?v=6/);
 assert.match(html,/\/lounge\.css\?v=8/);
});
