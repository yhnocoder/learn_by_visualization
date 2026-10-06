// 一个函数曲线坐标系：网格、坐标轴、曲线、标注（色带、参考线、竖线、关键点、方向箭头）和悬停提示。
// 由 lib/act-fn-plot.js 调用，每个面板（f(x) 或 df/dx）一个。
import { el } from '../../../lib/svg.js';
import { richHTML, plain, putLabel } from './labels.js';

let uid = 0;

/** 在 [a, b] 上取大约 5 个间隔整齐的刻度。 */
function niceTicks(a, b){
  const raw = (b - a) / 5, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p, step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p, t = [];
  for(let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) t.push(+v.toFixed(6));
  return t;
}

/**
 * 在 host 里创建坐标系。opt.x、opt.y 是横纵轴范围，opt.label 是 aria-label。
 * 返回 { draw(series, guides) }：series 是 [{ name, color, fn, dash, faint, hidden, breaks }]，
 * guides 的结构见 lib/guides.js。
 */
export function plot(host, opt){
  const W = 440, H = 250, ml = 40, mr = 12, mt = 10, mb = 28;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opt.label || '' });
  const id = 'act-fn-clip-' + (uid++);
  const defs = el('defs'), cp = el('clipPath', { id });
  cp.appendChild(el('rect', { x: ml, y: mt, width: W - ml - mr, height: H - mt - mb }));
  defs.appendChild(cp); svg.appendChild(defs);
  const [x0, x1] = opt.x, [y0, y1] = opt.y;
  const sx = v => ml + (v - x0) / (x1 - x0) * (W - ml - mr), sy = v => mt + (y1 - v) / (y1 - y0) * (H - mt - mb);
  const g = el('g'); svg.appendChild(g);
  for(const t of niceTicks(y0, y1)){
    g.appendChild(el('line', { x1: ml, x2: W - mr, y1: sy(t), y2: sy(t), class: 'grid' }));
    g.appendChild(el('text', { x: ml - 6, y: sy(t) + 3.5, 'text-anchor': 'end', class: 'tick' }, t));
  }
  for(const t of niceTicks(x0, x1)){
    g.appendChild(el('line', { y1: mt, y2: H - mb, x1: sx(t), x2: sx(t), class: 'grid' }));
    g.appendChild(el('text', { x: sx(t), y: H - mb + 14, 'text-anchor': 'middle', class: 'tick' }, t));
  }
  if(y0 < 0 && y1 > 0) g.appendChild(el('line', { x1: ml, x2: W - mr, y1: sy(0), y2: sy(0), class: 'axis' }));
  if(x0 < 0 && x1 > 0) g.appendChild(el('line', { y1: mt, y2: H - mb, x1: sx(0), x2: sx(0), class: 'axis' }));
  const backdrop = el('g'); svg.appendChild(backdrop);
  const layer = el('g', { 'clip-path': `url(#${id})` }); svg.appendChild(layer);
  const marks = el('g'); svg.appendChild(marks);
  const cross = el('line', { y1: mt, y2: H - mb, class: 'cross', visibility: 'hidden' }); svg.appendChild(cross);
  const dots = el('g'); svg.appendChild(dots);
  const wrap = document.createElement('div'); wrap.className = 'plotwrap'; wrap.appendChild(svg);
  const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; wrap.appendChild(tip);
  host.appendChild(wrap);

  // 可聚焦的标注：悬停或聚焦时在左上角显示说明
  function annotate(node, text){
    node.setAttribute('tabindex', '0'); node.setAttribute('role', 'img'); node.setAttribute('aria-label', plain(text));
    node.appendChild(el('title', {}, plain(text)));
    const show = () => { tip.innerHTML = richHTML(text); tip.hidden = false; tip.style.left = '44px'; tip.style.top = '8px'; };
    node.addEventListener('pointerenter', show);
    node.addEventListener('pointerleave', () => { tip.hidden = true; });
    node.addEventListener('focus', show);
    node.addEventListener('blur', () => { tip.hidden = true; });
    marks.appendChild(node);
  }

  let series = [];
  function draw(s, guides){
    series = s; layer.innerHTML = ''; dots.innerHTML = ''; marks.innerHTML = ''; backdrop.innerHTML = ''; tip.hidden = true;
    if(guides){
      for(const b of guides.bands || []){
        const a = Math.max(x0, b.a), z = Math.min(x1, b.b); if(a >= z) continue;
        backdrop.appendChild(el('rect', { x: sx(a), y: mt, width: sx(z) - sx(a), height: H - mb - mt, fill: b.color || 'var(--accent)', opacity: .09, 'pointer-events': 'none' }));
      }
      for(const r of guides.references || []){
        backdrop.appendChild(el('line', { x1: sx(r.a), x2: sx(r.b), y1: sy(r.y), y2: sy(r.endY ?? r.y), stroke: r.color || 'var(--ink-3)', class: 'ref' }));
        if(r.label) putLabel(backdrop, r.label, { x: sx(r.labelX ?? ((r.a + r.b) / 2)), y: sy(r.labelY ?? r.y) + (r.dy ?? -9), anchor: 'middle', fill: r.color || 'var(--ink-3)' });
      }
      for(const v of guides.verticals || []){
        if(v.x < x0 || v.x > x1) continue;
        backdrop.appendChild(el('line', { x1: sx(v.x), x2: sx(v.x), y1: mt, y2: H - mb, class: 'vert' }));
        if(v.label) putLabel(backdrop, v.label, { x: sx(v.x) + 6, y: mt + 13, fill: 'var(--ink-2)' });
      }
    }
    const N = 400;
    for(const q of series){
      if(q.hidden) continue;
      let d = '', pen = false;
      for(let i = 0; i <= N; i++){
        const x = x0 + (x1 - x0) * i / N, y = q.fn(x);
        if(!isFinite(y)){ pen = false; continue; }
        if((q.breaks || []).some(v => x - (x1 - x0) / N <= v && x >= v)) pen = false;
        const Y = Math.max(Math.min(y, y1 + (y1 - y0)), y0 - (y1 - y0));
        d += (pen ? 'L' : 'M') + sx(x).toFixed(1) + ' ' + sy(Y).toFixed(1); pen = true;
      }
      const p = el('path', { d, fill: 'none', stroke: q.color, 'stroke-width': q.width || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
      if(q.dash) p.setAttribute('stroke-dasharray', '6 4');
      if(q.faint) p.setAttribute('opacity', '.55');
      layer.appendChild(p);
    }
    if(!guides) return;
    // 色带对应的曲线段加粗，两端画空心圆
    (guides.bands || []).forEach((b, i) => {
      if(b.shadeOnly) return;
      const q = series[b.index ?? i]; if(!q || q.hidden) return;
      const a = Math.max(x0, b.a), z = Math.min(x1, b.b);
      let d = '';
      for(let j = 0; j <= 100; j++){ const x = a + (z - a) * j / 100; d += (j ? 'L' : 'M') + sx(x) + ' ' + sy(q.fn(x)); }
      annotate(el('path', { 'clip-path': `url(#${id})`, d, fill: 'none', stroke: q.color, 'stroke-width': 4, 'stroke-linecap': 'round' }), b.label);
      for(const x of [b.a, b.b].filter(x => x >= x0 && x <= x1 && q.fn(x) >= y0 && q.fn(x) <= y1))
        annotate(el('circle', { cx: sx(x), cy: sy(q.fn(x)), r: 4, fill: 'var(--surface)', stroke: q.color, 'stroke-width': 2 }), b.label + '；边界 $x=' + x.toFixed(2) + '$');
    });
    // 每条实线曲线两端画方向箭头，说明输入趋向两端时的行为
    for(const q of series.filter(q => !q.hidden && !q.dash && !q.faint)){
      for(const side of [-1, 1]){
        const x = side < 0 ? x0 + (x1 - x0) * .06 : x1 - (x1 - x0) * .06;
        const xx = x - side * (x1 - x0) * .035;
        const px = sx(x), py = sy(q.fn(x)), angle = Math.atan2(py - sy(q.fn(xx)), px - sx(xx));
        if(py < mt + 6 || py > H - mb - 6) continue;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const d = `M ${px - 7 * dx + 4 * dy} ${py - 7 * dy - 4 * dx} L ${px} ${py} L ${px - 7 * dx - 4 * dy} ${py - 7 * dy + 4 * dx}`;
        annotate(el('path', { d, fill: 'none', stroke: q.color, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), q.name + ' · ' + (side < 0 ? guides.left : guides.right));
      }
    }
    for(const m of guides.points || []){
      if(m.x < x0 || m.x > x1 || m.y < y0 || m.y > y1) continue;
      const color = m.color || 'var(--ink)';
      annotate(el('circle', { cx: sx(m.x), cy: sy(m.y), r: 4, fill: m.open ? 'var(--surface)' : color, stroke: m.open ? color : 'var(--surface)', 'stroke-width': 1.5 }), m.label || ('边界点 $(' + m.x.toFixed(2) + ',\\ ' + m.y.toFixed(2) + ')$'));
      if(m.label) putLabel(marks, m.label, { x: sx(m.x) + (m.dx ?? 8), y: sy(m.y) + (m.dy ?? -10), fill: color, pe: false });
    }
  }

  // 悬停：竖线、各曲线上的点、数值提示
  function hover(ev){
    if(ev.target.closest('[tabindex]')) return;
    const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W;
    if(px < ml || px > W - mr){ leave(); return; }
    const x = x0 + (px - ml) / (W - ml - mr) * (x1 - x0);
    cross.setAttribute('x1', sx(x)); cross.setAttribute('x2', sx(x)); cross.setAttribute('visibility', 'visible');
    dots.innerHTML = '';
    let html = `${richHTML('$x$')} ${x.toFixed(2)}`;
    for(const q of series){
      if(q.hidden) continue;
      const y = q.fn(x);
      if(y >= y0 && y <= y1) dots.appendChild(el('circle', { cx: sx(x), cy: sy(y), r: 3.5, fill: q.color, stroke: 'var(--surface)', 'stroke-width': 1.5 }));
      html += `<br><span style="color:${q.color}">■</span> ${richHTML(q.name)} ${isFinite(y) ? y.toFixed(3) : '不可导'}`;
    }
    tip.innerHTML = html; tip.hidden = false;
    const left = ev.clientX - r.left;
    tip.style.top = '8px'; tip.style.left = (left > r.width * 0.6 ? left - tip.offsetWidth - 12 : left + 12) + 'px';
  }
  function leave(){ cross.setAttribute('visibility', 'hidden'); dots.innerHTML = ''; tip.hidden = true; }
  svg.addEventListener('pointermove', hover); svg.addEventListener('pointerleave', leave);
  return { draw, remove: () => wrap.remove() };
}
