// 前文笔记侧边栏：按正文的阅读位置，显示已经读过的小节的笔记。
// 用法：页面里写下面的结构，再在页面末尾引入本文件。笔记里的公式由页面自己的 MathJax 排版。
//   <nav class="recap" aria-label="前文笔记" data-drawer-below="1240"><ol>
//     <li class="recap-part"><a href="#chapter">章标题</a></li>
//     <li><a href="#section">小节标题<div class="recap-note">笔记，可以含公式、图片、SVG</div></a></li>
//   </ol></nav>
// 视口宽度不超过 data-drawer-below 时，侧边栏变成从左侧滑出的抽屉。
// 宽屏时收起侧边栏，nav 带有 is-collapsed 类，页面可以据此把侧边栏的宽度让给正文，例如
//   .frame:has(>.recap.is-collapsed){grid-template-columns:0 minmax(0,1156px);column-gap:0}
// 颜色取页面的 --ink、--ink-2、--ink-3、--accent、--rule-2、--surface，没有定义时用默认值。
(function(){
  const nav=document.querySelector('nav.recap');
  if(!nav)return;

  const style=document.createElement('style');
  style.textContent=`
@property --recap-edge{syntax:'<number>';inherits:true;initial-value:0}
.recap,.recap-fab,.recap-backdrop{--recap-ink:var(--ink,#1b1d1f);--recap-ink-2:var(--ink-2,#51585e);--recap-ink-3:var(--ink-3,#80878d);--recap-accent:var(--accent,#985b57);--recap-rule:var(--rule-2,#c7ccc6);--recap-surface:var(--surface,#fff)}
.recap{position:sticky;top:0;align-self:start;height:100vh;height:100dvh;display:flex;flex-direction:column;padding-top:28px;font-size:13.5px;line-height:1.6;color:var(--recap-ink-2);transition:opacity .25s,visibility .25s}
.recap.is-collapsed{opacity:0;visibility:hidden}
.recap-head{padding:0 0 10px 14px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11.5px;letter-spacing:.14em;color:var(--recap-ink-3)}
.recap-foot{padding:12px 0 24px}
.recap-foot button{font:inherit;font-size:13px;line-height:1;color:var(--recap-ink-3);background:none;border:1px solid transparent;padding:8px 12px 8px 14px;cursor:pointer}
.recap-foot button:hover{color:var(--recap-ink)}
.recap-list{position:relative;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;
  -webkit-mask-image:linear-gradient(rgb(0 0 0/var(--recap-edge)),#000 var(--recap-fade-top,0px),#000 64%,rgb(0 0 0/var(--recap-edge)));
  mask-image:linear-gradient(rgb(0 0 0/var(--recap-edge)),#000 var(--recap-fade-top,0px),#000 64%,rgb(0 0 0/var(--recap-edge)));transition:--recap-edge .3s}
.recap-list:is(:hover,:focus-within){--recap-edge:1;scrollbar-width:thin}
.recap ol{list-style:none;margin:0;padding:0 0 calc(50vh - 80px);padding-bottom:calc(50dvh - 80px);border-left:1px solid var(--recap-rule)}
.recap li>a{color:inherit;text-decoration:none;border:0}
.recap-part>a{display:block;padding:22px 8px 6px 14px;font-size:14.5px;font-weight:600;color:var(--recap-ink-2)}
.recap-part.is-ahead>a{color:var(--recap-ink-3);opacity:.7}
.recap li:not(.recap-part)>a{display:grid;grid-template-rows:auto 0fr;margin-left:-1px;padding:5px 8px 5px 14px;border-left:2px solid transparent;color:var(--recap-ink-2);transition:opacity .25s}
.recap li:not(.recap-part):not(.is-read):not(.is-current)>a{color:var(--recap-ink-3);opacity:.7}
.recap li:is(.is-read,.is-current)>a{font-weight:500}
.recap li.is-current>a{color:var(--recap-accent);border-left-color:var(--recap-accent)}
.recap li>a:hover{color:var(--recap-accent)}
.recap-note{min-height:0;overflow:hidden;opacity:0;font-weight:400;font-size:12.5px;line-height:1.7;color:var(--recap-ink-2);transition:opacity .3s}
.recap li.is-read>a{grid-template-rows:auto 1fr}
.recap li.is-read .recap-note{opacity:1;padding:2px 0 6px}
.recap-note>:is(img,svg,video){display:block;max-width:100%;height:auto;margin:4px 0}
.recap.is-drawer{position:fixed;top:0;bottom:0;left:0;z-index:70;align-self:normal;height:auto;width:min(85vw,340px);padding:20px 12px 0 8px;background:var(--recap-surface);box-shadow:0 0 32px rgb(0 0 0/.25);transform:translateX(-100%);visibility:hidden;transition:transform .25s,visibility .25s}
.recap.is-drawer.is-open{transform:none;visibility:visible}
.recap.is-drawer .recap-list{--recap-edge:1}
.recap-backdrop{position:fixed;inset:0;z-index:65;background:rgb(0 0 0/.35)}
.recap-fab{position:fixed;left:0;bottom:24px;z-index:60;display:flex;align-items:center;gap:6px;padding:8px 12px 8px 10px;font:inherit;font-size:13px;line-height:1;color:var(--recap-ink-2);background:var(--recap-surface);border:1px solid var(--recap-rule);border-left:0;border-radius:0 8px 8px 0;box-shadow:0 2px 10px rgb(0 0 0/.12);cursor:pointer}
.recap-fab:hover{color:var(--recap-ink)}
:is(.recap-fab,.recap-backdrop)[hidden]{display:none}
@media (prefers-reduced-motion:reduce){.recap,.recap *{transition:none!important}}
`;
  document.head.appendChild(style);

  // 结构：标题、可滚动的列表、底部的收起按钮，外加固定在屏幕左下角的展开按钮和抽屉的遮罩
  const label=nav.getAttribute('aria-label')||'前文笔记';
  if(!nav.id)nav.id='recap';
  const ol=nav.querySelector('ol');
  const list=document.createElement('div'); list.className='recap-list';
  const head=document.createElement('div'); head.className='recap-head'; head.textContent=label;
  // 收起按钮放在底部，与展开按钮的高度相同
  const foot=document.createElement('div'); foot.className='recap-foot';
  foot.innerHTML='<button type="button">‹ 收起</button>';
  const closeBtn=foot.firstChild;
  nav.prepend(head); nav.append(list,foot); list.append(ol);
  const fab=document.createElement('button');
  fab.type='button'; fab.className='recap-fab';
  fab.setAttribute('aria-controls',nav.id);
  fab.innerHTML='<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 3h12M1 7h12M1 11h8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg><span>笔记</span>';
  fab.setAttribute('aria-label','展开'+label);
  const backdrop=document.createElement('div'); backdrop.className='recap-backdrop'; backdrop.hidden=true;
  document.body.append(fab,backdrop);

  const items=[...ol.querySelectorAll('li:not(.recap-part)>a')]
    .map(a=>({li:a.parentElement,h:document.getElementById(decodeURIComponent(a.hash.slice(1)))}))
    .filter(it=>it.h);
  // 每个章节标题记下它后面第一个小节的序号，用来判断这一章是否还没读到
  const parts=[...ol.querySelectorAll('.recap-part')]
    .map(li=>({li,first:items.findIndex(it=>li.compareDocumentPosition(it.li)&Node.DOCUMENT_POSITION_FOLLOWING)}));

  const narrow=matchMedia('(max-width:'+(nav.dataset.drawerBelow||1240)+'px)');
  const reduce=matchMedia('(prefers-reduced-motion:reduce)');
  const KEY='recap-collapsed';
  let collapsed=false, open=false, current=-2;
  try{collapsed=localStorage.getItem(KEY)==='1';}catch(e){}

  function render(){
    const drawer=narrow.matches, shown=drawer?open:!collapsed;
    nav.classList.toggle('is-drawer',drawer);
    nav.classList.toggle('is-open',drawer&&open);
    nav.classList.toggle('is-collapsed',!drawer&&collapsed);
    nav.inert=!shown;
    fab.hidden=shown;
    fab.setAttribute('aria-expanded',String(shown));
    backdrop.hidden=!(drawer&&open);
  }
  function setShown(shown){
    if(narrow.matches)open=shown;
    else{collapsed=!shown; try{localStorage.setItem(KEY,collapsed?'1':'0');}catch(e){}}
    render();
    if(shown){follow(false); closeBtn.focus({preventScroll:true});}
    else fab.focus({preventScroll:true});
  }

  // 把刚读完的上一小节滚到列表的垂直中央；前面的条目不够多时，列表停在最顶端。
  // 鼠标停在列表上时不移动，方便自己滚动查看；点击条目跳转后，force 为 true，照常移动
  function follow(smooth,force){
    if(!force&&list.matches(':hover'))return;
    const it=items[Math.max(current-1,0)];
    if(!it)return;
    const top=it.li.offsetTop+it.li.offsetHeight/2-list.clientHeight/2;
    if(Math.abs(list.scrollTop-top)>1)list.scrollTo({top,behavior:smooth&&!reduce.matches?'smooth':'instant'});
  }

  // 当前小节：标题越过视口上方判定线的最后一个小节。
  // 屏幕中心越过当前小节 85% 的篇幅后，当前小节的笔记也显示出来
  let pending=false;
  function update(){
    pending=false;
    const line=Math.min(160,innerHeight*.2), mid=innerHeight/2;
    const atEnd=scrollY+innerHeight>=document.documentElement.scrollHeight-2;
    let cur=-1;
    items.forEach((it,i)=>{if(it.h.getBoundingClientRect().top<=line)cur=i;});
    if(atEnd)cur=items.length-1;
    let done=atEnd;
    if(cur>=0&&!atEnd){
      const top=items[cur].h.getBoundingClientRect().top;
      let end=items[cur+1]?items[cur+1].h.getBoundingClientRect().top:document.documentElement.getBoundingClientRect().bottom;
      const sec=items[cur].h.closest('section');
      if(sec)end=Math.min(end,sec.getBoundingClientRect().bottom);
      done=mid-top>=.85*(end-top);
    }
    items.forEach((it,i)=>{
      it.li.classList.toggle('is-read',i<cur||(i===cur&&done));
      it.li.classList.toggle('is-current',i===cur);
      it.li.firstElementChild.toggleAttribute('aria-current',i===cur);
    });
    parts.forEach(p=>p.li.classList.toggle('is-ahead',p.first<0||p.first>cur));
    if(cur!==current){const first=current===-2; current=cur; follow(!first);}
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(update);}}

  fab.addEventListener('click',()=>setShown(true));
  closeBtn.addEventListener('click',()=>setShown(false));
  backdrop.addEventListener('click',()=>setShown(false));
  addEventListener('keydown',e=>{if(e.key==='Escape'&&narrow.matches&&open)setShown(false);});
  ol.addEventListener('click',e=>{
    if(!e.target.closest('a'))return;
    if(narrow.matches){open=false;render();}
    requestAnimationFrame(()=>{update();follow(true,true);});
  });
  // 顶端的渐隐区域随列表的滚动距离增大，列表停在最顶端时，最前面的条目不被渐隐
  function fadeTop(){list.style.setProperty('--recap-fade-top',Math.min(list.scrollTop,list.clientHeight*.36)+'px');}
  list.addEventListener('scroll',fadeTop,{passive:true});
  list.addEventListener('mouseleave',()=>follow(true));
  narrow.addEventListener('change',()=>{open=false;render();follow(false);});
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule); addEventListener('hashchange',schedule); addEventListener('load',schedule);
  // 公式排版、笔记展开、正文图表加载都会改变高度，之后重新定位
  if('ResizeObserver' in window){
    new ResizeObserver(schedule).observe(document.body);
    new ResizeObserver(()=>follow(true)).observe(ol);
  }
  render(); update();
})();
