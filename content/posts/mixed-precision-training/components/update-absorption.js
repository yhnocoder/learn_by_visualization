import { F16, BF16, F32, E4M3, E5M2, rt, ulpOf, num, esc, mulberry32, gauss, ncdf, mkPlot } from './lib/common.js'
import { decode, encode, fields, maxFiniteCode, parseValue, pow2 } from './lib/fmt.js'
import { typeset } from '../../../../components/lib/typeset.js'
import { styleFigure } from './lib/figure.js'

export const layout = { placeholder: { narrow: 900, wide: 620 } }

const $=id=>document.getElementById(id);

export default class UpdateAbsorption extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    styleFigure(this)
    this.innerHTML = `<h4>演示：同一次更新在 fp16、bf16、fp32 中分别发生了什么</h4>
    <div class="controls">
      <label>权重 w <input type="text" id="up-w" value="0.5"></label>
      <label>学习率 η <input type="text" id="up-lr" value="1e-3"></label>
      <label>梯度 g = 2^k，k <input type="range" id="up-g" min="-30" max="4" step="1" value="0"> <span class="v" id="up-g-v"></span></label>
      <label>连续更新次数 N <input type="range" id="up-n" min="0" max="12" step="1" value="6"> <span class="v" id="up-n-v"></span></label>
      <button class="btn" type="button" id="up-preset-fp16">fp16 吸收示例</button>
      <button class="btn" type="button" id="up-preset-bf16">bf16 吸收示例</button>
    </div>
    <div class="status" id="up-status"></div>
    <div class="tbl"><table id="up-table"></table></div>
    <div id="up-bits"></div>`
const upState={};
  const wIn=$('up-w'), lrIn=$('up-lr'), gIn=$('up-g'), nIn=$('up-n');
  function bitsHTML(f,code,prev){
    const a=fields(f,code), b=prev==null?null:fields(f,prev);
    const e=a.exp.toString(2).padStart(f.e,'0'), m=a.mant.toString(2).padStart(f.m,'0');
    const eb=b?b.exp.toString(2).padStart(f.e,'0'):null, mb=b?b.mant.toString(2).padStart(f.m,'0'):null;
    const mark=(str,ref,cls)=>[...str].map((c,i)=>`<span class="${cls}${ref&&ref[i]!==c?' chg':''}">${c}</span>`).join('');
    return `<span class="bits">${mark(String(a.sign),b?String(b.sign):null,'s')} ${mark(e,eb,'e')} ${mark(m,mb,'f')}</span>`;
  }
  function render(){
    const w=parseValue(wIn.value), lr=parseValue(lrIn.value), k=+gIn.value, N=pow2(+nIn.value);
    $('up-g-v').textContent='2^'+k+' = '+num(pow2(k),3); $('up-n-v').textContent=N;
    if(w===undefined||lr===undefined||!isFinite(w)||!isFinite(lr)){ $('up-status').textContent='权重和学习率需要是有限的十进制数。'; return; }
    const g=pow2(k), u=lr*g;
    $('up-status').innerHTML=`更新量 η·g = ${num(lr,3)} × 2^${k} = <b>${num(u,5)}</b>。fp32 master 累加 N 次后的值：<b>${num(masterAfter(w,u,N),8)}</b>`;
    let h='<thead><tr><th>格式</th><th>w 在该格式中</th><th>ulp(w)</th><th class="r">更新量 / ulp</th><th>单步结果</th><th>单步</th><th>N 次格式内更新</th><th>N 次 master 更新后转回该格式</th></tr></thead><tbody>';
    const bitsBox=[];
    for(const [f,label] of [[F16,'fp16'],[BF16,'bf16'],[F32,'fp32']]){
      const wf=rt(f,w), ul=ulpOf(f,wf), one=rt(f,wf+u), ratio=Math.abs(u)/ul;
      let acc=wf; for(let i=0;i<N;i++) acc=rt(f,acc+u);
      const viaMaster=rt(f,masterAfter(w,u,N));
      const absorbed=one===wf&&u!==0;
      const pill=absorbed?'<span class="pill bad">被吸收</span>':(ratio<1?'<span class="pill warn">保留，但有舍入</span>':'<span class="pill ok">保留</span>');
      h+=`<tr><td><strong>${label}</strong></td><td class="m">${num(wf,8)}</td><td class="m">${num(ul,3)}</td><td class="m r">${num(ratio,3)}</td><td class="m">${num(one,8)}</td><td>${pill}</td><td class="m">${num(acc,8)}</td><td class="m">${num(viaMaster,8)}</td></tr>`;
      bitsBox.push(`<div class="bitrows"><span class="k">${label} w</span>${bitsHTML(f,encode(f,wf))}<span class="k">${label} w+ηg</span>${bitsHTML(f,encode(f,one),encode(f,wf))}</div>`);
    }
    $('up-table').innerHTML=h+'</tbody>';
    $('up-bits').innerHTML=bitsBox.join('');
  }
  function masterAfter(w,u,N){ let m=rt(F32,w); for(let i=0;i<N;i++) m=rt(F32,m+u); return m; }
  for(const el of [wIn,lrIn,gIn,nIn]) el.addEventListener('input',render);
  upState.set=(w,lr,k,n)=>{ wIn.value=w; lrIn.value=lr; gIn.value=k; nIn.value=n; render(); };
  $('up-preset-fp16').addEventListener('click',()=>upState.set('1','1e-4','0','6'));
  $('up-preset-bf16').addEventListener('click',()=>upState.set('0.5','1e-3','0','6'));
  render();
  addEventListener('mixed-precision-bf16-example',()=>{ upState.set('0.5','1e-3','0','6'); this.scrollIntoView({behavior:'smooth',block:'start'}); });
    typeset(this)
  }
}
