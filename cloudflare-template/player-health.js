// Bounded recovery and speed-aware buffering. Never persist media or prefetch episodes.
const playbackRates=[0.5,1,1.25,1.5,2];
let playerHealth=null;
let temporaryPlaybackRate=null;
function playbackRate(){const value=temporaryPlaybackRate??Number(document.querySelector('#playback-speed')?.value);return playbackRates.includes(value)?value:1;}
function mobilePlayback(){return navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|HarmonyOS|OpenHarmony|Mobile/i.test(navigator.userAgent);}
// Cap automatic selection only. Explicit quality choices remain available.
function mobileQualityCap(levels,height=720){let cap=-1;levels.forEach((level,i)=>{if(level.height>0&&level.height<=height)cap=i;});return cap<0?0:cap;}
function configurePlaybackQuality(instance){if(originalQualityPlayback()){instance.autoLevelCapping=-1;instance.startLevel=highestPlaybackLevel(instance.levels);instance.nextLevel=instance.startLevel;return;}if(!mobilePlayback()){instance.autoLevelCapping=-1;return;}instance.autoLevelCapping=mobileQualityCap(instance.levels);}
function handlePlaybackWaiting(media,instance){
  if(originalQualityPlayback()||!mobilePlayback()||!instance?.autoLevelEnabled||media.seeking||media.currentTime<2||playbackBufferedWindow(media).ahead>1)return;
  // Abort no requests and flush no buffers: lower only subsequent fragments.
  if(instance.levels.length>1){instance.nextAutoLevel=0;instance.autoLevelCapping=mobileQualityCap(instance.levels,480);}
}
function playbackBufferConfig(low,rate=playbackRate()){
  const forward=Math.min(120,Math.ceil((low?40:72)*Math.max(1,rate)));
  const config={maxBufferLength:forward,maxMaxBufferLength:Math.min(120,forward*1.5),backBufferLength:low?15:30,maxBufferSize:(low?32:64)*1024*1024,startLevel:0,capLevelToPlayerSize:true,abrBandWidthFactor:0.7,abrBandWidthUpFactor:0.5};
  if(mobilePlayback())Object.assign(config,{capLevelToPlayerSize:false,abrEwmaDefaultEstimate:500000,abrBandWidthFactor:0.6,abrBandWidthUpFactor:0.35,abrEwmaFastVoD:2,abrEwmaSlowVoD:6,maxStarvationDelay:2,maxLoadingDelay:3,backBufferLength:low?6:12});
  for(const name of ['fragLoadPolicy','manifestLoadPolicy']){const policy=window.Hls?.DefaultConfig?.[name]?.default;if(policy)config[name]={default:{...policy,maxTimeToFirstByteMs:10000,maxLoadTimeMs:30000,timeoutRetry:{maxNumRetry:3,retryDelayMs:800,maxRetryDelayMs:5000},errorRetry:{maxNumRetry:3,retryDelayMs:800,maxRetryDelayMs:5000}}};}
  if(originalQualityPlayback())Object.assign(config,{capLevelToPlayerSize:false,maxBufferLength:Math.min(120,Math.ceil((low?60:90)*Math.max(1,rate))),maxMaxBufferLength:120});
  return config;
}
function clearPlayerHealth(){if(!playerHealth)return;clearInterval(playerHealth.timer);clearTimeout(playerHealth.retry);playerHealth=null;}
function monitorPlayback(video,instance,ticket,url){
  clearPlayerHealth();
  const state=playerHealth={network:0,media:0,started:Date.now(),lastProgress:Date.now(),lastTime:video.currentTime,hasPlayed:false,lowered:false,retry:null,timer:null};
  const current=()=>playerHealth===state&&ticket===mediaTicket;
  function fail(message){if(!current())return;globalThis.CiyuanPlayback?.fail(message);globalThis.CiyuanExperienceUI?.recordFailure();if(tryPlaybackAlternative(message))return;clearPlayerHealth();if(hls){hls.destroy();hls=null;}video.pause();$('#player-status').textContent=message+'；自动恢复已停止，请重试或手动换源。';$('#retry-playback').hidden=false;}
  function retry(){if(!current()||state.retry)return;if(state.network>=2){fail('该线路持续不可用');return;}state.network++;state.lastProgress=Date.now();$('#player-status').textContent=`网络波动，正在重连（${state.network}/2）…`;state.retry=setTimeout(()=>{state.retry=null;if(!current()||!instance||hls!==instance)return;if(!instance.levels.length)instance.loadSource(url);else instance.startLoad();},state.network*1200);}
  state.handleError=data=>{
    if(!current())return;
    const code=Number(data.response?.code||data.networkDetails?.status);
    if([401,403,404,410].includes(code)&&!/subtitle/i.test(data.details||'')){fail(`视频源返回 ${code}，当前地址失效或拒绝访问`);return;}
    if(!data.fatal)return;
    if(data.type===Hls.ErrorTypes.NETWORK_ERROR)retry();
    else if(data.type===Hls.ErrorTypes.MEDIA_ERROR&&state.media++<1){continueAt=video.currentTime;$('#player-status').textContent='正在恢复视频解码…';instance.recoverMediaError();}
    else fail('该线路无法继续播放');
  };
  state.timer=setInterval(()=>{
    if(!current()||video.ended)return;
    if(document.hidden){state.started=Date.now();state.lastProgress=Date.now();return;}
    // HLS stays paused while fetching its first manifest / prebuffer. It still needs a deadline.
    if(!state.hasPlayed&&video.readyState<2&&Date.now()-state.started>16000){fail('视频源 16 秒内未返回可播放数据');return;}
    if(video.currentTime>0.15&&!video.paused)state.hasPlayed=true;
    if(video.paused||video.seeking){state.lastProgress=Date.now();state.lastTime=video.currentTime;return;}
    if(!navigator.onLine){$('#player-status').textContent='网络已断开，恢复联网后可重试。';state.lastProgress=Date.now();return;}
    if(video.currentTime>state.lastTime+0.15){state.lastTime=video.currentTime;state.lastProgress=Date.now();return;}
    const stalled=Date.now()-state.lastProgress;if(stalled>7000&&!state.slowRecorded){state.slowRecorded=true;globalThis.CiyuanExperienceUI?.noteSlow();}
    if(stalled>7000&&!state.lowered&&instance&&instance.autoLevelEnabled){state.lowered=true;if(instance.levels.length>1){instance.nextAutoLevel=Math.max(0,instance.currentLevel-1);$('#player-status').textContent='网络较慢，正在降低自动清晰度并补充缓冲…';}else $('#player-status').textContent='当前来源只有一个清晰度，正在补充缓冲…';}
    if(stalled>18000){if(instance)retry();else fail('视频源长时间没有返回画面');}
  },2000);
  return state;
}
let playbackAlternatives={visited:new Set(),switches:0};
function tryPlaybackAlternative(reason){
  if(originalQualityPlayback())return false; // Different providers cannot guarantee the same quality.
  if(!watchState||!$('#auto-source').checked||playbackAlternatives.switches>=2)return false;
  const previous=watchState,position=video.currentTime||continueAt||0,currentName=previous.subject.playGroups[previous.group].episodes[previous.episode].name;
  const number=currentName.match(/\d+/)?.[0],candidates=[];
  previous.sources.forEach((s,si)=>s.playGroups.forEach((g,gi)=>{
    const key=si+':'+gi;if(si===previous.sourceIndex&&gi===previous.group||playbackAlternatives.visited.has(key))return;
    let ep=number===undefined?g.episodes.findIndex(e=>e.name===currentName):g.episodes.findIndex(e=>Number(e.name.match(/\d+/)?.[0])===Number(number));
    if(ep<0&&g.episodes.length===1&&previous.subject.playGroups[previous.group].episodes.length===1)ep=0;
    if(g.episodes.length===1&&previous.subject.playGroups[previous.group].episodes.length>1)return;if(ep>=0)candidates.push({si,gi,ep,key,score:globalThis.CiyuanExperienceUI?.scoreLine(s,g)||0});
  }));
  const next=candidates.filter(c=>c.score>-100).sort((a,b)=>b.score-a.score)[0];if(!next)return false;
  const session=playbackAlternatives;session.visited.add(previous.sourceIndex+':'+previous.group);session.visited.add(next.key);session.switches++;
  chooseEpisode(previous.sources,next.si,next.gi,next.ep);playbackAlternatives=session;continueAt=position;
  $('#player-status').textContent=reason+'，正在切换同一集的其他线路…';
  startVideo(watchState.subject.playGroups[next.gi].episodes[next.ep].url,{automatic:true,resumeTime:position});return true;
}

function playbackBufferedWindow(media,position=media.currentTime){for(let i=0;i<media.buffered.length;i++){const start=media.buffered.start(i),end=media.buffered.end(i);if(position>=start&&position<=end)return{start,end,ahead:Math.max(0,end-position)};}return{start:position,end:position,ahead:0};}
function preparePlaybackSeek(media,instance){const cached=playbackBufferedWindow(media).ahead>.2;if(!cached&&instance?.autoLevelEnabled&&instance.levels.length>1)instance.nextAutoLevel=0;return cached;}
