/* THE EVENING WIRE — Reaction Hub 2.0, non-destructive member community */
(function(){
'use strict';
const host=document.getElementById('commandDesk');if(!host)return;
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=id=>document.getElementById(id),shown=()=>document.body.dataset.ewView==='reactions';
const rooms=[['all','🌎 All Rooms'],['general','💬 National Discussion'],['senate','🏛 Senate Races'],['governors','🗳 Governor Races'],['house','🏛 House Races'],['election-night','⚡ Election Night'],['news','📡 Breaking News']];
const emojis=[['like','👍'],['love','❤️'],['laugh','😂'],['wow','😮'],['usa','🇺🇸'],['fire','🔥']];
const roomName=id=>rooms.find(x=>x[0]===id)?.[1]||'National Discussion';
const clock=x=>{const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'Recently'};
const tone=(x)=>{let h=0;const s=String(x||'');for(let i=0;i<s.length;i++)h=(h*33+s.charCodeAt(i))>>>0;return h%8};
let member=null,owner=false,posts=[],polls=[],calls=[],room='all',search='',replyId=null,editId=null,loading=false,stream=null,liveConnected=false,online=0,unread=0,previousLatest='',lastSignature='',running=false,pendingImageData=null,pendingImageUrl=null,pendingVideoData=null,pendingVideoUrl=null,pendingAudioData=null,pendingAudioUrl=null,voiceRecorder=null,voiceStream=null,voiceTimer=null,voiceLimit=null,discardVoiceOnStop=false,voiceProcessing=false;
function avatar(p){const number=tone(p.member_id||p.name||p.id);return '<span class="hub2-avatar a'+number+'">'+safe(String(p.name||'?').slice(0,1).toUpperCase())+'</span>'}
function requireMember(){if(member)return true;location.href='/login';return false}
async function api(path,method='GET',body){
 const opts={method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined};
 const response=await fetch(path,opts),data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'Unable to complete request');return data
}
function feedback(text){const node=q('hubFeedback');if(node)node.textContent=text||''}
function roleNotice(){return !member?'<div class="hub2-panel"><h2>JOIN THE CONVERSATION</h2><p class="hub2-muted">Sign in to post, reply, or react.</p><a class="hub2-btn" href="/login">SIGN IN OR CREATE ACCOUNT</a></div>':''}

async function preparePicture(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG or WebP picture.');
 if(file.size>12000000)throw Error('Picture too big. Choose a file under 12 MB.');
 const picture=await createImageBitmap(file);
 if(!picture.width||!picture.height||picture.width>20000||picture.height>20000){picture.close();throw Error('Invalid picture dimensions.')}
 try{
  // Resize in browser; images are never sent to a third-party service.
  for(const maxSide of [1600,1280,1024]){
   const scale=Math.min(1,maxSide/Math.max(picture.width,picture.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(picture.width*scale));canvas.height=Math.max(1,Math.round(picture.height*scale));
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('Your browser cannot prepare this picture.');
   ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(picture,0,0,canvas.width,canvas.height);
   for(const quality of [.8,.65,.5]){
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if(blob&&blob.size<=1400000){
     const imageData=await new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read picture'));reader.readAsDataURL(blob);
     });
     return {imageData,imageUrl:URL.createObjectURL(blob),size:blob.size}
    }
   }
  }
  throw Error('Picture could not be compressed under 1.5 MB. Try a smaller picture.')
 }finally{picture.close()}
}
async function attachPicture(file,source='Image'){
 if(!member)throw Error('Sign in to share a picture.');
 feedback('Preparing '+source.toLowerCase()+'…');
 const ready=await preparePicture(file);
 clearPicture();pendingImageData=ready.imageData;pendingImageUrl=ready.imageUrl;
 showPicturePreview();feedback(source+' attached. Add a caption or press SEND MESSAGE.')
}
async function attachMedia(file){
 if(!member)throw Error('Sign in to share media.');
 if(file.type.startsWith('image/'))return attachPicture(file,'Picture');
 if(file.type==='video/mp4'||file.type==='video/webm'){
  feedback('Preparing video…');const ready=await prepareVideo(file);
  clearVideo();pendingVideoData=ready.videoData;pendingVideoUrl=ready.videoUrl;
  showVideoPreview();feedback('Video attached. Press SEND MESSAGE.');return
 }
 if(file.type.startsWith('audio/')||/\.(mp3|m4a|ogg|webm)$/i.test(file.name||'')){
  feedback('Preparing audio…');const ready=await prepareAudioFile(file);
  clearVoice();pendingAudioData=ready.audioData;pendingAudioUrl=ready.audioUrl;
  showVoicePreview();feedback('Voice note attached. Press SEND MESSAGE.');return
 }
 throw Error('Drop a JPG, PNG, WebP, MP4, WebM, MP3, or M4A file.')
}
function clearPicture(){
 if(pendingImageUrl)URL.revokeObjectURL(pendingImageUrl);
 pendingImageData=null;pendingImageUrl=null;
 const field=q('hubPhotoFile');if(field)field.value='';
 const box=q('hubPhotoPreview');if(box){box.hidden=true;box.innerHTML=''}
}
function showPicturePreview(){
 const box=q('hubPhotoPreview');if(!box)return;
 box.hidden=!pendingImageUrl;
 if(!pendingImageUrl){box.replaceChildren();return}
 box.innerHTML='<img id="hubPhotoPreviewImg" alt="Your photo ready to post"><span>📷 Photo attached · Ready to publish</span><button type="button" class="hub2-btn secondary" data-hub-remove-photo="1">REMOVE</button>';
 q('hubPhotoPreviewImg').src=pendingImageUrl
}



