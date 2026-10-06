// 割线与切线：上图是函数图像、过两点的割线和切线，下图是导数函数。
// 两个滑块控制 x0 和 Δx，也可以在上图里拖动选择 x0；四个按钮切换函数。依赖浏览器端 MathJax。
import { el, tex } from '../../../lib/svg.js';

const sig=x=>1/(1+Math.exp(-x));
const F={
  cube:{f:x=>x*x*x,d:x=>3*x*x,xr:[-2,2],yr:[-8,8],dr:[-1,12],x0:[-1.9,1],init:1},
  sin:{f:Math.sin,d:Math.cos,xr:[-6.5,6.5],yr:[-1.6,1.6],dr:[-1.5,1.5],x0:[-6.3,5.5],init:1},
  ln:{f:Math.log,d:x=>1/x,xr:[0,6],yr:[-3,2.2],dr:[-0.3,5],x0:[0.15,5],init:1,lo:0.01},
  swish:{f:x=>x*sig(x),d:x=>{const s=sig(x);return s+x*s*(1-s);},xr:[-6,6],yr:[-1.2,6],dr:[-0.2,1.2],x0:[-5.8,5],init:1}
};
const W=760, HF=300, HD=170, L=44, R=16, TP=12, BT=22, N=240;

function scale(xr,yr,H){
  const sx=x=>L+(x-xr[0])/(xr[1]-xr[0])*(W-L-R);
  const sy=y=>TP+(yr[1]-y)/(yr[1]-yr[0])*(H-TP-BT);
  return {sx,sy,ix:px=>xr[0]+(px-L)/(W-L-R)*(xr[1]-xr[0])};
}
function clampY(py,H){return Math.max(-200,Math.min(H+200,py));}
function pts(fn,g,H,which){
  const spec=F[fn];const out=[];
  for(let i=0;i<=N;i++){
    const x=spec.xr[0]+(spec.xr[1]-spec.xr[0])*i/N;
    const xx=(spec.lo!=null&&x<spec.lo)?spec.lo:x;
    let y=spec[which](xx);
    if(!isFinite(y))y=spec.yr[1]*10;
    out.push([g.sx(x),clampY(g.sy(y),H)]);
  }
  return out;
}
const path=p=>p.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ');
function ticks(xr){const step=(xr[1]-xr[0])>10?2:1;const out=[];for(let v=Math.ceil(xr[0]/step)*step;v<=xr[1]+1e-9;v+=step)out.push(v);return out;}
// 像素坐标下过 (px,py)、斜率为 slopePx 的直线，延伸到画布两端
function lineThrough(px,py,slopePx){
  const x1=L-40,x2=W-R+40;
  return {x1,y1:py+(x1-px)*slopePx,x2,y2:py+(x2-px)*slopePx};
}

