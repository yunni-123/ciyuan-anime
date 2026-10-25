(function(root){
 const day=(date=new Date())=>new Date(date.getTime()+8*3600000).toISOString().slice(0,10);
 const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
 const names=s=>[s.name,s.name_cn,s.title,s.originalTitle,...(s.aliases||[])].map(normalize).filter(Boolean);
 function merge(rows,announcements,today=day()){
  const items=[],byName=new Map(),seen=new Set(),pastNames=new Set();
  for(const s of rows){if(s.type!==2||s.region!=='jp'||s.nsfw)continue;const date=s.date||s.air_date||'';if(date&&date<=today){for(const n of names(s))pastNames.add(n);continue;}if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;const key=String(s.id);if(seen.has(key))continue;seen.add(key);const item={...s,date,scheduleYear:date.slice(0,4),scheduleMonth:Number(date.slice(5,7))||0,officialLinks:[],announcementLabel:'资料档期 · 待核实'};items.push(item);for(const n of names(item))byName.set(n,item);}
  for(const a of announcements||[]){if(!/^https:\/\//.test(a.source||'')||names(a).some(n=>pastNames.has(n)))continue;const match=names(a).map(n=>byName.get(n)).find(Boolean);if(match){if(!match.officialLinks.some(l=>l.url===a.source))match.officialLinks.push({url:a.source,name:a.sourceName||'官网公告'});match.announcementLabel='官网制作公告已核实';match.officialWindow=a.window;continue;}const window=String(a.window||''),m=window.match(/(20\d{2})年(?:\s*(\d{1,2})月)?/),y=m?.[1]||'',month=Number(m?.[2])||0;if(y&&Number(y)<Number(today.slice(0,4)))continue;if(y===today.slice(0,4)&&month&&month<Number(today.slice(5,7)))continue;const n=names(a)[0];if(n&&seen.has('name:'+n))continue;seen.add('name:'+n);const item={id:'announcement:'+a.id,type:2,region:'jp',name:a.originalTitle||a.title,name_cn:a.title,date:'',scheduleYear:y,scheduleMonth:month,officialWindow:window,summary:a.note||'',officialLinks:[{url:a.source,name:a.sourceName||'官网公告'}],announcementLabel:'官网制作公告已核实',sourceType:'official-announcement'};items.push(item);for(const name of names(item))byName.set(name,item);}
  return items.sort((a,b)=>(a.date||a.scheduleYear+(a.scheduleMonth?'-'+String(a.scheduleMonth).padStart(2,'0'):'')||'9999').localeCompare(b.date||b.scheduleYear+(b.scheduleMonth?'-'+String(b.scheduleMonth).padStart(2,'0'):'')||'9999')||String(a.id).localeCompare(String(b.id)));
 }
 const quarter=s=>s.scheduleMonth?Math.floor((s.scheduleMonth-1)/3)+1:0;
 const api={day,merge,quarter};if(typeof module==='object'&&module.exports)module.exports=api;else root.CiyuanUpcoming=api;
})(globalThis);
