// 第一节的格式参数表：五种格式的位数、偏置、最大有限值、最小规格化数、最小 subnormal 与 ulp(1)，都由编码函数计算。
import { decode, maxFiniteCode } from '../../../lib/fmt.js';
import { F32, F16, BF16, E4M3, E5M2, pow2, num } from './common.js';

const ROWS = [[F32, 'fp32'], [F16, 'fp16'], [BF16, 'bf16'], [E4M3, 'fp8 e4m3'], [E5M2, 'fp8 e5m2']];
const NOTES = {
  fp32: 'IEEE 754 单精度。',
  fp16: 'IEEE 754 半精度。有 inf 与 NaN。',
  bf16: '指数位与 fp32 相同，范围相同。',
  'fp8 e4m3': '无 inf，NaN 只占一种位模式，因此最大值为 448 而不是 240。',
  'fp8 e5m2': '遵循 IEEE 754 的特殊值约定，可视为尾数更短的 fp16。',
};

/** root 是 FormatTable 组件的外层元素，里面有 .fmt-table 与 .fmt-notes 两个容器 */
export function initFormatTable(root){
  let h = '<table><thead><tr><th>格式</th><th class="r">位数</th><th class="r">指数位</th><th class="r">尾数位</th><th class="r">偏置</th><th>最大有限值</th><th>最小规格化数</th><th>最小 subnormal</th><th>ulp(1)</th></tr></thead><tbody>';
  for(const [f, label] of ROWS){
    const mx = decode(f, maxFiniteCode(f)).value, mn = pow2(1 - f.bias), ms = pow2(1 - f.bias - f.m);
    h += `<tr><td><strong>${label}</strong></td><td class="m r">${f.bits}</td><td class="m r">${f.e}</td><td class="m r">${f.m}</td><td class="m r">${f.bias}</td><td class="m">${num(mx, 5)}</td><td class="m">2^${1 - f.bias} ≈ ${num(mn, 3)}</td><td class="m">2^${1 - f.bias - f.m} ≈ ${num(ms, 3)}</td><td class="m">2^${-f.m} ≈ ${num(pow2(-f.m), 3)}</td></tr>`;
  }
  root.querySelector('.fmt-table').innerHTML = h + '</tbody></table>';
  root.querySelector('.fmt-notes').innerHTML = ROWS.map(([, l]) => `<li><strong>${l}</strong>：${NOTES[l]}</li>`).join('');
}
