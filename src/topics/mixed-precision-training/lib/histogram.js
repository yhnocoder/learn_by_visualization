// 第三节的梯度直方图：合成的 log₂ 幅值分布乘以 loss scale 后，落在所选格式的归零、subnormal、规格化、溢出四个区间的比例。
import { pow2, ncdf, mkPlot } from './common.js';

const X0 = -64, X1 = 20, SD = 7;

/** 各区间的边界（log₂）：zero 及以下归零，[sub, norm) 是 subnormal，[norm, over) 是规格化，over 及以上溢出 */
function regions(fmt){
  if(fmt === 'fp16') return { zero: -25, sub: -24, norm: -14, over: 16 };
  return { zero: -134, sub: -133, norm: -126, over: 128 };
}

/** root 是 GradHistogram 组件的外层元素，data-prefix 是其中各元素 id 的前缀 */
export function initGradHistogram(root){
  const q = s => root.querySelector(`#${root.dataset.prefix}-${s}`);
  const kIn = q('k'), muIn = q('mu'), fmtSel = q('fmt');
  const p = mkPlot(q('plot'), { W: 680, H: 300, xr: [X0, X1], yr: [0, 0.08], xt: [-60, -50, -40, -30, -20, -10, 0, 10, 20], yt: [0, 0.02, 0.04, 0.06, 0.08], yf: t => (t * 100).toFixed(0) + '%', xf: t => String(t), xl: 'log₂ |梯度|（每格一个 binade）', yl: '非零梯度的占比', aria: '梯度直方图与 fp16 可表示区间' });
  function render(){
    const k = +kIn.value, mu = +muIn.value, fmt = fmtSel.value; const r = regions(fmt);
    q('k-v').textContent = '2^' + k + ' = ' + pow2(k); q('mu-v').textContent = '2^' + mu;
    const clamp = x => Math.max(X0, Math.min(X1, x));
    const band = (a, b, c) => a >= b ? '' : `<rect x="${p.X(clamp(a))}" y="${p.mt}" width="${p.X(clamp(b)) - p.X(clamp(a))}" height="${p.H - p.mt - p.mb}" fill="${c}"/>`;
    p.bg.innerHTML = band(X0, r.zero + 1, 'var(--bad-soft)') + band(r.sub, r.norm, 'var(--warn-soft)') + band(r.norm, r.over, 'var(--ok-soft)') + band(r.over, X1, 'var(--bad-soft)');
    let bars = '', zero = 0, sub = 0, norm = 0, over = 0;
    for(let b = -120; b <= 60; b++){
      const mass = ncdf((b + 1 - mu) / SD) - ncdf((b - mu) / SD); const sb = b + k;
      if(sb <= r.zero) zero += mass; else if(sb < r.norm) sub += mass; else if(sb < r.over) norm += mass; else over += mass;
      if(sb >= X0 && sb < X1 && mass > 1e-5){ const x = p.X(sb), w = p.X(sb + 1) - x; bars += `<rect x="${x + 0.5}" y="${p.Y(mass)}" width="${Math.max(0.5, w - 1)}" height="${p.Y(0) - p.Y(mass)}" fill="var(--s1)" opacity=".85"/>`; }
    }
    const labels = [];
    if(fmt === 'fp16') labels.push([X0 + 1, '归零 (< 2⁻²⁵)'], [r.sub, 'subnormal'], [r.norm + 9, '规格化'], [r.over + 0.5, '溢出']);
    else labels.push([X0 + 1, 'bf16：整段都在规格化区间内（最小规格化数 2⁻¹²⁶ 在图外）']);
    let ann = ''; for(const [x, t] of labels) ann += `<text class="ann" x="${p.X(x) + 3}" y="${p.mt + 13}">${t}</text>`;
    const lines = [[r.sub, '2^' + r.sub], [r.norm, '2^' + r.norm], [r.over, '2^' + r.over]].filter(([x]) => x > X0 && x < X1).map(([x, t]) => `<line x1="${p.X(x)}" x2="${p.X(x)}" y1="${p.mt}" y2="${p.H - p.mb}" stroke="var(--axis)" stroke-dasharray="3 3"/><text x="${p.X(x) + 3}" y="${p.mt + 27}">${t}</text>`).join('');
    p.body.innerHTML = bars + lines + ann;
    const pct = x => (x * 100).toFixed(1) + '%';
    q('status').innerHTML = `非零梯度中：归零 <b>${pct(zero)}</b> · subnormal <b>${pct(sub)}</b> · 规格化 <b>${pct(norm)}</b> · 溢出 <b>${pct(over)}</b>${over > 0.001 ? '  ← 出现溢出，梯度里会有 inf，这一步应当跳过' : ''}`;
  }
  for(const input of [kIn, muIn, fmtSel]) input.addEventListener('input', render);
  render();
}
