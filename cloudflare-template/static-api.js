// Static-hosted API compatibility. Only public metadata is served; no proxy or secrets.
(() => {
  const originalFetch=window.fetch.bind(window),base=new URL('./',location.href);
  const providerNames={sn:'索尼资源',hh:'豪华资源',jy:'金鹰资源',md:'魔都动漫',zy360:'360资源',lz:'量子资源',bf:'暴风资源'};
  let cachedCatalog;
  const file=async name=>{const url=new URL(name,base),detail=name.startsWith('details/');let fallback=null;if(detail&&'caches'in window){try{const hit=await caches.match(url);if(hit){fallback=await hit.json();if(Date.now()-Number(hit.headers.get('X-Directory-Saved'))<3600000)return fallback;}}catch{}}let r;try{r=await originalFetch(url,{signal:AbortSignal.timeout(name==='vod-catalog.json'?45000:6500),cache:'no-store'});}catch(error){if(fallback)return fallback;throw error;}if(!r.ok){if(fallback)return fallback;throw Error('资料尚未发布');}const data=await r.json();if(detail&&'caches'in window){try{const cache=await caches.open('ciyuan-directory-v1');await cache.put(url,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','X-Directory-Saved':String(Date.now())}}));const keys=await cache.keys();for(const old of keys.slice(0,Math.max(0,keys.length-40)))await cache.delete(old);}catch{}}return data;};
  const catalog=()=>cachedCatalog||(cachedCatalog=file('vod-catalog.json'));
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
  async function api(url,method) {
    if(method!=='GET'&&method!=='HEAD')return json({error:'静态网站不允许访客修改云端资源'},403);
    const u=new URL(url,location.href);
    if(u.pathname==='/api/runtime-config')return json({relayEnabled:false,freeTier:true,storage:'published'});
    if(u.pathname==='/api/catalog')return json({...await catalog(),storage:'published'});
    if(u.pathname==='/api/update-status')return json({...await file('update-status.json'),access:'anonymous',runtime:'cloudflare-pages',freeTier:true,siteUrl:base.href});
    if(u.pathname==='/api/providers')return json({providers:Object.entries(providerNames).map(([id,name])=>({id,name}))});
    if(u.pathname==='/api/vod') {
      const provider=u.searchParams.get('source')||'lz',id=u.searchParams.get('id'),q=(u.searchParams.get('q')||'').trim().toLowerCase(),page=Number(u.searchParams.get('page')||1),region=u.searchParams.get('region')||'jp';
      if(!providerNames[provider]||!Number.isInteger(page)||page<1||page>500||q.length>100||id&&!/^\d{1,12}$/.test(id)||!['jp','cn','all'].includes(region))return json({error:'参数无效'},400);
      if(id){const source=(await catalog()).items.flatMap(s=>(s.inlineSources||[]).map(x=>({...x,name:s.name,name_cn:s.name_cn}))).find(s=>s.provider===provider&&s.vodId===id);if(source)return json({provider:providerNames[provider],items:[{...source,id:'vod_'+provider+'_'+id,providerName:providerNames[provider]}],mode:'embedded'});try{return json({provider:providerNames[provider],items:[await file(`details/${provider}_${id}.json`)],mode:'published'});}catch{return json({provider:providerNames[provider],items:[],mode:'published'});}}
      const data=await catalog(),map=new Map();
      for(const s of data.items)for(const variant of [{...s},...(s.alternatives||[]).map(a=>({...s,...a,id:`vod_${a.provider}_${a.vodId}`,providerName:providerNames[a.provider]}))]) {
        if(variant.provider===provider&&(region==='all'||variant.region===region)&&(!q||(variant.name_cn+' '+variant.name).toLowerCase().includes(q)))map.set(variant.provider+'_'+variant.vodId,variant);
      }
      const items=[...map.values()];return json({provider:providerNames[provider],items:items.slice((page-1)*30,page*30),total:items.length,page,pagecount:Math.ceil(items.length/30),mode:'published',checkedAt:data.fetchedAt});
    }
    if(u.pathname==='/api/bangumi') {
      const data=await file('catalog.json'),q=(u.searchParams.get('q')||'').toLowerCase(),type=Number(u.searchParams.get('type')||2),offset=Number(u.searchParams.get('offset')||0);
      const items=data.items.filter(s=>s.type===type&&(!q||(s.name_cn+' '+s.name).toLowerCase().includes(q)));return json({data:items.slice(offset,offset+30),total:items.length,limit:30,offset});
    }
    return json({error:'此免费静态版本使用直连播放与云端发布目录'},403);
  }
  window.fetch=async(input,options={})=>{
    const u=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
    if(u.origin==='https://api.bgm.tv'&&/^\/v0\/subjects\/\d+$/.test(u.pathname)){try{return json(await file('subject-details/'+u.pathname.split('/').pop()+'.json'));}catch{return json({error:'本测试版未收录此资料'},404);}}if(u.origin===location.origin&&u.pathname.startsWith('/api/'))return api(u.href,(options.method||input?.method||'GET').toUpperCase());
    return originalFetch(input,options);
  };
})();
