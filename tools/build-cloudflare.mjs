import {compact,coverFallbacks,homeCatalog} from './build-cloudflare-data.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]||'docs'),out=path.resolve(process.argv[3]||'cloudflare-dist'),template=path.resolve('cloudflare-template');
if(out===root||out===template)throw Error('Build directory must be separate');
await fs.mkdir(out,{recursive:true});await fs.cp('cloudflare-probe',out,{recursive:true});
const site=path.join(out,'preview');await fs.mkdir(site,{recursive:true});await fs.cp(template,site,{recursive:true});
for(const name of await fs.readdir(root)){if(name.endsWith('.json'))await fs.copyFile(path.join(root,name),path.join(site,name));}
await fs.cp(path.join(root,'details'),path.join(site,'details'),{recursive:true});
const covers=await coverFallbacks(root);
for(const name of ['catalog.json','vod-catalog.json']){const data=JSON.parse(await fs.readFile(path.join(root,name),'utf8'));if(name==='catalog.json'){await fs.mkdir(path.join(site,'subject-details'),{recursive:true});for(const s of data.items)await fs.writeFile(path.join(site,'subject-details',s.id+'.json'),JSON.stringify(s));}await fs.writeFile(path.join(site,name),JSON.stringify({fetchedAt:data.fetchedAt,directoryMode:'lazy',items:data.items.map(s=>compact(covers.has(s.id)?{...s,coverAlternatives:[covers.get(s.id)]}:s))}));}
const sourceStatus=JSON.parse(await fs.readFile(path.join(root,'update-status.json'),'utf8')),catalog=JSON.parse(await fs.readFile(path.join(site,'vod-catalog.json'),'utf8')),annual=JSON.parse(await fs.readFile(path.join(site,'annual-top50.json'),'utf8'));
await fs.writeFile(path.join(site,'home-catalog.json'),JSON.stringify(homeCatalog(catalog)));
const enabled=process.env.CIYUAN_AUTOMATION_ENABLED==='true';
const status={...sourceStatus,updatedAt:catalog.fetchedAt,total:catalog.items.length,publishedAt:new Date().toISOString(),runtime:'cloudflare-pages',schedule:{enabled,mode:'github-actions-cloudflare-pages',timezone:'Asia/Shanghai',daily:{cron:'17 0 * * *',time:'08:17'},rankings:{cron:'47 0 * * 1',weekday:'Monday',time:'08:47',intervalDays:7}},rankingsUpdatedAt:annual.fetchedAt,workflowUrl:'https://github.com/yunni-123/ciyuan-anime/actions/workflows/publish.yml',note:enabled?'作品资料每日更新，年度 Top50 每周一更新；平台可能排队，来源失败保留旧资料。':'本次已发布最新资料；自动发布等待 Cloudflare 仓库密钥配置。'};
await fs.writeFile(path.join(site,'update-status.json'),JSON.stringify(status));
let html=await fs.readFile(path.join(site,'index.html'),'utf8');html=html.replace(/轻量版测试入口 · 作品资料按需加载 · 当前为发布时快照，自动发布尚未接通。/g,enabled?'作品资料每日更新 · 年度 Top50 每周更新 · 资料按需加载。':'最新作品资料 · 资料按需加载 · 自动发布等待配置。');
html=html.replace(/轻量版测试入口[^<]*自动发布尚未接通。/g,status.note);await fs.writeFile(path.join(site,'index.html'),html);
const version=createHash('sha256').update(html+JSON.stringify(status)).digest('hex').slice(0,12);
let sw=await fs.readFile(path.join(site,'sw.js'),'utf8');sw=sw.replace(/const CACHE='[^']+'/,'const CACHE=\'ciyuan-cloudflare-'+version+'\'');sw=sw.replace(/const SHELL=\[[^;]+;/, 'const SHELL='+JSON.stringify(['./','home-catalog.json',...new Set([...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)].map(m=>m[1])),'icon.svg','manifest.webmanifest'])+';');await fs.writeFile(path.join(site,'sw.js'),sw);
await fs.writeFile(path.join(out,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Cache-Control: public, max-age=300, must-revalidate\n\n/preview/*.json\n  Cache-Control: no-cache, must-revalidate\n\n/preview/sw.js\n  Cache-Control: no-cache, must-revalidate\n');
await fs.copyFile('tools/cloudflare-worker.mjs',path.join(out,'_worker.js'));
await fs.writeFile(path.join(out,'_routes.json'),JSON.stringify({version:1,include:['/preview/*.json','/preview/details/*','/preview/subject-details/*','/preview/cover'],exclude:[]}));
let fileCount=0;async function count(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await count(p);else{fileCount++;if((await fs.stat(p)).size>25*1024*1024)throw Error('Cloudflare file too large: '+p);}}}await count(out);if(fileCount>20000)throw Error('Free Pages file limit exceeded: '+fileCount);
console.log(JSON.stringify({out,fileCount,items:catalog.items.length,annualYears:annual.years.length,automationEnabled:enabled,publishedAt:status.publishedAt}));