export function initTangent(fig){
  const q=s=>fig.querySelector(`[data-tan="${s}"]`);
  const svgF=q('f'), svgD=q('d');
  const inX=q('x'), inDx=q('dx'), outX=q('xv'), outDx=q('dxv'), outSec=q('sec'), outTan=q('tan');
  let cur='cube', x0=1, dx=0.001, anim=null;

  function build(svg,H,isD){
    svg.innerHTML='';
    const id=`${fig.id}-clip${isD?'D':'F'}`;
    const defs=el('defs',{});const cp=el('clipPath',{id});cp.appendChild(el('rect',{x:L,y:TP,width:W-L-R,height:H-TP-BT}));defs.appendChild(cp);svg.appendChild(defs);
    const g={grid:el('g',{class:'g'}),curve:el('path',{class:isD?'dcurve':'curve','clip-path':`url(#${id})`}),ov:el('g',{class:'ov','clip-path':`url(#${id})`}),lab:el('g',{class:'ov'})};
    svg.appendChild(g.grid);svg.appendChild(g.curve);svg.appendChild(g.ov);svg.appendChild(g.lab);
    const t=tex(isD?'\\dfrac{dy}{dx}':'y = f(x)',13,W-R-6,TP+(isD?26:16),'end');
    svg.appendChild(el('rect',{x:+t.getAttribute('x')-4,y:+t.getAttribute('y')-2,width:+t.getAttribute('width')+8,height:+t.getAttribute('height')+4,rx:3,style:'fill:var(--surface);opacity:.9'}));
    svg.appendChild(t);
    if(!isD){g.x0=tex('x_0',13,0,H-BT-8,'start');g.lab.appendChild(g.x0);}
    return g;
  }
  const gF=build(svgF,HF,false), gD=build(svgD,HD,true);

  function drawGrid(g,spec,sc,H,yr){
    g.grid.innerHTML='';
    for(const v of ticks(spec.xr)){
      const px=sc.sx(v);
      g.grid.appendChild(el('line',{x1:px,y1:TP,x2:px,y2:H-BT,class:'grid'}));
      g.grid.appendChild(el('text',{x:px,y:H-6,'text-anchor':'middle'},String(v)));
    }
    const ystep=(yr[1]-yr[0])>6?2:((yr[1]-yr[0])>2.5?1:0.5);
    for(let v=Math.ceil(yr[0]/ystep)*ystep;v<=yr[1]+1e-9;v+=ystep){
      const py=sc.sy(v);
      g.grid.appendChild(el('line',{x1:L,y1:py,x2:W-R,y2:py,class:'grid'}));
      g.grid.appendChild(el('text',{x:L-6,y:py+4,'text-anchor':'end'},String(+v.toFixed(2))));
    }
    if(yr[0]<0&&yr[1]>0)g.grid.appendChild(el('line',{x1:L,y1:sc.sy(0),x2:W-R,y2:sc.sy(0),class:'axis'}));
    if(spec.xr[0]<0&&spec.xr[1]>0)g.grid.appendChild(el('line',{x1:sc.sx(0),y1:TP,x2:sc.sx(0),y2:H-BT,class:'axis'}));
    else g.grid.appendChild(el('line',{x1:L,y1:TP,x2:L,y2:H-BT,class:'axis'}));
  }

  function overlay(){
    const spec=F[cur];
    const sF=scale(spec.xr,spec.yr,HF), sD=scale(spec.xr,spec.dr,HD);
    const y0=spec.f(x0), x1=x0+dx, y1=spec.f(x1);
    const kSec=(y1-y0)/dx, kTan=spec.d(x0);
    // 像素斜率：dy_px/dx_px
    const kx=(W-L-R)/(spec.xr[1]-spec.xr[0]), ky=(HF-TP-BT)/(spec.yr[1]-spec.yr[0]);
    const toPx=k=>-k*ky/kx;
    gF.ov.innerHTML='';gD.ov.innerHTML='';
    const px0=sF.sx(x0), py0=sF.sy(y0);
    let l=lineThrough(px0,py0,toPx(kTan)); gF.ov.appendChild(el('line',{...l,class:'tan'}));
    l=lineThrough(px0,py0,toPx(kSec)); gF.ov.appendChild(el('line',{...l,class:'sec'}));
    gF.ov.appendChild(el('line',{x1:px0,y1:TP,x2:px0,y2:HF-BT,class:'guide'}));
    gF.ov.appendChild(el('circle',{cx:sF.sx(x1),cy:clampY(sF.sy(y1),HF),r:5,class:'p1'}));
    gF.ov.appendChild(el('circle',{cx:px0,cy:py0,r:6,class:'p0'}));
    gF.x0.setAttribute('x',px0+7);
    const pxd=sD.sx(x0), pyd=sD.sy(kTan);
    gD.ov.appendChild(el('line',{x1:pxd,y1:TP,x2:pxd,y2:HD-BT,class:'guide'}));
    gD.ov.appendChild(el('line',{x1:L,y1:pyd,x2:pxd,y2:pyd,class:'guide'}));
    gD.ov.appendChild(el('circle',{cx:pxd,cy:clampY(pyd,HD),r:6,class:'pd'}));
    outX.textContent=x0.toFixed(2); outDx.textContent=dx.toFixed(3);
    outSec.textContent=kSec.toFixed(3); outTan.textContent=kTan.toFixed(3);
  }

  // 切换函数时曲线从旧形状过渡到新形状，过渡期间隐藏割线、切线和标记
  function setFn(fn){
    const spec=F[fn];
    const sF=scale(spec.xr,spec.yr,HF), sD=scale(spec.xr,spec.dr,HD);
    drawGrid(gF,spec,sF,HF,spec.yr); drawGrid(gD,spec,sD,HD,spec.dr);
    const toF=pts(fn,sF,HF,'f'), toD=pts(fn,sD,HD,'d');
    const fromF=gF.curve._pts||toF, fromD=gD.curve._pts||toD;
    gF.curve._pts=toF; gD.curve._pts=toD;
    cur=fn; x0=spec.init; dx=0.001;
    inX.min=spec.x0[0]; inX.max=spec.x0[1]; inX.value=x0; inDx.value=-3;
    for(const b of fig.querySelectorAll('.fn button'))b.setAttribute('aria-pressed',String(b.dataset.fn===fn));
    if(anim)cancelAnimationFrame(anim);
    const t0=performance.now(), D=320;
    gF.ov.classList.add('off');gF.lab.classList.add('off');gD.ov.classList.add('off');
    function step(now){
      let t=Math.min(1,(now-t0)/D); t=1-Math.pow(1-t,3);
      gF.curve.setAttribute('d',path(fromF.map((p,i)=>[p[0],p[1]+(toF[i][1]-p[1])*t])));
      gD.curve.setAttribute('d',path(fromD.map((p,i)=>[p[0],p[1]+(toD[i][1]-p[1])*t])));
      if(t<1)anim=requestAnimationFrame(step);
      else{anim=null;overlay();gF.ov.classList.remove('off');gF.lab.classList.remove('off');gD.ov.classList.remove('off');}
    }
    anim=requestAnimationFrame(step);
  }

  fig.querySelectorAll('.fn button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.fn!==cur)setFn(b.dataset.fn);}));
  inX.addEventListener('input',()=>{x0=+inX.value;overlay();});
  inDx.addEventListener('input',()=>{dx=Math.pow(10,+inDx.value);overlay();});

  let drag=false;
  function fromPointer(ev){
    const r=svgF.getBoundingClientRect();
    const px=(ev.clientX-r.left)/r.width*W;
    const spec=F[cur];
    const x=scale(spec.xr,spec.yr,HF).ix(px);
    x0=Math.max(spec.x0[0],Math.min(spec.x0[1],x));
    inX.value=x0; overlay();
  }
  svgF.addEventListener('pointerdown',ev=>{drag=true;svgF.setPointerCapture(ev.pointerId);fromPointer(ev);});
  svgF.addEventListener('pointermove',ev=>{if(drag)fromPointer(ev);});
  svgF.addEventListener('pointerup',()=>{drag=false;});
  svgF.addEventListener('pointercancel',()=>{drag=false;});

  const spec0=F.cube, s0=scale(spec0.xr,spec0.yr,HF), d0=scale(spec0.xr,spec0.dr,HD);
  drawGrid(gF,spec0,s0,HF,spec0.yr); drawGrid(gD,spec0,d0,HD,spec0.dr);
  gF.curve._pts=pts('cube',s0,HF,'f'); gD.curve._pts=pts('cube',d0,HD,'d');
  gF.curve.setAttribute('d',path(gF.curve._pts)); gD.curve.setAttribute('d',path(gD.curve._pts));
  overlay();
}
