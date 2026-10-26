import fs from 'node:fs/promises';
import path from 'node:path';
import core from './free-reading-core.cjs';
import pub from './public-reading-core.cjs';

const root=path.resolve(process.argv[2]||'docs'),read=async f=>JSON.parse(await fs.readFile(path.join(root,f),'utf8'));
const state=await read('reading-sources.json'),index=await read('books-index.json'),yearArg=Number(process.argv.find(a=>/^--year=20\d{2}$/.test(a))?.split('=')[1])||null;
const now=new Date().toISOString(),started=Date.now(),maxMs=330000,errors=[],reports={},delay=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>core.norm(s),entries=x=>[x,...(x?.alternatives||[])].filter(Boolean);
const checkedTitleIds={...(state.narouReading?.checkedTitleIds||{})};
function chapterEvidence(html){
 const title=core.clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 const open=/<div\b[^>]*class=["'][^"']*js-novel-text[^"']*["'][^>]*>/i.exec(html);if(!open)return null;
 const tail=html.slice(open.index+open[0].length),tags=/<\/?div\b[^>]*>/gi;let depth=1,end=-1,m;
 while((m=tags.exec(tail))){depth+=/^<\//.test(m[0])?-1:1;if(!depth){end=m.index;break;}}
 if(end<0)return null;const body=core.clean(tail.slice(0,end)),japanese=(body.match(/[\u3040-\u30ff\u3400-\u9fff]/g)||[]).length;
 const gate=/ログイン|会員登録|購入|有料|閲覧できません|公開停止/.test(body);
 return {title,characters:body.length,japaneseCharacters:japanese,gate};
}
async function fetchText(url,api=false){
 const r=await fetch(url,{redirect:'error',headers:{'User-Agent':'CiyuanResourceLinkCheck/1.0 (+https://github.com/yunni-123/ciyuan-anime)',...(api?{Accept:'application/json'}:{})},signal:AbortSignal.timeout(12000)});
 if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status);}
 const text=await r.text();if(text.length>3_000_000)throw Error('页面超过读取上限');return text;
}
if(process.argv.includes('--refresh')){
 const titles=new Map();for(const year of index.years.filter(y=>y.kind==='novels'))for(const s of(await read(path.join('books','novels-'+year.year+'.json'))).items)titles.set(String(s.id),s);
 const batch=Object.entries(state.items).filter(([key,e])=>key.startsWith('novels:')&&entries(e).some(x=>x.provider==='narou'&&x.state==='sample-readable'));
 for(const [key,entry]of batch){const source=entries(entry).find(x=>x.provider==='narou'&&x.state==='sample-readable'),target=titles.get(key.slice(7));try{const html=await fetchText(source.readerUrl),evidence=chapterEvidence(html);if(!target||!evidence||norm(evidence.title.split(/\s+[-–—]\s+/)[0])!==norm(target.name)||evidence.characters<500||evidence.japaneseCharacters<200||evidence.gate)throw Error('首话抽检失效或标题不匹配');source.readerEvidence={...source.readerEvidence,httpStatus:200,characters:evidence.characters,japaneseCharacters:evidence.japaneseCharacters,gate:false,scope:'小説家になろう匿名第一话日文正文复核；未保存正文。'};source.lastAttemptAt=source.lastSuccessAt=source.lastVerifiedAt=new Date().toISOString();
  }catch(e){source.state='verification-failed';source.lastAttemptAt=now;source.lastError=e.message;errors.push({key,error:e.message});}await delay(250);}
 state.narouReading={...state.narouReading,checkedAt:now,refresh:{checked:batch.length,valid:batch.filter(([key,e])=>entries(e).some(x=>x.provider==='narou'&&x.state==='sample-readable')).length,failed:errors.length,scope:'每日抽查已收录小説家になろう入口。'},errors:errors.slice(-300)};state.checkedAt=now;await fs.writeFile(path.join(root,'reading-sources.json'),JSON.stringify(state));console.log(JSON.stringify({phase:'narou-refresh',checked:batch.length,valid:batch.length-errors.length,failed:errors.length}));process.exit(0);
}
const yearRows=index.years.filter(y=>y.kind==='novels'&&(!yearArg||y.year===yearArg));
const coverage=new Map();for(const year of yearRows){const c=await read(path.join('books','novels-'+year.year+'.json'));coverage.set(year.year,c.items.filter(s=>entries(state.items['novels:'+s.id]).some(e=>core.verifiedSample(e))).length);}
for(const year of yearRows.sort((a,b)=>(coverage.get(a.year)||0)-(coverage.get(b.year)||0)||a.year-b.year)){
 const catalog=await read(path.join('books','novels-'+year.year+'.json')),items=catalog.items.filter(s=>pub.eligibleTitle(s)&&!state.restricted?.['novels:'+s.id]);
 const alreadyChecked=new Set(checkedTitleIds[year.year]||[]),candidates=items.filter(s=>!alreadyChecked.has(s.id)&&!entries(state.items['novels:'+s.id]).some(e=>core.verifiedSample(e)));
 const report={checked:0,verified:0,failed:0,pending:0};
 for(const s of candidates){
  if(Date.now()-started>maxMs)break;report.checked++;
  try{
   const q=new URLSearchParams({out:'json',lim:'30',of:'t-n-ga',title:'1',word:s.name});
   const data=JSON.parse(await fetchText('https://api.syosetu.com/novelapi/api/?'+q,true));
   const exact=data.slice(1).filter(x=>norm(x.title)===norm(s.name));
   if(exact.length!==1){(checkedTitleIds[year.year]??=[]).push(s.id);continue;}
   const work=exact[0],base='https://ncode.syosetu.com/'+work.ncode.toLowerCase()+'/',catalogHtml=await fetchText(base);
   const catalogTitle=core.clean(catalogHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/\s*[-|｜].*$/,'');
   if(norm(catalogTitle)!==norm(s.name))throw Error('目录标题与年度作品名不一致');
   const readerUrl=base+'1/',html=await fetchText(readerUrl),evidence=chapterEvidence(html);
   if(!evidence||norm(evidence.title.split(/\s+[-–—]\s+/)[0])!==norm(s.name)||evidence.characters<500||evidence.japaneseCharacters<200||evidence.gate)throw Error('首话未通过匿名日文正文抽检');
   const entry={kind:'novels',provider:'narou',title:work.title,directoryUrl:base,url:base,readerUrl,state:'sample-readable',language:'ja',anonymous:true,freeScope:'checked-page',checkedPages:1,listedChapters:Number(work.general_all_no)||null,chapterTitle:'第1部分（公开页面）',match:'exact-title-and-anonymous-reader',lastAttemptAt:now,lastSuccessAt:new Date().toISOString(),lastVerifiedAt:new Date().toISOString(),readerEvidence:{httpStatus:200,characters:evidence.characters,japaneseCharacters:evidence.japaneseCharacters,gate:false,scope:'小説家になろう官方 API 精确匹配作品名；匿名抽检首话日文正文。站点只记录链接和抽检数值，不保存正文；不代表纸书全卷均免费。'},rights:'作者公开发布页；按来源页面条件阅读'};
   state.items['novels:'+s.id]=pub.mergeEntry(state.items['novels:'+s.id],entry);report.verified++;
   (checkedTitleIds[year.year]??=[]).push(s.id);
   console.log(JSON.stringify({year:year.year,id:s.id,title:s.name_cn||s.name,provider:'narou',state:'sample-readable'}));
  }catch(e){report.failed++;errors.push({year:year.year,id:s.id,error:e.message});}
  await delay(650);
 }
 report.pending=candidates.length-report.checked;reports[year.year]=report;
 console.log(JSON.stringify({phase:'narou',year:year.year,...report}));
 if(Date.now()-started>maxMs)break;
}
const previous=state.narouReading||{};for(const year of Object.keys(checkedTitleIds))checkedTitleIds[year]=[...new Set(checkedTitleIds[year])];state.narouReading={...previous,checkedAt:now,checkedTitleIds,years:{...(previous.years||{}),...Object.fromEntries(Object.entries(reports).map(([year,report])=>[year,{...report,checkedAt:now}]))},errors:errors.slice(-300),scope:'使用小説家になろう官方作品 API 精确匹配年度榜日文标题；匿名检查第一话可读标记。仅记录外链和抽检数据，不复制正文。'};
state.checkedAt=now;if(Object.values(reports).some(r=>r.verified))state.lastSuccessAt=new Date().toISOString();
await fs.writeFile(path.join(root,'reading-sources.json'),JSON.stringify(state));
