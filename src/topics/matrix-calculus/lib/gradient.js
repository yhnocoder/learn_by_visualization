// 偏导数与梯度：左图是 f(x, y) = 3x²y 的取值、经过选定位置的等值线、两个偏导数和梯度的箭头，
// 右边两张图是固定 y 或固定 x 切出的单变量曲线和切线。依赖浏览器端 MathJax。
import { el, tex } from '../../../lib/svg.js';
import { readColor, onColorSchemeChange } from '../../../lib/tokens.js';
import { arrowMarker } from './markers.js';

const f=(x,y)=>3*x*x*y, fx=(x,y)=>6*x*y, fy=(x,y)=>3*x*x;
const XR=[-2,2], FR=[-24,24];
const K=0.1;   // 箭头比例：1 个单位的偏导数画成 0.1 个坐标单位

// 左图：热力图 + 叠加层。FW 是热力图部分的边长，VW 是整个 viewBox 的宽度（右侧留给 color bar）
const FW=300, VW=348, FL=34, FR_=10, FT=10, FB=26;
const fx2px=x=>FL+(x-XR[0])/(XR[1]-XR[0])*(FW-FL-FR_), fy2px=y=>FT+(XR[1]-y)/(XR[1]-XR[0])*(FW-FT-FB);
const px2fx=px=>XR[0]+(px-FL)/(FW-FL-FR_)*(XR[1]-XR[0]), px2fy=py=>XR[1]-(py-FT)/(FW-FT-FB)*(XR[1]-XR[0]);
// 右侧两张剖面图
const SW=460, SH=140, SL=40, SR=12, ST=10, SB=22;
const s2x=x=>SL+(x-XR[0])/(XR[1]-XR[0])*(SW-SL-SR), s2y=v=>ST+(FR[1]-v)/(FR[1]-FR[0])*(SH-ST-SB);

// 等值线 3x²y = c，即 y = c / (3x²)，sgn 选 x 的正负哪一侧
function branch(c,sgn){
  if(Math.abs(c)<1e-6)return `M${FL},${fy2px(0)} L${FW-FR_},${fy2px(0)}`;   // c = 0 时取 y = 0 这条线
  const pts=[]; for(let i=0;i<=200;i++){const x=sgn*(0.05+1.95*i/200), y=c/(3*x*x); if(Math.abs(y)<=2.5)pts.push(fx2px(x).toFixed(1)+','+fy2px(y).toFixed(1));}
  return pts.length>1?'M'+pts.join(' L'):'';
}
function fmt(v){return (Math.abs(v)<5e-4?0:v).toFixed(3);}

