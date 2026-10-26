import fs from 'node:fs/promises';
import path from 'node:path';
import c from './free-reading-core.cjs';
import pub from './public-reading-core.cjs';
import parser from './additional-reading-core.cjs';

const root=path.resolve(process.argv[2]||'docs'),read=async f=>JSON.parse(await fs.readFile(path.join(root,f),'utf8'));
const state=await read('reading-sources.json'),index=await read('books-index.json'),refresh=process.argv.includes('--refresh'),now=new Date().toISOString();
const deadline=Date.now()+360000,blocked=new Set(),failures=new Map(),errors=(state.additionalReading?.errors||[]).filter(e=>process.argv.includes('--manga')?e.provider!=='hlgmh':process.argv.includes('--novels')?e.provider!=='kxgxs':false),targets={novels:[],manga:[]};
for(const y of index.years)for(const s of(await read('books/'+y.kind+'-'+y.year+'.json')).items)if(pub.eligibleTitle(s)&&!state.restricted?.[y.kind+':'+s.id])targets[y.kind].push(s);
const names=s=>[s.name_cn,s.name].filter(Boolean),entries=r=>[r,...(r?.alternatives||[])].filter(Boolean);
async function get(url,image=false){
 const u=new URL(url),allowed=u.origin==='https://kxgxs.com'?/^\/index\.php\/(?:library\/books\/5(?:\/\d+)?|book\/(?:info|catalog)\/\d+|book\/read\/\d+\/\d+)$/.test(u.pathname):u.origin==='https://hlgmh.com'?/^\/(?:search|comic\/hlg-[a-z0-9]+|chapter\/hlg-[a-z0-9]+)$/.test(u.pathname):image&&u.origin==='https://img.hlgmh.com'&&u.pathname.includes('/chapters/');
 if(!allowed||u.username||u.password||u.hash)throw Error('非允许的公开阅读路径');
 if(blocked.has(u.host)||Date.now()>deadline)throw Error('本轮来源暂停或预算到期');
 let r;try{r=await fetch(url,{redirect:'error',headers:{'User-Agent':'CiyuanReadingLinkCheck/1.0',...(image?{Range:'bytes=0-511'}:{})},signal:AbortSignal.timeout(12000)});}catch(e){const n=(failures.get(u.host)||0)+1;failures.set(u.host,n);if(n>=3)blocked.add(u.host);throw e;}
 if([403,429].includes(r.status))blocked.add(u.host);
 if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status);}
 await new Promise(r=>setTimeout(r,700));
 if(image){const reader=r.body?.getReader(),part=await reader?.read();await reader?.cancel();const b=part?.value,type=r.headers.get('Content-Type')||'',magic=!!b&&(b[0]===255&&b[1]===216&&b[2]===255||b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71||b[0]===82&&b[1]===73&&b[2]===70&&b[3]===70&&b[8]===87&&b[9]===69&&b[10]===66&&b[11]===80);if(!type.startsWith('image/')||!magic)throw Error('漫画图签名不匹配');return{status:r.status,contentType:type,magicValid:true};}
 const html=await r.text();if(html.length>2000000)throw Error('页面过大');return html;
}
function invalidate(key,provider,url,error){for(const e of entries(state.items[key]))if(e.provider===provider&&(!url||e.readerUrl===url)){e.state='verification-failed';e.lastAttemptAt=now;e.lastError=error;}}
const reports={};
for(const kind of ['novels','manga']){
 if(process.argv.includes('--novels')&&kind!=='novels'||process.argv.includes('--manga')&&kind!=='manga')continue;
 const provider=kind==='novels'?'kxgxs':'hlgmh',origin=kind==='novels'?'https://kxgxs.com':'https://hlgmh.com',rows=[];let checked=0,verified=0;
 if(refresh){for(const s of targets[kind])for(const e of entries(state.items[kind+':'+s.id]))if(e.provider===provider&&e.readerUrl)rows.push({s,e});}
 else if(kind==='novels'){
  const catalog=[];for(let p=1;p<=5&&!blocked.has('kxgxs.com')&&Date.now()<deadline;p++){const url=origin+'/index.php/library/books/5'+(p>1?'/'+p:'')+'?sort=popular';try{catalog.push(...parser.novelList(await get(url)));}catch(e){errors.push({provider,url,error:e.message});}}
  for(const r of catalog){const hits=targets.novels.filter(s=>names(s).some(n=>c.norm(n)===c.norm(r.title)));if(hits.length===1)rows.push({s:hits[0],r});}
 }else{
  const retryIds=new Set([279379,...(state.additionalReading?.errors||[]).filter(e=>e.provider==='hlgmh').map(e=>Number(e.key?.split(':')[1]))]);
  rows.push(...targets.manga.filter(s=>s.name_cn&&c.norm(s.name_cn).length>=3&&(!process.argv.includes('--retry-failed')||retryIds.has(s.id))).sort((a,b)=>(a.annualRank||50)-(b.annualRank||50)).map(s=>({s})));
 }
 const previous=state.additionalReading?.[kind]||{},retry=process.argv.includes('--retry-failed'),unique=[...new Map(rows.map(r=>[r.s.id,r])).values()],cursor=retry?0:Number(refresh?previous.refreshCursor:previous.cursor)||0,batch=Array.from({length:Math.min(refresh?48:kind==='novels'?32:16,unique.length)},(_,i)=>unique[(cursor+i)%unique.length]);
 for(const row of batch){if(blocked.has(new URL(origin).host)||Date.now()>deadline)break;const{s,e:old,r}=row,key=kind+':'+s.id;checked++;
  try{
   let match,readerUrl,directoryUrl,evidence;
   if(kind==='novels'){
    directoryUrl=old?.directoryUrl||origin+r.path.replace('/info/','/catalog/');const id=directoryUrl.split('/').at(-1);
    match=old?{title:old.title,chapterTitle:old.chapterTitle,listedChapters:old.listedChapters}:parser.novelCatalog(await get(directoryUrl),id,names(s));
    if(!match)throw Error('作品名或目录不匹配');readerUrl=old?.readerUrl||origin+match.path;evidence=parser.novelEvidence(await get(readerUrl));if(!evidence?.readable)throw Error('中文正文不足或存在阅读门槛');
   }else{
    let comicPath=old?new URL(old.directoryUrl).pathname:null;
    if(!comicPath){const url=origin+'/search?keyword='+encodeURIComponent(s.name_cn),matches=parser.mangaSearch(await get(url),names(s));if(matches.length!==1)throw Error('搜索结果没有唯一同名作品');comicPath=matches[0].path;}
    directoryUrl=origin+comicPath;match=old?{title:old.title,chapterTitle:old.chapterTitle,listedChapters:old.listedChapters}:parser.mangaCatalog(await get(directoryUrl),names(s));if(!match)throw Error('作品名或首话目录不匹配');readerUrl=old?.readerUrl||origin+match.path;
    const pages=parser.mangaPages(await get(readerUrl),names(s),comicPath);if(pages.length<3)throw Error('无公开漫画图或作品关联不匹配');
    evidence={httpStatus:200,isPublic:true,publicBasis:'anonymous-server-rendered-reader',imageProbe:await get(pages[0],true),additionalImageProbe:await get(pages[2],true),listedImages:pages.length,scope:'免登录取得阅读页并抽检第一、第三张漫画图；中文来源，未逐页核对翻译与全系列完整性。'};
   }
   const entry={kind,provider,title:match.title,url:directoryUrl,directoryUrl,readerUrl,state:'sample-readable',language:'zh',anonymous:true,freeScope:kind==='novels'?'checked-page':'checked-episode-image',checkedPages:kind==='novels'?1:undefined,checkedImages:kind==='manga'?2:undefined,listedChapters:match.listedChapters,chapterTitle:match.chapterTitle,match:'exact-title-and-public-reader',lastAttemptAt:now,lastSuccessAt:new Date().toISOString(),lastVerifiedAt:new Date().toISOString(),readerEvidence:{httpStatus:200,...evidence,scope:evidence.scope||'免登录抽检一页中文正文，不保存正文；未验证全卷、后续分页及译文质量。'},rights:'来源授权未核实'};
   state.items[key]=pub.mergeEntry(state.items[key],entry);verified++;console.log(JSON.stringify({kind,id:s.id,title:s.name_cn||s.name,state:entry.state,provider}));
  }catch(e){if(refresh)invalidate(key,provider,old?.readerUrl,e.message);errors.push({provider,key,error:e.message});}
 }
 reports[kind]={checkedAt:now,checked,verified,failed:checked-verified,pending:batch.length-checked,cursor:refresh||retry?(previous.cursor||0):(cursor+checked)%Math.max(1,unique.length),refreshCursor:refresh?(cursor+checked)%Math.max(1,unique.length):(previous.refreshCursor||0),candidates:refresh||retry?(previous.candidates||unique.length):unique.length};
 console.log(JSON.stringify({phase:'additional-'+kind,...reports[kind]}));
}
state.additionalReading={...(state.additionalReading||{}),...reports,checkedAt:now,mode:refresh?'refresh':'discovery',scope:'每周分批扩充既有日本年度榜同名作品；每日轮查已有正文或漫画图。抽检可读不代表全本完整、翻译质量或大陆网络可达。',errors};state.checkedAt=now;if(Object.values(reports).some(r=>r.verified))state.lastSuccessAt=new Date().toISOString();await fs.writeFile(path.join(root,'reading-sources.json'),JSON.stringify(state));
