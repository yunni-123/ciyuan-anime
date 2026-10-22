(() => {
 const key='ciyuan-appearance-v1',valid=x=>x==='classic'||x==='starlight'||x==='cyber';
 let theme='starlight';try{const saved=localStorage.getItem(key);if(valid(saved))theme=saved;}catch{}
 const apply=value=>{theme=valid(value)?value:'starlight';document.documentElement.dataset.theme=theme;window.dispatchEvent(new CustomEvent('ciyuan-theme-change',{detail:theme}));};
 document.documentElement.dataset.theme=theme;
 window.CiyuanAppearance={getTheme:()=>theme,setTheme(value){apply(value);try{localStorage.setItem(key,theme);return true;}catch{return false;}}};
 window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue);});
})();