async function prepareVideo(file){
 if(!file||!['video/mp4','video/webm'].includes(file.type))throw Error('Please choose an MP4 or WebM video clip.');
 if(file.size<32||file.size>12000000)throw Error('Video clips must be smaller than 12 MB. Shorter clips work best.');
 const videoUrl=URL.createObjectURL(file);
 try{
  // Preserve the original clip for playback; do not strip its audio track.
  const videoData=await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(reader.result);
   reader.onerror=()=>reject(Error('Could not read video file.'));
   reader.readAsDataURL(file)
  });
  if(!videoData.startsWith('data:'+file.type+';base64,'))throw Error('Browser video format was not recognized.');
  return {videoUrl,videoData}
 }catch(err){URL.revokeObjectURL(videoUrl);throw err}
}
function clearVideo(){
 if(pendingVideoUrl)URL.revokeObjectURL(pendingVideoUrl);
 pendingVideoData=null;pendingVideoUrl=null;
 const field=q('hubVideoFile');if(field)field.value='';
 const box=q('hubVideoPreview');if(box){box.hidden=true;box.replaceChildren()}
}
function showVideoPreview(){
 const box=q('hubVideoPreview');if(!box)return;
 box.hidden=!pendingVideoUrl;
 if(!pendingVideoUrl){box.replaceChildren();return}
 box.innerHTML='<div class="hub2-voice-caption"><b>🎬 VIDEO READY</b><small>Video uploads must be under 12 MB.</small></div><video id="hubVideoPreviewPlayer" controls playsinline preload="metadata"></video><button type="button" class="hub2-btn secondary" data-hub-remove-video="1">REMOVE VIDEO</button>';
 q('hubVideoPreviewPlayer').src=pendingVideoUrl
}


async function prepareAudioFile(file){
 const types={'audio/webm':'audio/webm','audio/mp4':'audio/mp4','audio/x-m4a':'audio/mp4','audio/ogg':'audio/ogg','audio/mpeg':'audio/mpeg','audio/mp3':'audio/mpeg'};
 const typ=types[file?.type]||(/\.(m4a|mp4)$/i.test(file?.name||'')?'audio/mp4':/\.(mp3)$/i.test(file?.name||'')?'audio/mpeg':null);
 if(!typ)throw Error('Choose an MP3, M4A, Ogg, or WebM voice recording.');
 if(file.size<30||file.size>1600000)throw Error('Voice notes must be under 1.6 MB.');
 const source=new Blob([file],{type:typ}),audioUrl=URL.createObjectURL(source);
 try{
  const audioData=await new Promise((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read this voice note'));reader.readAsDataURL(source)
  });
  return {audioData,audioUrl}
 }catch(err){URL.revokeObjectURL(audioUrl);throw err}
}

