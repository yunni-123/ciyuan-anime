(() => {
  const board=document.createElement('section');board.className='announcement-board';board.id='production-board';
  board.innerHTML='<details><summary><span>新作制作公告 <small>OFFICIAL ANNOUNCEMENTS</small></span><span id="announcement-count">加载中…</span></summary><p id="announcement-check"></p><div id="announcement-list" class="announcement-grid"></div><p class="announcement-note">制作消息不等于已上线播放。档期可能调整，以原文及后续官网公告为准。云端会检查已收录官网的新制作消息，不能保证覆盖所有作品。</p><div id="official-news-links"></div></details>';
  document.querySelector('main').prepend(board);
  fetchJSON('announcements.json').then(data=>{
    const items=(data.items||[]).filter(x=>/^https:\/\//.test(x.source||''));
    $('#announcement-count').textContent=items.length+' 条已公布作品 · 展开';
    $('#announcement-check').textContent='人工核实：'+data.verifiedAt+(data.lastCheckedAt?' · 官网最近检查：'+new Date(data.lastCheckedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'');
    $('#announcement-list').innerHTML=items.map(x=>`<article><span class="announcement-window">${safe(x.window)}</span><h3>${safe(x.title)}</h3><p>${safe(x.note)}</p><small>公布：${safe(x.announcedAt)}</small><a href="${safe(x.source)}" target="_blank" rel="noopener noreferrer">${safe(x.sourceName)}原文 ↗</a></article>`).join('');
    const latest=(data.latestOfficial||[]).filter(x=>/^https:\/\//.test(x.url||''));
    if(latest.length)$('#official-news-links').innerHTML='<h3>官网最新制作公告</h3>'+latest.slice(0,8).map(x=>`<a href="${safe(x.url)}" target="_blank" rel="noopener noreferrer">${safe(x.title)} ↗</a>`).join('');
  }).catch(()=>{$('#announcement-count').textContent='暂时无法读取，刷新重试';});
})();
