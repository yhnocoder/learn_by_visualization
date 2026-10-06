// Essay 布局的目录：高亮当前阅读位置所在的小节；窄屏时目录折叠成一个按钮。

const nav=document.querySelector('.toc');
if(nav)initToc(nav);

function initToc(nav){
  const links=[...nav.querySelectorAll('a')];
  const targets=links.map(a=>document.getElementById(a.hash.slice(1)));
  const toggle=nav.querySelector('.toc-toggle');
  const narrow=matchMedia('(max-width:1240px)');
  function resetToggle(){toggle.setAttribute('aria-expanded',String(!narrow.matches));}
  resetToggle(); narrow.addEventListener('change',resetToggle);
  toggle.addEventListener('click',()=>toggle.setAttribute('aria-expanded',String(toggle.getAttribute('aria-expanded')!=='true')));
  nav.addEventListener('click',e=>{if(e.target.closest('a')&&narrow.matches)toggle.setAttribute('aria-expanded','false');});
  let pending=false;
  function update(){
    pending=false;
    const line=Math.min(160,innerHeight*.2);
    let current=0;
    targets.forEach((t,i)=>{if(t&&t.getBoundingClientRect().top<=line)current=i;});
    if(scrollY+innerHeight>=document.documentElement.scrollHeight-2)current=targets.length-1;
    // 当前小节所在章节的标题：章节的 id 在 section 上（手写的页面）或在章节的 h2 上（MDX 页面）
    const section=targets[current].closest('section');
    const sectionId=section?.id||section?.querySelector(':scope > h2')?.id;
    links.forEach((a,i)=>{
      a.classList.toggle('on',i===current);
      a.classList.toggle('in-section',a.hash==='#'+sectionId&&i!==current);
    });
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(update);}}
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule); addEventListener('hashchange',schedule); addEventListener('load',schedule);
  if('ResizeObserver' in window)new ResizeObserver(schedule).observe(document.querySelector('article'));
  update();
}
