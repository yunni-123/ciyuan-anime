// Public metadata publisher for a standard, free GitHub-hosted runner.
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'docs');
const providers={md:{name:'魔都动漫',url:'https://www.mdzyapi.com/api.php/provide/vod/',type:2},zy360:{name:'360资源',url:'https://360zy.com/api.php/provide/vod/',type:40},lz:{name:'量子资源',url:'https://cj.lziapi.com/api.php/provide/vod/',type:30},bf:{name:'暴风资源',url:'https://bfzyapi.com/api.php/provide/vod/',type:41}};
const clean=value=>String(value||'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').slice(0,1000);
const identity=s=>(s.name_cn||s.name).replace(/[\s！!·・]/g,'')+'_'+s.year;
const catalogPath=path.join(root,'vod-catalog.json');
const catalog=JSON.parse(await fs.readFile(catalogPath,'utf8'));
const merged=new Map(catalog.items.map(s=>[identity(s),s])),reports={};
let anySuccess=false;
async function get(url){let last;for(let attempt=0;attempt<2;attempt++){try{const r=await fetch(url,{headers:{'User-Agent':'CiyuanMetadata/1.0','Accept':'application/json'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const text=await r.text();if(text.length>5000000)throw Error('Metadata exceeds size limit');return JSON.parse(text);}catch(e){last=e;}}throw last;}
for(const [id,p]of Object.entries(providers)) {
  let pages=0,received=0,failed=0;
  for(let page=1;page<=4;page++) {
    const u=new URL(p.url);u.searchParams.set('ac','detail');u.searchParams.set('t',p.type);u.searchParams.set('pg',page);
    try {
      const data=await get(u);pages++;anySuccess=true;
      for(const x of data.list||[]) {
        if(!/日本/.test(x.vod_area)||!/动漫|动画/.test(x.type_name)||/解说|成人|伦理|里番/.test(x.type_name)||/枫与铃|楓與鈴|Kaede to Suzu|拔作岛|拔作島|ぬきたし|Nukitashi/i.test(x.vod_name))continue;
        const year=Number(String(x.vod_year).match(/\d{4}/)?.[0]);if(!year||year>new Date().getUTCFullYear()+1||!/^\d{1,12}$/.test(String(x.vod_id)))continue;
        const groups=String(x.vod_play_url||'').split('$$$').map((g,i)=>({name:clean(String(x.vod_play_from||'').split('$$$')[i]||'线路 '+(i+1)),episodes:g.split('#').map((e,n)=>{const k=e.indexOf('$');return{name:clean(k<0?'第'+(n+1)+'集':e.slice(0,k)),url:k<0?'':e.slice(k+1).trim()};}).filter(e=>/^https:\/\//i.test(e.url)&&/\.(m3u8|mp4)(\?|$)/i.test(e.url))})).filter(g=>g.episodes.length);
        const entry={id:`vod_${id}_${x.vod_id}`,vodId:String(x.vod_id),provider:id,providerName:p.name,type:2,name:clean(x.vod_name),name_cn:clean(x.vod_name),date:year+'-01-01',year:String(year),region:'jp',area:'日本',platform:clean(x.type_name),remarks:clean(x.vod_remarks),images:{common:/^https:\/\//.test(x.vod_pic||'')?x.vod_pic:''},summary:clean(x.vod_content),rating:{score:0},tags:[{name:clean(x.vod_class||'日本动画')}],sourceType:'third-party',updatedAt:x.vod_time,playable:groups.length>0,episodeCount:groups[0]?.episodes.length||0};
        const old=merged.get(identity(entry));
        if(old) {
          const alternatives=[...(old.alternatives||[]),{provider:old.provider,vodId:old.vodId},...(entry.alternatives||[])];
          merged.set(identity(entry),{...old,...entry,classic:old.classic,classicRank:old.classicRank,franchise:old.franchise,alternatives:[...new Map(alternatives.filter(a=>a.provider!==id||a.vodId!==entry.vodId).map(a=>[a.provider+'_'+a.vodId,a])).values()]});
        } else merged.set(identity(entry),entry);
        if(groups.length)await fs.writeFile(path.join(root,'details',id+'_'+entry.vodId+'.json'),JSON.stringify({...entry,playGroups:groups,snapshotAt:new Date().toISOString()}));
        received++;
      }
    } catch {failed++;}
  }
  reports[id]={sourceName:p.name,pages,received,failedPages:failed,checkedAt:new Date().toISOString()};
}
let status={};try{status=JSON.parse(await fs.readFile(path.join(root,'update-status.json'),'utf8'));}catch{}
if(anySuccess){catalog.items=[...merged.values()].sort((a,b)=>(b.date||'').localeCompare(a.date||''));catalog.fetchedAt=new Date().toISOString();await fs.writeFile(catalogPath,JSON.stringify(catalog));}
await fs.writeFile(path.join(root,'update-status.json'),JSON.stringify({...status,updatedAt:anySuccess?catalog.fetchedAt:status.updatedAt,total:catalog.items.length,storageReady:true,schedule:{enabled:true,mode:'github-actions',timezone:'Asia/Shanghai',hours:[2,8,14,20]},lastAttemptAt:new Date().toISOString(),providers:reports,warning:anySuccess?null:'本轮来源不可用，保留上次已发布目录。'}));
console.log(JSON.stringify({ok:anySuccess,total:catalog.items.length,providers:reports}));
