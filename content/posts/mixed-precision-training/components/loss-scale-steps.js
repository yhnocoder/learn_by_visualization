import { F16, BF16, F32, E4M3, E5M2, rt, ulpOf, num, esc, mulberry32, gauss, ncdf, mkPlot } from './lib/common.js'
import { decode, encode, fields, maxFiniteCode, parseValue, pow2 } from './lib/fmt.js'
import { typeset } from 'bake/kit'
import './lib/figure.css'

export const layout = { placeholder: { narrow: 760, wide: 700 } }

const $=id=>document.getElementById(id);

export default class LossScaleSteps extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    this.classList.add('mp-figure')
    this.innerHTML = `<h4>演示：GradScaler 的 scale 随迭代变化</h4>
    <div class="controls">
      <label>growth_interval <input type="range" id="d-gi" min="1" max="200" step="1" value="20"> <span class="v" id="d-gi-v"></span></label>
      <label>典型最大梯度 2^μ，μ <input type="range" id="d-mu" min="-16" max="0" step="1" value="-8"> <span class="v" id="d-mu-v"></span></label>
      <label>梯度尖峰概率 <input type="range" id="d-p" min="0" max="0.2" step="0.01" value="0.03"> <span class="v" id="d-p-v"></span></label>
      <button class="btn primary" type="button" id="d-step1">前进 1 步</button>
      <button class="btn" type="button" id="d-step50">前进 50 步</button>
      <button class="btn" type="button" id="d-reset">重置</button>
    </div>
    <div class="legend"><span><i class="line" style="--c:var(--s1)"></i>log₂ scale</span><span><i class="line" style="--c:var(--bad)"></i>本步跳过（发现 inf/NaN）</span><span><i class="line" style="--c:var(--axis)"></i>溢出边界 log₂(65504 / 2^μ)</span></div>
    <div class="plot" id="d-plot"></div>
    <div class="status" id="d-status"></div>
    <div class="tbl"><table id="d-table"></table></div>`
  const host=$('d-plot'), giIn=$('d-gi'), muIn=$('d-mu'), pIn=$('d-p');
  let hist=[], scale=65536, tracker=0, rnd=mulberry32(7);
  function reset(){ hist=[]; scale=65536; tracker=0; rnd=mulberry32(7); render(); }
  function step(){
    const gi=+giIn.value, mu=+muIn.value, pr=+pIn.value;
    let lg=mu+0.7*gauss(rnd); const spike=rnd()<pr; if(spike) lg+=8;
    const g=pow2(lg); const inf=g*scale>65504; const before=scale;
    let action;
    if(inf){ scale*=0.5; tracker=0; action='跳过 step，scale × 0.5'; }
    else { tracker++; if(tracker>=gi){ scale*=2; tracker=0; action='scale × 2，计数清零'; } else action='正常 step，计数 '+tracker; }
    hist.push({i:hist.length+1,g,spike,inf,before,after:scale,action});
  }
  function render(){
    $('d-gi-v').textContent=giIn.value; $('d-mu-v').textContent='2^'+muIn.value; $('d-p-v').textContent=(+pIn.value*100).toFixed(0)+'%';
    const n=Math.max(60,hist.length); const mu=+muIn.value; const bound=Math.log2(65504)-mu;
    const p=mkPlot(host,{W:680,H:260,xr:[0,n],yr:[0,32],xt:[0,Math.round(n/4),Math.round(n/2),Math.round(3*n/4),n],yt:[0,8,16,24,32],yf:t=>'2^'+t,xl:'迭代',yl:'scale',aria:'loss scale 随迭代的变化'});
    let s=`<line x1="${p.ml}" x2="${p.W-p.mr}" y1="${p.Y(bound)}" y2="${p.Y(bound)}" stroke="var(--axis)" stroke-dasharray="4 3"/>`;
    if(hist.length){
      let d='M'+p.X(0)+' '+p.Y(16);
      hist.forEach(h=>{ d+=' L'+p.X(h.i)+' '+p.Y(Math.log2(h.after)); });
      s+=`<path d="${d}" fill="none" stroke="var(--s1)" stroke-width="1.8"/>`;
      hist.filter(h=>h.inf).forEach(h=>{ s+=`<line x1="${p.X(h.i)}" x2="${p.X(h.i)}" y1="${p.Y(Math.log2(h.before))-6}" y2="${p.Y(Math.log2(h.before))+6}" stroke="var(--bad)" stroke-width="2"/>`; });
    }
    p.body.innerHTML=s;
    const skipped=hist.filter(h=>h.inf).length;
    $('d-status').innerHTML=`已运行 <b>${hist.length}</b> 步 · 当前 scale <b>2^${Math.log2(scale)}</b> · 连续无溢出计数 <b>${tracker}</b> / ${giIn.value} · 跳过 <b>${skipped}</b> 步`;
    let t='<thead><tr><th class="r">迭代</th><th>本步最大 |g|</th><th>|g| × scale</th><th>结果</th><th>update() 之后</th></tr></thead><tbody>';
    hist.slice(-8).reverse().forEach(h=>{ t+=`<tr><td class="m r">${h.i}</td><td class="m">2^${Math.log2(h.g).toFixed(1)}${h.spike?' <span class="pill warn">尖峰</span>':''}</td><td class="m">${num(h.g*h.before,4)}</td><td>${h.inf?'<span class="pill bad">inf</span>':'<span class="pill ok">有限</span>'}</td><td class="m">${h.action}，scale = 2^${Math.log2(h.after)}</td></tr>`; });
    $('d-table').innerHTML=t+'</tbody>';
  }
  $('d-step1').addEventListener('click',()=>{ step(); render(); });
  $('d-step50').addEventListener('click',()=>{ for(let i=0;i<50;i++) step(); render(); });
  $('d-reset').addEventListener('click',reset);
  for(const el of [giIn,muIn,pIn]) el.addEventListener('input',render);
  reset();
    typeset(this)
  }
}
