// 各页面共用的基础代码：创建 SVG 元素、把 MathJax 公式放进 SVG、绘制计算图、折叠块动画、目录。
// 用普通 <script> 引入，放在 MathJax 之后、页面自己的脚本之前。
const NS='http://www.w3.org/2000/svg';
const el=(n,a,txt)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;return e;};
// 用 MathJax 把 tex 渲染成 svg，作为嵌套 <svg> 放进图里。fs 是字号（px），y 是基线位置，align 为 'middle' | 'start' | 'end'
function tex(t,fs,x,y,align,color){
  const node=MathJax.tex2svg(t,{display:false}).querySelector('svg');
  const ex=fs*0.45;
  const w=parseFloat(node.getAttribute('width'))*ex, h=parseFloat(node.getAttribute('height'))*ex;
  const shift=parseFloat((node.getAttribute('style')||'').match(/vertical-align:\s*(-?[\d.]+)ex/)?.[1]||0)*ex;
  const left=align==='middle'?x-w/2:(align==='end'?x-w:x);
  node.setAttribute('width',w); node.setAttribute('height',h);
  node.setAttribute('x',left); node.setAttribute('y',y-h-shift);
  node.removeAttribute('style'); node.classList.add('tex');
  if(color)node.style.color=color;
  return node;
}

function addMarkers(svg,svgId){
  const defs=el('defs',{});
  for(const [id,col] of [['arr','var(--ink-2)'],['arrb','var(--s1)']]){
    const m=el('marker',{id:id+'-'+svgId,viewBox:'0 0 10 10',refX:'9',refY:'5',markerWidth:'7',markerHeight:'7',orient:'auto-start-reverse'});
    m.appendChild(el('path',{d:'M0,0 L10,5 L0,10 z',fill:col}));
    defs.appendChild(m);
  }
  svg.appendChild(defs);
}
// 标签：$...$ 之间的公式由 MathJax 渲染成嵌套 svg，其余文字用 <text>，按实际宽度横向拼接
function label(svg,x,y,t,fs,align,cls,color){
  const segs=t.split('$'), nodes=[]; let total=0;
  segs.forEach((seg,i)=>{
    if(!seg)return;
    let node,w;
    if(i%2){ node=tex(seg,fs,0,y,'start',color); w=+node.getAttribute('width'); }
    else{ node=el('text',{x:0,y,'xml:space':'preserve',class:cls||'',style:`font-size:${fs}px`+(color?`;fill:${color}`:'')},seg); svg.appendChild(node); w=node.getComputedTextLength(); }
    nodes.push([node,w]); total+=w;
  });
  let left=align==='middle'?x-total/2:(align==='end'?x-total:x);
  for(const [node,w] of nodes){ node.setAttribute('x',left); if(node.parentNode!==svg)svg.appendChild(node); left+=w; }
}
// 沿竖直方向依次画一串节点：方框是运算，圆角框是数据，plus 是残差相加
function drawChain(svg,svgId,items,o){
  const CX=o.CX, BW=o.BW||270, BH=46, PW=o.PW||230, PH=30, RX=CX+160, GAP=o.gap||30;
  const lb=(x,y,t,fs,align,cls,color)=>label(svg,x,y,t,fs,align,cls,color);
  let y=o.y0||8, res=null, lastPill=null;
  const late=[], marks={}; // 残差线最后画，避免压住节点
  function tag(x,y,text,kind){ // kind: 'bf' | 'fp' | 'int'
    const w=text.length>4?42:36;
    svg.appendChild(el('rect',{x:x-w,y,width:w,height:14,class:'tagbox '+kind}));
    lb(x-w/2,y+10.5,text,9.5,'middle','tag '+kind);
  }
  function arrow(y1,y2){svg.appendChild(el('path',{d:`M${CX},${y1} L${CX},${y2-2}`,class:'e',style:`marker-end:url(#arr-${svgId})`}));}
  items.forEach((it,idx)=>{
    const top=idx?y+GAP:y; if(idx)arrow(y,it.plus?y+GAP:top);
    if(it.plus){
      const cy=y+GAP+10;
      svg.appendChild(el('circle',{cx:CX,cy,r:10,class:'plus'})); lb(CX,cy+5,'+',14,'middle','plus');
      const from=res; late.push(()=>svg.appendChild(el('path',{d:`M${from.x},${from.y} L${RX},${from.y} L${RX},${cy} L${CX+13},${cy}`,class:'r',style:`marker-end:url(#arrb-${svgId})`})));
      if(it.mark)marks[it.mark]={top:cy-10,bot:cy+10,x:CX-10,w:20};
      y=cy+10; return;
    }
    if(it.act){
      svg.appendChild(el('rect',{x:CX-PW/2,y:top,width:PW,height:PH,class:'pill'}));
      lb(CX-(it.dt?16:0),top+PH/2+4.5,it.act,12.5,'middle');
      if(it.dt)tag(CX+PW/2-6,top+8,it.dt,it.dt==='BF16'?'bf':(it.dt==='FP32'?'fp':'int'));
      lastPill={x:CX+PW/2,y:top+PH/2};
      if(it.mark)marks[it.mark]={top,bot:top+PH,x:CX-PW/2,w:PW};
      y=top+PH; return;
    }
    if(it.res)res=lastPill;
    if(it.stack){svg.appendChild(el('rect',{x:CX-BW/2+8,y:top+8,width:BW,height:BH,class:'box'}));svg.appendChild(el('rect',{x:CX-BW/2+4,y:top+4,width:BW,height:BH,class:'box'}));}
    svg.appendChild(el('rect',{x:CX-BW/2,y:top,width:BW,height:BH,class:'box'}));
    if(it.w){lb(CX,top+18,it.op,12.5,'middle');lb(CX,top+37,it.w,10.5,'middle','','var(--ink-2)');}
    else lb(CX,top+BH/2+4.5,it.op,12.5,'middle');
    if(it.bf)tag(CX+BW/2-6,top+5,'BF16','bf'); if(it.fp)tag(CX+BW/2-6,top+5,'FP32','fp');
    if(it.side){const cy=top+BH/2,SL=o.sideLen||160;svg.appendChild(el('path',{d:`M${CX+BW/2+SL},${cy} L${CX+BW/2+2},${cy}`,class:'e',style:`marker-end:url(#arr-${svgId})`}));lb(CX+BW/2+SL+8,cy+4,it.side,11.5,'start','','var(--ink-2)');}
    if(it.mark)marks[it.mark]={top,bot:top+BH+(it.stack?8:0),x:CX-BW/2,w:BW+(it.stack?8:0)};
    y=top+BH+(it.stack?8:0);
  });
  late.forEach(f=>f());
  return {y,marks};
}
// 按给定坐标画有分支的计算图。节点类型：op 是运算方框，act 是数据圆角框，mul 是逐元素乘；x 是中心横坐标，y 是上边缘，W 是宽度
// 边 [起点, 终点, 横向偏移]：从起点下边缘竖直向下，在终点上方 14px 处折向终点；终点是 mul 时从侧面进入
function drawGraph(svgId,nodes,edges){
  const svg=document.getElementById(svgId); addMarkers(svg,svgId);
  const BH=46, PH=30, R=11;
  const bot=n=>n.y+(n.t==='op'?BH:n.t==='act'?PH:2*R);
  for(const [a,b,dx=0] of edges){
    const p=nodes[a], q=nodes[b], x=q.x+dx; let d;
    if(q.t==='mul'&&p.x!==q.x){const cy=q.y+R; d=`M${p.x},${bot(p)} L${p.x},${cy} L${q.x+(p.x<q.x?-R-2:R+2)},${cy}`;}
    else if(p.x===x)d=`M${p.x},${bot(p)} L${x},${q.y-2}`;
    else{const my=q.y-14; d=`M${p.x},${bot(p)} L${p.x},${my} L${x},${my} L${x},${q.y-2}`;}
    svg.appendChild(el('path',{d,class:'e',style:`marker-end:url(#arr-${svgId})`}));
  }
  let H=0;
  for(const n of Object.values(nodes)){
    if(n.t==='mul'){svg.appendChild(el('circle',{cx:n.x,cy:n.y+R,r:R,class:'op'}));label(svg,n.x,n.y+R+4.5,'$\\otimes$',13,'middle');}
    else if(n.t==='act'){const W=n.W||150;svg.appendChild(el('rect',{x:n.x-W/2,y:n.y,width:W,height:PH,class:'pill'}));label(svg,n.x,n.y+PH/2+4.5,n.l,12.5,'middle');}
    else{
      const W=n.W||170;svg.appendChild(el('rect',{x:n.x-W/2,y:n.y,width:W,height:BH,class:'box'}));
      if(n.w){label(svg,n.x,n.y+18,n.l,12.5,'middle');label(svg,n.x,n.y+37,n.w,10.5,'middle','','var(--ink-2)');}
      else label(svg,n.x,n.y+BH/2+4.5,n.l,12.5,'middle');
    }
    H=Math.max(H,bot(n));
  }
  svg.setAttribute('viewBox',`0 0 ${svg.viewBox.baseVal.width} ${H+8}`);
}

