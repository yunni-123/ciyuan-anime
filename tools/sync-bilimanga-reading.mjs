import fs from 'node:fs/promises';
import path from 'node:path';
import core from './free-reading-core.cjs';
import pub from './public-reading-core.cjs';
const root=path.resolve(process.argv[2]||'docs'),read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const state=await read('reading-sources.json'),index=await read('books-index.json'),now=new Date().toISOString();
const seeds=[
[376,"アオのハコ","青春之箱",332037],[213,"今さらですが、幼なじみを好きになってしまいました","事到如今，喜歡上了青梅竹馬",472321],
[802,"君のことが大大大大大好きな100人の彼女","超超超超超喜歡你的100個女朋友",296466],
[1642,"スキップとローファー","躍動青春",272611],
[65,"私を喰べたい、ひとでなし","對我垂涎欲滴的非人少女",313877],
[272,"ダンダダン","膽大黨",332250],
[1617,"妖狐×僕SS","妖狐×僕SS",24667],
[1578,"この美術部には問題がある！","這個美術社大有問題！",96134],
[1547,"ハイスコアガール","高分少女",43165],
[457,"その着せ替え人形は恋をする","更衣人偶墜入愛河",234799],
[1525,"恋愛暴君","戀愛暴君",80902],
[1375,"マリッジトキシン","婚姻劇毒",378773],
[1176,"双星の陰陽師","雙星之陰陽師",89062],
[491,"となりの猫と恋知らず","與貓相鄰尚不識戀",470365],
[1146,"愛してるゲームを終わらせたい","想結束這場「我愛你」的遊戲",363489],
[145,"ワンパンマン","一拳超人",55911,"村田雄介"],
[159,"ぐらんぶる","碧藍之海",118165,"吉岡公威"],
[1715,"賭ケグルイ","狂賭之淵",108783,"尚村透"],
[31,"無職転生 ～異世界行ったら本気だす～","無職轉生",143597,"フジカワ ユカ"],
[23,"かぐや様は告らせたい～天才たちの恋愛頭脳戦～","輝夜姬想讓人告白",135218,"赤坂アカ"],
[842,"幼女戦記","幼女戰記",180834,"東條チカ"],
[824,"東京卍リベンジャーズ","東京卍復仇者",210506,"和久井健"],
[715,"終末のワルキューレ","終末的女武神",230858,"アジチカ"],
[20,"陰の実力者になりたくて！","我想成為影之強者",270199,"阪野杏梨"],
[204,"SAKAMOTO DAYS","SAKAMOTO DAYS",319012,"鈴木祐斗"],
[1188,"ウィッチウォッチ","WITCH WATCH",325236,"篠原健太"],
[467,"薫る花は凛と咲く","薰香花朵凜然綻放",355555,"三香見SAKA"],
[1192,"ジョジョの奇妙な冒険 Part8『ジョジョリオン』","JOJO",45021,"荒木飛呂彥"],
 [3,'お隣の天使様にいつの間にか駄目人間にされていた件','關於鄰家的天使大人不知不覺把我慣成廢人這檔子事'],[4,'蜘蛛ですが、なにか?','轉生成蜘蛛又怎樣'],[6,'シャングリラ・フロンティア～クソゲーハンター、神ゲーに挑まんとす～','香格里拉'],[8,'安達としまむら','安達與島村'],[262,'やはり俺の青春ラブコメはまちがっている。@comic','果然我的青春戀愛喜劇搞錯了'],[137,'薬屋のひとりごと','葯屋少女的呢喃'],
 [1,'葬送のフリーレン','葬送的芙莉蓮'],[2,'【推しの子】','【我推的孩子】'],[78,'チェンソーマン','鏈鋸人'],[130,'怪獣8号','怪獸8號'],[175,'東京喰種トーキョーグール','東京喰種'],[857,'ガヴリールドロップアウト','廢天使加百列'],[208,'ささやくように恋を唄う','恰如細語般的戀歌'],[5,'氷菓','冰菓'],[25,'虚構推理','虛構推理'],[33,'地縛少年花子くん','地縛少年花子君']
];
const titles=new Map();for(const y of index.years.filter(y=>y.kind==='manga'))for(const s of(await read('books/manga-'+y.year+'.json')).items){const k=core.norm(s.name);const a=titles.get(k)||[];a.push(s);titles.set(k,a);}
async function get(url){const u=new URL(url);if(u.origin!=='https://www.bilimanga.net'||!/^\/(?:detail\/\d+\.html|read\/\d+\/(?:catalog|\d+\.html))$/.test(u.pathname))throw Error('来源路径不匹配');const r=await fetch(url,{redirect:'error',headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(12000)});if(r.status!==200){await r.body?.cancel();throw Error('HTTP '+r.status);}const h=await r.text();if(h.length>1_000_000)throw Error('页面超过上限');return h;}
const errors=[];let checked=0,matched=0;
for(const [sourceId,japaneseName,sourceTitle,targetId,expectedAuthor]of seeds){const targets=(titles.get(core.norm(japaneseName))||[]).filter(s=>(targetId?s.id===targetId:sourceId!==8||s.id===283417)&&pub.eligibleTitle(s)&&!state.restricted?.['manga:'+s.id]);if(!targets.length)continue;if(process.argv.includes('--new-only')&&targets.every(s=>[state.items['manga:'+s.id],...(state.items['manga:'+s.id]?.alternatives||[])].some(e=>e?.provider==='bilimanga'&&e.lastSuccessAt?.slice(0,10)===now.slice(0,10))))continue;checked++;try{const directoryUrl=`https://www.bilimanga.net/detail/${sourceId}.html`,detail=await get(directoryUrl);if(!detail.includes(sourceTitle))throw Error('作品页标题不符');if(expectedAuthor&&!detail.includes(expectedAuthor))throw Error('作者与目标版本不符');const catalogUrl=`https://www.bilimanga.net/read/${sourceId}/catalog`,html=await get(catalogUrl);if(!html.includes(sourceTitle))throw Error('目录标题不符');const chapters=[...html.matchAll(new RegExp(`<a\\b[^>]*href=["'](/read/${sourceId}/\\d+\\.html)["'][^>]*>([\\s\\S]*?)<\\/a>`,'g'))];if(!chapters.length)throw Error('无同作品公开目录');const readerUrl=new URL(chapters[0][1],directoryUrl).href,reader=await get(readerUrl),title=core.clean(reader.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');if(!title.includes(sourceTitle)||!reader.includes(`mangaid:'${sourceId}'`))throw Error('章节与作品关联不符');const mobileOnly=reader.includes('不支持桌面'),isVip=reader.match(/chapterisvip:'([^']+)'/)?.[1];for(const s of targets){const entry={kind:'manga',provider:'bilimanga',sourceId,title:reader.match(/manganame:'([^']+)'/)?.[1]||sourceTitle,directoryUrl:catalogUrl,url:directoryUrl,readerUrl,state:'directory-confirmed',language:'zh-Hant',anonymous:true,listedChapters:chapters.length,chapterTitle:core.clean(chapters[0][2]),match:'curated-original-title-alias-and-chapter-path',lastAttemptAt:now,lastSuccessAt:now,readerEvidence:{httpStatus:200,chapterIsVip:isVip??null,mobileOnly,scope:'已核对中文作品页、同书章节目录和首话关联。阅读页提示手机浏览器，正文通过脚本加载；图片实际可读、完整性及免费范围待核实。只保存外链和核验数据。'},rights:'非官方来源；授权未核实'};state.items['manga:'+s.id]=pub.mergeEntry(state.items['manga:'+s.id],entry);matched++;}console.log(JSON.stringify({provider:'bilimanga',title:sourceTitle,state:'directory-confirmed',chapters:chapters.length,mobileOnly}));}catch(e){errors.push({sourceId,japaneseName,error:e.message});}await new Promise(r=>setTimeout(r,500));}
state.bilimangaReading={checkedAt:now,checked,matched,failed:errors.length,errors,scope:'仅记录已确认作品关联的站外目录；不把客户端介绍页或未取得正文的页面计作免费阅读通过。'};state.checkedAt=now;await fs.writeFile(path.join(root,'reading-sources.json'),JSON.stringify(state));console.log(JSON.stringify({phase:'bilimanga-directory',checked,matched,failed:errors.length}));
