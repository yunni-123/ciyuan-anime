import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export async function embedDirectories(directory) {
 const file=path.join(directory,'vod-catalog.json'),catalog=JSON.parse(await fs.readFile(file,'utf8'));let entries=0;
 let cursor=0;await Promise.all(Array.from({length:8},async()=>{while(cursor<catalog.items.length){const item=catalog.items[cursor++],sources=[];for(const ref of [{provider:item.provider,vodId:item.vodId},...(item.alternatives||[])]){if(!/^[a-z0-9]+$/.test(ref.provider)||!/^\d+$/.test(String(ref.vodId)))continue;try{const d=JSON.parse(await fs.readFile(path.join(directory,'details',ref.provider+'_'+ref.vodId+'.json'),'utf8'));const groups=(d.playGroups||[]).map(g=>({name:g.name,episodes:g.episodes.filter(e=>/^https:\/\//.test(e.url)&&/\.(m3u8|mp4)(\?|$)/i.test(e.url)).map(e=>({name:e.name,url:e.url}))})).filter(g=>g.episodes.length);if(groups.length)sources.push({provider:ref.provider,vodId:String(ref.vodId),playGroups:groups});}catch{}}item.inlineSources=sources;entries+=sources.length;}}));
 catalog.directoryMode='embedded';await fs.writeFile(file,JSON.stringify(catalog));console.log(JSON.stringify({embeddedSources:entries,catalogMB:Math.round((await fs.stat(file)).size/1048576*10)/10}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await embedDirectories(path.resolve(process.argv[2]||'docs'));
