import test from 'node:test';
import assert from 'node:assert/strict';
import {aiStatus,openAIRequest,readAIAnswer} from '../ask-ai.mjs';
test('AI status is not active when no secret exists',()=>{
 const previous=process.env.OPENAI_API_KEY;
 delete process.env.OPENAI_API_KEY;
 try{assert.equal(aiStatus().available,false)}
 finally{if(previous!==undefined)process.env.OPENAI_API_KEY=previous}
});
test('OpenAI Responses API payload uses current supported model and disables storage',()=>{
 const result=openAIRequest({question:'What is the capital of Australia?'},'gpt-5.4-mini','2026-11-05');
 assert.equal(result.model,'gpt-5.4-mini');
 assert.equal(result.store,false);
 assert.equal(result.input.length,1);
});
test('OpenAI output parser reads generated text',()=>{
 assert.equal(readAIAnswer({output:[{type:'message',content:[{type:'output_text',text:'Canberra.'}]}]}),'Canberra.');
 assert.equal(readAIAnswer({output:[]}), '');
});
