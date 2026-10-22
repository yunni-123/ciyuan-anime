import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(process.argv[2]||'docs'),file=path.join(root,'announcements.json');
const data=JSON.parse(await fs.readFile(file,'utf8'));
const feeds=['https://www.toho.co.jp/anime/','https://dr-stone.jp/news/','https://frieren-anime.jp/news/','https://delicious-in-dungeon.com/news.html','https://anime.kagurabachi.jp/news/','https://happy-kanako-anime.jp/news/','https://soara-anime.com/'];
const latest=new Map((data.latestOfficial||[]).map(x=>[x.url,x]));let reached=0;
await Promise.all(feeds.map(async url=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'CiyuanAnnouncementMonitor/1.0'}});if(!r.ok)return;const html=await r.text();if(html.length>3000000)return;reached++;
  for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const title=m[2].replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi,' $1 ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
    if(!/制作決定|アニメ化決定/.test(title)||title.length<8||title.length>200)continue;
    const link=new URL(m[1],url);if(link.protocol!=='https:'||link.hostname!==new URL(url).hostname||link.href===url)continue;
    const date=title.match(/(20\d{2})[年.\/-](\d{1,2})[月.\/-](\d{1,2})/);if(date&&Date.now()-new Date(`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}T00:00:00Z`).getTime()>120*86400000)continue;
    if(!(data.items||[]).some(x=>x.source===link.href))latest.set(link.href,{title,url:link.href,observedAt:new Date().toISOString()});
  }
}catch{}}));
if(reached){data.lastCheckedAt=new Date().toISOString();data.latestOfficial=[...latest.values()].sort((a,b)=>(b.observedAt||'').localeCompare(a.observedAt||'')).slice(0,12);}
data.monitor={sources:feeds.length,reached,lastAttemptAt:new Date().toISOString(),note:'仅从指定官网提取明确标注制作决定或动画化决定的公告标题；既有人工核实档期不自动改写。'};
await fs.writeFile(file,JSON.stringify(data));console.log(JSON.stringify({officialSitesReached:reached,latestOfficial:data.latestOfficial?.length||0}));
