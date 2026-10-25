const origin='https://raw.githubusercontent.com/yunni-123/ciyuan-anime/main/';
const rootFiles=new Set(['annual-top50.json','announcements.json','franchises.json','novels.json','resource-coverage.json','resource-summary.json','text-only-catalog.json','update-status.json']);
const coverHosts=new Set(['lain.bgm.tv','snzypic.vip','img.lzipic.com','www.mdzypic.com','hhmage.com','p.bfvp26.com','www.imgzy360.com','image.jinyingimage.com','img.bfzypic.com','img.liangzipic.com','img.ffzy888.com']);
export function coverURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&coverHosts.has(u.hostname)&&(!u.port||u.hostname==='www.imgzy360.com'&&u.port==='7788')&&/\.(jpe?g|png|webp)$/i.test(u.pathname)&&!u.search&&!u.hash?u:null;}catch{return null;}}
async function cover(request,ctx,dependencies){
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
 const url=new URL(request.url),remote=coverURL(url.searchParams.get('url'));
 if(!remote)return new Response(null,{status:400});
 const cache=dependencies.cache||caches.default,fetcher=dependencies.fetch||fetch,key=new Request(url.origin+'/preview/cover?url='+encodeURIComponent(remote.href));
 const hit=await cache.match(key);if(hit)return request.method==='HEAD'?new Response(null,hit):hit;
 let failure='network';try{
  const r=await fetcher(remote.href,{redirect:'manual',signal:AbortSignal.timeout(6000),headers:{Accept:'image/webp,image/jpeg,image/png'},cf:{cacheEverything:true,cacheTtl:604800}});
  const type=(r.headers.get('Content-Type')||'').split(';')[0].trim();
  failure=!r.ok?'upstream-'+r.status:!['image/jpeg','image/png','image/webp'].includes(type)?'upstream-type':'too-large';
  if(!r.ok||!['image/jpeg','image/png','image/webp'].includes(type)||Number(r.headers.get('Content-Length'))>2097152){await r.body?.cancel();throw Error('Cover unavailable');}
  failure='body';
  const reader=r.body.getReader(),chunks=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2097152){await reader.cancel();throw Error('Cover too large');}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const valid=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  failure='invalid-image';if(!valid)throw Error('Invalid cover');
  const result=new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=604800','X-Ciyuan-Cover':'edge-cache','X-Content-Type-Options':'nosniff'}});
  failure='cache';ctx.waitUntil(cache.put(key,result.clone()));return request.method==='HEAD'?new Response(null,result):result;
 }catch{return new Response(null,{status:502,headers:{'Cache-Control':'no-store','X-Ciyuan-Cover-Error':failure}});}
}
export function metadataPath(pathname){const prefix='/preview/';if(!pathname.startsWith(prefix))return null;const file=pathname.slice(prefix.length);if(file==='catalog.json'||file==='vod-catalog.json'||/^subject-details\/\d+\.json$/.test(file))return 'cloudflare-data/'+file;if(rootFiles.has(file)||/^details\/[a-z0-9]+_\d+\.json$/.test(file))return 'docs/'+file;return null;}
export async function handle(request,env,ctx,dependencies={}){
 const url=new URL(request.url);if(url.pathname==='/preview/cover')return cover(request,ctx,dependencies);
 const upstream=metadataPath(url.pathname);if(!upstream)return env.ASSETS.fetch(request);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const cache=dependencies.cache||caches.default,fetcher=dependencies.fetch||fetch;
 const key=new Request(url.origin+url.pathname,{method:'GET'}),cached=await cache.match(key);if(cached)return request.method==='HEAD'?new Response(null,cached):cached;
 try{
  const response=await fetcher(origin+upstream,{headers:{Accept:'application/json','User-Agent':'CiyuanCloudMetadata/1.0'},signal:AbortSignal.timeout(5000),cf:{cacheEverything:true,cacheTtl:300}});
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
