// 第 8 节的二维训练图：在 300 句人造语料上训练 d = 2 的 Skip-gram，把 V（和可选的 U）的每一行画成平面上的点。
// 支持完整 softmax 与负采样两种目标函数、共享 U = V，以及按 epoch 拖动进度条回看训练过程。
import { el } from '../../../lib/svg.js';
import { mulberry32, sig, stepSoftmax } from './model.js';

// 词的分组，颜色只用于显示，与训练无关
const GROUPS = [
  { name: '主语', color: 'var(--s7)', words: ['i','you','we','they','he','she'] },
  { name: '吃', color: 'var(--s8)', words: ['eat','ate','eats'] },
  { name: '喝', color: 'var(--s1)', words: ['drink','drank','drinks'] },
  { name: '食物', color: 'var(--s4)', words: ['bread','rice','apple','cake','soup'] },
  { name: '饮料', color: 'var(--s3)', words: ['tea','coffee','water','milk','juice'] },
];

/** 初始化一个 .train-demo 实例。 */
export function initTrainDemo(root){
  const vocab = GROUPS.flatMap(g => g.words), n = vocab.length, d = 2;
  const idx = Object.fromEntries(vocab.map((w, i) => [w, i]));
  const colorOf = vocab.map(w => GROUPS.find(g => g.words.includes(w)).color);
  const pick = (rng, a) => a[Math.floor(rng() * a.length)];
  // 语料：固定种子，300 句
  const sents = (() => { const rng = mulberry32(11), out = [];
    for(let i = 0; i < 300; i++){ const eat = rng() < .5;
      out.push([idx[pick(rng, GROUPS[0].words)], idx[pick(rng, eat ? GROUPS[1].words : GROUPS[2].words)], idx[pick(rng, eat ? GROUPS[3].words : GROUPS[4].words)]]); }
    return out; })();
  // 负采样表：unigram^0.75 的累积分布
  const counts = new Float64Array(n); sents.flat().forEach(w => counts[w]++);
  const pw = Array.from(counts, c => Math.pow(c, .75)), Z = pw.reduce((a, b) => a + b, 0);
  const cum = []; let acc = 0; for(const x of pw){ acc += x / Z; cum.push(acc); }
  const sampleNeg = rng => { const r = rng(); let lo = 0, hi = n - 1; while(lo < hi){ const mid = (lo + hi) >> 1; if(cum[mid] < r) lo = mid + 1; else hi = mid; } return lo; };

  const $ = id => root.querySelector('#' + id);
  const svg = $('tr-svg'), status = $('tr-status');
  const modeSel = $('tr-mode'), sharedIn = $('tr-shared'), showU = $('tr-showU');
  const runBtn = $('tr-run'), oneBtn = $('tr-one'), resetBtn = $('tr-reset');
  const progress = $('tr-progress'), progressLabel = $('tr-progress-label');
  $('tr-legend').innerHTML = GROUPS.map(g => `<span style="--c:${g.color}"><i></i>${g.name}</span>`).join('') + '<span><i class="ring"></i>U 的行（勾选后显示）</span>';

  let V, U, rng, epoch, E, lr0, mode, shared, timer = null, lastLoss = NaN;
  const k = 10;
  let history = [];
  function remember(){ history[epoch] = { V: V.slice(), U: shared ? null : U.slice(), rng: rng.getState(), loss: lastLoss }; }
  function restore(target){
    const saved = history[target];
    V = saved.V.slice(); U = shared ? V : saved.U.slice();
    rng = mulberry32(saved.rng); epoch = target; lastLoss = saved.loss;
  }
  function seek(target){
    if(timer !== null) return;
    target = Math.max(0, Math.min(E, Math.round(target)));
    if(history[target]) restore(target);
    else{ restore(history.length - 1); while(epoch < target) runEpoch(); }
    draw();
  }
  progress.addEventListener('input', () => seek(+progress.value));
  function reset(){
    stop();
    mode = modeSel.value; shared = sharedIn.checked;
    E = mode === 'softmax' ? 60 : 150; lr0 = mode === 'softmax' ? 0.05 : 0.1;
    rng = mulberry32(1);
    V = new Float64Array(n*d); for(let i = 0; i < n*d; i++) V[i] = (rng() - .5) / d;
    U = shared ? V : new Float64Array(n*d);
    epoch = 0; lastLoss = NaN; history = []; remember(); draw();
  }
  function stepNS(c, o, lr){
    let loss = 0; const gv = new Float64Array(d); const vc = Array.from(V.subarray(c*d, c*d+d));
    for(let j = 0; j <= k; j++){
      let w, label; if(j === 0){ w = o; label = 1; } else{ w = sampleNeg(rng); if(w === o) continue; label = 0; }
      let x = 0; for(let q = 0; q < d; q++) x += U[w*d+q] * vc[q];
      const p = sig(x); loss += label ? -Math.log(p + 1e-12) : -Math.log(1 - p + 1e-12);
      const g = p - label;
      for(let q = 0; q < d; q++){ gv[q] += g * U[w*d+q]; U[w*d+q] -= lr * g * vc[q]; }
    }
    for(let q = 0; q < d; q++) V[c*d+q] -= lr * gv[q];
    return loss;
  }
  function runEpoch(){
    const lr = lr0 * (1 - epoch / E) + 0.0005; let loss = 0, cnt = 0;
    for(const s of sents) for(let t = 0; t < s.length; t++) for(const j of [-1, 1]){
      const u = t + j; if(u < 0 || u >= s.length) continue;
      loss += mode === 'softmax' ? stepSoftmax(V, U, n, d, s[t], s[u], lr) : stepNS(s[t], s[u], lr); cnt++;
    }
    epoch++; lastLoss = loss / cnt; remember();
  }
  let motionFrame = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function draw(animate = false){
    if(motionFrame !== null) cancelAnimationFrame(motionFrame);
    motionFrame = null;
    const marks = '.pt, .pu, .word-label';
    const before = Array.from(svg.querySelectorAll(marks), node => ({
      x: +(node.getAttribute('cx') ?? node.getAttribute('x')),
      y: +(node.getAttribute('cy') ?? node.getAttribute('y')),
    }));
    svg.replaceChildren();
    // 两种目标函数共用固定坐标；横纵轴每单位均为 32 像素。
    const W = 640, H = 400, scale = 32;
    const sx = x => W / 2 + x * scale, sy = y => H / 2 - (y + 1) * scale;
    svg.appendChild(el('line', { class: 'axis', x1: sx(-8), y1: sy(0), x2: sx(8), y2: sy(0) }));
    svg.appendChild(el('line', { class: 'axis', x1: sx(0), y1: sy(-6), x2: sx(0), y2: sy(4) }));
    for(let x = -8; x <= 8; x += 2){
      svg.appendChild(el('line', { class: 'axis', x1: sx(x), y1: sy(0) - 3, x2: sx(x), y2: sy(0) + 3 }));
      svg.appendChild(el('text', { class: 'lab', x: sx(x), y: sy(0) + 16, 'text-anchor': 'middle' }, x));
    }
    for(let y = -6; y <= 4; y += 2){
      if(y === 0) continue;
      svg.appendChild(el('line', { class: 'axis', x1: sx(0) - 3, y1: sy(y), x2: sx(0) + 3, y2: sy(y) }));
      svg.appendChild(el('text', { class: 'lab', x: sx(0) - 7, y: sy(y) + 4, 'text-anchor': 'end' }, y));
    }
    if(showU.checked && !shared) for(let i = 0; i < n; i++){
      svg.appendChild(el('circle', { class: 'pu', cx: sx(U[i*d]), cy: sy(U[i*d+1]), r: 4.5, stroke: colorOf[i] }));
      svg.appendChild(el('text', { class: 'lab u word-label', x: sx(U[i*d]) + 7, y: sy(U[i*d+1]) + 3.5 }, vocab[i]));
    }
    for(let i = 0; i < n; i++){
      svg.appendChild(el('circle', { class: 'pt', cx: sx(V[i*d]), cy: sy(V[i*d+1]), r: 5, fill: colorOf[i] }));
      svg.appendChild(el('text', { class: 'lab word-label', x: sx(V[i*d]) + 7, y: sy(V[i*d+1]) + 3.5 }, vocab[i]));
    }
    // 动画：每个点从上一次绘制的位置平滑移动到新位置，用时 300ms
    if(animate === true && !reducedMotion.matches){
      const nodes = Array.from(svg.querySelectorAll(marks));
      const destinations = nodes.map(node => ({
        x: +(node.getAttribute('cx') ?? node.getAttribute('x')),
        y: +(node.getAttribute('cy') ?? node.getAttribute('y')),
      }));
      if(before.length === nodes.length){
        const position = fraction => nodes.forEach((node, i) => {
          const circle = node.tagName.toLowerCase() === 'circle';
          node.setAttribute(circle ? 'cx' : 'x', before[i].x + (destinations[i].x - before[i].x) * fraction);
          node.setAttribute(circle ? 'cy' : 'y', before[i].y + (destinations[i].y - before[i].y) * fraction);
        });
        position(0);
        const started = performance.now();
        const move = now => {
          const t = Math.min(1, (now - started) / 300);
          position(t * t * (3 - 2 * t));
          motionFrame = t < 1 ? requestAnimationFrame(move) : null;
        };
        motionFrame = requestAnimationFrame(move);
      }
    }
    const dist = (a, b) => Math.hypot(V[idx[a]*d] - V[idx[b]*d], V[idx[a]*d+1] - V[idx[b]*d+1]).toFixed(2);
    progress.max = E;
    progress.value = epoch;
    progress.style.setProperty('--progress', `${epoch / E * 100}%`);
    progress.setAttribute('aria-valuetext', `epoch ${epoch} / ${E}`);
    progressLabel.textContent = `epoch ${epoch} / ${E}`;
    status.textContent = (isNaN(lastLoss) ? '' : `平均 loss ${lastLoss.toFixed(3)}，`) + `${mode === 'softmax' ? '完整 softmax' : '负采样 k = 10'}${shared ? '，共享 U = V' : ''}。输入词向量之间的欧氏距离：eat–bread ${dist('eat','bread')}，eat–drink ${dist('eat','drink')}，bread–rice ${dist('bread','rice')}。`;
    status.dataset.epoch = epoch;
  }
  // 自动播放时每秒训练 3 个 epoch
  const epochInterval = 1000 / 3;
  let lastTick = null;
  function tick(now){
    if(lastTick === null) lastTick = now;
    if(now - lastTick >= epochInterval){
      runEpoch(); draw(true);
      lastTick += epochInterval;
      if(now - lastTick >= epochInterval) lastTick = now;
      if(epoch >= E){ stop(); return; }
    }
    timer = requestAnimationFrame(tick);
  }
  function start(){ if(epoch >= E) return; lastTick = null; progress.disabled = true; runBtn.textContent = '暂停'; timer = requestAnimationFrame(tick); }
  function stop(){ if(timer !== null) cancelAnimationFrame(timer); timer = null; lastTick = null; progress.disabled = false; runBtn.textContent = '开始'; }
  runBtn.addEventListener('click', () => timer ? stop() : start());
  oneBtn.addEventListener('click', () => { stop(); if(epoch < E){ runEpoch(); draw(true); } });
  resetBtn.addEventListener('click', reset);
  modeSel.addEventListener('change', reset); sharedIn.addEventListener('change', reset);
  showU.addEventListener('change', () => draw());
  reset();
}
