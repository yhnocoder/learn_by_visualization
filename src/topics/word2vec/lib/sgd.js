// 第 5 节的“一步更新”图：8 个词、d = 2 的完整 softmax，分三步显示分数与概率、梯度和更新后的参数。
// 详情区和状态栏里的公式随数值变化，由浏览器端 MathJax 生成；调用前先 await mathReady()。
import { mulberry32, softmaxDist, stepSoftmax } from './model.js';

const WORDS = ['problems','turning','into','banking','crises','as','has','happened'];

/** 初始化一个 .sgd-demo 实例。 */
export function initSgdDemo(root){
  const words = WORDS;
  const n = 8, d = 2, $ = id => root.querySelector('#' + id);
  const cSel = $('sg-c'), oSel = $('sg-o'), lrIn = $('sg-lr');
  let V, U, mode = 'forward', selected = 4, last = '';
  words.forEach((w, i) => { cSel.add(new Option(w, i)); oSel.add(new Option(w, i)); });
  cSel.value = 3; oSel.value = 4;
  const fmt = x => x.toFixed(3), vec = a => `(${a.map(fmt).join(', ')})`, row = (M, w) => Array.from(M.slice(w*2, w*2+2));
  function state(){
    const c = +cSel.value, o = +oSel.value, vc = row(V, c), p = softmaxDist(V, U, n, d, c);
    const g = Array.from(p, (x, w) => x - (w === o ? 1 : 0));
    const parts = words.map((_, w) => row(U, w).map(x => x * g[w]));
    const gv = [0, 1].map(k => parts.reduce((sum, a) => sum + a[k], 0));
    const gu = words.map((_, w) => vc.map(x => x * g[w]));
    return { c, o, vc, p, g, parts, gv, gu };
  }
  function render(){
    const { c, o, vc, p, g, parts, gv, gu } = state(), lr = +lrIn.value;
    const cell = x => `<span class="sg-cell" style="--strength:${Math.min(.24, Math.abs(x) * .18)};--tone:var(${x < 0 ? '--center' : '--ctx'})">${fmt(x)}</span>`;
    for(const [name, M] of [['v', V], ['u', U]]){
      $(`sg-${name}-matrix`).innerHTML = words.map((word, w) => {
        const active = name === 'v' ? w === c : w === selected;
        return `<button type="button" class="sg-mrow ${active ? 'selected' : ''}" data-${name}-row="${w}" aria-pressed="${active}" aria-label="${name === 'v' ? '选择中心词' : '查看输出词'} ${word}"><span>${word}<small>${name === 'v' && w === c ? ' c' : name === 'u' && w === o ? ' o' : ''}</small></span>${row(M, w).map(cell).join('')}</button>`;
      }).join('');
    }
    root.querySelectorAll('[data-v-row]').forEach(b => b.onclick = () => { cSel.value = b.dataset.vRow; last = ''; render(); });
    root.querySelectorAll('[data-u-row]').forEach(b => b.onclick = () => { selected = +b.dataset.uRow; render(); });
    root.querySelectorAll('[data-sg-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.sgMode === mode));
    root.querySelectorAll('[data-sg-title]').forEach(title => { title.hidden = title.dataset.sgTitle !== mode; });
    $('sg-result').innerHTML = words.map((word, w) => {
      const values = mode === 'gradient' ? gu[w] : row(U, w).map((x, k) => x - lr * gu[w][k]);
      return `<button type="button" class="sg-output ${w === selected ? 'selected' : ''}" data-result-row="${w}" aria-pressed="${w === selected}"><span>${word}${w === o ? ' · o' : ''}</span>${mode === 'forward' ? `<span class="sg-prob"><i style="width:${p[w] * 100}%"></i><b>${fmt(p[w])}</b></span>` : `<span class="sg-pair">${vec(values)}</span>`}</button>`;
    }).join('');
    root.querySelectorAll('[data-result-row]').forEach(b => b.onclick = () => { selected = +b.dataset.resultRow; render(); });
    const w = selected, uw = row(U, w), score = uw.reduce((sum, x, k) => sum + x * vc[k], 0), Z = words.reduce((sum, _, j) => sum + Math.exp(row(U, j).reduce((a, x, k) => a + x * vc[k], 0)), 0);
    $('sg-result-note').textContent = mode === 'forward' ? '条形长度表示概率（0 至 1）' : mode === 'gradient' ? '每行显示两个偏导数，不是标量系数' : '预览下一次更新；左侧是当前参数';
    const math = tex => window.MathJax.tex2svg(tex, { display: false }).outerHTML;
    const vector = a => String.raw`\left(${a.map(fmt).join(',\\;')}\right)^{\!\top}`;
    $('sg-detail').innerHTML = mode === 'forward'
      ? `<strong>${words[w]}：点积 → 概率</strong><div>${math(String.raw`s_w = (${fmt(uw[0])})\times(${fmt(vc[0])})`)}</div><div class="cont">${math(String.raw`+\, (${fmt(uw[1])})\times(${fmt(vc[1])})`)}</div><div class="cont">${math(String.raw`= ${fmt(score)}`)}</div><div>${math(String.raw`p_w = \frac{e^{${fmt(score)}}}{${fmt(Z)}} = ${fmt(p[w])}`)} <span class="sg-note">（分母为全部 8 个 ${math(String.raw`e^{s_j}`)} 之和）</span></div>`
      : mode === 'gradient'
      ? `<strong>${words[w]}：系数 ${math(String.raw`p_w-y_w=${fmt(p[w])}-${w === o ? 1 : 0}=${fmt(g[w])}`)}</strong><div>${math(String.raw`\frac{\partial\ell}{\partial u_w} = ${fmt(g[w])}\times ${vector(vc)}`)}</div><div class="cont">${math(String.raw`= ${vector(gu[w])}`)}</div><div>对 ${math(String.raw`\frac{\partial\ell}{\partial v_c}`)} 的贡献：${math(String.raw`${fmt(g[w])}\times ${vector(uw)}`)}</div><div class="cont">${math(String.raw`= ${vector(parts[w])}`)}</div><div>${math(String.raw`\frac{\partial\ell}{\partial v_c} = \sum_{w=1}^{8}(p_w-y_w)u_w`)}</div><div class="cont">${math(String.raw`= ${vector(gv)}`)}</div>`
      : `<strong>下一次更新 · ${math(String.raw`\eta = ${lr.toFixed(2)}`)}</strong><div>${math(String.raw`u_{\mathrm{${words[w]}}}^{\mathrm{new}} = ${vector(uw)} - ${lr.toFixed(2)}\times ${vector(gu[w])}`)}</div><div class="cont">${math(String.raw`= ${vector(uw.map((x, k) => x - lr * gu[w][k]))}`)}</div><div>${math(String.raw`v_{\mathrm{${words[c]}}}^{\mathrm{new}} = ${vector(vc)} - ${lr.toFixed(2)}\times ${vector(gv)}`)}</div><div class="cont">${math(String.raw`= ${vector(vc.map((x, k) => x - lr * gv[k]))}`)}</div><div class="sg-note">V 的其他 7 行保持不变；U 的全部 8 行按各自梯度更新。</div>`;
    $('sg-status').innerHTML = `${last}当前 ${math(String.raw`\ell = -\log P(\mathrm{${words[o]}}\mid\mathrm{${words[c]}}) = ${(-Math.log(p[o])).toFixed(3)}`)}。`;
  }
  function reset(){ const rng = mulberry32(7); V = Float64Array.from({ length: 16 }, () => (rng() - .5) * 2); U = Float64Array.from({ length: 16 }, () => (rng() - .5) * 2); last = ''; render(); }
  root.querySelectorAll('[data-sg-mode]').forEach(b => b.onclick = () => { mode = b.dataset.sgMode; render(); });
  $('sg-step').onclick = () => { const { c, o, p } = state(); stepSoftmax(V, U, n, d, c, o, +lrIn.value); const next = softmaxDist(V, U, n, d, c); last = `已更新：目标词概率从 ${fmt(p[o])} 变为 ${fmt(next[o])}。`; render(); };
  $('sg-reset').onclick = reset;
  cSel.onchange = () => { last = ''; render(); }; oSel.onchange = () => { selected = +oSel.value; last = ''; render(); };
  lrIn.oninput = () => { $('sg-lr-v').textContent = (+lrIn.value).toFixed(2); render(); };
  reset();
}
