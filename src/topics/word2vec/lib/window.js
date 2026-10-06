// 第 2 节的滑动窗口图：在一句话上移动中心词位置 t、改变窗口大小 m，画出每个训练样本对应的弧线。
import { el } from '../../../lib/svg.js';

const WORDS = ['problems','turning','into','banking','crises','as','has','happened'];

/** 初始化一个 .win-demo 实例。 */
export function initWindowDemo(root){
  const words = WORDS;
  const svg = root.querySelector('svg.win');
  const tIn = root.querySelector('#win-t'), mIn = root.querySelector('#win-m');
  const tV = root.querySelector('#win-t-v'), mV = root.querySelector('#win-m-v');
  const pairsEl = root.querySelector('#win-pairs'), status = root.querySelector('#win-status');
  const markerId = 'win-arrow-' + svg.id;
  tIn.max = words.length;
  const W = 720, gap = 8, padX = 10, rowY = 150, boxH = 34;
  // 每个词的宽度按字符数估算，等宽字体 14px 约 8.4px 一个字符。
  const widths = words.map(w => Math.max(52, w.length * 8.4 + 22));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  const scale = Math.min(1, (W - 2 * padX) / total);
  const xs = []; let x = padX + ((W - 2 * padX) - total * scale) / 2;
  for(let i = 0; i < words.length; i++){ xs.push(x); x += widths[i] * scale + gap; }
  const cx = i => xs[i] + widths[i] * scale / 2;

  // 样本总数：每个位置的窗口在两端截断。
  function totalPairs(m){ let n = 0; for(let t = 0; t < words.length; t++) n += Math.min(t, m) + Math.min(words.length - 1 - t, m); return n; }

  function render(){
    const t = +tIn.value, m = +mIn.value, ti = t - 1;
    tV.textContent = t; mV.textContent = m;
    svg.replaceChildren();
    const defs = el('defs', {});
    const marker = el('marker', { id: markerId, viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
    marker.appendChild(el('path', { d: 'M0,0 L8,4 L0,8 z', fill: 'var(--ctx)' }));
    defs.appendChild(marker); svg.appendChild(defs);

    const lo = Math.max(0, ti - m), hi = Math.min(words.length - 1, ti + m);
    // 弧线与标签：偏移越大弧线越高。
    for(let i = lo; i <= hi; i++){
      if(i === ti) continue;
      const j = i - ti, h = 34 + Math.abs(j) * 30;
      const x0 = cx(ti), x1 = cx(i), y0 = rowY - 2;
      const d = `M${x0},${y0} Q${(x0 + x1) / 2},${y0 - h * 1.6} ${x1},${y0}`;
      svg.appendChild(el('path', { class: 'arc', d, 'marker-end': `url(#${markerId})` }));
      const sub = j < 0 ? `t−${-j}` : `t+${j}`;
      // 负偏移的标签向左对齐，正偏移的向右对齐，避免 j = ±1 的两个标签在中心词上方重叠。
      const lbl = el('text', { class: 'lbl', x: (x0 + x1) / 2 + (j < 0 ? 6 : -6), y: y0 - h * .8 - 4, 'text-anchor': j < 0 ? 'end' : 'start' });
      lbl.appendChild(el('tspan', {}, 'P(w'));
      lbl.appendChild(el('tspan', { dy: '4', 'font-size': '9px' }, sub));
      lbl.appendChild(el('tspan', { dy: '-4' }, ' | w'));
      lbl.appendChild(el('tspan', { dy: '4', 'font-size': '9px' }, 't'));
      lbl.appendChild(el('tspan', { dy: '-4' }, ')'));
      svg.appendChild(lbl);
    }
    // 词框
    words.forEach((w, i) => {
      const g = el('g', { class: 'tok' + (i === ti ? ' center' : (i >= lo && i <= hi ? ' ctx' : '')), tabindex: '0', role: 'button', 'aria-label': `把 ${w} 设为中心词` });
      g.appendChild(el('rect', { x: xs[i], y: rowY, width: widths[i] * scale, height: boxH, rx: 4 }));
      g.appendChild(el('text', { x: cx(i), y: rowY + boxH / 2 + 5, 'text-anchor': 'middle' }, w));
      g.appendChild(el('text', { class: 'idx', x: cx(i), y: rowY + boxH + 16, 'text-anchor': 'middle' }, String(i + 1)));
      const set = () => { tIn.value = i + 1; render(); };
      g.addEventListener('click', set);
      g.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); set(); } });
      svg.appendChild(g);
    });
    // 括线与说明
    const braceY = rowY + boxH + 26;
    const brace = (a, b, cls, text) => {
      const x0 = xs[a], x1 = xs[b] + widths[b] * scale;
      svg.appendChild(el('path', { class: 'brace', d: `M${x0},${braceY} v6 H${x1} v-6` }));
      svg.appendChild(el('text', { class: 'cap ' + cls, x: (x0 + x1) / 2, y: braceY + 24, 'text-anchor': 'middle' }, text));
    };
    if(lo < ti) brace(lo, ti - 1, '', `左侧上下文，${ti - lo} 个`);
    brace(ti, ti, 'c', `中心词 w_t，t = ${t}`);
    if(hi > ti) brace(ti + 1, hi, '', `右侧上下文，${hi - ti} 个`);

    // 样本列表
    const pairs = [];
    for(let i = lo; i <= hi; i++) if(i !== ti) pairs.push(`<span>(<b>${words[ti]}</b>, <i>${words[i]}</i>)</span>`);
    pairsEl.innerHTML = pairs.join('');
    const n = pairs.length, all = totalPairs(m);
    status.textContent = `位置 t = ${t} 产生 ${n} 个样本${n < 2 * m ? '（窗口在语料边界被截断）' : ''}；这句话共 ${words.length} 个位置，m = ${m} 时一共产生 ${all} 个样本，上限 2mT = ${2 * m * words.length}。`;
  }
  tIn.addEventListener('input', render); mIn.addEventListener('input', render);
  render();
}
