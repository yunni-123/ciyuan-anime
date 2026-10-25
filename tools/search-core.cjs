(function(root){
 const groups=[['校园','学校','学园','学園','高中','初中','学生','社团','school'],['恋爱','爱情','告白','恋人','恋愛','初恋'],['奇幻','魔法','异世界','幻想','魔王','勇者'],['战斗','热血','格斗','战士','忍者'],['科幻','机器人','机甲','太空','宇宙','未来世界'],['悬疑','推理','侦探','探偵','破案'],['运动','体育','篮球','足球','排球','网球','棒球'],['音乐','乐队','偶像','演唱','吹奏','摇滚'],['治愈','温馨','治癒'],['日常','日常生活','生活喜剧'],['冒险','冒險','探险'],['搞笑','喜剧','喜劇','コメディ']];
 const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
 const terms=s=>[s.name_cn,s.name,...(s.aliases||[]),...(s.tags||[]).map(t=>typeof t==='string'?t:t.name)].filter(Boolean);
 function themes(s){const text=normalize([...terms(s),s.summary||''].join(' '));return groups.filter(g=>g.some(w=>text.includes(normalize(w)))).map(g=>g[0]);}
 function computeScore(s,query){const q=normalize(query);if(!q)return 0;const names=[s.name_cn,s.name].filter(Boolean).map(normalize),aliases=(s.aliases||[]).map(normalize);
  if(names.includes(q))return 10000;if(aliases.includes(q))return 9500;
  if(names.some(n=>n.includes(q)))return 8000;if(aliases.some(n=>n.includes(q)))return 7000;
  const words=String(query).trim().split(/\s+/).map(normalize).filter(Boolean);if(words.length>1&&words.every(w=>names.some(n=>n.includes(w))))return 6500;
  const tags=(s.tags||[]).map(t=>normalize(typeof t==='string'?t:t.name));if(tags.some(t=>t.includes(q)))return 5000;
  const related=groups.filter(g=>g.some(w=>normalize(w)===q)).map(g=>g[0]);if(related.some(t=>(s.searchThemes||themes(s)).includes(t)))return 3000;
  if(normalize(s.summary).includes(q))return 2000;return 0;
 }
 const scores=new WeakMap();function score(s,query){const previous=scores.get(s);if(previous?.query===query)return previous.score;const value=computeScore(s,query);scores.set(s,{query,score:value});return value;}
 function remember(history,value){const text=String(value||'').trim().slice(0,80);if(!text)return history;return[text,...history.filter(s=>normalize(s)!==normalize(text))].slice(0,20);}
 const api={normalize,themes,score,remember};if(typeof module==='object'&&module.exports)module.exports=api;else root.CiyuanSearch=api;
})(globalThis);