function voiceButtons(){
 const start=q('hubVoiceStart'),stop=q('hubVoiceStop'),elapsed=q('hubVoiceElapsed');
 if(start){start.hidden=!!voiceRecorder||voiceProcessing;start.disabled=voiceProcessing}
 if(stop){stop.hidden=!voiceRecorder;stop.disabled=!!voiceRecorder&&voiceRecorder.state!=='recording';stop.textContent=voiceRecorder&&voiceRecorder.state!=='recording'?'● FINISHING…':'■ STOP RECORDING'}
 if(elapsed)elapsed.textContent=voiceProcessing?'Preparing voice note…':voiceRecorder?(voiceRecorder.state==='recording'?'🔴 RECORDING · '+Math.min(60,Math.floor((Date.now()-voiceStartedAt)/1000))+'s / 60s':'Finishing recording…'):'Record up to 60 seconds';
}
let voiceStartedAt=0;
function endVoiceTracks(){
 if(voiceTimer){clearInterval(voiceTimer);voiceTimer=null}
 if(voiceLimit){clearTimeout(voiceLimit);voiceLimit=null}
 if(voiceStream){for(const track of voiceStream.getTracks())track.stop();voiceStream=null}
}
function clearVoice(){
 discardVoiceOnStop=true;voiceProcessing=false;
 if(voiceRecorder&&voiceRecorder.state!=='inactive'){try{voiceRecorder.stop()}catch{}}
 voiceRecorder=null;endVoiceTracks();
 if(pendingAudioUrl)URL.revokeObjectURL(pendingAudioUrl);
 pendingAudioData=null;pendingAudioUrl=null;
 const preview=q('hubVoicePreview');if(preview){preview.replaceChildren();preview.hidden=true}
 const file=q('hubAudioFile');if(file)file.value='';
 voiceButtons()
}
function showVoicePreview(){
 const preview=q('hubVoicePreview');if(!preview)return;
 preview.hidden=!pendingAudioUrl;
 if(!pendingAudioUrl){preview.replaceChildren();return}
 preview.innerHTML='<div class="hub2-voice-caption"><b>🎤 VOICE NOTE READY</b><small>Listen before posting. The recording uploads only when you send the message.</small></div><audio id="hubVoicePreviewPlayer" controls preload="metadata"></audio><button class="hub2-btn secondary" type="button" data-hub-remove-voice="1">REMOVE RECORDING</button>';
 q('hubVoicePreviewPlayer').src=pendingAudioUrl
}
async function beginVoice(){
 if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('Microphone recording needs an updated browser and HTTPS.');
 if(voiceRecorder||voiceProcessing)throw Error('A voice note is already recording or being prepared.');
 clearVoice();discardVoiceOnStop=false;
 const candidates=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'];
 const mime=candidates.find(x=>MediaRecorder.isTypeSupported?.(x));
 if(!mime)throw Error('This browser cannot record a supported voice-note format.');
 let stream;
 try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}
 catch(err){throw Error(err?.name==='NotAllowedError'?'Allow microphone access in your browser’s address bar, then try again.':err?.name==='NotFoundError'?'No microphone detected. Connect a microphone or upload an audio file.':err?.name==='NotReadableError'?'Microphone is in use by another app. Close that app and retry.':'Microphone unavailable: '+(err?.message||'Try uploading an audio file.'))}
 try{
  let recorder;try{recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:64000})}catch{recorder=new MediaRecorder(stream,{mimeType:mime})}
  voiceStream=stream;voiceRecorder=recorder;
  let chunks=[];
  recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
  recorder.onerror=event=>{feedback('Recording failed: '+(event?.error?.message||'Try again or upload an audio file.'));clearVoice()};
  recorder.onstop=async()=>{
   endVoiceTracks();
   if(voiceRecorder===recorder)voiceRecorder=null;
   voiceProcessing=true;voiceButtons();
   try{
    if(discardVoiceOnStop)return;
    const blob=new Blob(chunks,{type:recorder.mimeType||mime});chunks=[];
    if(blob.size<30)throw Error('Nothing was recorded. Speak for at least one second and try again.');
    if(blob.size>1600000)throw Error('Voice note is too large. Record a shorter note.');
    const source=await new Promise((resolve,reject)=>{
     const reader=new FileReader();
     reader.onload=()=>resolve(reader.result);
     reader.onerror=()=>reject(Error('Could not prepare the recording.'));
     reader.readAsDataURL(blob)
    });
    if(discardVoiceOnStop)return;
    if(pendingAudioUrl)URL.revokeObjectURL(pendingAudioUrl);
    pendingAudioData=source;pendingAudioUrl=URL.createObjectURL(blob);
    showVoicePreview();
    feedback('Voice note ready. Play it or send your message.');
   }catch(err){feedback(err.message||'Recording failed. Please try again.')}
   finally{voiceProcessing=false;voiceButtons()}
  };
  recorder.start();voiceStartedAt=Date.now();voiceButtons();
  voiceTimer=setInterval(voiceButtons,1000);
  voiceLimit=setTimeout(stopVoice,60000);
  feedback('Recording… click STOP RECORDING when finished.')
 }catch(err){for(const track of stream.getTracks())track.stop();voiceStream=null;voiceRecorder=null;voiceButtons();throw err}
}
function stopVoice(){
 if(!voiceRecorder)return;
 if(voiceRecorder.state==='recording')try{voiceProcessing=true;voiceRecorder.stop()}catch(err){feedback('Could not finish recording: '+err.message);clearVoice();return}
 // Wait for the final dataavailable and stop events before stopping tracks.
 voiceButtons()
}

