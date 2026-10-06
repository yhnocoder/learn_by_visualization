// 第二节的演示：同一次更新 w ← w + ηg 在 fp16、bf16、fp32 中的单步结果、N 步结果与位视图。
import { encode, fields, parseValue } from '../../../lib/fmt.js';
import { F16, BF16, F32, pow2, rt, ulpOf, num } from './common.js';

// 每个演示实例的设定函数，供第六节的按钮载入示例
const setters = new WeakMap();

/** 把权重、学习率、梯度指数 k、更新次数的指数 n 写入 root 所在的演示并重新计算 */
export function setUpdateDemo(root, w, lr, k, n){ setters.get(root)?.(w, lr, k, n); }

function bitsHTML(f, code, prev){
  const a = fields(f, code), b = prev == null ? null : fields(f, prev);
  const e = a.exp.toString(2).padStart(f.e, '0'), m = a.mant.toString(2).padStart(f.m, '0');
  const eb = b ? b.exp.toString(2).padStart(f.e, '0') : null, mb = b ? b.mant.toString(2).padStart(f.m, '0') : null;
  const mark = (str, ref, cls) => [...str].map((c, i) => `<span class="${cls}${ref && ref[i] !== c ? ' chg' : ''}">${c}</span>`).join('');
  return `<span class="bits">${mark(String(a.sign), b ? String(b.sign) : null, 's')} ${mark(e, eb, 'e')} ${mark(m, mb, 'f')}</span>`;
}

/** 在 fp32 中从 w 开始连续加 N 次 u */
function masterAfter(w, u, N){ let m = rt(F32, w); for(let i = 0; i < N; i++) m = rt(F32, m + u); return m; }

/** root 是 UpdateDemo 组件的外层元素，data-prefix 是其中各元素 id 的前缀 */
export function initUpdateDemo(root){
  const q = s => root.querySelector(`#${root.dataset.prefix}-${s}`);
  const wIn = q('w'), lrIn = q('lr'), gIn = q('g'), nIn = q('n');
  function render(){
    const w = parseValue(wIn.value), lr = parseValue(lrIn.value), k = +gIn.value, N = pow2(+nIn.value);
    q('g-v').textContent = '2^' + k + ' = ' + num(pow2(k), 3); q('n-v').textContent = N;
    if(w === undefined || lr === undefined || !isFinite(w) || !isFinite(lr)){ q('status').textContent = '权重和学习率需要是有限的十进制数。'; return; }
    const g = pow2(k), u = lr * g;
    q('status').innerHTML = `更新量 η·g = ${num(lr, 3)} × 2^${k} = <b>${num(u, 5)}</b>。fp32 master 累加 N 次后的值：<b>${num(masterAfter(w, u, N), 8)}</b>`;
    let h = '<thead><tr><th>格式</th><th>w 在该格式中</th><th>ulp(w)</th><th class="r">更新量 / ulp</th><th>单步结果</th><th>单步</th><th>N 次格式内更新</th><th>N 次 master 更新后转回该格式</th></tr></thead><tbody>';
    const bitsBox = [];
    for(const [f, label] of [[F16, 'fp16'], [BF16, 'bf16'], [F32, 'fp32']]){
      const wf = rt(f, w), ul = ulpOf(f, wf), one = rt(f, wf + u), ratio = Math.abs(u) / ul;
      let acc = wf; for(let i = 0; i < N; i++) acc = rt(f, acc + u);
      const viaMaster = rt(f, masterAfter(w, u, N));
      const absorbed = one === wf && u !== 0;
      const pill = absorbed ? '<span class="pill bad">被吸收</span>' : (ratio < 1 ? '<span class="pill warn">保留，但有舍入</span>' : '<span class="pill ok">保留</span>');
      h += `<tr><td><strong>${label}</strong></td><td class="m">${num(wf, 8)}</td><td class="m">${num(ul, 3)}</td><td class="m r">${num(ratio, 3)}</td><td class="m">${num(one, 8)}</td><td>${pill}</td><td class="m">${num(acc, 8)}</td><td class="m">${num(viaMaster, 8)}</td></tr>`;
      bitsBox.push(`<div class="bitrows"><span class="k">${label} w</span>${bitsHTML(f, encode(f, wf))}<span class="k">${label} w+ηg</span>${bitsHTML(f, encode(f, one), encode(f, wf))}</div>`);
    }
    q('table').innerHTML = h + '</tbody>';
    q('bits').innerHTML = bitsBox.join('');
  }
  for(const input of [wIn, lrIn, gIn, nIn]) input.addEventListener('input', render);
  const set = (w, lr, k, n) => { wIn.value = w; lrIn.value = lr; gIn.value = k; nIn.value = n; render(); };
  setters.set(root, set);
  q('preset-fp16').addEventListener('click', () => set('1', '1e-4', '0', '6'));
  q('preset-bf16').addEventListener('click', () => set('0.5', '1e-3', '0', '6'));
  render();
}
