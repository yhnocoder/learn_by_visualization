import { F16, BF16, F32, E4M3, E5M2, rt, ulpOf, num, esc, mulberry32, gauss, ncdf, mkPlot } from './lib/common.js'
import { decode, encode, fields, maxFiniteCode, parseValue, pow2 } from './lib/fmt.js'
import { typeset } from 'bake/kit'
import './lib/figure.css'

export const layout = { placeholder: { narrow: 560, wide: 560 } }

const $=id=>document.getElementById(id);

export default class AccumulationError extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    this.classList.add('mp-figure')
    this.innerHTML = `<h4>演示：同一串数在 fp16 与 fp32 中顺序累加</h4>
    <div class="controls">
      <label>加数分布 <select id="a-mode"><option value="uniform">均匀分布 [0, 1)</option><option value="signed">零均值 N(0, 1) × 0.1</option><option value="prod">两个 fp16 向量的逐元素乘积</option></select></label>
      <button class="btn" type="button" id="a-resample">重新采样</button>
    </div>
    <div class="legend"><span><i class="line" style="--c:var(--s2)"></i>fp16 累加</span><span><i class="line" style="--c:var(--s1)"></i>fp32 累加</span><span><i class="line" style="--c:var(--ink-3)"></i>精确值（float64）</span></div>
    <div class="plot" id="a-plot"></div>
    <div class="tbl"><table id="a-table"></table></div>`
  const host=$('a-plot'), modeSel=$('a-mode'); const N=4096; let seed=11;
  function data(mode){
    const rnd=mulberry32(seed), xs=[];
    for(let i=0;i<N;i++){
      if(mode==='uniform') xs.push(rnd());
      else if(mode==='signed') xs.push(0.1*gauss(rnd));
      else { const a=rt(F16,0.5*gauss(rnd)), b=rt(F16,0.5*gauss(rnd)); xs.push(Math.fround(a*b)); }
    }
    return xs;
  }
  function render(){
    const xs=data(modeSel.value);
    const ex=[],f32=[],f16=[]; let e=0,s32=0,s16=0;
    for(let i=0;i<N;i++){ e+=xs[i]; s32=Math.fround(s32+xs[i]); s16=rt(F16,s16+xs[i]); ex.push(e); f32.push(s32); f16.push(s16); }
    let lo=Math.min(0,...ex,...f16), hi=Math.max(0,...ex,...f16); const pad=(hi-lo)*0.08||1; lo-=pad; hi+=pad;
    const yt=[]; const stepY=niceStep((hi-lo)/5); for(let v=Math.ceil(lo/stepY)*stepY; v<=hi; v+=stepY) yt.push(+v.toFixed(10));
    const p=mkPlot(host,{W:680,H:300,xr:[0,N],yr:[lo,hi],xt:[0,1024,2048,3072,4096],yt,yf:t=>num(t,4),xl:'已累加的加数个数',yl:'部分和',aria:'三种精度的部分和随加数个数的变化'});
    const path=(arr,c,w)=>{ let d=''; for(let i=0;i<N;i+=2) d+=(i?' L':'M')+p.X(i+1).toFixed(1)+' '+p.Y(arr[i]).toFixed(1); return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"/>`; };
    let s=path(ex,'var(--ink-3)',1.2)+path(f32,'var(--s1)',1.6)+path(f16,'var(--s2)',1.6);
    if(modeSel.value==='uniform') s+=`<line x1="${p.ml}" x2="${p.W-p.mr}" y1="${p.Y(2048)}" y2="${p.Y(2048)}" stroke="var(--axis)" stroke-dasharray="4 3"/><text class="ann" x="${p.ml+6}" y="${p.Y(2048)-5}">2048：fp16 的 ulp 变为 2</text>`;
    p.body.innerHTML=s;
    let t='<thead><tr><th class="r">N</th><th>精确值</th><th>fp32 累加</th><th>fp16 累加</th><th class="r">fp32 相对误差</th><th class="r">fp16 相对误差</th></tr></thead><tbody>';
    for(const n of [256,1024,4096]){ const i=n-1; const re=(a)=>ex[i]===0?'—':num(Math.abs(a-ex[i])/Math.abs(ex[i]),3); t+=`<tr><td class="m r">${n}</td><td class="m">${num(ex[i],7)}</td><td class="m">${num(f32[i],7)}</td><td class="m">${num(f16[i],7)}</td><td class="m r">${re(f32[i])}</td><td class="m r">${re(f16[i])}</td></tr>`; }
    $('a-table').innerHTML=t+'</tbody>';
  }
  function niceStep(x){ const e=Math.pow(10,Math.floor(Math.log10(x))); const f=x/e; return (f<1.5?1:f<3.5?2:f<7.5?5:10)*e; }
  modeSel.addEventListener('input',render);
  $('a-resample').addEventListener('click',()=>{ seed++; render(); });
  render();
    typeset(this)
  }
}
