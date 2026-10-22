// One HTML player in both inline and fullscreen modes, including touch controls.
(() => {
  const stage=$('.video-stage'),media=$('#video'),dialog=$('#player-dialog');
  media.controls=false;media.setAttribute('webkit-playsinline','');media.setAttribute('controlslist','nofullscreen noremoteplayback');
  stage.insertAdjacentHTML('beforeend','<div id="video-dimmer" aria-hidden="true"></div><output id="gesture-hud" role="status" aria-live="polite" hidden><b></b><span class="gesture-meter"><i></i></span></output><button id="media-lock" type="button" aria-label="锁定屏幕手势">🔓 锁定</button><button id="exit-stage-fullscreen" type="button" aria-label="退出全屏">退出全屏 ⛶</button><div id="media-controls"><button id="media-toggle" type="button" aria-label="播放或暂停">▶</button><span id="media-time">00:00 / --:--</span><input id="media-seek" aria-label="播放进度" type="range" min="0" max="1000" value="0"><button id="media-rate" type="button" aria-label="切换倍速">1×</button><button id="media-subtitles" type="button" aria-label="字幕设置">字幕</button><button id="media-fullscreen" type="button" aria-label="全屏播放">⛶</button></div>');
  stage.insertAdjacentHTML('afterend','<div class="gesture-settings"><label><input id="enable-gestures" type="checkbox" checked> 屏幕手势</label><label>画面亮度 <input id="video-brightness" aria-label="画面亮度" type="range" min="20" max="100" value="100"></label><label>播放器音量 <input id="video-volume" aria-label="播放器音量" type="range" min="0" max="100" value="100"></label><button id="stage-fullscreen" type="button">全屏播放 ⛶</button></div><p class="gesture-help">长按临时 2×，松手恢复；左侧上下滑调画面亮度，右侧调音量；横滑预览进度，松手跳转。轻点显隐控制条，双击暂停 / 播放。全屏可锁定手势。网页亮度不改变系统亮度，部分手机音量需用系统按键。</p>');
  const hud=$('#gesture-hud'),brightness=$('#video-brightness'),volume=$('#video-volume'),enabled=$('#enable-gestures');
  let active=null,hideTimer=null,controlsTimer=null,lastTap=0,tapTimer=null,locked=false,scrubbing=false,orientationLocked=false;
  const full=()=>document.fullscreenElement===stage||document.webkitFullscreenElement===stage||stage.classList.contains('web-fullscreen');
  const clock=value=>{if(!Number.isFinite(value))return '--:--';const s=Math.max(0,Math.floor(value));return(s>=3600?Math.floor(s/3600)+':':'')+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
  function controls(){clearTimeout(controlsTimer);stage.classList.add('controls-visible');if(!media.paused&&!locked)controlsTimer=setTimeout(()=>{if(!active&&!stage.querySelector(':focus-visible'))stage.classList.remove('controls-visible');},3000);}
  function hint(text,percent=null,linger=false){clearTimeout(hideTimer);hud.querySelector('b').textContent=text;hud.querySelector('.gesture-meter').hidden=percent===null;hud.querySelector('i').style.width=Math.max(0,Math.min(100,percent||0))+'%';hud.hidden=false;if(linger)hideTimer=setTimeout(()=>hud.hidden=true,1400);}
  function rate(){media.playbackRate=playbackRate();$('#media-rate').textContent=playbackRate()+'×';if(hls)Object.assign(hls.config,playbackBufferConfig($('#memory-mode').checked));}
  function end(){if(active)clearTimeout(active.timer);active=null;if(temporaryPlaybackRate!==null){temporaryPlaybackRate=null;rate();}hud.hidden=true;}
  window.cancelPlayerGesture=()=>{end();clearTimeout(tapTimer);clearTimeout(hideTimer);clearTimeout(controlsTimer);lastTap=0;};
  function light(value){brightness.value=String(Math.round(Math.max(20,Math.min(100,value))));$('#video-dimmer').style.opacity=String(1-Number(brightness.value)/100);}
  function sound(value){const target=Math.max(0,Math.min(1,value));try{media.volume=target;if(target>0)media.muted=false;}catch{}volume.value=String(Math.round((media.muted?0:media.volume)*100));return Math.abs(media.volume-target)<0.02;}
  brightness.oninput=()=>light(Number(brightness.value));volume.oninput=()=>{if(!sound(Number(volume.value)/100))hint('请使用手机音量键调节',null,true);};
  const toggle=()=>{if(media.paused){if(!media.currentSrc)$('#play-video').click();else media.play().catch(()=>hint('请重试播放',null,true));}else media.pause();controls();};
  $('#media-toggle').onclick=toggle;$('#media-rate').onclick=()=>{const select=$('#playback-speed'),rates=[1,1.25,1.5,2,.5];select.value=String(rates[(rates.indexOf(Number(select.value))+1)%rates.length]);select.dispatchEvent(new Event('change'));controls();};
  $('#playback-speed').addEventListener('change',()=>$('#media-rate').textContent=playbackRate()+'×');$('#media-rate').textContent=playbackRate()+'×';
  $('#media-subtitles').onclick=()=>{window.openSubtitleSettings?.();controls();};
  $('#media-seek').oninput=()=>{scrubbing=true;controls();$('#media-time').textContent=clock(Number($('#media-seek').value)/1000*media.duration)+' / '+clock(media.duration);};
  $('#media-seek').onchange=()=>{if(Number.isFinite(media.duration))media.currentTime=Number($('#media-seek').value)/1000*media.duration;scrubbing=false;controls();};
  function update(){if(!scrubbing){$('#media-time').textContent=clock(media.currentTime)+' / '+clock(media.duration);$('#media-seek').value=Number.isFinite(media.duration)?String(media.currentTime/media.duration*1000):'0';}$('#media-toggle').textContent=media.paused?'▶':'❚❚';$('#media-seek').disabled=!Number.isFinite(media.duration);}
  for(const name of ['timeupdate','durationchange','loadedmetadata','emptied'])media.addEventListener(name,update);
  media.addEventListener('volumechange',()=>volume.value=String(Math.round((media.muted?0:media.volume)*100)));
  enabled.onchange=()=>{end();stage.classList.toggle('gestures-enabled',enabled.checked);};stage.classList.add('gestures-enabled');controls();update();
  $('#media-lock').onclick=()=>{end();locked=!locked;stage.classList.toggle('gestures-locked',locked);$('#media-lock').textContent=locked?'🔒 解锁':'🔓 锁定';$('#media-lock').setAttribute('aria-label',locked?'解锁屏幕手势':'锁定屏幕手势');controls();};
  const interactive=target=>target.closest('button,input,select,a,.subtitle-settings');
  stage.addEventListener('pointerdown',event=>{
    if(interactive(event.target))return;if(active){end();return;}
    const rect=stage.getBoundingClientRect();if(locked||!event.isPrimary||event.button!==0)return;
    active={id:event.pointerId,x:event.clientX,y:event.clientY,startBrightness:Number(brightness.value),startVolume:media.muted?0:media.volume,startTime:media.currentTime,seekTime:media.currentTime,side:event.clientX<rect.left+rect.width/2?'light':'sound',height:Math.max(280,rect.height),width:rect.width,mode:'pending',timer:null};
    stage.setPointerCapture(event.pointerId);const current=active;
    if(enabled.checked&&!media.paused&&!media.ended)current.timer=setTimeout(()=>{if(active!==current)return;current.mode='hold';temporaryPlaybackRate=2;rate();hint('▶▶ 2× 加速中 · 松手恢复');stage.classList.remove('controls-visible');},400);
  });
  stage.addEventListener('pointermove',event=>{
    if(!active||event.pointerId!==active.id)return;const dx=event.clientX-active.x,dy=event.clientY-active.y;
    if(active.mode==='pending'&&Math.hypot(dx,dy)>10){clearTimeout(active.timer);if(!enabled.checked){active.mode='cancel';return;}active.mode=Math.abs(dx)>Math.abs(dy)*1.2?'seek':active.side;}
    if(['light','sound','seek'].includes(active.mode)){
      event.preventDefault();clearTimeout(tapTimer);lastTap=0;stage.classList.remove('controls-visible');const delta=-dy/active.height*.85;
      if(active.mode==='light'){light(active.startBrightness+delta*100);hint('☀ 亮度 '+brightness.value+'%',Number(brightness.value));}
      else if(active.mode==='sound'){const supported=sound(active.startVolume+delta);hint(supported?'♫ 音量 '+volume.value+'%':'请使用手机音量键',supported?Number(volume.value):null);}
      else if(Number.isFinite(media.duration)){active.seekTime=Math.max(0,Math.min(media.duration-.1,active.startTime+dx/active.width*Math.min(120,media.duration)));hint(clock(active.seekTime)+' / '+clock(media.duration)+' · 松手跳转',active.seekTime/media.duration*100);}
    }else if(active.mode==='hold')event.preventDefault();
  },{passive:false});
  function finish(event,cancel=false){if(!active||event.pointerId!==active.id)return;const state=active;end();if(cancel)return;
    if(state.mode==='seek'&&Number.isFinite(media.duration))media.currentTime=state.seekTime;
    if(state.mode==='pending'){const now=Date.now();if(now-lastTap<280){clearTimeout(tapTimer);lastTap=0;toggle();}else{lastTap=now;tapTimer=setTimeout(()=>{if(media.paused||!stage.classList.contains('controls-visible'))controls();else stage.classList.remove('controls-visible');},280);}}
    else controls();
  }
  window.addEventListener('pointerup',e=>finish(e));window.addEventListener('pointercancel',e=>finish(e,true));stage.addEventListener('lostpointercapture',e=>finish(e,true));
  stage.addEventListener('click',event=>{if(!interactive(event.target)){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
  stage.addEventListener('contextmenu',event=>{if(enabled.checked&&!interactive(event.target))event.preventDefault();});
  stage.addEventListener('keydown',event=>{if(interactive(event.target))return;if(event.key===' '){event.preventDefault();toggle();}if(event.key==='Escape'&&full()){event.preventDefault();exitFullscreen();}});stage.tabIndex=0;
  window.addEventListener('blur',end);document.addEventListener('visibilitychange',()=>{if(document.hidden)end();});
  for(const name of ['pause','ended'])media.addEventListener(name,()=>{end();controls();update();});media.addEventListener('playing',()=>{controls();update();});
  function restore(){end();stage.classList.remove('web-fullscreen');dialog.classList.remove('web-player-host');stage.classList.toggle('player-fullscreen',full());if(orientationLocked){screen.orientation?.unlock?.();orientationLocked=false;}controls();}
  async function exitFullscreen(){end();if(document.fullscreenElement===stage){await document.exitFullscreen().catch(()=>{});}else if(document.webkitFullscreenElement===stage){document.webkitExitFullscreen?.();}restore();}
  async function enterFullscreen(){end();if(full())return exitFullscreen();try{if(stage.requestFullscreen)await stage.requestFullscreen();else if(stage.webkitRequestFullscreen)stage.webkitRequestFullscreen();else throw Error('web fullscreen');}catch{stage.classList.add('web-fullscreen');dialog.classList.add('web-player-host');}stage.classList.add('player-fullscreen');controls();try{if(document.fullscreenElement&&screen.orientation?.lock){await screen.orientation.lock('landscape');orientationLocked=true;}}catch{}}
  window.exitPlayerFullscreen=exitFullscreen;$('#stage-fullscreen').onclick=enterFullscreen;$('#media-fullscreen').onclick=enterFullscreen;$('#exit-stage-fullscreen').onclick=exitFullscreen;
  document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement!==stage)restore();else{stage.classList.add('player-fullscreen');controls();}});
  dialog.addEventListener('cancel',event=>{if(full()){event.preventDefault();exitFullscreen();}});dialog.addEventListener('close',()=>{exitFullscreen();locked=false;stage.classList.remove('gestures-locked');$('#media-lock').textContent='🔓 锁定';});
})();
