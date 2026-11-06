import test from 'node:test';
import assert from 'node:assert/strict';
import {imageRequest,decodeImageResponse,IMAGE_MODEL} from '../lounge-images.mjs';
import {openAIRequest} from '../ask-ai.mjs';

test('Premium chat uses GPT-6 Astra with high reasoning, storage disabled, useful output allowance',()=>{
 const request=openAIRequest({question:'Explain the causes of the Roman Empire collapse.'});
 assert.equal(request.model,'gpt-6-astra');
 assert.equal(request.reasoning.effort,'high');
 assert.equal(request.store,false);
 assert.ok(request.max_output_tokens>=4000);
 assert.match(request.instructions,/detailed|detail/i);
});
test('Premium image requests use GPT Image 2.6 Sunburst with high quality',()=>{
 const request=imageRequest('A breathtaking ultra-realistic cinematic view of ancient Rome at sunset.');
 assert.equal(request.model,'gpt-image-2.6-sunburst');
 assert.equal(IMAGE_MODEL,request.model);
 assert.equal(request.quality,'high');
 assert.equal(request.complexity,'high');
 assert.equal(request.output_format,'png');
 assert.equal(request.size,'1024x1024');
 assert.equal(request.n,1);
});
test('Image output respects fixed safe aspect ratios and rejects invalid prompts',()=>{
 assert.equal(imageRequest('A world map poster with accurate geography', '1536x1024').size,'1536x1024');
 assert.equal(imageRequest('A vertical portrait of the Capitol at night', '1024x1536').size,'1024x1536');
 assert.throws(()=>imageRequest('short'),/10/);
 assert.throws(()=>imageRequest('A proper scene description','9999x9999'),/Choose/);
});
test('Image decoder validates PNG signature and rejects corrupt output',()=>{
 const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(160)]);
 assert.equal(decodeImageResponse({data:[{b64_json:png.toString('base64')}]}).length,png.length);
 assert.throws(()=>decodeImageResponse({data:[{b64_json:Buffer.alloc(168).toString('base64')}]}),/unexpected image format/);
});
