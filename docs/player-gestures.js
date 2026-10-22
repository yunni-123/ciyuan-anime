// Pointer gestures affect this player only. Never change or persist system settings.
(() => {
  const stage=document.querySelector('.video-stage'),media=document.querySelector('#video');
  stage.insertAdjacentHTML('beforeend','<div id="video-dimmer" aria-hidden="true"></div><output id="gesture-hud" role="status" aria-live="polite" hidden></output><button id="exit-stage-fullscreen" type="button" aria-label="退出画面全屏">退出全屏 ⛶</button>');
  stage.insertAdjacentHTML('afterend','<div class="gesture-settings"><label><input id="enable-gestures" type="checkbox" checked> 屏幕手势</label><label>画面亮度 <input id="video-brightness" aria-label="画面亮度" type="range" min="20" max="100" value="100"></label><label>播放器音量 <input id="video-volume" aria-label="播放器音量" type="range" min="0" max="100" value="100"></label><button id="stage-fullscreen" type="button">画面全屏 ⛶</button></div><p class="gesture-help">播放时长按画面临时 2×，松手恢复；左侧上下滑调亮度，右侧调音量。底部进度条保持原生操作。亮度仅影响网页画面；部分手机音量需用系统按键。可用“画面全屏”保留手势。</p>');
  const hud=document.querySelector('#gesture-hud'),brightness=document.querySelector('#video-brightness'),volume=document.querySelector('#video-volume'),enabled=document.querySelector('#enable-gestures');
  let active=null,hideTimer=null,suppressClickUntil=0;
  function hint(message,linger=false){clearTimeout(hideTimer);hud.textContent=message;hud.hidden=false;if(linger)hideTimer=setTimeout(()=>hud.hidden=true,1300);}
  function rate(){media.playbackRate=playbackRate();if(hls)Object.assign(hls.config,playbackBufferConfig(document.querySelector('#memory-mode').checked));}
  function end(){if(active)clearTimeout(active.timer);active=null;if(temporaryPlaybackRate!==null){temporaryPlaybackRate=null;rate();}hud.hidden=true;}
  // Called synchronously before changing episodes, selected speed, or releasing the player.
  window.cancelPlayerGesture=end;
  function light(value){brightness.value=String(Math.max(20,Math.min(100,Math.round(value))));document.querySelector('#video-dimmer').style.opacity=String(1-Number(brightness.value)/100);}
  function sound(value){const target=Math.max(0,Math.min(1,value));try{media.volume=target;if(target>0)media.muted=false;}catch{}const supported=Math.abs(media.volume-target)<0.02;volume.value=String(Math.round((media.muted?0:media.volume)*100));return supported;}
  brightness.oninput=()=>light(Number(brightness.value));volume.oninput=()=>{if(!sound(Number(volume.value)/100))hint('浏览器限制音量调节，请使用手机音量键',true);};
  media.addEventListener('volumechange',()=>volume.value=String(Math.round((media.muted?0:media.volume)*100)));
  enabled.onchange=()=>{end();stage.classList.toggle('gestures-enabled',enabled.checked);};stage.classList.add('gestures-enabled');
  stage.addEventListener('pointerdown',event=>{
    if(active){if(event.pointerId!==active.id)end();return;}
    const rect=stage.getBoundingClientRect();
    if(!enabled.checked||!event.isPrimary||event.button!==0||media.paused||media.ended||event.clientY>rect.bottom-48||event.target.closest('button'))return;
    active={id:event.pointerId,x:event.clientX,y:event.clientY,startBrightness:Number(brightness.value),startVolume:media.muted?0:media.volume,side:event.clientX<rect.left+rect.width/2?'light':'sound',height:rect.height,mode:'pending',timer:null};
    const current=active;
    current.timer=setTimeout(()=>{if(active!==current)return;current.mode='hold';temporaryPlaybackRate=2;rate();hint('正在 2× 播放 · 松手恢复');suppressClickUntil=Date.now()+500;},380);
  });
  stage.addEventListener('pointermove',event=>{
    if(!active||event.pointerId!==active.id)return;const dx=event.clientX-active.x,dy=event.clientY-active.y;
    if(active.mode==='pending'&&Math.hypot(dx,dy)>12){clearTimeout(active.timer);if(Math.abs(dx)>Math.abs(dy)){end();return;}active.mode=active.side;stage.setPointerCapture(event.pointerId);}
    if(active.mode==='light'||active.mode==='sound'){
      event.preventDefault();suppressClickUntil=Date.now()+500;const delta=-dy/Math.max(100,active.height)*1.3;
      if(active.mode==='light'){light(active.startBrightness+delta*100);hint('画面亮度 '+brightness.value+'%');}
      else{const supported=sound(active.startVolume+delta);hint(supported?'播放器音量 '+volume.value+'%':'请使用手机音量键调整音量');}
    }else if(active.mode==='hold'){event.preventDefault();suppressClickUntil=Date.now()+500;}
  },{passive:false});
  function finish(event){if(active&&event.pointerId===active.id){if(active.mode!=='pending')suppressClickUntil=Date.now()+500;end();}}
  window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);stage.addEventListener('lostpointercapture',finish);
  stage.addEventListener('pointerleave',event=>{if(active&&!stage.hasPointerCapture(event.pointerId))finish(event);});
  stage.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
  stage.addEventListener('contextmenu',event=>{if(active){event.preventDefault();}});
  window.addEventListener('blur',end);document.addEventListener('visibilitychange',()=>{if(document.hidden)end();});media.addEventListener('pause',end);media.addEventListener('ended',end);
  document.querySelector('#stage-fullscreen').onclick=async()=>{end();try{if(document.fullscreenElement)await document.exitFullscreen();else if(stage.requestFullscreen)await stage.requestFullscreen();else hint('当前浏览器不支持画面全屏，可使用播放器全屏按钮',true);}catch{hint('无法开启画面全屏，请使用播放器全屏按钮',true);}};
  document.querySelector('#exit-stage-fullscreen').onclick=()=>{end();document.exitFullscreen?.().catch(()=>{});};
})();
