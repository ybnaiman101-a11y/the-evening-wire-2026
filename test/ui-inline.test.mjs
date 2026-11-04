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

test('THE PULSE stays in primary navigation with no misleading number',()=>{
 assert.match(html,/class="command-nav command-nav-v4"/);
 assert.match(html,/data-ew-tab="reactions"/);
 assert.match(html,/class="ew-v4-nav-link ew-v4-pulse"/);
 assert.match(html,/id="ewV4MoreButton"/);
 assert.doesNotMatch(html,/data-ew-tab="reactions"[^<]*<span class="num">/);
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
test('THE LOUNGE Pulse keeps posting at left, messages in center and everyday social tools at right',()=>{
 const app=readFileSync(new URL('../public/reactions.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/reaction-hub-v2.css',import.meta.url),'utf8');
 for(const part of ['hub4-columns','hub4-left','hub4-center','hub4-right','lounge-sidebar-welcome','hub4-polls-panel','hub4-media-actions'])
  assert.match(app,new RegExp(part));
 assert.doesNotMatch(app,/id="hubRaceWrap"/);
 assert.match(app,/data-hub-pick="photo"/);
 assert.match(app,/data-hub-pick="video"/);
 assert.match(app,/data-hub-record-start="1"/);
 assert.match(app,/data-hub-pick="audio"/);
 assert.match(app,/data-hub-mobile-open="compose"/);
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


test('Pulse members can set a persistent X-style profile photo for posts and replies',()=>{
 const app=readFileSync(new URL('../public/reactions.js',import.meta.url),'utf8');
 const members=readFileSync(new URL('../public/members.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/reaction-hub-v2.css',import.meta.url),'utf8');
 assert.match(app,/function avatar\(p\)/);
 assert.match(app,/hub4-member-photo/);
 assert.match(app,/p\.avatar_url/);
 assert.match(app,/p\.avatar_url\]/);
 assert.match(members,/ewAvatarFile/);
 assert.match(members,/prepareAvatar\(file\)/);
 assert.match(members,/api\/members\/avatar/);
 assert.match(members,/ewAvatarRemove/);
 assert.match(css,/\.hub4-member-photo/);
 assert.match(css,/\.ew-profile-avatar/);
});
