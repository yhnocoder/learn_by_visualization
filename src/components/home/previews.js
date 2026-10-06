// 首页每个主题卡片的实时预览。每个函数返回 { html, init(el), start(el), stop(el) }：
// html 是预览区的初始内容，init 画出静态画面，start 在悬停或聚焦时开始播放，stop 在离开时停止。
// 函数名与 src/data/topics.ts 里主题的 id 相同。

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const previews = {
  'matrix-calculus'() {
    let elapsed = 0, raf;
    const expressions = ['2x', '0', 'y', 'x'];
    const html = `<svg viewBox="0 0 320 180" aria-hidden="true">
      <text x="160" y="24" text-anchor="middle" font-size="13" fill="var(--ink-2)">f(x, y) = [x², xy]</text>
      <text x="48" y="96" font-size="20" fill="var(--ink-2)" font-style="italic">J =</text>
      <path d="M103 38H95V142H103 M263 38H271V142H263" fill="none" stroke="var(--ink-3)" stroke-width="1.5"/>
      ${expressions.map((expression, i) => {
        const x = 110 + (i % 2) * 78, y = 41 + Math.floor(i / 2) * 52;
        return `<rect x="${x}" y="${y}" width="66" height="46" rx="6" fill="${i === 0 || i === 3 ? '#985b57' : '#c4b17b'}" fill-opacity=".18"/>
          <text class="expression" x="${x + 33}" y="${y + 15}" text-anchor="middle" font-size="12" fill="var(--ink-2)">${expression}</text>
          <text class="entry" x="${x + 33}" y="${y + 36}" text-anchor="middle" font-size="18" fill="var(--ink)"></text>`;
      }).join('')}
      <line x1="110" y1="149" x2="254" y2="149" stroke="var(--rule)" stroke-width="2"/>
      <circle class="x-point" cy="149" r="3.5" fill="#985b57"/>
      <text x="99" y="153" text-anchor="end" font-size="10" fill="var(--ink-3)">x</text>
      <line x1="285" y1="45" x2="285" y2="135" stroke="var(--rule)" stroke-width="2"/>
      <circle class="y-point" cx="285" r="3.5" fill="#b49a58"/>
      <text x="285" y="35" text-anchor="middle" font-size="10" fill="var(--ink-3)">y</text>
      <text class="input-values" x="160" y="164" text-anchor="middle" font-size="11" fill="var(--ink-2)"></text>
      <text class="phase-label" x="160" y="177" text-anchor="middle" font-size="10" fill="var(--ink-3)"></text>
      </svg>`;
    const render = el => {
      // Each four-second stage returns to 1 before the other variable starts moving.
      const stage = Math.floor(elapsed / 4000) % 2;
      const moving = Math.cos((elapsed % 4000) / 4000 * 2 * Math.PI);
      const x = stage === 0 ? moving : 1, y = stage === 1 ? moving : 1;
      const values = [2 * x, 0, y, x];
      const format = value => (Math.abs(value) < .005 ? 0 : value).toFixed(2);
      el.querySelectorAll('.entry').forEach((node, i) => { node.textContent = format(values[i]); });
      el.querySelector('.x-point').setAttribute('cx', 182 + 72 * x);
      el.querySelector('.y-point').setAttribute('cy', 90 - 45 * y);
      el.querySelector('.input-values').textContent = `x = ${format(x)}    y = ${format(y)}`;
      el.querySelector('.phase-label').textContent = stage === 0 ? 'x 变化 · y 保持不变' : 'y 变化 · x 保持不变';
    };
    return { html, init: render, start(el) {
      cancelAnimationFrame(raf);
      let last;
      const step = now => { if (last !== undefined) elapsed += Math.min(now - last, 50); last = now; render(el); raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }, stop() { cancelAnimationFrame(raf); } };
  },
  // fp8 E4M3：1 位符号、4 位指数、3 位尾数。悬停时随机翻转一位并重新算值。
  floating_points() {
    let bits = [0, 1,0,0,0, 0,1,0], timer;
    const kinds = 'b-s b-e b-e b-e b-e b-m b-m b-m'.split(' ');
    const html = `<div class="bits">${bits.map((b, i) => `<span class="bit ${kinds[i]}" data-v="${b}">${b}</span>`).join('')}</div><span class="lbl"></span>`;
    const value = () => { const e = parseInt(bits.slice(1, 5).join(''), 2), m = parseInt(bits.slice(5).join(''), 2);
      const v = e === 0 ? Math.pow(2, -6) * m / 8 : Math.pow(2, e - 7) * (1 + m / 8); return bits[0] ? -v : v; };
    const render = el => { el.querySelectorAll('.bit').forEach((s, i) => { s.dataset.v = bits[i]; s.textContent = bits[i]; });
      el.querySelector('.lbl').textContent = 'E4M3 = ' + value(); };
    return { html, init: render, start(el) { timer = setInterval(() => { bits[Math.floor(Math.random() * 8)] ^= 1; render(el); }, 450); }, stop() { clearInterval(timer); } };
  },
  // 逐步应用一组固定的合并规则，循环播放。
  bpe() {
    const steps = [['l','o','w','e','r','</w>'], ['l','o','w','er','</w>'], ['lo','w','er','</w>'], ['low','er','</w>'], ['lower','</w>']];
    let i = 0, timer;
    const render = el => { const prev = steps[Math.max(i - 1, 0)];
      el.querySelector('.syms').innerHTML = steps[i].map(s => `<span class="sym ${s === '</w>' ? 'eow' : ''} ${i > 0 && !prev.includes(s) ? 'new' : ''}">${esc(s)}</span>`).join('');
      el.querySelector('.lbl').textContent = `merge ${i} / ${steps.length - 1}`; };
    return { html: '<div class="syms"></div><span class="lbl"></span>', init: render, start(el) { timer = setInterval(() => { i = (i + 1) % steps.length; render(el); }, 700); }, stop() { clearInterval(timer); } };
  },
  // SiLU_β(x) = x·σ(βx)，β 在 0.5 到 8 之间往复；β 越大越接近 ReLU（虚线）。
  'llm-act-fns'() {
    let t = 0, raf;
    const W = 320, H = 180, X = x => W / 2 + x * 34, Y = y => H * .74 - y * 24;
    const html = `<svg viewBox="0 0 ${W} ${H}"><line x1="0" y1="${Y(0)}" x2="${W}" y2="${Y(0)}" stroke="var(--rule)"/><line x1="${X(0)}" y1="0" x2="${X(0)}" y2="${H}" stroke="var(--rule)"/>
      <path d="M0 ${Y(0)} H${X(0)} L${W} ${Y((W / 2) / 34)}" fill="none" stroke="var(--ink-3)" stroke-dasharray="3 3"/><path class="f" fill="none" stroke="#1baf7a" stroke-width="2.5" stroke-linejoin="round"/></svg><span class="lbl"></span>`;
    const render = (el, beta) => { let d = '';
      for (let x = -4.7; x <= 4.7; x += .1) d += (d ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(x / (1 + Math.exp(-beta * x))).toFixed(1) + ' ';
      el.querySelector('.f').setAttribute('d', d); el.querySelector('.lbl').textContent = 'SiLU  β = ' + beta.toFixed(2); };
    return { html, init: el => render(el, 1), start(el) { const step = () => { t += .02; render(el, 0.5 + 7.5 * (1 - Math.cos(t)) / 2); raf = requestAnimationFrame(step); }; step(); }, stop() { cancelAnimationFrame(raf); } };
  },
  // 指数轴上 fp16 的可表示下界是 2^-24；一个 2^-30 的梯度乘以 2^k 后才进入范围。
  'mixed-precision-training'() {
    let k = 0, timer;
    const W = 320, H = 180, X = e => 20 + (e + 40) / 40 * (W - 40);
    const html = `<svg viewBox="0 0 ${W} ${H}"><rect x="${X(-24)}" y="70" width="${W - 20 - X(-24)}" height="40" fill="#1baf7a" fill-opacity=".18"/>
      <rect x="20" y="70" width="${X(-24) - 20}" height="40" fill="#e34948" fill-opacity=".14"/>
      <line x1="20" y1="90" x2="${W - 20}" y2="90" stroke="var(--rule)"/>
      <text x="${X(-24)}" y="128" font-size="10" fill="var(--ink-3)" text-anchor="middle">2^-24 fp16 最小次正规数</text>
      <text x="22" y="60" font-size="10" fill="#e34948">被吸收为 0</text><text x="${W - 22}" y="60" font-size="10" fill="#1baf7a" text-anchor="end">可表示</text>
      <circle class="g" cy="90" r="7" fill="#eda100"/><text class="gl" y="45" font-size="11" fill="var(--ink)" text-anchor="middle"></text></svg><span class="lbl"></span>`;
    const render = el => { const e = -30 + k; el.querySelector('.g').setAttribute('cx', X(e)); const l = el.querySelector('.gl'); l.setAttribute('x', X(e)); l.textContent = `g·2^${k} = 2^${e}`;
      el.querySelector('.lbl').textContent = e >= -24 ? 'loss scale 生效' : 'loss scale = 2^' + k; };
    return { html, init: render, start(el) { timer = setInterval(() => { k = (k + 1) % 17; render(el); }, 350); }, stop() { clearInterval(timer); } };
  },
  // 五组词的二维向量从随机初始位置移动到各自的簇，循环播放。
  word2vec() {
    let t = 0, raf;
    const W = 320, H = 180, colors = ['#4a3aa7', '#e34948', '#2a78d6', '#eda100', '#1baf7a'];
    const centers = [[70, 60], [250, 50], [90, 135], [235, 130], [160, 95]];
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const pts = centers.flatMap((c, g) => Array.from({ length: 4 }, () => ({ g, x0: 40 + rnd() * (W - 80), y0: 25 + rnd() * (H - 50), x1: c[0] + (rnd() - .5) * 26, y1: c[1] + (rnd() - .5) * 22 })));
    const html = `<svg viewBox="0 0 ${W} ${H}">${pts.map(p => `<circle r="5" fill="${colors[p.g]}" stroke="var(--surface)" stroke-width="1.2"/>`).join('')}</svg><span class="lbl"></span>`;
    const render = (el, u) => { const e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      el.querySelectorAll('circle').forEach((c, i) => { const p = pts[i]; c.setAttribute('cx', p.x0 + (p.x1 - p.x0) * e); c.setAttribute('cy', p.y0 + (p.y1 - p.y0) * e); });
      el.querySelector('.lbl').textContent = 'epoch ' + Math.round(u * 60); };
    return { html, init: el => render(el, 0), start(el) { const step = () => { t = (t + .006) % 1.3; render(el, Math.min(1, t)); raf = requestAnimationFrame(step); }; step(); }, stop() { cancelAnimationFrame(raf); } };
  },
};
