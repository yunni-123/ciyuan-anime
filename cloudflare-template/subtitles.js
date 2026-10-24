// Timed text translation only. No microphone use, audio upload, or model download.
(() => {
 const media=$('#video'),stage=$('.video-stage');
 stage.insertAdjacentHTML('beforeend','<div id="subtitle-overlay" aria-live="off" hidden><div class="subtitle-original"></div><div class="subtitle-translated"></div></div><section id="subtitle-popover" class="subtitle-settings" aria-label="字幕设置" hidden><div class="subtitle-head"><b>同步字幕 · 中文翻译</b><button id="close-subtitle-settings" type="button" aria-label="关闭字幕设置">×</button></div><label>字幕轨 <select id="subtitle-track"><option value="none">尚未检测到文字字幕</option></select></label><label class="subtitle-file-label">导入字幕 SRT / VTT / ASS<input id="subtitle-file" type="file" accept=".srt,.vtt,.ass,.ssa,text/plain"></label><div class="subtitle-row"><label>显示 <select id="subtitle-mode"><option value="bilingual">原文 + 中文</option><option value="original">只看原文</option><option value="translated">只看中文</option><option value="off">关闭字幕</option></select></label><label>延后秒 <input id="subtitle-offset" aria-label="字幕延后秒数" type="number" min="-120" max="120" step="0.5" value="0"></label></div><div class="subtitle-row"><label>原文 <select id="subtitle-language"><option value="ja">日语</option><option value="en">英语</option><option value="ko">韩语</option><option value="zh-CN">中文（无需翻译）</option></select></label><label>翻译方式 <select id="subtitle-engine"><option value="online">免费在线翻译</option><option value="local">本机已就绪的翻译模型</option></select></label></div><label class="subtitle-opt-in"><input id="subtitle-translate" type="checkbox">启用字幕文字翻译为中文</label><p id="subtitle-status" role="status">无文字字幕时，请先导入匹配本集的字幕。此功能不识别纯音频，也不读取烧录在画面里的字幕。</p><p class="subtitle-privacy">在线翻译会按需把少量字幕文字发送至 MyMemory，不上传视频或音频；有免费额度和网络限制，机翻可能有误。本机模式仅使用已就绪模型，不自动下载。切集会清空导入字幕。</p><a href="https://mymemory.translated.net/doc/spec.php" target="_blank" rel="noopener noreferrer">翻译服务说明 ↗</a></section>');
 const overlay=$('#subtitle-overlay'),panel=$('#subtitle-popover'),select=$('#subtitle-track'),status=$('#subtitle-status');
 let source='none',cues=[],instance=null,generation=0,controller=null,translator=null,translatorLanguage='',localCue='',busy=false,queued=null,failures=0,blocked=false,disposed=false,quota=0;
 const cache=new Map(),listeners=new WeakSet();
 const strip=text=>String(text||'').replace(/\{[^}]*\}/g,'').replace(/<[^>]*>/g,'').replace(/\\[Nn]/g,'\n').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[s]).trim().slice(0,1200);
 function seconds(value){const p=value.trim().replace(',','.').split(':').map(Number);if(p.length<2||p.length>3||p.some(n=>!Number.isFinite(n)||n<0)||p.at(-1)>=60||p.length===3&&p[1]>=60)return NaN;return p.reduce((a,b)=>a*60+b,0);}
 function parse(text,ext='srt'){
  text=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');const result=[];
  if(/^(ass|ssa)$/i.test(ext)||text.includes('[Events]')){let events=false,format=['Layer','Start','End','Style','Name','MarginL','MarginR','MarginV','Effect','Text'];
   for(const line of text.split('\n')){if(/^\[/.test(line)){events=line.trim().toLowerCase()==='[events]';continue;}if(!events)continue;
    if(/^Format:/i.test(line)){format=line.slice(line.indexOf(':')+1).split(',').map(s=>s.trim());continue;}
    if(!/^Dialogue:/i.test(line))continue;const parts=line.slice(line.indexOf(':')+1).split(','),values=parts.slice(0,format.length-1).concat(parts.slice(format.length-1).join(','));
    const get=name=>values[format.findIndex(s=>s.toLowerCase()===name.toLowerCase())]||'',start=seconds(get('Start')),end=seconds(get('End')),content=strip(get('Text'));if(Number.isFinite(start)&&end>start&&content)result.push({start,end,text:content});
   }
  }else{for(const block of text.split(/\n\s*\n/)){const lines=block.split('\n'),i=lines.findIndex(l=>l.includes('-->'));if(i<0)continue;const match=lines[i].match(/([\d:.,]+)\s*-->\s*([\d:.,]+)/);if(!match)continue;const start=seconds(match[1]),end=seconds(match[2]),content=strip(lines.slice(i+1).join('\n'));if(Number.isFinite(start)&&end>start&&content)result.push({start,end,text:content});}}
  if(result.length>10000)throw Error('字幕条数超过 10000，请拆分到单集');return result.sort((a,b)=>a.start-b.start);
 }
 window.CiyuanSubtitles={parse};
 window.openSubtitleSettings=()=>{panel.hidden=!panel.hidden;if(!panel.hidden)refreshTracks();};$('#close-subtitle-settings').onclick=()=>panel.hidden=true;
 function configureTracks(){const native=Array.from(media.textTracks||[]);for(const t of native){if(t.mode==='showing')t.mode='hidden';if(!listeners.has(t)){t.addEventListener('cuechange',render);listeners.add(t);}}
  if(instance){instance.subtitleDisplay=false;if(source.startsWith('hls:'))instance.subtitleTrack=Number(source.split(':')[1]);}
  if(source.startsWith('native:')){const index=Number(source.split(':')[1]);native.forEach((t,i)=>{t.mode=i===index?'hidden':'disabled';});if(instance){const track=native[index],indexHls=instance.subtitleTracks.findIndex(t=>t.lang&&t.lang===track?.language);if(indexHls>=0)instance.subtitleTrack=indexHls;}}
 }
 function refreshTracks(){const tracks=Array.from(media.textTracks||[]),options=[];tracks.forEach((t,i)=>{if(t.kind==='metadata')return;options.push({value:'native:'+i,label:t.label||t.language||'字幕 '+(i+1),lang:t.language});});
  if(!options.length)instance?.subtitleTracks?.forEach((t,i)=>options.push({value:'hls:'+i,label:t.name||t.lang||'字幕 '+(i+1),lang:t.lang}));
  if(cues.length)options.unshift({value:'file',label:'已导入字幕 · '+cues.length+' 条'});
  if(!options.some(t=>t.value===source)){const preferred=options.find(t=>/^zh|中文/i.test(t.lang||t.label))||options.find(t=>/^ja/i.test(t.lang||''))||options[0];source=preferred?.value||'none';if(preferred?.lang&&/^(zh|en|ko|ja)/.test(preferred.lang))$('#subtitle-language').value=preferred.lang.startsWith('zh')?'zh-CN':preferred.lang.slice(0,2);}
  select.innerHTML=options.length?options.map(t=>`<option value="${safe(t.value)}">${safe(t.label)}</option>`).join(''):'<option value="none">没有可读取的文字字幕轨</option>';select.value=source;configureTracks();
  if(source==='none')status.textContent='本视频没有可读取的文字字幕。请导入匹配本集的 SRT / VTT / ASS；不能直接把纯日语音轨变成字幕。';else if(!$('#subtitle-translate').checked)status.textContent='原文字幕已就绪；可勾选翻译为中文。';render();
 }
 function activeText(){const t=media.currentTime-Number($('#subtitle-offset').value||0);if(source==='file'){
   let lo=0,hi=cues.length;while(lo<hi){const mid=(lo+hi)>>1;if(cues[mid].start<=t)lo=mid+1;else hi=mid;}
   const matching=[];for(let i=lo-1;i>=Math.max(0,lo-20);i--)if(cues[i].end>t)matching.unshift(cues[i].text);return [...new Set(matching)].join('\n');
  }
  let tracks=Array.from(media.textTracks||[]);if(source.startsWith('native:'))tracks=tracks.filter((_,i)=>i===Number(source.split(':')[1]));
  const lines=[];for(const track of tracks){if(track.kind==='metadata')continue;const available=Number($('#subtitle-offset').value)?Array.from(track.cues||[]).filter(c=>c.startTime<=t&&c.endTime>t):Array.from(track.activeCues||[]);for(const cue of available)if(cue.text)lines.push(strip(cue.text));}return [...new Set(lines)].join('\n');
 }
 const key=text=>$('#subtitle-language').value+'|'+$('#subtitle-engine').value+'|'+text;
 function render(){if(disposed)return;const text=source==='none'?'':activeText(),mode=$('#subtitle-mode').value,translate=$('#subtitle-translate').checked&&$('#subtitle-language').value!=='zh-CN',translated=cache.get(key(text));localCue=text;
  overlay.hidden=!text||mode==='off';overlay.querySelector('.subtitle-original').textContent=mode==='translated'&&translate&&translated?'':text;overlay.querySelector('.subtitle-translated').textContent=translate&&mode!=='original'?translated||'':'';
  if(text&&translate&&mode!=='off'&&mode!=='original'&&!translated&&!blocked)request(text);
 }
 function abort(){generation++;controller?.abort();controller=null;queued=null;busy=false;}
 async function request(text){if(busy){queued=text;return;}const cacheKey=key(text);if(cache.has(cacheKey)||blocked)return;busy=true;const ticket=generation,lang=$('#subtitle-language').value,engine=$('#subtitle-engine').value;controller=new AbortController();
  try{let result;
   if(engine==='local'){
    if(!window.Translator)throw Error('此浏览器没有本机翻译能力，请切换在线翻译。');
    if(!translator||translatorLanguage!==lang){const options={sourceLanguage:lang,targetLanguage:'zh'};if(await Translator.availability(options)!=='available')throw Error('本机没有已就绪的对应语言模型；本功能不会自动下载，请选择在线翻译。');translator?.destroy?.();translator=await Translator.create(options);translatorLanguage=lang;}
    result=await translator.translate(text);
   }else{
    if(text.length>450)throw Error('当前字幕过长，请使用按句分段的字幕文件。');
    let budget={date:new Date().toISOString().slice(0,10),count:0};try{const old=JSON.parse(localStorage.getItem('ciyuan-translation-budget')||'null');if(old?.date===budget.date)budget=old;}catch{}
    if(budget.count+text.length>4500){blocked=true;throw Error('本浏览器今日在线翻译保护额度已用完，请关闭翻译或改用本机已就绪模型。');}budget.count+=text.length;try{localStorage.setItem('ciyuan-translation-budget',JSON.stringify(budget));}catch{}quota=budget.count;
    const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',text);url.searchParams.set('langpair',lang+'|zh-CN');url.searchParams.set('mt','1');
    const response=await fetch(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]),referrerPolicy:'no-referrer',credentials:'omit'});if(!response.ok)throw Error('翻译服务暂不可用（'+response.status+'），保留原文。');
    const data=await response.json();if(data.quotaFinished||Number(data.responseStatus)===429){blocked=true;throw Error('免费翻译服务额度已用完，已停止请求并保留原文。');}if(Number(data.responseStatus)!==200||!data.responseData?.translatedText)throw Error('翻译服务没有返回译文，保留原文。');result=strip(data.responseData.translatedText);
   }
   if(ticket!==generation)return;if(!result)throw Error('翻译结果为空，保留原文。');cache.set(cacheKey,result);if(cache.size>240)cache.delete(cache.keys().next().value);failures=0;status.textContent='同步字幕翻译已启用 · '+(engine==='local'?'本机处理':'免费在线机翻 · 本浏览器今日约 '+quota+' 字');
   }catch(e){if(ticket!==generation||e.name==='AbortError')return;failures++;if(failures>=3||engine==='local')blocked=true;status.textContent=(e.name==='TypeError'?'翻译连接失败，请检查当前网络；保留原文。':e.message)+(blocked?' 已停止自动重试；重新勾选可再检测。':'');}
  finally{if(ticket===generation){busy=false;controller=null;if(cache.has(key(localCue)))render();const next=queued;queued=null;if(next&&!cache.has(key(next))&&!blocked&&next===activeText())request(next);}}
 }
 select.onchange=()=>{abort();source=select.value;configureTracks();render();};
 $('#subtitle-file').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('请选择 2MB 以内的单集字幕');const bytes=await file.arrayBuffer();let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('gb18030').decode(bytes);}const parsed=parse(text,file.name.split('.').at(-1));if(!parsed.length)throw Error('未找到有效时间轴，请确认是 SRT / VTT / ASS 字幕');abort();cues=parsed;source='file';disposed=false;refreshTracks();status.textContent=file.name+' · '+cues.length+' 条字幕已载入，文件在本机解析。';}catch(e){status.textContent=e.message;}event.target.value='';};
 for(const id of ['subtitle-language','subtitle-engine','subtitle-translate'])$('#'+id).onchange=()=>{abort();blocked=false;failures=0;disposed=false;render();if(source==='none')refreshTracks();};
 for(const id of ['subtitle-mode','subtitle-offset'])$('#'+id).onchange=render;
 for(const name of ['timeupdate','seeking','seeked'])media.addEventListener(name,render);
 media.addEventListener('loadedmetadata',()=>{disposed=false;refreshTracks();});media.textTracks?.addEventListener('addtrack',refreshTracks);media.textTracks?.addEventListener('removetrack',refreshTracks);
 window.attachSubtitlePlayer=player=>{instance=player;disposed=false;if(player)for(const event of [Hls.Events.MANIFEST_PARSED,Hls.Events.SUBTITLE_TRACKS_UPDATED])player.on(event,refreshTracks);};
 window.suspendPlayerSubtitles=()=>{abort();disposed=true;instance=null;overlay.hidden=true;};
 window.releasePlayerSubtitles=()=>{abort();disposed=true;source='none';cues=[];cache.clear();instance=null;blocked=false;failures=0;localCue='';overlay.hidden=true;panel.hidden=true;$('#subtitle-offset').value='0';select.innerHTML='<option value="none">尚未检测到文字字幕</option>';status.textContent='切集后请重新选择或导入匹配字幕。无原文字幕时无法直接生成中文。';for(const t of Array.from(media.textTracks||[]))t.mode='disabled';};
 $('#player-dialog').addEventListener('close',()=>{translator?.destroy?.();translator=null;translatorLanguage='';});
})();
