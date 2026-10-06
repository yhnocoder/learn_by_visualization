// 链式法则的路径图：反向传播从输出出发、沿各条路径传回输入。共四种：
//   chain     单变量链式法则，只有一条路径 y → u → x
//   paths     全导数链式法则，y 经过 u_1 … u_n 共 n 条路径传回 x
//   vecPaths  向量输入，y 经过 n 条路径传回 x_1
//   headPaths LM head，Loss 经过 V 条路径传回 x_i，每条路径标出两段的偏导数
// 依赖浏览器端 MathJax，调用前先 await mathReady()。
import { el, tex, label } from '../../../lib/svg.js';
import { addArrowMarkers } from './markers.js';

function chain(svg,p){
  addArrowMarkers(svg,[[p+'carr','var(--ink-2)']]);
  const box=(x,t)=>{svg.appendChild(el('rect',{x,y:30,width:70,height:40}));label(svg,x+35,55,t,13,'middle');};
  box(20,'$x$'); box(225,'$u$'); box(430,'$y$');
  svg.appendChild(el('path',{d:'M225,50 L92,50',style:`marker-end:url(#${p}carr)`}));
  svg.appendChild(el('path',{d:'M430,50 L297,50',style:`marker-end:url(#${p}carr)`}));
  label(svg,157,24,'$\\dfrac{du}{dx}$',12,'middle','','var(--ink-2)');
  label(svg,362,24,'$\\dfrac{dy}{du}$',12,'middle','','var(--ink-2)');
  label(svg,260,98,'反向传播：从 $y$ 出发，先乘 $dy/du$，再乘 $du/dx$，得到 $dy/dx$',12,'middle','','var(--s1)');
}

function paths(svg,p){
  addArrowMarkers(svg,[[p+'parr','var(--ink-2)'],[p+'parrb','var(--s1)']]);
  const box=(x,y,w,h,t)=>{svg.appendChild(el('rect',{x,y,width:w,height:h}));label(svg,x+w/2,y+h/2+5,t,13,'middle');};
  box(20,70,60,40,'$x$');
  box(440,70,60,40,'$y$');
  for(const [cy,t,cls] of [[24,'u_1','b'],[72,'u_2',''],[152,'u_n','']]){
    const arr=p+(cls?'parrb':'parr');
    svg.appendChild(el('path',{d:`M230,${cy} C160,${cy} 150,90 82,90`,class:cls,style:`marker-end:url(#${arr})`}));
    svg.appendChild(el('path',{d:`M440,90 C370,90 360,${cy} 292,${cy}`,class:cls,style:`marker-end:url(#${arr})`}));
    box(230,cy-16,60,32,`$${t}$`);
  }
  label(svg,260,118,'$\\vdots$',13,'middle');
  label(svg,140,45,'$\\dfrac{du_1}{dx}$',12,'middle','','var(--s1)');
  label(svg,380,45,'$\\dfrac{\\partial y}{\\partial u_1}$',12,'middle','','var(--s1)');
  label(svg,260,194,'反向传播：从 $y$ 出发，经过 $n$ 条路径传回 $x$，各条路径的贡献相加',12,'middle','','var(--s1)');
}

function vecPaths(svg,p){
  addArrowMarkers(svg,[[p+'varr','var(--ink-2)'],[p+'varrb','var(--s1)']]);
  const box=(x,cy,t)=>{svg.appendChild(el('rect',{x,y:cy-16,width:60,height:32}));label(svg,x+30,cy+5,t,13,'middle');};
  const rows=[24,72,152];                   // 第 1、2、最后一个分量的纵坐标，中间是省略号
  // 先画灰色的边，再画高亮的边，高亮的边在上层
  for(const hi of [false,true]) rows.forEach((a,i)=>rows.forEach(b=>{
    if((i===0)!==hi)return;
    svg.appendChild(el('path',{d:`M230,${b} L102,${a}`,class:hi?'b':'f',style:`marker-end:url(#${p}${hi?'varrb':'varr'})`}));
  }));
  rows.forEach(b=>svg.appendChild(el('path',{d:`M440,88 C370,88 360,${b} 292,${b}`,class:'b',style:`marker-end:url(#${p}varrb)`})));
  ['x_1','x_2','x_m'].forEach((t,i)=>box(40,rows[i],`$${t}$`));
  ['u_1','u_2','u_n'].forEach((t,i)=>box(230,rows[i],`$${t}$`));
  box(440,88,'$y$');
  label(svg,70,118,'$\\vdots$',13,'middle'); label(svg,260,118,'$\\vdots$',13,'middle');
  label(svg,260,192,'反向传播：从 $y$ 出发，经过 $n$ 条路径传回 $x_1$',12,'middle','','var(--s1)');
}

function headPaths(svg,p){
  addArrowMarkers(svg,[[p+'harr','var(--ink-2)'],[p+'harrb','var(--s1)']]);
  const box=(x,cy,t)=>{svg.appendChild(el('rect',{x,y:cy-16,width:60,height:32}));label(svg,x+30,cy+5,t,13,'middle');};
  // 压在边上的公式标签，底下垫一块背景色，遮住穿过的边
  const tag=(x,cy,t)=>{const n=tex(t,12,x,cy+4,'middle','var(--ink-2)');svg.appendChild(el('rect',{x:+n.getAttribute('x')-2,y:+n.getAttribute('y')-1,width:+n.getAttribute('width')+4,height:+n.getAttribute('height')+2,class:'bg'}));svg.appendChild(n);};
  const xs=[[24,'x_1'],[88,'x_i'],[152,'x_d']], zs=[[24,'1'],[72,'2'],[152,'V']];
  for(const [a] of xs) if(a!==88) for(const [b] of zs) svg.appendChild(el('path',{d:`M230,${b} L102,${a}`,class:'f',style:`marker-end:url(#${p}harr)`}));
  for(const [b] of zs){
    svg.appendChild(el('path',{d:`M230,${b} L102,88`,class:'b',style:`marker-end:url(#${p}harrb)`}));
    svg.appendChild(el('path',{d:`M440,88 C370,88 360,${b} 292,${b}`,class:'b',style:`marker-end:url(#${p}harrb)`}));
  }
  for(const [b,j] of zs){ tag(170,88+0.55*(b-88),`W_{i${j}}`); tag(337,b+(88-b)*0.22,`p_${j} - y_${j}`); }
  xs.forEach(([a,t])=>box(40,a,`$${t}$`)); zs.forEach(([b,j])=>box(230,b,`$z_${j}$`)); box(440,88,'$\\ell$');
  label(svg,70,62,'$\\vdots$',13,'middle'); label(svg,70,126,'$\\vdots$',13,'middle'); label(svg,260,118,'$\\vdots$',13,'middle');
  label(svg,260,194,'反向传播：每条路径贡献 $(p_j - y_j)\\,W_{ij}$',12,'middle','','var(--s1)');
}

const KINDS={chain,paths,vecPaths,headPaths};

/** 按 svg 的 data-kind 画对应的路径图。marker 的 id 用 svg 的 id 作前缀，同一页里的几张图互不冲突。 */
export function drawPaths(svg){
  KINDS[svg.dataset.kind](svg,svg.id+'-');
}
