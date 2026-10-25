(function(root){
 const formats={tv:'TV 动画',movie:'剧场版',ova:'OVA / OAD',web:'WEB 动画',unknown:'类型待核实'};
 function format(s){if(s.discoveryFormat)return s.discoveryFormat;const value=String(s.platform||'');return /^TV$/i.test(value)?'tv':/剧场版|劇場版|Movie/i.test(value)?'movie':/^(OVA|OAD)$/i.test(value)?'ova':/^WEB(?:动画)?$/i.test(value)?'web':'unknown';}
 function quarter(s){if(s.discoveryQuarter)return Number(s.discoveryQuarter);if(s.provider)return 0;const match=String(s.date||'').match(/^\d{4}-(\d{2})-\d{2}$/),month=Number(match?.[1]);return month>=1&&month<=12?Math.floor((month-1)/3)+1:0;}
 function filter(s,q){return (!q.format||format(s)===q.format)&&(!q.quarter||quarter(s)===Number(q.quarter));}
 function coverageState(entry){const c=entry.coverage||entry;return c.status==='scheduled'?'未播出':c.status==='edition-review'?'版本待核实':c.status==='partial'?'集数不足':c.resourceIds?.length?'已有目录':'缺少目录';}
 function members(subject,data){const id=String(subject.id),season=subject.identity?.seasonId,bgm=season?.startsWith('bgm:')?season.slice(4):/^\d+$/.test(id)?id:null,refs=new Set([id,...(subject.refKeys||[]).map(r=>'vod_'+r),...(subject.alternatives||[]).map(r=>'vod_'+r.provider+'_'+r.vodId)]);const groups=(data.series||[]).filter(g=>g.entries.some(e=>String(e.id)===bgm||(e.resourceIds||[]).some(r=>refs.has(r))));return groups.sort((a,b)=>Number(!!b.guideId)-Number(!!a.guideId)||a.entries.length-b.entries.length)[0]||null;}
 function current(subject,e){const id=String(subject.id);return String(e.id)===id||subject.identity?.seasonId==='bgm:'+e.id||(e.resourceIds||[]).includes(id);}
 function episodeMatch(label,input){const q=String(input||'').trim().normalize('NFKC').toLowerCase();if(!q)return true;const n=q.match(/^(?:第|ep)?0*(\d+)(?:集|话)?$/i),m=String(label).normalize('NFKC').match(/^(?:第|ep)?0*(\d+)(?:集|话|話|回|完结)?$/i);return n&&m?Number(n[1])===Number(m[1]):String(label).toLowerCase().includes(q);}
 const api={formats,format,quarter,filter,coverageState,members,current,episodeMatch};if(typeof module==='object'&&module.exports)module.exports=api;else root.CiyuanDiscovery=api;
})(globalThis);