function composer(){
 if(!member)return roleNotice();
 return '<div class="hub2-panel hub2-composer"><div class="hub2-label">NEW POST</div>'+
  '<div class="hub2-compose-head">'+avatar({name:member.displayName,member_id:member.id})+'<div><b>'+safe(member.displayName)+'</b></div></div>'+
  '<form id="hubComposer" class="hub2-form"><div id="hubReply" class="hub2-replying" hidden></div>'+
  '<label>ROOM<select name="topic">'+rooms.filter(x=>x[0]!=='all').map(x=>'<option value="'+x[0]+'">'+safe(x[1])+'</option>').join('')+'</select></label>'+
  '<label>YOUR POST OR REPLY<textarea name="message" maxlength="700" placeholder="Write a post or paste a picture (Ctrl+V)…"></textarea></label>'+ 
  '<label class="hub2-photo-field">📷 UPLOAD OR PASTE A PICTURE <small>Copy an image or screenshot, then press Ctrl + V in the post box.</small><input id="hubPhotoFile" type="file" accept="image/jpeg,image/png,image/webp"></label>'+
  '<div id="hubPhotoPreview" class="hub2-photo-preview" hidden></div>'+ 
  '<label class="hub2-photo-field pulse-video-field">🎬 ADD A VIDEO CLIP (MP4 / WEBM, MAX 12 MB) <input id="hubVideoFile" type="file" accept="video/mp4,video/webm"></label>'+ 
  '<div id="hubVideoPreview" class="hub2-video-preview" hidden></div>'+ 
  '<div class="hub2-voice-controls"><button type="button" class="hub2-btn hub2-mic-start" id="hubVoiceStart" data-hub-record-start="1">🎤 RECORD VOICE NOTE</button><button type="button" class="hub2-btn danger" id="hubVoiceStop" data-hub-record-stop="1" hidden>■ STOP RECORDING</button><span id="hubVoiceElapsed" class="hub2-micro">Tap microphone to record up to 60 seconds</span></div>'+ 
  '<div id="hubVoicePreview" class="hub2-voice-preview" hidden></div>'+ 
  '<label class="hub2-audio-field">OR UPLOAD AN AUDIO NOTE <input id="hubAudioFile" type="file" accept="audio/webm,audio/mp4,audio/x-m4a,audio/ogg,audio/mpeg,.mp3,.m4a"></label>'+
  '<div class="hub2-tools"><span class="hub2-micro" id="hubCharCount">0 / 700</span><button class="hub2-btn" type="submit" id="hubPostSubmit">SEND MESSAGE</button></div></form>'+
  '<p id="hubFeedback" class="hub2-feedback" role="status" aria-live="polite"></p></div>'
}
function adminPanel(){
 if(!owner)return '';
 return '<div class="hub2-panel"><div class="hub2-label">🔒 OWNER CONTROLS</div><h3>Newsroom Control</h3>'+
 '<form class="hub2-form" id="hubAnnouncement"><label>PIN OFFICIAL ANNOUNCEMENT<textarea name="message" required minlength="8" maxlength="700" placeholder="Election-night announcement..."></textarea></label>'+
 '<label>ROOM<select name="topic">'+rooms.filter(x=>x[0]!=='all').map(x=>'<option value="'+x[0]+'">'+safe(x[1])+'</option>').join('')+'</select></label>'+
 '<button type="submit" class="hub2-btn">📣 POST OFFICIAL ANNOUNCEMENT</button></form>'+
 '<hr style="border:0;border-top:1px solid #33526d;margin:20px 0">'+
 '<form class="hub2-form" id="hubNewPoll"><label>CREATE ELECTION COMMUNITY POLL<input name="question" minlength="8" maxlength="180" required placeholder="Who will win the Senate?"></label>'+
 '<label>ANSWER 1<input name="option" maxlength="90" required></label><label>ANSWER 2<input name="option" maxlength="90" required></label>'+
 '<label>ANSWER 3 (OPTIONAL)<input name="option" maxlength="90"></label><label>ANSWER 4 (OPTIONAL)<input name="option" maxlength="90"></label>'+
 '<label>POLL LENGTH<select name="durationHours"><option value="1">1 hour</option><option value="6">6 hours</option><option value="24" selected>24 hours</option><option value="72">3 days</option><option value="168">7 days</option></select></label>'+
 '<button type="submit" class="hub2-btn">🗳 CREATE POLL</button></form></div>';
}
function renderShell(){
 if(!shown())return;
 host.innerHTML='<div class="hub2">'+
 '<header class="hub2-header"><div class="hub2-kicker">THE EVENING WIRE · 2026 ELECTION NIGHT NEWSROOM</div>'+
 '<h1>THE <span>PULSE</span></h1>'+
 '<p>Post · Reply · React · Share media</p>'+
 '</header>'+
 '<div class="hub2-columns"><aside class="hub2-side"><div class="hub2-panel"><div class="hub2-label">ELECTION DEBATE ROOMS</div>'+
 '<nav class="hub2-room-list" aria-label="Discussion rooms" id="hubRooms">'+rooms.map(([id,label])=>
 '<button class="hub2-room" data-hub-room="'+id+'" aria-pressed="'+(room===id?'true':'false')+'"><span>'+safe(label)+'</span><small id="hubRoomCount-'+id+'">0</small></button>').join('')+
 '</nav></div>'+adminPanel()+'</aside>'+
 '<main class="hub2-main">'+composer()+'<section id="hubRaceWrap" class="hub2-panel" hidden><div class="hub2-label">⚡ OWNER RACE CALLS</div><div id="hubRaceCards"></div></section>'+
 '<section class="hub2-panel"><div class="hub2-tools"><div><div class="hub2-label">THE LIVE FLOOR · NEWEST FIRST ↓</div><h2 id="hubRoomTitle">ALL DISCUSSIONS</h2></div><button type="button" class="hub2-btn secondary" data-hub-refresh="1">↻ REFRESH</button></div>'+
 '<div class="hub2-tools"><input class="hub2-search" id="hubSearch" type="search" placeholder="Search messages or members..." aria-label="Search messages">'+
 '<span class="hub2-micro" id="hubUpdates">Live updates</span></div>'+
 '<div id="hubFeed" class="hub2-feed" aria-live="off" aria-label="Election discussion feed"></div>'+
 '<button type="button" class="hub2-btn hub2-new" id="hubNewMessages" hidden>↑ NEW MESSAGES</button></section></main>'+
 '<aside class="hub2-polls-col"><div class="hub2-panel"><div class="hub2-label">🗳 MEMBER PREDICTIONS</div><h2>LIVE RACE POLLS</h2>'+
 '<p class="hub2-muted">Member opinions · Not election results</p>'+
 '<div id="hubPolls"></div></div></aside></div><div id="hubPhotoLightbox" class="hub2-photo-lightbox" hidden role="dialog" aria-label="View conversation photo"><button type="button" data-hub-close-photo="1">✕ CLOSE</button><img id="hubLightboxImg" alt="Larger message picture"></div></div>';
 q('hubSearch').value=search;
 if(member){q('hubComposer').elements.namedItem('topic').value=room==='all'?'general':room}
 wireEvents();renderAll()
}
function renderAll(){renderRooms();renderFeed();renderPolls();renderRaceCards();renderPresence()}
function renderRooms(){
 if(!shown())return;
 for(const [id] of rooms){const node=q('hubRoomCount-'+id);if(node)node.textContent=posts.filter(p=>!p.parent_id&&(id==='all'||p.topic===id)).length}
 q('hubRoomTitle').textContent=room==='all'?'ALL DISCUSSIONS':roomName(room).replace(/^[^\s]+\s/,'').toUpperCase();

}
// X-style election timeline: each reply is a compact bubble nested inside
// the message it responds to, and every level supports further replies/reactions.
function messageCard(p,childrenById,depth=0){
 const mine=member&&p.member_id===member.id,active=p.myReactions||[],nested=depth>0;
 const children=childrenById.get(p.id)||[];
 const replyCount=children.length;
 const btns=emojis.map(([id,label])=>
  '<button class="pulse-emoji" type="button" data-hub-react="'+safe(p.id)+'" data-emoji="'+id+'" aria-pressed="'+(active.includes(id)?'true':'false')+'" title="React: '+id+'">'+label+
  '<span>'+Number(p.reactions?.[id]||0)+'</span></button>').join('');
 const controls='<div class="pulse-action-row">'+
  '<button type="button" class="pulse-reply-action" data-hub-reply="'+safe(p.id)+'" title="Reply to this message">↩ <span>REPLY'+(replyCount?' · '+replyCount:'')+'</span></button>'+
  (mine?'<button type="button" data-hub-edit="'+safe(p.id)+'" title="Edit your message">✎ <span>EDIT</span></button>':'')+
  (mine&&Date.now()-Date.parse(p.created_at)<15*60000?'<button type="button" data-hub-delete="'+safe(p.id)+'">DELETE</button>':'')+
  '<button type="button" data-hub-report="'+safe(p.id)+'" title="Report this message">⚑ <span>REPORT</span></button>'+
  (owner?'<button type="button" data-hub-pin="'+safe(p.id)+'">'+(p.pinned?'UNPIN':'📌 PIN')+'</button><button type="button" data-hub-hide="'+safe(p.id)+'">HIDE</button>':'')+'</div>';
 const media=(p.image_id?'<button type="button" class="hub2-photo-card" data-hub-photo="'+safe(p.image_id)+'" aria-label="View picture shared by '+safe(p.name||'member')+'"><img loading="lazy" src="/api/community/images/'+safe(p.image_id)+'" alt="Picture shared by '+safe(p.name||'member')+'"></button>':'')+
  (p.video_id?'<div class="pulse-video"><video controls preload="metadata" playsinline src="/api/community/videos/'+safe(p.video_id)+'" aria-label="Video shared by '+safe(p.name||'member')+'"></video></div>':'')+
  (p.audio_id?'<div class="hub2-post-audio"><b>🎤 VOICE NOTE</b><audio controls preload="metadata" src="/api/community/audio/'+safe(p.audio_id)+'"></audio></div>':'');
 const bubble='<div class="pulse-bubble">'+
   '<div class="pulse-author-line">'+avatar(p)+'<div class="pulse-author-meta"><strong>'+safe(p.name||'Member')+'</strong>'+
   '<small> · '+safe(clock(p.created_at))+(p.edited_at?' · edited':'')+(nested?' · REPLY':'')+'</small></div>'+
   (p.official?'<span class="hub2-tag">OFFICIAL EVENING WIRE</span>':p.pinned?'<span class="hub2-tag">📌 PINNED</span>':'')+'</div>'+
   (p.message?'<p class="pulse-message-text">'+safe(p.message)+'</p>':'')+
   media+controls+'<div class="pulse-emoji-strip" aria-label="Reactions to this message">'+btns+'</div></div>';
 const nestedChildren=children.length?'<div class="pulse-branch">'+children.slice().sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).map(child=>messageCard(child,childrenById,depth+1)).join('')+'</div>':'';
 const inner=bubble+nestedChildren;
 return nested?'<div class="pulse-reply-bubble" id="hub-message-'+safe(p.id)+'" data-post-id="'+safe(p.id)+'">'+inner+'</div>':
  '<article class="pulse-post'+(p.official?' pulse-official':'')+'" id="hub-message-'+safe(p.id)+'" data-post-id="'+safe(p.id)+'">'+
  '<div class="pulse-post-room">'+safe(roomName(p.topic))+'</div>'+inner+'</article>'
}
function renderFeed(){
 const feed=q('hubFeed');if(!feed||!shown())return;
 const all=posts.filter(p=>room==='all'||p.topic===room);
 const byId=new Map(all.map(p=>[p.id,p]));
 let visible=all;
 if(search){
  const needle=search.toLowerCase();
  const included=new Set();
  for(const p of all){
   if(!((p.name||'')+' '+(p.message||'')).toLowerCase().includes(needle))continue;
   let ancestor=p;
   for(let depth=0;ancestor&&depth<15;depth++){
    included.add(ancestor.id);ancestor=byId.get(ancestor.parent_id)
   }
  }
  visible=all.filter(p=>included.has(p.id))
 }
 const sig=JSON.stringify(visible.map(p=>[p.id,p.parent_id,p.message,p.edited_at,p.reactions,p.myReactions,p.pinned,p.official,p.image_id,p.audio_id,p.video_id]))+'|'+room+'|'+search;
 if(sig===lastSignature)return;
 lastSignature=sig;
 const atTop=feed.scrollTop<85,oldTop=feed.scrollTop,oldHeight=feed.scrollHeight;
 const listed=new Set(visible.map(p=>p.id)),children=new Map();
 for(const p of visible)if(p.parent_id&&listed.has(p.parent_id)){
  const row=children.get(p.parent_id)||[];row.push(p);children.set(p.parent_id,row)
 }
 const roots=visible.filter(p=>!p.parent_id||!listed.has(p.parent_id)).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 feed.innerHTML=roots.length?roots.map(p=>messageCard(p,children)).join(''):'<div class="hub2-empty">No conversations here yet. Start the first election-night discussion.</div>';
 if(atTop||!previousLatest){feed.scrollTop=0;unread=0}else feed.scrollTop=oldTop+Math.max(0,feed.scrollHeight-oldHeight);
 const fresh=roots[0]?.id||'';
 if(previousLatest&&fresh&&fresh!==previousLatest&&!atTop)unread+=1;
 previousLatest=fresh||previousLatest;
 const btn=q('hubNewMessages');btn.hidden=unread===0;btn.textContent=unread?'↑ '+unread+' NEW CONVERSATION'+(unread===1?'':'S'):'';
 q('hubUpdates').textContent=visible.length+' messages · newest first';
}
function renderPolls(){
 const target=q('hubPolls');if(!target)return;
 target.innerHTML=polls.length?polls.map(p=>{
  const options=Array.isArray(p.options)?p.options:[];
  const votes=options.reduce((sum,x,i)=>sum+Number(p.counts?.[i]||0),0);
  const closed=p.closed||Date.parse(p.closes_at)<=Date.now(),voted=p.myVote!==null&&p.myVote!==undefined;
  return '<article class="hub2-poll"><h4>'+safe(p.question)+'</h4><div class="hub2-poll-answers">'+options.map((option,i)=>{
   const count=Number(p.counts?.[i]||0),percent=votes?Math.round(100*count/votes):0;
   const text=String(option).toLowerCase(),cls=text.includes('republican')?'party-red':text.includes('democrat')?'party-blue':'';
   return '<button class="hub2-choice '+cls+(p.myVote===i?' selected':'')+'" type="button" data-hub-vote="'+safe(p.id)+'" data-choice="'+i+'" '+(voted||closed?'disabled':'')+'>'+
    '<span>'+safe(option)+' · '+(voted||closed?percent+'%':count+' votes')+'</span><span class="hub2-bar"><span style="width:'+percent+'%"></span></span></button>'
  }).join('')+'</div><p class="hub2-micro">'+votes+' votes · '+(closed?'POLL CLOSED':voted?'YOUR VOTE RECORDED · '+'Closes '+clock(p.closes_at):'Closes '+clock(p.closes_at))+'</p>'+
  (owner&&!closed?'<button class="hub2-btn secondary" type="button" data-hub-close-poll="'+safe(p.id)+'">CLOSE POLL</button>':'')+'</article>'
 }).join(''):'<p class="hub2-muted">The owner has not opened any community polls yet.</p>';
}
function renderRaceCards(){
 const target=q('hubRaceCards'),wrap=q('hubRaceWrap');if(!target||!wrap)return;
 const latest=calls.slice().sort((a,b)=>Date.parse(b.calledAt)-Date.parse(a.calledAt)).slice(0,3);
 wrap.hidden=latest.length===0;
 target.innerHTML=latest.map(c=>'<div class="hub2-race"><div><strong>'+safe(c.state)+' '+safe(c.office.toUpperCase())+' · '+safe(c.candidate)+'</strong>'+
 '<small>'+safe(c.party==='R'?'REPUBLICAN':c.party==='D'?'DEMOCRAT':'OTHER')+' · OWNER EDITORIAL CALL · NOT OFFICIAL CERTIFICATION</small></div>'+
 '<a href="/#calls">RACE DETAILS ↗</a></div>').join('')
}
function renderPresence(){/* Presence still works privately; no counter shown in the header. */}
function updateReply(){
 const area=q('hubReply'),form=q('hubComposer');if(!area||!form)return;
 const p=posts.find(x=>x.id===replyId);
 if(!p){area.hidden=true;area.textContent='';form.elements.namedItem('topic').disabled=false;return}
 area.hidden=false;area.innerHTML='↪ Replying to <b>'+safe(p.name)+'</b> · '+safe(p.message.slice(0,110))+' <button type="button" class="hub2-btn secondary" data-hub-cancel="1">CANCEL</button>';
 form.elements.namedItem('topic').value=p.topic;form.elements.namedItem('topic').disabled=true
}
async function refresh(){
 if(loading||!shown())return;loading=true;
 try{
  const [p,pol,c]=await Promise.all([
   api('/api/community/posts'),api('/api/community/polls'),api('/api/editor/calls')
  ]);
  posts=Array.isArray(p.posts)?p.posts:[];polls=Array.isArray(pol.polls)?pol.polls:[];calls=Array.isArray(c.calls)?c.calls:[];
  renderAll()
 }catch(err){feedback(err.message);const status=q('hubUpdates');if(status)status.textContent='Connection interrupted. Retrying.'}
 finally{loading=false}
}
async function presence(){
 if(!shown())return;
 try{
  if(member)await api('/api/community/presence','POST');
  const d=await api('/api/community/presence');online=Number(d.online)||0;renderPresence()
 }catch{}
}
function connect(){
 if(stream)return;
 try{
  stream=new EventSource('/api/community/stream');
  stream.onopen=()=>{liveConnected=true;renderRooms()};
  stream.addEventListener('change',()=>{if(shown())refresh()});
  stream.onerror=()=>{liveConnected=false;renderRooms()}
 }catch{stream=null}
}
async function action(path,body){
 const data=await api('/api/community/'+path,'POST',body);
 await refresh();return data
}
function focusComposer(){q('hubComposer')?.scrollIntoView({behavior:'smooth',block:'center'});q('hubComposer')?.elements.namedItem('message').focus()}
function wireEvents(){
 if(!shown())return;
 host.onclick=async e=>{
  if(!shown())return;
  const node=e.target.closest('button,[data-hub-cancel]');if(!node)return;
  const roomButton=node.closest('[data-hub-room]');
  if(roomButton){
   room=roomButton.dataset.hubRoom;search='';replyId=null;editId=null;unread=0;previousLatest='';lastSignature='';
   host.querySelectorAll('[data-hub-room]').forEach(x=>x.setAttribute('aria-pressed',String(x===roomButton)));
   q('hubSearch').value='';if(member){q('hubComposer').elements.namedItem('topic').value=room==='all'?'general':room;updateReply()}
   renderAll();return
  }
  if(node.dataset.hubRefresh){refresh();return}
  if(node.dataset.hubRemovePhoto){clearPicture();return}
  if(node.dataset.hubRemoveVideo){clearVideo();return}
  if(node.dataset.hubRecordStart){try{await beginVoice()}catch(err){feedback(err.message)}return}
  if(node.dataset.hubRecordStop){stopVoice();return}
  if(node.dataset.hubRemoveVoice){clearVoice();return}
  if(node.dataset.hubPhoto){q('hubLightboxImg').src='/api/community/images/'+encodeURIComponent(node.dataset.hubPhoto);q('hubPhotoLightbox').hidden=false;return}
  if(node.dataset.hubClosePhoto){q('hubPhotoLightbox').hidden=true;q('hubLightboxImg').removeAttribute('src');return}
  if(node.id==='hubNewMessages'){q('hubFeed').scrollTo({top:0,behavior:'smooth'});unread=0;node.hidden=true;return}
  if(node.dataset.hubCancel){replyId=null;editId=null;clearPicture();clearVideo();clearVoice();updateReply();q('hubComposer').elements.namedItem('message').value='';q('hubPostSubmit').textContent='SEND MESSAGE';return}
  const id=node.dataset.hubReply||node.dataset.hubEdit||node.dataset.hubDelete||node.dataset.hubReport||node.dataset.hubPin||node.dataset.hubHide||node.dataset.hubReact;
  try{
   if(node.dataset.hubReply){if(!requireMember())return;const p=posts.find(x=>x.id===id);if(!p)return;replyId=p.id;editId=null;updateReply();focusComposer();return}
   if(node.dataset.hubEdit){clearPicture();clearVideo();clearVoice();const p=posts.find(x=>x.id===id);if(!p||!member||p.member_id!==member.id)return;editId=id;replyId=null;updateReply();const form=q('hubComposer');form.elements.namedItem('message').value=p.message;form.elements.namedItem('topic').value=p.topic;q('hubPostSubmit').textContent='SAVE EDIT';focusComposer();return}
   if(node.dataset.hubReact){if(!requireMember())return;await action(id+'/react',{emoji:node.dataset.emoji});return}
   if(node.dataset.hubDelete){if(!confirm('Delete your message?'))return;await action(id+'/delete');return}
   if(node.dataset.hubReport){if(!requireMember()||!confirm('Report this message to the moderators?'))return;await action(id+'/report');return}
   if(node.dataset.hubPin){await action('admin/posts/'+id+'/pin');return}
   if(node.dataset.hubHide){if(!confirm('Hide this message from readers?'))return;await action('admin/posts/'+id+'/hide');return}
   if(node.dataset.hubVote){if(!requireMember())return;await action('polls/'+node.dataset.hubVote+'/vote',{choice:Number(node.dataset.choice)});return}
   if(node.dataset.hubClosePoll){if(!confirm('Close this community poll?'))return;await action('admin/polls/'+node.dataset.hubClosePoll+'/close');return}
  }catch(err){feedback(err.message)}
 };
 host.oninput=e=>{
  if(!shown())return;
  if(e.target.id==='hubSearch'){search=e.target.value.trim().slice(0,120);lastSignature='';renderFeed()}
  if(e.target.name==='message'&&e.target.closest('#hubComposer')){const x=q('hubCharCount');if(x)x.textContent=e.target.value.length+' / 700'}
 };
 // Pasted screenshots and images become normal photo attachments.
 // When there is no image in the clipboard, keep ordinary text paste behavior.
 host.onpaste=async e=>{
  if(!shown()||!member||!e.target.closest('#hubComposer'))return;
  const images=Array.from(e.clipboardData?.items||[])
   .filter(item=>item.kind==='file'&&item.type.startsWith('image/'))
   .map(item=>item.getAsFile()).filter(Boolean);
  if(!images.length)return;
  e.preventDefault();
  try{await attachPicture(images[0],'Pasted picture')}
  catch(err){feedback(err.message||'Could not paste picture.')}
 };
 host.ondragover=e=>{
  if(!shown()||!member||!e.target.closest('#hubComposer'))return;
  if(Array.from(e.dataTransfer?.types||[]).includes('Files'))e.preventDefault()
 };
 host.ondrop=async e=>{
  if(!shown()||!member||!e.target.closest('#hubComposer'))return;
  const files=Array.from(e.dataTransfer?.files||[]);
  if(!files.length)return;
  e.preventDefault();
  try{await attachMedia(files[0])}
  catch(err){feedback(err.message||'Could not attach file.')}
 };
 host.onchange=async e=>{
  if(!shown())return;
  const type=e.target.id,file=e.target.files?.[0];if(!file)return;
  try{
   if(type==='hubPhotoFile'){
    await attachPicture(file,'Picture')
   }else if(type==='hubVideoFile'){
    feedback('Preparing video (up to 12 MB)…');const ready=await prepareVideo(file);
    clearVideo();pendingVideoData=ready.videoData;pendingVideoUrl=ready.videoUrl;
    showVideoPreview();feedback('Video ready. You can add a caption before posting.')
   }else if(type==='hubAudioFile'){
    feedback('Preparing audio file…');const ready=await prepareAudioFile(file);
    clearVoice();pendingAudioData=ready.audioData;pendingAudioUrl=ready.audioUrl;
    showVoicePreview();feedback('Voice note ready. Listen before posting.')
   }
  }catch(err){
   if(type==='hubPhotoFile')clearPicture();
   else if(type==='hubVideoFile')clearVideo();
   else if(type==='hubAudioFile')clearVoice();
   feedback(String(err.message||err))
  }
 };
 host.onsubmit=async e=>{
  if(!shown())return;const form=e.target.closest('form');if(!form)return;
  if(!['hubComposer','hubAnnouncement','hubNewPoll'].includes(form.id))return;
  e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
  try{
   const d=new FormData(form);
   if(form.id==='hubComposer'){
    const message=String(d.get('message')||'').trim(),topic=replyId?posts.find(x=>x.id===replyId)?.topic||'general':d.get('topic')||'general';
    if(voiceRecorder||voiceProcessing)throw Error('Finish recording. Wait for the voice-note preview before sending.');
    if(!editId&&!pendingImageData&&!pendingAudioData&&!pendingVideoData&&!message.length)throw Error('Write a message, or attach a picture, video, or voice note.');
    if(editId){if(pendingImageData||pendingAudioData||pendingVideoData)throw Error('Media attachments can be added when creating a message.');await action(editId+'/edit',{message})}
    else await action('posts',{topic,message,parentId:replyId,imageData:pendingImageData,audioData:pendingAudioData,videoData:pendingVideoData});
    clearPicture();clearVideo();clearVoice();form.reset();q('hubCharCount').textContent='0 / 700';q('hubPostSubmit').textContent='SEND MESSAGE';replyId=null;editId=null;updateReply();feedback('Message published successfully.')
   }else if(form.id==='hubAnnouncement'){
    await action('admin/announcement',{message:d.get('message'),topic:d.get('topic')});form.reset();feedback('Official announcement published.')
   }else{
    await action('admin/polls',{question:d.get('question'),options:d.getAll('option').map(x=>String(x).trim()).filter(Boolean),durationHours:Number(d.get('durationHours'))});form.reset();feedback('Community poll created.')
   }
  }catch(err){feedback(err.message)}finally{button.disabled=false}
 }
}
async function open(){
 if(!shown())return;
 const [sess,admin]=await Promise.all([
  fetch('/api/members/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json()).catch(()=>({})),
  fetch('/api/admin/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json()).catch(()=>({}))
 ]);
 if(!shown())return;
 member=sess.user||null;owner=admin.authenticated===true;
 lastSignature='';renderShell();connect();await Promise.all([refresh(),presence()])
}
window.addEventListener('pagehide',clearVoice);
document.addEventListener('click',e=>{if(e.target.closest('[data-ew-tab]')&&voiceRecorder)clearVoice()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&q('hubPhotoLightbox')&&!q('hubPhotoLightbox').hidden){q('hubPhotoLightbox').hidden=true;q('hubLightboxImg').removeAttribute('src')}});
setInterval(()=>{if(shown()&&!document.hidden)refresh()},5000);
setInterval(()=>{if(shown()&&!document.hidden)presence()},30000);
document.addEventListener('visibilitychange',()=>{if(shown()&&!document.hidden){refresh();presence()}});
window.EWReactions={open,refresh};
})();