/* ---------- 折叠动画 ---------- */
function slide(box,open,done){
  box.style.overflow='hidden';
  const h=box.scrollHeight;
  const a=box.animate(open?[{height:'0px',opacity:0},{height:h+'px',opacity:1}]:[{height:h+'px',opacity:1},{height:'0px',opacity:0}],{duration:240,easing:'ease'});
  a.onfinish=()=>{box.style.overflow='';if(done)done();};
}
document.querySelectorAll('details.fold').forEach(d=>{
  const sum=d.querySelector('summary'), body=d.querySelector('.body');
  sum.addEventListener('click',e=>{
    e.preventDefault();
    if(d.open)slide(body,false,()=>{d.open=false;});
    else{d.open=true;slide(body,true);}
  });
});

/* ---------- 目录 ---------- */
(function(){
  const nav=document.querySelector('.toc');
  if(!nav)return;
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
    const section=targets[current].closest('section');
    links.forEach((a,i)=>{
      a.classList.toggle('on',i===current);
      a.classList.toggle('in-section',a.hash==='#'+section.id&&i!==current);
    });
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(update);}}
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule); addEventListener('hashchange',schedule); addEventListener('load',schedule);
  if('ResizeObserver' in window)new ResizeObserver(schedule).observe(document.querySelector('article'));
  update();
})();