export function initGradient(fig){
  const q=s=>fig.querySelector(`[data-grad="${s}"]`);
  const fld=q('field'), sx=q('sx'), sy=q('sy'), inX=q('x'), inY=q('y');
  const p=fig.id+'-';   // 这张图里 marker、clipPath、渐变的 id 前缀
  let x0=1.2, y0=0.8;

  const img=el('image',{x:FL,y:FT,width:FW-FL-FR_,height:FW-FT-FB,preserveAspectRatio:'none',style:'opacity:.55'});
  const defsF=el('defs',{});
  for(const [id,col] of [['garr','var(--s7)'],['xarr','var(--s3)'],['yarr','var(--s5)']])defsF.appendChild(arrowMarker(p+id,col,{refX:8,size:6}));
  const clipF=el('clipPath',{id:p+'gclip'}); clipF.appendChild(el('rect',{x:FL,y:FT,width:FW-FL-FR_,height:FW-FT-FB})); defsF.appendChild(clipF);
  fld.appendChild(defsF); fld.appendChild(img);
  const gridF=el('g',{}), ovF=el('g',{'clip-path':`url(#${p}gclip)`}); fld.appendChild(gridF); fld.appendChild(ovF);
  for(const v of [-2,-1,0,1,2]){
    gridF.appendChild(el('line',{x1:fx2px(v),y1:FT,x2:fx2px(v),y2:FW-FB,class:'grid'}));
    gridF.appendChild(el('line',{x1:FL,y1:fy2px(v),x2:FW-FR_,y2:fy2px(v),class:'grid'}));
    gridF.appendChild(el('text',{x:fx2px(v),y:FW-8,'text-anchor':'middle'},String(v)));
    gridF.appendChild(el('text',{x:FL-6,y:fy2px(v)+4,'text-anchor':'end'},String(v)));
  }
  gridF.appendChild(el('line',{x1:fx2px(0),y1:FT,x2:fx2px(0),y2:FW-FB,class:'axis'}));
  gridF.appendChild(el('line',{x1:FL,y1:fy2px(0),x2:FW-FR_,y2:fy2px(0),class:'axis'}));
  // color bar：与热力图同一套颜色和透明度，上端 f = 24，下端 f = -24
  const cb=el('linearGradient',{id:p+'gcb',x1:0,y1:0,x2:0,y2:1});
  for(const [o,c] of [[0,'--s8'],[0.5,'--surface-2'],[1,'--s1']])cb.appendChild(el('stop',{offset:o,style:`stop-color:var(${c})`}));
  defsF.appendChild(cb);
  const CBX=FW+4, CBW=10, cb2px=v=>FT+(FR[1]-v)/(FR[1]-FR[0])*(FW-FT-FB);
  gridF.appendChild(el('rect',{x:CBX,y:FT,width:CBW,height:FW-FT-FB,fill:`url(#${p}gcb)`,style:'opacity:.55'}));
  gridF.appendChild(el('rect',{x:CBX,y:FT,width:CBW,height:FW-FT-FB,fill:'none',stroke:'var(--rule-2)'}));
  for(const v of [-24,-12,0,12,24]){
    gridF.appendChild(el('line',{x1:CBX+CBW,y1:cb2px(v),x2:CBX+CBW+3,y2:cb2px(v),stroke:'var(--axis)'}));
    gridF.appendChild(el('text',{x:CBX+CBW+6,y:cb2px(v)+4,'text-anchor':'start'},String(v)));
  }
  gridF.appendChild(tex('x',13,FW-FR_-5,fy2px(0)+15,'end','var(--ink-2)'));
  gridF.appendChild(tex('y',13,fx2px(0)+6,FT+14,'start','var(--ink-2)'));

  // 热力图画在 canvas 上，颜色要用数值，所以读取 token 的实际颜色；亮暗色切换时重画
  function paint(){
    const neg=readColor('--s1',fig), mid=readColor('--surface-2',fig), pos=readColor('--s8',fig);
    const N=96, cv=document.createElement('canvas'); cv.width=N; cv.height=N; const ctx=cv.getContext('2d'); const d=ctx.createImageData(N,N);
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){
      const x=XR[0]+(i+.5)/N*(XR[1]-XR[0]), y=XR[1]-(j+.5)/N*(XR[1]-XR[0]);
      let t=f(x,y)/FR[1]; t=Math.max(-1,Math.min(1,t));
      const a=t<0?neg:pos, k=Math.abs(t), o=(j*N+i)*4;
      for(let c=0;c<3;c++)d.data[o+c]=Math.round(mid[c]+(a[c]-mid[c])*k);
      d.data[o+3]=255;
    }
    ctx.putImageData(d,0,0); img.setAttribute('href',cv.toDataURL());
  }
  paint();
  onColorSchemeChange(paint);

  function buildSlice(svg,axisName,varName,cls){
    const clip=`${p}clip-${svg.id}`;
    const defs=el('defs',{}); const cp=el('clipPath',{id:clip}); cp.appendChild(el('rect',{x:SL,y:ST,width:SW-SL-SR,height:SH-ST-SB})); defs.appendChild(cp); svg.appendChild(defs);
    const grid=el('g',{}); svg.appendChild(grid);
    for(const v of [-2,-1,0,1,2]){grid.appendChild(el('line',{x1:s2x(v),y1:ST,x2:s2x(v),y2:SH-SB,class:'grid'}));grid.appendChild(el('text',{x:s2x(v),y:SH-6,'text-anchor':'middle'},String(v)));}
    for(const v of [-24,-12,0,12,24]){grid.appendChild(el('line',{x1:SL,y1:s2y(v),x2:SW-SR,y2:s2y(v),class:'grid'}));grid.appendChild(el('text',{x:SL-6,y:s2y(v)+4,'text-anchor':'end'},String(v)));}
    grid.appendChild(el('line',{x1:SL,y1:s2y(0),x2:SW-SR,y2:s2y(0),class:'axis'}));
    grid.appendChild(el('line',{x1:s2x(0),y1:ST,x2:s2x(0),y2:SH-SB,class:'axis'}));
    const curve=el('path',{class:'curve','clip-path':`url(#${clip})`}), ov=el('g',{'clip-path':`url(#${clip})`}), title=el('g',{});
    svg.appendChild(curve); svg.appendChild(ov); svg.appendChild(title);
    title.appendChild(tex(axisName,12.5,SW-SR-4,ST+14,'end'));title.appendChild(tex(varName,12.5,SW-SR-4,s2y(0)+15,'end','var(--ink-2)'));
    return {curve,ov,cls};
  }
  const gx=buildSlice(sx,'f(x,\\,y_0)','x','tx'), gy=buildSlice(sy,'f(x_0,\\,y)','y','ty');
  function drawSlice(g,fn,at,slope,pointCls){
    const pts=[]; for(let i=0;i<=120;i++){const v=XR[0]+(XR[1]-XR[0])*i/120;pts.push((i?'L':'M')+s2x(v).toFixed(1)+','+s2y(fn(v)).toFixed(1));}
    g.curve.setAttribute('d',pts.join(' '));
    g.ov.innerHTML='';
    const px=s2x(at), py=s2y(fn(at));
    const kx=(SW-SL-SR)/(XR[1]-XR[0]), ky=(SH-ST-SB)/(FR[1]-FR[0]), m=-slope*ky/kx;
    g.ov.appendChild(el('line',{x1:px-500,y1:py-500*m,x2:px+500,y2:py+500*m,class:g.cls}));
    g.ov.appendChild(el('line',{x1:px,y1:ST,x2:px,y2:SH-SB,class:'guide'}));
    g.ov.appendChild(el('circle',{cx:px,cy:py,r:5,class:pointCls}));
  }

  function render(){
    const px=fx(x0,y0), py=fy(x0,y0);
    // 左图叠加层
    ovF.innerHTML='';
    ovF.appendChild(el('line',{x1:FL,y1:fy2px(y0),x2:FW-FR_,y2:fy2px(y0),class:'slx'}));
    ovF.appendChild(el('line',{x1:fx2px(x0),y1:FT,x2:fx2px(x0),y2:FW-FB,class:'sly'}));
    // 经过当前位置的等值线
    if(Math.abs(x0)>0.05)ovF.appendChild(el('path',{d:branch(f(x0,y0),Math.sign(x0)),class:'contour'}));
    // 两个偏导数沿坐标轴的箭头、补全矩形的虚线、合成的梯度箭头，长度都乘 K
    const ex=x0+K*px, ey=y0+K*py, P0=`${fx2px(x0)},${fy2px(y0)}`;
    ovF.appendChild(el('path',{d:`M${fx2px(ex)},${fy2px(y0)} L${fx2px(ex)},${fy2px(ey)} L${fx2px(x0)},${fy2px(ey)}`,class:'box'}));
    if(Math.abs(px)>1e-3)ovF.appendChild(el('path',{d:`M${P0} L${fx2px(ex)},${fy2px(y0)}`,class:'cx','marker-end':`url(#${p}xarr)`}));
    if(Math.abs(py)>1e-3)ovF.appendChild(el('path',{d:`M${P0} L${fx2px(x0)},${fy2px(ey)}`,class:'cy','marker-end':`url(#${p}yarr)`}));
    if(Math.hypot(px,py)>1e-3)ovF.appendChild(el('path',{d:`M${P0} L${fx2px(ex)},${fy2px(ey)}`,class:'gradv','marker-end':`url(#${p}garr)`}));
    ovF.appendChild(el('circle',{cx:fx2px(x0),cy:fy2px(y0),r:6,class:'p0'}));
    // 剖面
    drawSlice(gx,x=>f(x,y0),x0,px,'px'); drawSlice(gy,y=>f(x0,y),y0,py,'py');
    // 读数
    q('xv').textContent=x0.toFixed(2); q('yv').textContent=y0.toFixed(2);
    q('px').textContent=fmt(px); q('py').textContent=fmt(py); q('g1').textContent=fmt(px); q('g2').textContent=fmt(py);
  }
  inX.addEventListener('input',()=>{x0=+inX.value;render();}); inY.addEventListener('input',()=>{y0=+inY.value;render();});
  let drag=false;
  function fromPointer(ev){
    const r=fld.getBoundingClientRect();
    const px=(ev.clientX-r.left)/r.width*VW, py=(ev.clientY-r.top)/r.height*FW;
    x0=Math.max(XR[0],Math.min(XR[1],px2fx(px))); y0=Math.max(XR[0],Math.min(XR[1],px2fy(py)));
    inX.value=x0; inY.value=y0; render();
  }
  fld.addEventListener('pointerdown',ev=>{drag=true;fld.setPointerCapture(ev.pointerId);fromPointer(ev);});
  fld.addEventListener('pointermove',ev=>{if(drag)fromPointer(ev);});
  fld.addEventListener('pointerup',()=>{drag=false;}); fld.addEventListener('pointercancel',()=>{drag=false;});
  render();
}
