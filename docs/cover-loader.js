// Small public covers only. Video requests never pass through this helper.
(() => {
 const base=new URL('./',location.href),edge=location.hostname.endsWith('.pages.dev'),choices=new Map(),states=new WeakMap();
 const hosts=new Set(['lain.bgm.tv','snzypic.vip','img.lzipic.com','www.mdzypic.com','hhmage.com','p.bfvp26.com','www.imgzy360.com','image.jinyingimage.com','img.bfzypic.com','img.liangzipic.com','img.ffzy888.com']);
 function proxy(raw){try{const u=new URL(raw,base);if(edge&&u.protocol==='https:'&&hosts.has(u.hostname)&&/\.(jpe?g|png|webp)$/i.test(u.pathname)&&!u.search)return new URL('cover?url='+encodeURIComponent(u.href),base).href;return u.href;}catch{return new URL('icon.svg',base).href;}}
 window.CiyuanCovers={image(s){
  const raw=s.localImage||s.images?.common||s.images?.medium||s.images?.large||'icon.svg';
  const urls=[raw,...(s.coverAlternatives||[])].filter(Boolean),candidates=[...new Set([...urls.map(proxy),...urls.map(u=>new URL(u,base).href),new URL('icon.svg',base).href])];
  choices.set(candidates[0],candidates);return candidates[0];
 }};
 function arm(img,state){clearTimeout(state.timer);if(state.visible&&!img.complete)state.timer=setTimeout(()=>advance(img),8000);}
 function advance(img){const state=states.get(img);if(!state)return;clearTimeout(state.timer);if(!img.isConnected)return;const next=state.urls[++state.index];if(!next)return;img.src=next;arm(img,state);}
 function watch(img){if(states.has(img)||!choices.has(img.src))return;const state={urls:choices.get(img.src),index:0,visible:false,timer:null};states.set(img,state);observer.observe(img);if(img.complete&&img.naturalWidth===0)advance(img);}
 const observer=new IntersectionObserver(entries=>entries.forEach(e=>{const state=states.get(e.target);if(state){state.visible=e.isIntersecting;arm(e.target,state);}}),{rootMargin:'120px'});
 // Capture errors before legacy placeholder handlers, so a failed origin can use a real alternate cover.
 document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement&&states.has(e.target)){e.stopImmediatePropagation();advance(e.target);}},true);
 document.addEventListener('load',e=>{if(e.target instanceof HTMLImageElement){const state=states.get(e.target);if(state)clearTimeout(state.timer);}},true);
 new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes)if(node.nodeType===1){if(node.tagName==='IMG')watch(node);node.querySelectorAll?.('img').forEach(watch);}for(const node of record.removedNodes)if(node.nodeType===1){const cleanup=img=>{const state=states.get(img);if(state){clearTimeout(state.timer);observer.unobserve(img);}};if(node.tagName==='IMG')cleanup(node);node.querySelectorAll?.('img').forEach(cleanup);}}}).observe(document.body,{childList:true,subtree:true});
 document.querySelectorAll('img').forEach(watch);
})();
