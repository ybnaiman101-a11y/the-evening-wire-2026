import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('public/lounge.html'),js=read('public/lounge.js'),css=read('public/lounge.css');
test('THE LOUNGE is the new social homepage without election navigation',()=>{
 assert.match(html,/<title>THE LOUNGE/);
 for(const p of ['home','pulse','rooms','media','polls','friends','discover','profile'])assert.match(html,new RegExp('data-page="'+p+'"'));
 assert.doesNotMatch(html,/data-page="senate"|data-page="house"|data-page="governors"|data-page="calls"/i);
 assert.doesNotMatch(html,/Election Night 2026|LIVE NUMERICAL RESULTS|Newsroom Control/i);
 assert.match(html,/id="commandDesk"/);
 assert.match(html,/\/reactions\.js\?v=9/);
 assert.match(html,/\/lounge\.js\?v=1/);
});
test('social frontend parses and keeps media, friends, polls and existing member accounts',()=>{
 assert.doesNotThrow(()=>new Script(js,{filename:'public/lounge.js'}));
 assert.match(js,/window\.EWReactions\?\.open/);
 assert.match(js,/\/api\/community\/posts\?scope=social/);
 assert.match(js,/\/api\/community\/polls\?scope=social/);
 assert.match(js,/\/api\/lounge\/visibility/);
 assert.match(js,/\/api\/lounge\/follow/);
 assert.match(js,/\/api\/members\/avatar/);
 assert.match(js,/\/api\/members\/profile/);
 assert.match(js,/\/api\/members\/logout/);
});
test('rebranded Pulse uses everyday rooms while preserving stored media and nested replies',()=>{
 const pulse=read('public/reactions.js');
 assert.doesNotThrow(()=>new Script(pulse,{filename:'public/reactions.js'}));
 for(const topic of ['sports','movies','music','gaming','questions','random'])assert.match(pulse,new RegExp("'"+topic+"'"));
 assert.match(pulse,/\/api\/community\/posts\?scope=social/);
 assert.match(pulse,/\/api\/community\/polls\?scope=social/);
 assert.match(pulse,/hub4-member-photo/);
 assert.match(pulse,/host\.onpaste=async e=>/);
 assert.match(pulse,/data-hub-record-start="1"/);
 assert.doesNotMatch(pulse,/id="hubRaceWrap"/);
 assert.match(css,/\.lounge-nav/);
});
test('old election records stay in the database but cannot enter the social timeline',()=>{
 const community=read('community.mjs'),ext=read('community-v2.mjs');
 assert.match(community,/site_section='social'/);
 assert.match(community,/socialTopics\.includes\(topic\)\?'social':'legacy'/);
 assert.match(ext,/ADD COLUMN IF NOT EXISTS site_section/);
 assert.match(ext,/DEFAULT 'legacy'/);
 assert.match(ext,/kind='social'/);
});
test('sign-in and privacy pages use THE LOUNGE, with truthful public-post disclosures',()=>{
 const login=read('public/login.html'),about=read('public/about-security.html'),server=read('server.mjs');
 assert.match(login,/Sign in · THE LOUNGE/);
 assert.match(login,/FOUR-DIGIT SIGN-IN PIN/);
 assert.match(login,/Remember this device for 90 days/);
 assert.match(login,/\/#pulse/);
 assert.match(about,/Posts, replies, images, videos, voice notes/);
 assert.match(about,/Friends directory is optional/);
 assert.match(server,/return res\.end\(loungePage\)/);
 assert.match(server,/microphone=\(self\)/);
 assert.match(server,/media-src 'self' blob:/);
});
