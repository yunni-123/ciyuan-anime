// Recommendations are computed locally. No account, tracking requests or remote profile.
(()=>{
  let batch=[],fingerprint='',personalized=true;
  try{personalized=localStorage.getItem('ciyuan-personalized')!=='off';}catch{}
  const ignored=/^(日本|中国|国产|动画|动漫|TV|OVA|OAD|剧场版|漫画改|漫画改编|小说改|轻小说改|游戏改|原创|\d{4}.*)$/i;
  const key=s=>title(s).toLowerCase().replace(/[\s·・:：!！?？—\-_「」『』《》]/g,'');
  const subjects=()=>{
    const unique=new Map();
    for(const s of catalog){
      if(s.type!==2||s.calendarOnly||s.nsfw||s.region&&s.region!=='jp'||/成人|里番|18禁/.test(tags(s).join(' ')))continue;
      const k=key(s);if(!k)continue;
      const previous=unique.get(k);
      // Prefer bibliography tags/ratings; provider duplicates need not occupy multiple slots.
      if(!previous||score(s)>score(previous)||score(s)===score(previous)&&tags(s).length>tags(previous).length)unique.set(k,s);
    }
    return [...unique.values()];
  };
  function interests(){
    const weights=new Map(),seen=new Set(),events=[];
    const metadata=new Map(subjects().map(s=>[key(s),s]));
    function add(s,weight){if(!s||s.type!==2)return;seen.add(key(s));for(const t of new Set([...tags(s),...tags(metadata.get(key(s))||{})].filter(t=>!ignored.test(t))))weights.set(t,(weights.get(t)||0)+weight);}
    if(personalized){
      for(const f of Object.values(favorites)){if(!f?.subject)continue;add(f.subject,f.status==='在看'?3:2);events.push([f.subject.id,f.status,f.progress]);}
      try{for(let i=0;i<localStorage.length;i++){const name=localStorage.key(i);if(!name?.startsWith('ciyuan-watch-'))continue;try{const progress=JSON.parse(localStorage.getItem(name));if(!(progress?.time>=30))continue;const s=entry(name.slice('ciyuan-watch-'.length));if(!s)continue;const age=Math.max(0,(Date.now()-Date.parse(progress.updatedAt))/86400000);add(s,Number.isFinite(age)?Math.max(.25,2/(1+age/30)):1);events.push([s.id,progress.episode]);}catch{}}}catch{}
    }
    return {weights,seen,signature:JSON.stringify([personalized,events.sort((a,b)=>String(a[0]).localeCompare(String(b[0])))])};
  }
  function choose(){
    const profile=interests();fingerprint=profile.signature;
    const previous=new Set(batch.map(key));
    if(!previous.size)try{for(const k of JSON.parse(localStorage.getItem('ciyuan-recommendation-last')||'[]'))previous.add(k);}catch{}
    const pool=subjects(),unseen=pool.filter(s=>!profile.seen.has(key(s)));
    const fresh=(unseen.length>=5?unseen:pool).filter(s=>!previous.has(key(s)));
    const candidates=fresh.length>=5?fresh:unseen.length>=5?unseen:pool;
    const maxWeight=Math.max(1,...profile.weights.values());
    const ranked=candidates.map(s=>{
      const matching=tags(s).filter(t=>profile.weights.has(t));
      const affinity=matching.reduce((sum,t)=>sum+profile.weights.get(t)/maxWeight,0);
      const popularity=Math.log1p(Number(s.collection?.total)||Number(s.collection?.doing)||0);
      return {s,affinity,matching,quality:score(s)+popularity*.35};
    });
    const selected=[];
    function pick(list){if(!list.length)return;const top=list.slice(0,100);const chosen=top[Math.floor(Math.random()*top.length)];selected.push(chosen);ranked.splice(ranked.indexOf(chosen),1);}
    // Three interest-led slots plus two discovery slots; all slots rotate within a quality pool.
    if(profile.weights.size)for(let i=0;i<3;i++)pick(ranked.filter(x=>x.affinity>0).sort((a,b)=>(b.affinity*4+b.quality)-(a.affinity*4+a.quality)).slice(0,30));
    while(selected.length<Math.min(5,candidates.length))pick([...ranked].sort((a,b)=>b.quality-a.quality));
    batch=selected.map(x=>({...x.s,recommendationReason:profile.weights.size&&x.matching.length?'因为你喜欢'+x.matching.slice(0,2).join('、'):'资源库热门发现'}));
    try{localStorage.setItem('ciyuan-recommendation-last',JSON.stringify(batch.map(key)));}catch{}
    document.querySelector('.hero-switch').innerHTML=batch.map((s,i)=>`<button data-hero="${i}" aria-label="推荐 ${i+1}：${safe(title(s))}"></button>`).join('');
    document.querySelectorAll('[data-hero]').forEach(b=>b.onclick=()=>show(Number(b.dataset.hero)));
    show(0);
  }
  function show(i){
    if(!batch.length){if(catalog.length)choose();return;}
    heroIndex=((i%batch.length)+batch.length)%batch.length;const s=batch[heroIndex];
    document.querySelector('#hero-title').textContent=title(s);
    document.querySelector('.hero-kicker').textContent=s.recommendationReason;
    document.querySelector('#hero-desc').textContent=s.summary?.replace(/<[^>]*>/g,'').slice(0,100)||`${s.date?.slice(0,4)||'资源库收录'} · ${s.platform||'日本动画'}。打开作品查看简介、剧集与线路。`;
    document.querySelector('.hero-tags').innerHTML=tags(s).filter(t=>!ignored.test(t)).slice(0,2).map(t=>`<span>${safe(t)}</span>`).join('');
    document.querySelector('#hero-art').innerHTML=`<img src="${safe(image(s))}" alt="${safe(title(s))}" referrerpolicy="no-referrer">`;
    document.querySelector('#hero-art img').onerror=e=>{e.target.onerror=null;e.target.src='icon.svg';};
    document.querySelector('#hero-open').onclick=()=>openDetail(s.id);
    document.querySelector('.hero-index').innerHTML=`${String(heroIndex+1).padStart(2,'0')} <i>/ ${String(batch.length).padStart(2,'0')}</i>`;
    document.querySelectorAll('[data-hero]').forEach(b=>{const active=Number(b.dataset.hero)===heroIndex;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  }
  const tools=document.createElement('div');tools.className='recommendation-tools';tools.innerHTML='<button id="refresh-recommendations" type="button">↻ 换一批</button><label><input id="personalized-recommendations" type="checkbox"> 按本机兴趣推荐</label>';
  document.querySelector('.hero-content').append(tools);
  const control=document.querySelector('#personalized-recommendations');control.checked=personalized;control.title='仅使用当前浏览器的收藏、观看记录和题材标签，不上传个人兴趣。';
  control.onchange=()=>{personalized=control.checked;try{localStorage.setItem('ciyuan-personalized',personalized?'on':'off');}catch{}choose();};
  document.querySelector('#refresh-recommendations').onclick=choose;
  setHero=show;
  document.querySelector('#refresh').onclick=()=>{if(!keyword&&view==='home'){choose();return;}onlineSearch();};
  const priorPersist=persist;persist=function(){const result=priorPersist();if(catalog.length&&interests().signature!==fingerprint)choose();return result;};
  const priorView=setView;setView=function(next){priorView(next);if(next==='home'&&catalog.length&&interests().signature!==fingerprint)choose();};
  document.querySelector('#player-dialog').addEventListener('close',()=>{if(catalog.length&&interests().signature!==fingerprint)choose();});
  let hovered=false;const hero=document.querySelector('#hero');hero.addEventListener('pointerenter',()=>hovered=true);hero.addEventListener('pointerleave',()=>hovered=false);
  setInterval(()=>{if(!document.hidden&&!document.querySelector('dialog[open]')&&!hovered&&!hero.contains(document.activeElement)&&view==='home'&&!keyword&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&batch.length)show(heroIndex+1);},8000);
  window.CiyuanRecommendations={show,refresh:choose,getIds:()=>batch.map(s=>s.id)};
  if(catalog.length)choose();
})();
