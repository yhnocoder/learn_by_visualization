// MHA 与 GQA 的对比：n_h = 4 个 query head，MHA 每个 head 有自己的 K、V，GQA 每两个 head 共用一组。
// 图在折叠块里，未展开时 getComputedTextLength 为 0，所以这里不用 label()：文字用 text-anchor 居中，公式用 tex()。
// 依赖浏览器端 MathJax，调用前先 await mathReady()。
import { el, tex } from '../../../lib/svg.js';

export function drawGqa(svg){
  const QY=34, KY=118, H=34, BW=60, cx=(x0,i)=>x0+36+72*i;
  const text=(x,y,t,anchor)=>svg.appendChild(el('text',{x,y,'text-anchor':anchor||'middle'},t));
  const box=(x,y,w,t,cls)=>{svg.appendChild(el('rect',{x:x-w/2,y,width:w,height:H,class:cls||''}));svg.appendChild(tex(t,14,x,y+H/2+5,'middle'));};
  text(82,QY+H/2+5,'query head','end'); text(82,KY+H/2+5,'K/V','end');
  for(const [x0,title,nkv] of [[90,'MHA',4],[410,'GQA',2]]){
    text(x0+144,18,title);
    const per=4/nkv;
    for(let j=0;j<nkv;j++){
      const cls=nkv<4?'g'+(j+1):'', l=cx(x0,j*per), r=cx(x0,j*per+per-1), kx=(l+r)/2;
      for(let i=j*per;i<(j+1)*per;i++){
        svg.appendChild(el('path',{d:`M${cx(x0,i)},${QY+H} L${kx},${KY}`,class:cls}));
        box(cx(x0,i),QY,BW-8,`Q_${i+1}`,cls);
      }
      box(kx,KY,r-l+BW,`K_${j+1},\\,V_${j+1}`,cls);
    }
  }
  text(410+144,KY+H+22,'每组 K/V 被 2 个 query head 共用');
}
