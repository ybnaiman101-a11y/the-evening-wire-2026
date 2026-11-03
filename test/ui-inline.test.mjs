import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('every inline web page JavaScript block parses after live results integration',()=>{
 const list=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
   .filter(x=>!/\bsrc=/.test(x[1])&&!/\btype\s*=\s*["']module["']/.test(x[1]));
 assert.ok(list.length>=3,'Expected multiple inline JavaScript blocks');
 for(const [i,found] of list.entries()){
  if(found[2].trim())assert.doesNotThrow(()=>new Script(found[2],{filename:'public/index.html:inline-'+(i+1)}));
 }
});
test('live results markup is present without removing owner protections',()=>{
 assert.match(html,/LIVE.*VOTE TOTALS/);
 assert.match(html,/ONLY THE EVENING WIRE ADMINISTRATOR CAN CALL A RACE/);
 assert.match(html,/function liveNumbersBoard\(office\)/);
});
