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
test('compact live results copy retains the factual counting vs calling distinction',()=>{
 assert.match(html,/LIVE.*VOTE TOTALS/);
 assert.match(html,/function liveNumbersBoard\(office\)/);
 assert.match(html,/Leads are not race calls/);
 assert.doesNotMatch(html,/LIVE NUMERICAL RESULTS:/);
});
test('The Pulse supports clipboard images and a full-page reading layout',()=>{
 const app=readFileSync(new URL('../public/reactions.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/reaction-hub-v2.css',import.meta.url),'utf8');
 assert.match(app,/host\.onpaste=async e=>/);
 assert.match(app,/clipboardData\?\.items/);
 assert.match(app,/attachPicture\(images\[0\]/);
 assert.match(app,/host\.ondrop=async e=>/);
 assert.match(css,/max-height:none!important/);
 assert.match(html,/body\[data-ew-view="reactions"\] #commandDesk/);
});

test('THE PULSE is reachable immediately from the masthead and first navigation position',()=>{
 assert.match(html,/class="ew-pulse-quick" data-ew-pulse-shortcut="1"/);
 assert.match(html,/<nav class="command-nav"[^>]*><button[^>]*data-ew-tab="reactions"/);
 assert.match(html,/data-ew-pulse-shortcut.*addEventListener\('click',\(\)=>go\('reactions'\)\)/);
});
test('voice notes remain in processing state until browser audio conversion completes',()=>{
 const app=readFileSync(new URL('../public/reactions.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Script(app,{filename:'public/reactions.js'}));
 assert.match(app,/voiceProcessing=true;voiceButtons\(\)/);
 assert.match(app,/finally\{voiceProcessing=false;voiceButtons\(\)\}/);
 assert.match(app,/voiceRecorder\|\|voiceProcessing/);
 assert.match(app,/if\(voiceRecorder\|\|voiceProcessing\)throw Error/);
 assert.match(app,/class="hub2-panel hub4-composer"/);
});


test('Command Center 4.0 header uses original logo with accessible responsive navigation',()=>{
 assert.match(html,/class="brand ew-integrated-brand ew-uploaded-logo"/);
 assert.match(html,/id="ewV4MoreButton"[^>]*aria-expanded="false"/);
 assert.match(html,/id="ewV4MoreMenu"[^>]*role="menu" hidden/);
 assert.match(html,/data-ew-tab="reactions"/);
 assert.doesNotMatch(html,/data-ew-tab="reactions"[^<]*<span class="num">14<\/span>/);
 for(const tab of ['hq','news','senate','house','governor','calls','reactions','battleground','states','turnout','sources','mydesk','swing','predictions','members','traffic']){
  assert.match(html,new RegExp('data-ew-tab="'+tab+'"'),'Expected preserved destination '+tab);
 }
 assert.match(html,/const v4nav=document.querySelector/);
 assert.match(html,/e.key==='Escape'/);
 assert.match(html,/id="ewV4UsMap"/);
 assert.match(html,/\/api\/geo\/states/);
});
test('Pulse 4.0 puts posting at left, feed in center, editorial race calls at right',()=>{
 const app=readFileSync(new URL('../public/reactions.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/reaction-hub-v2.css',import.meta.url),'utf8');
 assert.match(app,/hub4-columns/);
 assert.match(app,/hub4-left/);
 assert.match(app,/hub4-center/);
 assert.match(app,/hub4-right/);
 assert.match(app,/hub4-race-panel/);
 assert.match(app,/hub4-media-actions/);
 assert.match(app,/data-hub-pick="photo"/);
 assert.match(app,/data-hub-pick="video"/);
 assert.match(app,/data-hub-record-start="1"/);
 assert.match(app,/data-hub-pick="audio"/);
 assert.match(app,/data-hub-mobile-open="compose"/);
 assert.match(app,/data-hub-mobile-open="calls"/);
 assert.match(css,/grid-template-columns:minmax\(220px,.8fr\) minmax\(0,3fr\) minmax\(230px,.8fr\)/);
 assert.match(css,/#hubFeed\{height:auto!important/);
 assert.match(css,/data-drawer="rooms"/);
});
test('Source-free editorial race calls still work on maps',()=>{
 const map=readFileSync(new URL('../public/election-maps.js',import.meta.url),'utf8');
 assert.match(map,/Evening Wire call:/);
 assert.match(map,/Owner editorial call/);
 assert.doesNotMatch(map,/sourceName\.trim\(\)&&typeof c\.sourceUrl/);
});
