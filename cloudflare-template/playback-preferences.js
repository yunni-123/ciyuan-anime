// Store player preferences on this device only; never store video bytes.
let playbackPreference='original';
try{if(localStorage.getItem('ciyuan-playback-preference')==='smooth')playbackPreference='smooth';}catch{}
function originalQualityPlayback(){return playbackPreference==='original';}
function highestPlaybackLevel(levels){return levels.reduce((best,level,i)=>((level.height||0)>(levels[best]?.height||0)||((level.height||0)===(levels[best]?.height||0)&&(level.bitrate||0)>(levels[best]?.bitrate||0)))?i:best,0);}
const preferenceLabel=document.createElement('label');
preferenceLabel.innerHTML='播放偏好 <select id="playback-preference" aria-label="播放偏好"><option value="original">原画质优先</option><option value="smooth">流畅优先</option></select>';
document.querySelector('.player-options').prepend(preferenceLabel);
const preferenceControl=document.querySelector('#playback-preference');
preferenceControl.value=playbackPreference;
preferenceControl.title='原画质优先：保留来源最高档或手选画质，手机开播前先攒缓冲；不代表原盘或无损。流畅优先：允许自动降画质。';
function reflectPlaybackPreference(){
  const autoSource=document.querySelector('#auto-source');
  autoSource.disabled=originalQualityPlayback();
  autoSource.title=originalQualityPlayback()?'原画质优先时请手动换线，其他来源不能保证同画质。':'卡顿时尝试同集的其他来源。';
}
reflectPlaybackPreference();
preferenceControl.onchange=()=>{
  playbackPreference=preferenceControl.value;
  reflectPlaybackPreference();
  try{localStorage.setItem('ciyuan-playback-preference',playbackPreference);}catch{}
  if(hls){
    Object.assign(hls.config,playbackBufferConfig(document.querySelector('#memory-mode').checked));
    if(originalQualityPlayback()){
      hls.autoLevelCapping=-1;
      // Preserve an explicit manual choice; otherwise pin the highest source variant.
      if(hls.autoLevelEnabled)hls.nextLevel=highestPlaybackLevel(hls.levels);
    }else{hls.nextLevel=-1;configurePlaybackQuality(hls);}
    document.querySelector('#quality').value=String(hls.autoLevelEnabled?-1:hls.manualLevel);
  }
  document.querySelector('#player-status').textContent=originalQualityPlayback()?'原画质优先：不自动降档；新选集在手机上先攒缓冲。':'流畅优先：允许自动降低清晰度。';
};
async function playPreparedVideo(media,instance,ticket){
  if(originalQualityPlayback()&&mobilePlayback()&&instance){
    const deadline=performance.now()+12000;
    const target=()=>Math.min(8*playbackRate(),Math.max(0,(Number.isFinite(media.duration)?media.duration:Infinity)-media.currentTime));
    while(ticket===mediaTicket&&instance===hls&&originalQualityPlayback()&&media.paused&&playbackBufferedWindow(media).ahead<target()&&performance.now()<deadline){
      document.querySelector('#player-status').textContent=`原画质预缓冲 ${playbackBufferedWindow(media).ahead.toFixed(0)} / ${Math.ceil(target())} 秒…`;
      await new Promise(resolve=>setTimeout(resolve,250));
    }
  }
  if(ticket!==mediaTicket||instance&&instance!==hls||document.hidden)return;
  return media.play().catch(()=>{if(ticket===mediaTicket)document.querySelector('#player-status').textContent='请点击播放器内的播放按钮。';});
}
