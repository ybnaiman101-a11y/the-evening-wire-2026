import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('public/lounge.html'),js=read('public/lounge.js'),pulse=read('public/reactions.js'),css=read('public/lounge.css');
const topics=['general','politics','jewish','world','history','economics','science','questions'];
test('All seven Lounge tabs are real navigable links that route to a valid page',()=>{
 assert.match(html,/<title>THE LOUNGE/);
 for(const page of ['home','pulse','rooms','polls','friends','discover','profile']){
   assert.match(html,new RegExp('<a data-page="'+page+'" href="/#'+page+'"'));
   assert.match(js,new RegExp("'"+page+"'"));
 }
 assert.doesNotMatch(html,/<button data-page=/);
 assert.doesNotMatch(html,/data-page="media"|Photos &amp; Videos/);
 assert.match(js,/addEventListener\('hashchange',navigate\)/);
 assert.match(js,/nav.addEventListener\('click'/);
 assert.match(js,/addEventListener\('popstate',navigate\)/);
 assert.match(html,/id="commandDesk"/);
 assert.match(html,/\/reactions\.js\?v=10/);
 assert.match(html,/\/lounge\.js\?v=3/);
});
test('Discussion rooms are politics, Jewish life and meaningful conversations',()=>{
 assert.doesNotThrow(()=>new Script(js,{filename:'public/lounge.js'}));
 assert.doesNotThrow(()=>new Script(pulse,{filename:'public/reactions.js'}));
 const server=read('community.mjs'),ext=read('community-v2.mjs');
 for(const topic of topics)for(const source of [js,pulse,server,ext])assert.match(source,new RegExp("'"+topic+"'"));
 for(const forbidden of ['sports','movies','gaming'])for(const source of [js,pulse,server,ext])assert.doesNotMatch(source,new RegExp("'"+forbidden+"'"));
 assert.doesNotMatch(js,/async function mediaPage\(/);
 assert.match(pulse,/\/api\/community\/posts\?scope=social/);
 assert.match(js,/\/api\/community\/posts\?scope=social/);
 assert.match(server,/site_section='social'/);
 assert.match(server,/socialTopics\.includes\(topic\)\?'social':'legacy'/);
 assert.match(ext,/DEFAULT 'legacy'/);
});
test('Accounts, polls, profile photos, messages and nested replies remain functional',()=>{
 assert.match(js,/\/api\/community\/polls\?scope=social/);
 assert.match(js,/\/api\/lounge\/visibility/);
 assert.match(js,/\/api\/members\/avatar/);
 assert.match(js,/\/api\/members\/profile/);
 assert.match(js,/\/api\/members\/logout/);
 assert.match(pulse,/hub4-member-photo/);
 assert.match(pulse,/host\.onpaste=async e=>/);
 assert.match(pulse,/data-hub-record-start="1"/);
 assert.match(css,/\.lounge-nav a/);
 assert.match(css,/repeat\(8,minmax\(0,1fr\)\)/);
});
test('Login and privacy pages still serve THE LOUNGE',()=>{
 const login=read('public/login.html'),about=read('public/about-security.html'),server=read('server.mjs');
 assert.match(login,/Sign in · THE LOUNGE/);
 assert.match(login,/FOUR-DIGIT SIGN-IN PIN/);
 assert.match(login,/Remember this device for 90 days/);
 assert.match(about,/Friends directory is optional/);
 assert.match(server,/return res\.end\(loungePage\)/);
});

test('Clubhouse includes working navigation for all twelve additions',()=>{
 const page=read('public/club.html'),app=read('public/club.js'),server=read('server.mjs'),club=read('club.mjs');
 assert.doesNotThrow(()=>new Script(app,{filename:'public/club.js'}));
 for(const feature of ['debate','polls','leaderboard','quiz','predictions','rooms','profiles','news','trending','history','questions','owner']){
   assert.match(page,new RegExp('href="#'+feature+'"'));
   assert.match(app,new RegExp("'"+feature+"'"));
 }
 assert.match(html,/href="\/club"/);
 assert.match(js,/href="\/club"/);
 assert.match(server,/u\.pathname==='\/club'/);
 assert.match(server,/clubRoute\(req,res,u\.pathname\)/);
 assert.match(server,/const publicAsset=.*'\/club\.js'/);
 for(const required of ['club_posts','club_polls','club_poll_votes','club_predictions','club_prediction_votes','club_quiz_answers','club_profiles']){
   assert.ok(club.includes(required),required+' persists in PostgreSQL');
 }
 assert.match(club,/authenticatedMember\(req\)/);
 assert.match(club,/isEditorAdmin\(req\)/);
 assert.match(club,/api\/club\/news/);
 assert.match(club,/api\/club\/history/);
 assert.match(page,/The Pulse/);
 assert.doesNotMatch(page,/Sports|Gaming|Movies/i);
});

test('All Clubhouse tab controls have a direct route, render fallback, and accessible sidebar',()=>{
 const page=read('public/club.html'),app=read('public/club.js'),styles=read('public/club.css');
 for(const feature of ['home','debate','polls','leaderboard','quiz','predictions','rooms','profiles','news','trending','history','questions','owner']){
   assert.match(page,new RegExp('href="#'+feature+'"'));
 }
 assert.match(app,/event.target.closest\('a\[href\^="#"\]'\)/);
 assert.match(app,/history.pushState\(null,''/);
 assert.match(app,/window.addEventListener\('popstate',render\)/);
 assert.match(app,/Clubhouse tab render failed/);
 assert.match(styles,/max-height:calc\(100dvh - 82px\)/);
 assert.match(styles,/overflow-y:auto/);
 assert.match(styles,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(styles,/hero::after\{content:none!important\}/);
 assert.match(css,/lounge-welcome::after\{content:none!important\}/);
});
