// RoPE 的旋转：一对分量的 query 和 key 向量，旋转前（虚线）与旋转后（实线）的位置。
// 两个滑块设置 query 的位置 t 和 key 的位置 s，按钮切换分量对、让 t 和 s 同时加减 1。
// 图在折叠块里，未展开时没有布局，所以只用 tex() 和 text-anchor，不量文字宽度。依赖浏览器端 MathJax。
import { el, tex } from '../../../lib/svg.js';
import { addArrowMarkers } from './markers.js';

const C=160, S=120;                       // 圆心坐标和单位长度（px）
const Q=[0.85,0.25], K=[0.3,0.7];         // 旋转前的一对分量
const TH=[1,0.1,0.01,0.001];              // d_h = 8，b = 10000 时四对的 θ_k
const TAU=2*Math.PI, net=a=>((a%TAU)+TAU)%TAU;
const rot=(v,a)=>{const c=Math.cos(a),sn=Math.sin(a);return [v[0]*c-v[1]*sn, v[0]*sn+v[1]*c];};  // 行向量乘 R(a)：逆时针旋转 a
const px=v=>[C+v[0]*S, C-v[1]*S];

export function initRope(fig){
  const q=s=>fig.querySelector(`[data-rope="${s}"]`);
  const svg=q('svg'), inT=q('t'), inS=q('s'), up=q('up'), down=q('down');
  const out=(key,v)=>{q(key).textContent=v;};
  const p=fig.id+'-';
  let k=0;
  addArrowMarkers(svg,[[p+'s1','var(--s1)'],[p+'s2','var(--s2)']],{size:6});
  svg.appendChild(el('circle',{cx:C,cy:C,r:S,class:'grid'}));
  svg.appendChild(el('line',{x1:C-S-14,y1:C,x2:C+S+14,y2:C,class:'axis'}));
  svg.appendChild(el('line',{x1:C,y1:C-S-14,x2:C,y2:C+S+14,class:'axis'}));
  const g=el('g',{}); svg.appendChild(g);
  const lab={};
  for(const [key,t,c] of [['q','\\mathbf{q}','s1'],['k','\\mathbf{k}','s2'],['qr','\\mathbf{q}R_t','s1'],['kr','\\mathbf{k}R_s','s2']]){
    lab[key]=tex(t,15,0,0,'start',`var(--${c})`); svg.appendChild(lab[key]);
  }
  function place(key,v,show){
    const n=lab[key], w=+n.getAttribute('width'), h=+n.getAttribute('height'), r=Math.hypot(v[0],v[1]);
    const [x,y]=px([v[0]*(1+0.2/r),v[1]*(1+0.2/r)]);
    n.setAttribute('x',x-w/2); n.setAttribute('y',y-h/2); n.style.opacity=show?1:0;
  }
  // 从角度 a 逆时针画到 a+d（d 可以为负），半径 r（px）
  function arc(r,a,d,cls,color){
    if(Math.abs(d)<1e-3)return;
    const p0=[C+r*Math.cos(a),C-r*Math.sin(a)], p1=[C+r*Math.cos(a+d),C-r*Math.sin(a+d)];
    g.appendChild(el('path',{d:`M${p0[0]},${p0[1]} A${r},${r} 0 ${Math.abs(d)>Math.PI?1:0} ${d>0?0:1} ${p1[0]},${p1[1]}`,class:cls,style:color?`stroke:var(--${color})`:''}));
  }
  function vec(v,cls,c){
    const [x,y]=px(v);
    g.appendChild(el('line',{x1:C,y1:C,x2:x,y2:y,class:cls,style:`stroke:var(--${c})`+(cls==='r'?`;marker-end:url(#${p}${c})`:'')}));
  }
  function update(){
    const t=+inT.value, s=+inS.value, th=TH[k];
    const qr=rot(Q,t*th), kr=rot(K,s*th);
    const aq=Math.atan2(Q[1],Q[0]), ak=Math.atan2(K[1],K[0]);
    g.innerHTML='';
    arc(Math.hypot(...Q)*S,aq,net(t*th),'trail','s1');
    arc(Math.hypot(...K)*S,ak,net(s*th),'trail','s2');
    vec(Q,'o','s1'); vec(K,'o','s2');
    const a1=Math.atan2(kr[1],kr[0]), a2=Math.atan2(qr[1],qr[0]);
    arc(26,a1,Math.atan2(Math.sin(a2-a1),Math.cos(a2-a1)),'ang');
    vec(qr,'r','s1'); vec(kr,'r','s2');
    const moved=a=>{const n=net(a);return n>0.35&&n<TAU-0.35;};
    place('q',Q,moved(t*th)); place('k',K,moved(s*th)); place('qr',qr,true); place('kr',kr,true);
    out('tv',t); out('sv',s); out('th',th); out('d',t-s);
    out('aq',(t*th).toFixed(3)); out('ak',(s*th).toFixed(3));
    out('dot0',(Q[0]*K[0]+Q[1]*K[1]).toFixed(3)); out('dot',(qr[0]*kr[0]+qr[1]*kr[1]).toFixed(3));
    up.disabled=t>=20||s>=20; down.disabled=t<=0||s<=0;
  }
  const btns=[...fig.querySelectorAll('.fn button')];
  function setPair(i){k=i;btns.forEach((x,j)=>x.setAttribute('aria-pressed',String(j===i)));update();}
  btns.forEach((b,i)=>b.addEventListener('click',()=>setPair(i)));
  q('reset').addEventListener('click',()=>{inT.value=3;inS.value=1;setPair(0);});
  inT.addEventListener('input',update); inS.addEventListener('input',update);
  up.addEventListener('click',()=>{inT.value=+inT.value+1;inS.value=+inS.value+1;update();});
  down.addEventListener('click',()=>{inT.value=+inT.value-1;inS.value=+inS.value-1;update();});
  update();
}
