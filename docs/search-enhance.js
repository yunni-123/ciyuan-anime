(() => {
 const engine=window.CiyuanSearch,form=$('#search-form'),input=$('#search'),key='ciyuan-search-history-v1';let history=[];
 try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))history=saved.filter(s=>typeof s==='string'&&s.trim()&&s.length<=80).slice(0,20);}catch{}
 const panel=document.createElement('div');panel.id='search-history';panel.className='search-history';panel.hidden=true;form.append(panel);input.maxLength=80;input.setAttribute('aria-controls',panel.id);input.setAttribute('aria-expanded','false');
 function save(){try{localStorage.setItem(key,JSON.stringify(history));}catch{}}
 function close(){panel.hidden=true;input.setAttribute('aria-expanded','false');}
 function submit(value){input.value=value;close();form.requestSubmit();input.blur();}
 function show(){panel.replaceChildren();const heading=document.createElement('div');heading.className='search-history-heading';const label=document.createElement('strong');label.textContent='最近搜索';heading.append(label);const clear=document.createElement('button');clear.type='button';clear.textContent='清空';clear.disabled=!history.length;clear.onclick=()=>{history=[];save();show();};heading.append(clear);panel.append(heading);
  const list=history.filter(s=>!input.value.trim()||engine.normalize(s).includes(engine.normalize(input.value))).slice(0,10);
  for(const text of list){const row=document.createElement('div');row.className='search-history-row';const button=document.createElement('button');button.type='button';button.className='search-history-term';button.textContent=text;button.onclick=()=>submit(text);const remove=document.createElement('button');remove.type='button';remove.className='search-history-remove';remove.textContent='×';remove.setAttribute('aria-label','删除搜索记录：'+text);remove.onclick=()=>{history=history.filter(s=>s!==text);save();show();};row.append(button,remove);panel.append(row);}
  if(!list.length){const empty=document.createElement('p');empty.textContent=history.length?'没有匹配的历史记录':'搜索过的片名会显示在这里';panel.append(empty);}
  const note=document.createElement('small');note.textContent='仅保存在此浏览器，可随时删除';panel.append(note);panel.hidden=false;input.setAttribute('aria-expanded','true');
 }
 input.addEventListener('focus',show);input.addEventListener('input',show);form.addEventListener('focusout',e=>{if(!form.contains(e.relatedTarget))close();});document.addEventListener('pointerdown',e=>{if(!form.contains(e.target))close();});
 form.addEventListener('keydown',e=>{if(e.key==='Escape'){input.focus();close();return;}if(e.key==='ArrowDown'||e.key==='ArrowUp'){if(panel.hidden)show();const buttons=[...panel.querySelectorAll('.search-history-term')];if(!buttons.length)return;e.preventDefault();const current=buttons.indexOf(document.activeElement),next=e.key==='ArrowDown'?(current+1)%buttons.length:(current<=0?buttons.length-1:current-1);buttons[next].focus();}});
 form.addEventListener('submit',()=>{history=engine.remember(history,input.value);save();close();},true);
 const originalSearch=onlineSearch;
 document.addEventListener('ciyuan-catalog-update',()=>{if(view==='library')onlineSearch(true);});
 onlineSearch=async function(append=false){if(type!==2)return originalSearch(append);
  ++requestId;busy=false;hasMore=false;if(!append)localLimit=48;
  const provider=$('#vod-provider').value,region=$('#vod-region').value,map=new Map();
  for(const s of catalog){if(s.type!==2||s.calendarOnly||keyword.trim()&&!engine.score(s,keyword)||region!=='all'&&s.region&&s.region!==region||provider!=='all'&&s.provider!==provider&&!(s.alternatives||[]).some(a=>a.provider===provider))continue;
   const identity=engine.normalize(s.name_cn||s.name)+'_'+(s.year||s.date?.slice(0,4)||'');const old=map.get(identity);if(!old||!old.provider&&s.provider)map.set(identity,s);
  }
  results=[...map.values()];const pending=window.CiyuanCatalogState?.complete===false;status((keyword?'相关度优先：完整片名 → 片名包含 → 别名与题材相关；同档结果按当前排序。':'')+(pending?' 完整目录后台加载中，结果将自动补全。':''));render();
 };
})();
