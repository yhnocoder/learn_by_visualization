import { F16, BF16, F32, E4M3, E5M2, rt, ulpOf, num, esc, mulberry32, gauss, ncdf, mkPlot } from './lib/common.js'
import { decode, encode, fields, maxFiniteCode, parseValue, pow2 } from './lib/fmt.js'
import { typeset } from 'bake/kit'
import './lib/figure.css'

export const layout = { placeholder: { narrow: 420, wide: 330 } }

const $=id=>document.getElementById(id);

export default class FormatTable extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    this.classList.add('mp-figure')
    this.innerHTML = `<div class="tbl" id="fmt-table"></div><ul class="plain" id="fmt-notes"></ul>`
  const rows=[[F32,'fp32'],[F16,'fp16'],[BF16,'bf16'],[E4M3,'fp8 e4m3'],[E5M2,'fp8 e5m2']];
  let h='<table><thead><tr><th>格式</th><th class="r">位数</th><th class="r">指数位</th><th class="r">尾数位</th><th class="r">偏置</th><th>最大有限值</th><th>最小规格化数</th><th>最小 subnormal</th><th>ulp(1)</th></tr></thead><tbody>';
  const notes={fp32:'IEEE 754 单精度。',fp16:'IEEE 754 半精度。有 inf 与 NaN。','bf16':'指数位与 fp32 相同，范围相同。','fp8 e4m3':'无 inf，NaN 只占一种位模式，因此最大值为 448 而不是 240。','fp8 e5m2':'遵循 IEEE 754 的特殊值约定，可视为尾数更短的 fp16。'};
  for(const [f,label] of rows){
    const mx=decode(f,maxFiniteCode(f)).value, mn=pow2(1-f.bias), ms=pow2(1-f.bias-f.m);
    h+=`<tr><td><strong>${label}</strong></td><td class="m r">${f.bits}</td><td class="m r">${f.e}</td><td class="m r">${f.m}</td><td class="m r">${f.bias}</td><td class="m">${num(mx,5)}</td><td class="m">2^${1-f.bias} ≈ ${num(mn,3)}</td><td class="m">2^${1-f.bias-f.m} ≈ ${num(ms,3)}</td><td class="m">2^${-f.m} ≈ ${num(pow2(-f.m),3)}</td></tr>`;
  }
  $('fmt-table').innerHTML=h+'</tbody></table>';
  $('fmt-notes').innerHTML=rows.map(([f,l])=>`<li><strong>${l}</strong>：${notes[l]}</li>`).join('');
    typeset(this)
  }
}
