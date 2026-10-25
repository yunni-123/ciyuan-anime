import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
import {handle,coverURL} from './cloudflare-worker.mjs';

test('single-title directory loads without downloading the search catalog',async()=>{
 const requests=[],window={fetch:async url=>{requests.push(String(url));if(String(url).endsWith('vod-catalog.json'))return new Promise(()=>{});return new Response(JSON.stringify({id:'vod_md_1',playGroups:[{episodes:[{name:'01'}]}]}));}};
 const context={window,location:{href:'https://example.pages.dev/preview/',origin:'https://example.pages.dev'},URL,Response,AbortSignal,Date};
 vm.runInNewContext(await fs.readFile('cloudflare-template/static-api.js','utf8'),context);
 const data=await(await window.fetch('/api/vod?source=md&id=1')).json();assert.equal(data.items[0].id,'vod_md_1');assert.deepEqual(requests,['https://example.pages.dev/preview/details/md_1.json']);
});

test('a failed catalog request can recover on retry',async()=>{
 let calls=0;const window={fetch:async()=>{if(++calls===1)throw Error('offline');return new Response('{"items":[]}');}};
 vm.runInNewContext(await fs.readFile('cloudflare-template/static-api.js','utf8'),{window,location:{href:'https://example.pages.dev/preview/',origin:'https://example.pages.dev'},URL,Response,AbortSignal,Date});
 await assert.rejects(window.fetch('/api/catalog'));assert.deepEqual((await(await window.fetch('/api/catalog')).json()).items,[]);assert.equal(calls,2);
});

test('cover relay permits fixed image hosts only, never video or arbitrary destinations',()=>{
 assert(coverURL('https://lain.bgm.tv/pic/cover/l/a.jpg'));assert(coverURL('https://www.imgzy360.com:7788/upload/vod/a.webp'));
 for(const u of ['https://evil.test/a.jpg','http://lain.bgm.tv/a.jpg','https://lain.bgm.tv/a.m3u8','https://user:secret@lain.bgm.tv/a.jpg','https://lain.bgm.tv:444/a.jpg','https://lain.bgm.tv/a.jpg?redirect=evil','https://lain.bgm.tv/a.svg'])assert.equal(coverURL(u),null,u);
});
function edge(fetcher){const entries=new Map(),pending=[];return{env:{ASSETS:{fetch:()=>new Response(null,{status:404})}},ctx:{waitUntil:p=>pending.push(p)},deps:{fetch:fetcher,cache:{match:async k=>entries.get(k.url)?.clone(),put:async(k,v)=>{entries.set(k.url,v.clone());}}},pending};}
test('cover cache isolates visitor credentials and accepts only actual small images',async()=>{
 let calls=0;const r=edge(async(url,init)=>{calls++;assert.equal(init.redirect,'manual');assert(!init.headers.Authorization);assert(!init.headers.Cookie);return new Response(new Uint8Array([255,216,255,0]),{headers:{'Content-Type':'image/jpeg'}});});
 const req=new Request('https://example.pages.dev/preview/cover?url='+encodeURIComponent('https://lain.bgm.tv/pic/cover/a.jpg'),{headers:{Cookie:'private'}});
 let response=await handle(req,r.env,r.ctx,r.deps);assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/jpeg');await Promise.all(r.pending);
 response=await handle(new Request(req.url,{method:'HEAD'}),r.env,r.ctx,r.deps);assert.equal(response.status,200);assert.equal(await response.text(),'');assert.equal(calls,1);
 for(const headers of [{'Content-Type':'text/html'},{'Content-Type':'image/jpeg','Content-Length':'9000000'},{'Content-Type':'image/png'}]){const bad=edge(async()=>new Response('not an image',{headers}));assert.equal((await handle(req,bad.env,bad.ctx,bad.deps)).status,502);}
 const redirect=edge(async()=>new Response(null,{status:302,headers:{Location:'https://untrusted.test/a.jpg'}}));const rejected=await handle(req,redirect.env,redirect.ctx,redirect.deps);assert.equal(rejected.status,502);assert.equal(rejected.headers.get('X-Ciyuan-Cover-Error'),'upstream-302');
});

async function healthHarness(){let now=0,timer;const elements={'#player-status':{},'#retry-playback':{hidden:true}},media={currentTime:0,readyState:0,paused:true,seeking:false,ended:false,pause(){this.paused=true;}},context={navigator:{onLine:true},document:{hidden:false},Date:{now:()=>now},setInterval:fn=>(timer=fn,1),clearInterval(){},setTimeout,clearTimeout,mediaTicket:1,hls:null,video:media,watchState:null,originalQualityPlayback:()=>true,$:s=>elements[s],Hls:{ErrorTypes:{NETWORK_ERROR:'network',MEDIA_ERROR:'media'}}};
 vm.createContext(context);vm.runInContext(await fs.readFile('cloudflare-template/player-health.js','utf8'),context);context.media=media;vm.runInContext('monitorPlayback(media,null,1,"https://example.test/a.m3u8")',context);return{tick:time=>{now=time;timer();},elements,media,context};}
test('initial paused HLS startup has a deadline instead of waiting forever',async()=>{const h=await healthHarness();h.tick(18000);assert.match(h.elements['#player-status'].textContent,/16 秒/);assert.equal(h.elements['#retry-playback'].hidden,false);});
test('a viewer pausing an already started video does not trigger failure',async()=>{const h=await healthHarness();h.media.paused=false;h.media.currentTime=1;h.media.readyState=4;h.tick(2000);h.media.paused=true;h.tick(100000);assert.equal(h.elements['#retry-playback'].hidden,true);});
test('HTTP denial stops even non-fatal HLS retries immediately',async()=>{const h=await healthHarness();vm.runInContext('playerHealth.handleError({fatal:false,response:{code:403}})',h.context);assert.match(h.elements['#player-status'].textContent,/403/);assert.equal(h.elements['#retry-playback'].hidden,false);});
