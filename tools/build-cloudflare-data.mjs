import search from './search-core.cjs';
import fs from 'node:fs/promises';import path from 'node:path';
export function compact(s){const result={};for(const k of ['id','type','name','name_cn','date','year','region','area','platform','provider','providerName','vodId','remarks','episodeCount','eps','classic','classicRank','franchise','fanWork','alternatives','localImage','collection','rating','coverAlternatives'])if(s[k]!==undefined)result[k]=s[k];const themes=search.themes(s);if(themes.length)result.searchThemes=themes;if(s.aliases?.length)result.aliases=s.aliases.slice(0,8).map(x=>String(x).slice(0,100));result.images={common:s.images?.common||s.images?.medium||s.images?.large||''};result.tags=(s.tags||[]).slice(0,8).map(t=>({name:t.name}));if(s.rating)result.rating={score:s.rating.score};if(s.collection)result.collection={total:s.collection.total,doing:s.collection.doing};return result;}
export async function coverFallbacks(root){
 const map=new Map();try{
  const bibliography=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8')),
   coverage=JSON.parse(await fs.readFile(path.join(root,'resource-coverage.json'),'utf8')),
   images=new Map(bibliography.items.map(s=>[s.id,s.images?.common||s.images?.medium||s.images?.large]));
  const entries=[...(coverage.series||[]).flatMap(s=>s.entries||[]),...(coverage.years||[]).flatMap(y=>y.entries||y.items||[])];
  for(const e of entries){const image=images.get(e.id);if(image)for(const id of e.resourceIds||[])map.set(id,image);}
 }catch{}return map;
}
export async function buildData(root,out){await fs.mkdir(out,{recursive:true});const covers=await coverFallbacks(root);for(const name of ['catalog.json','vod-catalog.json']){const data=JSON.parse(await fs.readFile(path.join(root,name),'utf8'));if(name==='catalog.json'){await fs.mkdir(path.join(out,'subject-details'),{recursive:true});for(const s of data.items)await fs.writeFile(path.join(out,'subject-details',s.id+'.json'),JSON.stringify(s));}await fs.writeFile(path.join(out,name),JSON.stringify({fetchedAt:data.fetchedAt,directoryMode:'lazy',items:data.items.map(s=>compact(covers.has(s.id)?{...s,coverAlternatives:[covers.get(s.id)]}:s))}));}}
if(process.argv[1]?.endsWith('build-cloudflare-data.mjs')){await buildData(path.resolve(process.argv[2]||'docs'),path.resolve(process.argv[3]||'cloudflare-data'));console.log('Cloudflare metadata built');}
