import fs from 'node:fs/promises';
import path from 'node:path';
import core from './free-reading-core.cjs';
import pub from './public-reading-core.cjs';

const root=path.resolve(process.argv[2]||'docs'),read=async f=>JSON.parse(await fs.readFile(path.join(root,f),'utf8'));
const state=await read('reading-sources.json'),index=await read('books-index.json'),yearArg=Number(process.argv.find(a=>/^--year=20\d{2}$/.test(a))?.split('=')[1])||null;
const started=Date.now(),budget=330000,now=new Date().toISOString(),errors=[],reports={},checkedIds={...(state.kadocomiReading?.checkedTitleIds||{})},delay=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>core.norm(s),entries=x=>[x,...(x?.alternatives||[])].filter(Boolean),headers={'User-Agent':'Mozilla/5.0 (compatible; CiyuanOfficialTrialLinkCheck/1.0)','Accept':'text/html,application/xhtml+xml'};
async function get(url){const u=new URL(url);if(u.origin!=='https://comic-walker.com'||!/^\/(?:search|detail)\//.test(u.pathname)&&!/^\/search$/.test(u.pathname))throw Error('非カドコミ官方路径');const r=await fetch(url,{redirect:'error',headers,signal:AbortSignal.timeout(12000)});if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status);}const h=await r.text();if(h.length>2_000_000)throw Error('页面超过读取上限');return h;}
function pageData(html){const raw=html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];return raw?JSON.parse(raw):null;}
function queryData(page,pathName){return page?.props?.pageProps?.dehydratedState?.queries?.find(q=>q.queryKey?.[0]===pathName)?.state?.data||null;}
function episodeDetails(page){const q=page?.props?.pageProps?.dehydratedState?.queries||[];return q.find(x=>x.queryKey?.[0]==='/api/contents/details/episode')?.state?.data?.episode||null;}
function workDetails(page){const q=page?.props?.pageProps?.dehydratedState?.queries||[];return q.find(x=>x.queryKey?.[0]==='/api/contents/details/work')?.state?.data?.work||null;}
if(process.argv.includes('--refresh')){
 const targets=new Map();for(const y of index.years.filter(y=>y.kind==='manga'))for(const s of(await read(path.join('books','manga-'+y.year+'.json'))).items)targets.set(String(s.id),s);
 const rows=Object.entries(state.items).filter(([key,e])=>key.startsWith('manga:')&&entries(e).some(x=>x.provider==='kadocomi'&&x.state==='sample-readable'));let checked=0,valid=0,failed=0;
 for(const [key,record]of rows){const source=entries(record).find(x=>x.provider==='kadocomi'&&x.state==='sample-readable'),target=targets.get(key.slice(6));checked++;try{const page=pageData(await get(source.readerUrl)),work=workDetails(page),episode=episodeDetails(page);if(!target||norm(work?.title)!==norm(target.name)||!['web','web_trial'].includes(episode?.serviceId)||episode.isActive!==true||Number(episode.internal?.pageCount)<1)throw Error('官方免费试读状态已失效或作品不匹配');source.title=work.title;source.chapterTitle=episode.title;source.listedChapters=Number(episode.internal.pageCount);source.readerEvidence={httpStatus:200,isPublic:true,serviceId:episode.serviceId,pageCount:source.listedChapters,scope:'カドコミ官方网页日常复核：匿名可访问，目录仍标注网页连载或 web_trial。'};source.lastAttemptAt=source.lastSuccessAt=source.lastVerifiedAt=new Date().toISOString();valid++;}catch(e){source.state='verification-failed';source.lastAttemptAt=now;source.lastError=e.message;failed++;}await delay(250);}
 state.kadocomiReading={...state.kadocomiReading,checkedAt:now,refresh:{checked,valid,failed,scope:'每日复核官方试读状态；试读过期的入口立即退出免费统计。'}};state.checkedAt=now;await fs.writeFile(path.join(root,'reading-sources.json'),JSON.stringify(state));console.log(JSON.stringify({phase:'kadocomi-refresh',checked,valid,failed}));process.exit(0);
}
const years=index.years.filter(y=>y.kind==='manga'&&(!yearArg||y.year===yearArg));
const coverage=new Map();for(const y of years){const cat=await read(path.join('books','manga-'+y.year+'.json'));coverage.set(y.year,cat.items.filter(s=>entries(state.items['manga:'+s.id]).some(e=>core.verifiedSample(e))).length);}
for(const year of years.sort((a,b)=>(coverage.get(a.year)||0)-(coverage.get(b.year)||0)||a.year-b.year)){
 const cat=await read(path.join('books','manga-'+year.year+'.json')),targets=cat.items.filter(s=>pub.eligibleTitle(s)&&!state.restricted?.['manga:'+s.id]),done=new Set(checkedIds[year.year]||[]),candidates=targets.filter(s=>!done.has(s.id)&&!entries(state.items['manga:'+s.id]).some(e=>core.verifiedSample(e))),report={checked:0,verified:0,failed:0,pending:0};
 for(const s of candidates){if(Date.now()-started>budget)break;report.checked++;
  try{
   const search=new URL('https://comic-walker.com/search');search.searchParams.set('keyword',s.name);const searchPage=pageData(await get(search.href)),data=queryData(searchPage,'/api/search/keywords'),matches=(data?.result||[]).filter(x=>norm(x.title)===norm(s.name));
   if(!matches.length){(checkedIds[year.year]??=[]).push(s.id);continue;}
   const match=matches.find(x=>x.episode?.code)||matches[0],workCode=match.code,episodeCode=match.episode?.code;if(!workCode||!episodeCode){(checkedIds[year.year]??=[]).push(s.id);continue;}
   const readerUrl='https://comic-walker.com/detail/'+encodeURIComponent(workCode)+'/episodes/'+encodeURIComponent(episodeCode)+'?episodeType=comics',reader=pageData(await get(readerUrl)),work=workDetails(reader),episode=episodeDetails(reader);
   if(!work||norm(work.title)!==norm(s.name)||!episode||!['web','web_trial'].includes(episode.serviceId)||episode.isActive!==true||Number(episode.internal?.pageCount)<1)throw Error('对应章节不是有效的网页免费试读或缺少页数');
   const entry={kind:'manga',provider:'kadocomi',title:work.title,directoryUrl:readerUrl,url:readerUrl,readerUrl,state:'sample-readable',language:'ja',anonymous:true,freeScope:'official-web-trial-chapter',checkedPages:1,listedChapters:Number(episode.internal.pageCount),chapterTitle:episode.title,match:'exact-title-and-official-web-trial',lastAttemptAt:now,lastSuccessAt:new Date().toISOString(),lastVerifiedAt:new Date().toISOString(),readerEvidence:{httpStatus:200,isPublic:true,serviceId:episode.serviceId,pageCount:Number(episode.internal.pageCount),scope:'カドコミ官方网页可匿名打开该话；官方目录标注网页连载或试读入口，已核实试读页数大于0。日文原版，不代表全卷均免费。'},rights:'角川官方网页阅读/试读'};
   state.items['manga:'+s.id]=pub.mergeEntry(state.items['manga:'+s.id],entry);(checkedIds[year.year]??[]).push(s.id);report.verified++;
   console.log(JSON.stringify({year:year.year,id:s.id,title:s.name,provider:'kadocomi',state:'sample-readable',pages:entry.listedChapters}));
  }catch(e){report.failed++;errors.push({year:year.year,id:s.id,error:e.message});if(/不是有效的网页免费试读/.test(e.message))(checkedIds[year.year]??[]).push(s.id);}
  await delay(300);
 }
 checkedIds[year.year]=[...new Set(checkedIds[year.year]||[])];report.pending=candidates.length-report.checked;reports[year.year]=report;console.log(JSON.stringify({phase:'kadocomi',year:year.year,...report}));if(Date.now()-started>budget)break;
}
const old=state.kadocomiReading||{};state.kadocomiReading={...old,checkedAt:now,checkedTitleIds:checkedIds,years:{...(old.years||{}),...Object.fromEntries(Object.entries(reports).map(([y,r])=>[y,{...r,checkedAt:now}]))},errors:errors.slice(-300),scope:'カドコミ官方搜索与章节元数据精确匹配作品；仅收录匿名可访问、目录标注 web_trial 且页面数有效的日文试读章节。不抓取漫画页内容。'};
state.checkedAt=now;if(Object.values(reports).some(r=>r.verified))state.lastSuccessAt=new Date().toISOString();await fs.writeFile(path.join(root,'reading-sources.json'),JSON.stringify(state));
