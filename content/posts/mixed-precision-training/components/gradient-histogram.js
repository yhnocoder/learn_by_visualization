import { F16, BF16, F32, E4M3, E5M2, rt, ulpOf, num, esc, mulberry32, gauss, ncdf, mkPlot } from './lib/common.js'
import { decode, encode, fields, maxFiniteCode, parseValue, pow2 } from './lib/fmt.js'
import { typeset } from 'bake/kit'
import './lib/figure.css'

export const layout = { placeholder: { narrow: 480, wide: 460 } }

const $=id=>document.getElementById(id);

export default class GradientHistogram extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    this.classList.add('mp-figure')
    this.innerHTML = `<h4>演示：loss scale 把梯度直方图平移到可表示范围内</h4>
    <div class="controls">
      <label>loss scale S = 2^k，k <input type="range" id="h-k" min="0" max="24" step="1" value="0"> <span class="v" id="h-k-v"></span></label>
      <label>分布中心 μ（log₂）<input type="range" id="h-mu" min="-40" max="-10" step="1" value="-26"> <span class="v" id="h-mu-v"></span></label>
      <label>格式 <select id="h-fmt"><option value="fp16">fp16</option><option value="bf16">bf16</option></select></label>
    </div>
    <div class="legend"><span><i style="--c:var(--bad-soft)"></i>归零</span><span><i style="--c:var(--warn-soft)"></i>subnormal</span><span><i style="--c:var(--ok-soft)"></i>规格化</span><span><i style="--c:var(--bad-soft)"></i>溢出</span><span><i style="--c:var(--s1)"></i>非零梯度的分布</span></div>
    <div class="plot" id="h-plot"></div>
    <div class="status" id="h-status"></div>`
  const host=$('h-plot'), kIn=$('h-k'), muIn=$('h-mu'), fmtSel=$('h-fmt');
  const X0=-64, X1=20, SD=7;
  const p=mkPlot(host,{W:680,H:300,xr:[X0,X1],yr:[0,0.08],xt:[-60,-50,-40,-30,-20,-10,0,10,20],yt:[0,0.02,0.04,0.06,0.08],yf:t=>(t*100).toFixed(0)+'%',xf:t=>String(t),xl:'log₂ |梯度|（每格一个 binade）',yl:'非零梯度的占比',aria:'梯度直方图与 fp16 可表示区间'});
  function regions(fmt){
    if(fmt==='fp16') return {zero:-25,sub:-24,norm:-14,over:16};
    return {zero:-134,sub:-133,norm:-126,over:128};
  }
  function render(){
    const k=+kIn.value, mu=+muIn.value, fmt=fmtSel.value; const r=regions(fmt);
    $('h-k-v').textContent='2^'+k+' = '+pow2(k); $('h-mu-v').textContent='2^'+mu;
    const clamp=x=>Math.max(X0,Math.min(X1,x));
    const band=(a,b,c)=>a>=b?'':`<rect x="${p.X(clamp(a))}" y="${p.mt}" width="${p.X(clamp(b))-p.X(clamp(a))}" height="${p.H-p.mt-p.mb}" fill="${c}"/>`;
    p.bg.innerHTML=band(X0,r.zero+1,'var(--bad-soft)')+band(r.sub,r.norm,'var(--warn-soft)')+band(r.norm,r.over,'var(--ok-soft)')+band(r.over,X1,'var(--bad-soft)');
    let bars='', zero=0,sub=0,norm=0,over=0;
    for(let b=-120;b<=60;b++){
      const mass=ncdf((b+1-mu)/SD)-ncdf((b-mu)/SD); const sb=b+k;
      if(sb<=r.zero) zero+=mass; else if(sb<r.norm) sub+=mass; else if(sb<r.over) norm+=mass; else over+=mass;
      if(sb>=X0&&sb<X1&&mass>1e-5){ const x=p.X(sb), w=p.X(sb+1)-x; bars+=`<rect x="${x+0.5}" y="${p.Y(mass)}" width="${Math.max(0.5,w-1)}" height="${p.Y(0)-p.Y(mass)}" fill="var(--s1)" opacity=".85"/>`; }
    }
    const labels=[];
    if(fmt==='fp16'){ labels.push([X0+1,'归零 (< 2⁻²⁵)'],[r.sub,'subnormal'],[r.norm+9,'规格化'],[r.over+0.5,'溢出']); }
    else labels.push([X0+1,'bf16：整段都在规格化区间内（最小规格化数 2⁻¹²⁶ 在图外）']);
    let ann=''; for(const [x,t] of labels) ann+=`<text class="ann" x="${p.X(x)+3}" y="${p.mt+13}">${t}</text>`;
    const lines=[[r.sub,'2^'+r.sub],[r.norm,'2^'+r.norm],[r.over,'2^'+r.over]].filter(([x])=>x>X0&&x<X1).map(([x,t])=>`<line x1="${p.X(x)}" x2="${p.X(x)}" y1="${p.mt}" y2="${p.H-p.mb}" stroke="var(--axis)" stroke-dasharray="3 3"/><text x="${p.X(x)+3}" y="${p.mt+27}">${t}</text>`).join('');
    p.body.innerHTML=bars+lines+ann;
    const pct=x=>(x*100).toFixed(1)+'%';
    $('h-status').innerHTML=`非零梯度中：归零 <b>${pct(zero)}</b> · subnormal <b>${pct(sub)}</b> · 规格化 <b>${pct(norm)}</b> · 溢出 <b>${pct(over)}</b>${over>0.001?'  ← 出现溢出，梯度里会有 inf，这一步应当跳过':''}`;
  }
  for(const el of [kIn,muIn,fmtSel]) el.addEventListener('input',render);
  render();
    typeset(this)
  }
}
