const origin='https://raw.githubusercontent.com/yunni-123/ciyuan-anime/main/';
const rootFiles=new Set(['annual-top50.json','announcements.json','franchises.json','novels.json','resource-coverage.json','resource-summary.json','text-only-catalog.json','update-status.json']);
export function metadataPath(pathname){const prefix='/preview/';if(!pathname.startsWith(prefix))return null;const file=pathname.slice(prefix.length);if(file==='catalog.json'||file==='vod-catalog.json'||/^subject-details\/\d+\.json$/.test(file))return 'cloudflare-data/'+file;if(rootFiles.has(file)||/^details\/[a-z0-9]+_\d+\.json$/.test(file))return 'docs/'+file;return null;}
export async function handle(request,env,ctx,dependencies={}){
 const url=new URL(request.url),upstream=metadataPath(url.pathname);if(!upstream)return env.ASSETS.fetch(request);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const cache=dependencies.cache||caches.default,fetcher=dependencies.fetch||fetch;
 const key=new Request(url.origin+url.pathname,{method:'GET'}),cached=await cache.match(key);if(cached)return request.method==='HEAD'?new Response(null,cached):cached;
 try{
  const response=await fetcher(origin+upstream,{headers:{Accept:'application/json','User-Agent':'CiyuanCloudMetadata/1.0'},signal:AbortSignal.timeout(8000),cf:{cacheEverything:true,cacheTtl:300}});
  if(!response.ok)throw Error('Metadata HTTP '+response.status);
  if(Number(response.headers.get('Content-Length'))>12000000)throw Error('Metadata too large');let body=response.body;
  if(url.pathname.endsWith('/update-status.json')){const data=await response.json();data.runtime='cloudflare-pages';data.dataDelivery='cloudflare-same-origin';data.schedule={...data.schedule,mode:'github-actions-cloudflare-data'};body=JSON.stringify(data);}
  const result=new Response(body,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300, must-revalidate','X-Ciyuan-Data':'cloud','X-Content-Type-Options':'nosniff'}});
  ctx.waitUntil(cache.put(key,result.clone()));return request.method==='HEAD'?new Response(null,result):result;
 }catch{
  const fallback=await env.ASSETS.fetch(request);if(!fallback.ok)return fallback;
  const headers=new Headers(fallback.headers);headers.set('X-Ciyuan-Data','snapshot-fallback');headers.set('Cache-Control','no-cache');return new Response(request.method==='HEAD'?null:fallback.body,{status:fallback.status,headers});
 }
}
export default {fetch:handle};
