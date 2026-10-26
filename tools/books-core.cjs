(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CiyuanBooks=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
 function eligible(s,kind,year){const tags=(s.tags||[]).map(t=>t.name);return s.type===1&&!s.nsfw&&String(s.date||'').startsWith(year+'-')&&(kind==='manga'?s.platform==='漫画':s.platform==='小说'&&tags.includes('轻小说'))&&(/[ぁ-ヿ]/u.test(s.name||'')||tags.includes('日本'))&&!tags.some(t=>/^(国漫|中国漫画|韩国漫画|韩漫|中国小说)$/.test(t))&&!tags.includes('单行本')&&!/[（(]\s*\d+\s*[)）]\s*$/.test(s.name||'');}
 function links(s){const q=encodeURIComponent(s.name||s.name_cn);return[{name:'BOOK☆WALKER 出版检索',url:'https://bookwalker.jp/search/?word='+q,kind:'search'},{name:'Kindle 出版检索',url:'https://www.amazon.co.jp/s?k='+q+'&i=digital-text',kind:'search'}];}
 function rank(rows,query){const q=norm(query);return rows.map(s=>({s,score:q?Math.max(...[s.name,s.name_cn].map(n=>norm(n)===q?1000:norm(n).includes(q)?500:0),...(s.tags||[]).map(t=>norm(t.name).includes(q)?100:0)):1})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.s.annualRank-b.s.annualRank).map(x=>x.s);}
 return{norm,eligible,links,rank};
});
