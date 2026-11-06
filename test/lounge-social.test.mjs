import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('public/lounge.html'),js=read('public/lounge.js'),pulse=read('public/reactions.js'),css=read('public/lounge.css');
const topics=['general','politics','jewish','world','history','economics','science','questions'];
test('All ten Lounge tabs are real navigable links that route to a valid page',()=>{
 assert.match(html,/<title>THE LOUNGE/);
 for(const page of ['home','pulse','rooms','polls','friends','discover','ai','profile','owner']){
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
 assert.match(html,/\/lounge\.js\?v=6/);
 assert.match(html,/\/ask-ai\.js\?v=10/);
 assert.match(html,/\/owner\.js\?v=1/);
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
 assert.match(css,/repeat\(10,minmax\(0,1fr\)\)/);
});
test('Login and privacy pages still serve THE LOUNGE',()=>{
 const login=read('public/login.html'),about=read('public/about-security.html'),server=read('server.mjs');
 assert.match(login,/Sign in · THE LOUNGE/);
 assert.match(login,/FOUR-DIGIT SIGN-IN PIN/);
 assert.match(login,/Remember this device for 90 days/);
 assert.match(about,/Friends directory is optional/);
 assert.match(server,/return res\.end\(loungePage\)/);
});

test('Clubhouse includes ten features and links to main Owner and Member Profiles tabs',()=>{
 const page=read('public/club.html'),app=read('public/club.js'),server=read('server.mjs'),club=read('club.mjs');
 assert.doesNotThrow(()=>new Script(app,{filename:'public/club.js'}));
 for(const feature of ['debate','polls','leaderboard','quiz','predictions','rooms','news','trending','history','questions']){
   assert.match(page,new RegExp('href="#'+feature+'"'));
   assert.match(app,new RegExp("'"+feature+"'"));
 }
 assert.match(html,/href="\/club"/);
 assert.match(js,/href="\/club"/);
 assert.match(server,/u\.pathname==='\/club'/);
 assert.match(server,/clubRoute\(req,res,u\.pathname,stories\)/);
 assert.match(server,/const publicAsset=.*'\/club\.js'/);
 for(const required of ['club_posts','club_polls','club_poll_votes','club_predictions','club_prediction_votes','club_quiz_answers','club_profiles']){
   assert.ok(club.includes(required),required+' persists in PostgreSQL');
 }
 assert.match(club,/authenticatedMember\(req\)/);
 assert.match(club,/isEditorAdmin\(req\)/);
 assert.match(club,/api\/club\/news/);
 assert.match(club,/api\/club\/history/);
 assert.match(page,/The Pulse/);
 assert.match(page,/href="\/#owner"/);
 assert.match(page,/href="\/#profile"/);
 assert.doesNotMatch(page,/data-tab="owner"|data-tab="profiles"/);
 assert.match(html,/data-page="owner"/);
 assert.match(html,/data-page="profile"/);
 const owner=read('public/owner.js');
 assert.doesNotThrow(()=>new Script(owner,{filename:'public/owner.js'}));
 for(const required of ['/api/admin/members','/api/traffic/summary','/api/community/admin/announcement','/api/community/admin/posts/','/api/club/dashboard']){
  assert.ok(owner.includes(required),'Owner dashboard uses '+required);
 }
 assert.doesNotMatch(page,/Sports|Gaming|Movies/i);
});

test('All Clubhouse tab controls have a direct route, render fallback, and accessible sidebar',()=>{
 const page=read('public/club.html'),app=read('public/club.js'),styles=read('public/club.css');
 for(const feature of ['home','debate','polls','leaderboard','quiz','predictions','rooms','news','trending','history','questions']){
   assert.match(page,new RegExp('href="#'+feature+'"'));
 }
 assert.match(app,/event.target.closest\('a\[href\^="#"\]'\)/);
 assert.match(app,/window\.history\.pushState\(null,''/);
 assert.doesNotMatch(app,/[^.]history\.pushState\(null,''/);
 assert.match(app,/function historyPage\(\)/);
 assert.match(app,/window.addEventListener\('popstate',render\)/);
 assert.match(app,/Clubhouse tab render failed/);
 assert.match(styles,/max-height:calc\(100dvh - 82px\)/);
 assert.match(styles,/overflow-y:auto/);
 assert.match(styles,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(styles,/hero::after\{content:none!important\}/);
 assert.match(css,/lounge-welcome::after\{content:none!important\}/);
});

test('AI Search uses the OpenAI API and never imports the failed browser model',()=>{
 const ask=read('public/ask-ai.js'),server=read('server.mjs'),api=read('ask-ai.mjs');
 assert.doesNotThrow(()=>new Script(ask,{filename:'public/ask-ai.js'}));
 assert.match(html,/data-page="ai"/);
 assert.match(html,/ask-ai\.js\?v=10/);
 assert.match(js,/LoungeAI\.open\(\)/);
 assert.doesNotMatch(ask,/chatgpt\.com/);
 assert.match(ask,/\/api\/ask-ai/);
 assert.match(ask,/\/api\/ask-ai\/status/);
 assert.match(ask,/\/api\/ask-ai\/image/);
 assert.match(ask,/data-ai-mode="image"/);
 assert.match(ask,/data-chat-new/);
 assert.match(ask,/data-chat-more/);
 assert.match(ask,/rotateIdeas/);
 assert.match(ask,/lounge_chat_suggestion_index_v1_/);
 assert.match(ask,/Recent chats/);
 assert.match(ask,/lounge_chat_threads_v1/);
 assert.match(ask,/function markdown/);
 assert.match(ask,/ai-conversation/);
 assert.match(ask,/Download PNG/);
 assert.match(server,/generateLoungeImage/);
 assert.match(api,/gpt-6\.1-sol/);
 assert.match(read('lounge-images.mjs'),/gpt-image-2\.6-sunburst/);
 assert.doesNotMatch(ask,/local-ai\.js|web-llm|navigator\.gpu/);
 assert.doesNotMatch(ask,/api\/ai-search|Reference search results|ai-references|ai-source/);
 assert.match(server,/askAIRoute/);
 assert.match(server,/aiSearchRoute/);
 assert.match(server,/local-ai\.js/);
 const local=read('public/local-ai.js'),search=read('ai-search.mjs');
 assert.match(local,/CreateMLCEngine/);
 assert.match(local,/navigator\.gpu/);
 assert.match(local,/max_tokens/);
 assert.match(search,/Wikipedia/);
 assert.match(search,/Wikidata/);
 assert.match(css,/overflow-wrap:anywhere/);
 assert.match(api,/OPENAI_API_KEY/);
 assert.match(api,/authenticatedMember/);
 assert.doesNotMatch(ask,/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/);
});
test('History reader and standalone quiz work independently of the old history endpoint',()=>{
 const client=read('public/club.js'),back=read('club.mjs');
 assert.match(client,/api\/club\/daily/);
 assert.match(back,/quizToday\(\)/);
 assert.match(back,/historicalEventsReader/);
 assert.match(client,/historyReload/);
 assert.match(client,/\/api\/club\/history/);
 assert.match(client,/historymark/);
});

test('On This Day has a verified source-linked on-device fallback and instant API path',()=>{
 const app=read('public/club.js'),history=read('history-reader.mjs'),backend=read('club.mjs');
 assert.match(app,/NOVEMBER5_HISTORY/);
 assert.match(app,/usingBackup/);
 assert.match(app,/Associated Press/);
 assert.match(history,/immediate/);
 assert.match(backend,/immediate:!force/);
 assert.match(read('public/club.html'),/club\.js\?v=8/);
});
