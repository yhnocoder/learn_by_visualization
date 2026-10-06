// 第三节的 GradScaler 状态机：每步随机生成本步最大梯度，乘以 scale 超过 65504 即溢出；
// 溢出则跳过本步、scale 减半、计数清零，连续 growth_interval 步无溢出则 scale 加倍。
import { pow2, num, mulberry32, gauss, mkPlot } from './common.js';

/** root 是 DynamicScaling 组件的外层元素，data-prefix 是其中各元素 id 的前缀 */
export function initDynamicScaling(root){
  const q = s => root.querySelector(`#${root.dataset.prefix}-${s}`);
  const host = q('plot'), giIn = q('gi'), muIn = q('mu'), pIn = q('p');
  let hist = [], scale = 65536, tracker = 0, rnd = mulberry32(7);
  function reset(){ hist = []; scale = 65536; tracker = 0; rnd = mulberry32(7); render(); }
  function step(){
    const gi = +giIn.value, mu = +muIn.value, pr = +pIn.value;
    let lg = mu + 0.7 * gauss(rnd); const spike = rnd() < pr; if(spike) lg += 8;
    const g = pow2(lg); const inf = g * scale > 65504; const before = scale;
    let action;
    if(inf){ scale *= 0.5; tracker = 0; action = '跳过 step，scale × 0.5'; }
    else{ tracker++; if(tracker >= gi){ scale *= 2; tracker = 0; action = 'scale × 2，计数清零'; } else action = '正常 step，计数 ' + tracker; }
    hist.push({ i: hist.length + 1, g, spike, inf, before, after: scale, action });
  }
  function render(){
    q('gi-v').textContent = giIn.value; q('mu-v').textContent = '2^' + muIn.value; q('p-v').textContent = (+pIn.value * 100).toFixed(0) + '%';
    const n = Math.max(60, hist.length); const mu = +muIn.value; const bound = Math.log2(65504) - mu;
    const p = mkPlot(host, { W: 680, H: 260, xr: [0, n], yr: [0, 32], xt: [0, Math.round(n / 4), Math.round(n / 2), Math.round(3 * n / 4), n], yt: [0, 8, 16, 24, 32], yf: t => '2^' + t, xl: '迭代', yl: 'scale', aria: 'loss scale 随迭代的变化' });
    let s = `<line x1="${p.ml}" x2="${p.W - p.mr}" y1="${p.Y(bound)}" y2="${p.Y(bound)}" stroke="var(--axis)" stroke-dasharray="4 3"/>`;
    if(hist.length){
      let d = 'M' + p.X(0) + ' ' + p.Y(16);
      hist.forEach(h => { d += ' L' + p.X(h.i) + ' ' + p.Y(Math.log2(h.after)); });
      s += `<path d="${d}" fill="none" stroke="var(--s1)" stroke-width="1.8"/>`;
      hist.filter(h => h.inf).forEach(h => { s += `<line x1="${p.X(h.i)}" x2="${p.X(h.i)}" y1="${p.Y(Math.log2(h.before)) - 6}" y2="${p.Y(Math.log2(h.before)) + 6}" stroke="var(--bad)" stroke-width="2"/>`; });
    }
    p.body.innerHTML = s;
    const skipped = hist.filter(h => h.inf).length;
    q('status').innerHTML = `已运行 <b>${hist.length}</b> 步 · 当前 scale <b>2^${Math.log2(scale)}</b> · 连续无溢出计数 <b>${tracker}</b> / ${giIn.value} · 跳过 <b>${skipped}</b> 步`;
    let t = '<thead><tr><th class="r">迭代</th><th>本步最大 |g|</th><th>|g| × scale</th><th>结果</th><th>update() 之后</th></tr></thead><tbody>';
    hist.slice(-8).reverse().forEach(h => { t += `<tr><td class="m r">${h.i}</td><td class="m">2^${Math.log2(h.g).toFixed(1)}${h.spike ? ' <span class="pill warn">尖峰</span>' : ''}</td><td class="m">${num(h.g * h.before, 4)}</td><td>${h.inf ? '<span class="pill bad">inf</span>' : '<span class="pill ok">有限</span>'}</td><td class="m">${h.action}，scale = 2^${Math.log2(h.after)}</td></tr>`; });
    q('table').innerHTML = t + '</tbody>';
  }
  q('step1').addEventListener('click', () => { step(); render(); });
  q('step50').addEventListener('click', () => { for(let i = 0; i < 50; i++) step(); render(); });
  q('reset').addEventListener('click', reset);
  for(const input of [giIn, muIn, pIn]) input.addEventListener('input', render);
  reset();
}
