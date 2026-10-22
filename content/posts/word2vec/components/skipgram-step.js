import { tex, typeset } from '../../../../components/lib/typeset.js'
import { mulberry32, softmaxDist, stepSoftmax } from './lib/skipgram.js'
import { styleFigure } from '../../../../components/lib/figure.js'
import './skipgram-step.css'

export const layout = { placeholder: { narrow: 1100, wide: 720 } }

const WORDS = ['problems', 'turning', 'into', 'banking', 'crises', 'as', 'has', 'happened']

export default class SkipgramStep extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    styleFigure(this)
    this.innerHTML = `
      <div class="controls">
        <label>中心词 $c$ <select data-id="c"></select></label>
        <label>上下文词 $o$ <select data-id="o"></select></label>
        <label>学习率 $\\eta$ <input type="range" data-id="lr" min="0.05" max="1" step="0.05" value="0.5"><span class="v" data-id="lr-value">0.50</span></label>
        <button class="btn" type="button" data-id="step">执行一步更新</button>
        <button class="btn quiet" type="button" data-id="reset">重置参数</button>
      </div>
      <div class="sg-modes" aria-label="计算步骤">
        <button type="button" data-sg-mode="forward" aria-pressed="true">1 · 分数与概率</button>
        <button type="button" data-sg-mode="gradient" aria-pressed="false">2 · 梯度</button>
        <button type="button" data-sg-mode="update" aria-pressed="false">3 · 更新预览</button>
      </div>
      <div class="sg-flow">
        <section><h4>$\\mathbf{V}$ <small>$8\\times 2$ · 输入向量</small></h4><div data-id="v-matrix"></div><p class="sg-note">标记 c 的行参与本次计算</p></section>
        <section><h4>$\\mathbf{U}$ <small>$8\\times 2$ · 输出向量</small></h4><div data-id="u-matrix"></div><p class="sg-note">全部行参与计算；点击一行查看</p></section>
        <section><h4><span data-sg-title="forward">$\\mathbf{U}v_c \\xrightarrow{\\operatorname{softmax}} p$</span><span data-sg-title="gradient" hidden>$\\nabla_{\\mathbf{U}}\\ell$ <small>· 完整梯度</small></span><span data-sg-title="update" hidden>$\\mathbf{U}-\\eta\\nabla_{\\mathbf{U}}\\ell$ <small>· 更新后</small></span></h4><div data-id="result"></div><p class="sg-note" data-id="result-note"></p></section>
      </div>
      <div class="sg-detail" data-id="detail" aria-live="polite"></div>
      <div class="chart-status" data-id="status" aria-live="polite"></div>`
    typeset(this)
    const $ = (id) => this.querySelector(`[data-id="${id}"]`)
    const n = 8, d = 2
    const cSel = $('c'), oSel = $('o'), lrIn = $('lr')
    let V, U, mode = 'forward', selected = 4, last = ''
    WORDS.forEach((w, i) => {
      cSel.add(new Option(w, i))
      oSel.add(new Option(w, i))
    })
    cSel.value = 3
    oSel.value = 4
    const fmt = (x) => x.toFixed(3)
    const row = (M, w) => Array.from(M.slice(w * 2, w * 2 + 2))
    const vector = (a) => String.raw`\left(${a.map(fmt).join(',\\;')}\right)^{\!\top}`
    const state = () => {
      const c = +cSel.value, o = +oSel.value, vc = row(V, c), p = softmaxDist(V, U, n, d, c)
      const g = Array.from(p, (x, w) => x - (w === o ? 1 : 0))
      const parts = WORDS.map((_, w) => row(U, w).map((x) => x * g[w]))
      const gv = [0, 1].map((k) => parts.reduce((sum, a) => sum + a[k], 0))
      const gu = WORDS.map((_, w) => vc.map((x) => x * g[w]))
      return { c, o, vc, p, g, parts, gv, gu }
    }
    const render = () => {
      const { c, o, vc, p, g, parts, gv, gu } = state(), lr = +lrIn.value
      const cell = (x) => `<span class="sg-cell" style="--strength:${Math.min(0.24, Math.abs(x) * 0.18)};--tone:var(${x < 0 ? '--center' : '--ctx'})">${fmt(x)}</span>`
      for (const [name, M] of [['v', V], ['u', U]]) {
        $(`${name}-matrix`).innerHTML = WORDS.map((word, w) => {
          const active = name === 'v' ? w === c : w === selected
          return `<button type="button" class="sg-mrow ${active ? 'selected' : ''}" data-${name}-row="${w}" aria-pressed="${active}" aria-label="${name === 'v' ? '选择中心词' : '查看输出词'} ${word}"><span>${word}<small>${name === 'v' && w === c ? ' c' : name === 'u' && w === o ? ' o' : ''}</small></span>${row(M, w).map(cell).join('')}</button>`
        }).join('')
      }
      this.querySelectorAll('[data-v-row]').forEach((b) => (b.onclick = () => {
        cSel.value = b.dataset.vRow
        last = ''
        render()
      }))
      this.querySelectorAll('[data-u-row]').forEach((b) => (b.onclick = () => {
        selected = +b.dataset.uRow
        render()
      }))
      this.querySelectorAll('[data-sg-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.sgMode === mode))
      this.querySelectorAll('[data-sg-title]').forEach((title) => (title.hidden = title.dataset.sgTitle !== mode))
      $('result').innerHTML = WORDS.map((word, w) => {
        const values = mode === 'gradient' ? gu[w] : row(U, w).map((x, k) => x - lr * gu[w][k])
        return `<button type="button" class="sg-output ${w === selected ? 'selected' : ''}" data-result-row="${w}" aria-pressed="${w === selected}"><span>${word}${w === o ? ' · o' : ''}</span>${mode === 'forward' ? `<span class="sg-prob"><i style="width:${p[w] * 100}%"></i><b>${fmt(p[w])}</b></span>` : `<span class="sg-pair">(${values.map(fmt).join(', ')})</span>`}</button>`
      }).join('')
      this.querySelectorAll('[data-result-row]').forEach((b) => (b.onclick = () => {
        selected = +b.dataset.resultRow
        render()
      }))
      const w = selected, uw = row(U, w)
      const score = uw.reduce((sum, x, k) => sum + x * vc[k], 0)
      const Z = WORDS.reduce((sum, _, j) => sum + Math.exp(row(U, j).reduce((a, x, k) => a + x * vc[k], 0)), 0)
      $('result-note').textContent = mode === 'forward' ? '条形长度表示概率（0 至 1）' : mode === 'gradient' ? '每行显示两个偏导数，不是标量系数' : '预览下一次更新；左侧是当前参数'
      $('detail').innerHTML =
        mode === 'forward'
          ? `<strong>${WORDS[w]}：点积 → 概率</strong><div>${tex(String.raw`s_w = (${fmt(uw[0])})\times(${fmt(vc[0])})`)}</div><div class="cont">${tex(String.raw`+\, (${fmt(uw[1])})\times(${fmt(vc[1])})`)}</div><div class="cont">${tex(String.raw`= ${fmt(score)}`)}</div><div>${tex(String.raw`p_w = \frac{e^{${fmt(score)}}}{${fmt(Z)}} = ${fmt(p[w])}`)} <span class="sg-note">（分母为全部 8 个 ${tex(String.raw`e^{s_j}`)} 之和）</span></div>`
          : mode === 'gradient'
            ? `<strong>${WORDS[w]}：系数 ${tex(String.raw`p_w-y_w=${fmt(p[w])}-${w === o ? 1 : 0}=${fmt(g[w])}`)}</strong><div>${tex(String.raw`\frac{\partial\ell}{\partial u_w} = ${fmt(g[w])}\times ${vector(vc)}`)}</div><div class="cont">${tex(String.raw`= ${vector(gu[w])}`)}</div><div>对 ${tex(String.raw`\frac{\partial\ell}{\partial v_c}`)} 的贡献：${tex(String.raw`${fmt(g[w])}\times ${vector(uw)}`)}</div><div class="cont">${tex(String.raw`= ${vector(parts[w])}`)}</div><div>${tex(String.raw`\frac{\partial\ell}{\partial v_c} = \sum_{w=1}^{8}(p_w-y_w)u_w`)}</div><div class="cont">${tex(String.raw`= ${vector(gv)}`)}</div>`
            : `<strong>下一次更新 · ${tex(String.raw`\eta = ${lr.toFixed(2)}`)}</strong><div>${tex(String.raw`u_{\mathrm{${WORDS[w]}}}^{\mathrm{new}} = ${vector(uw)} - ${lr.toFixed(2)}\times ${vector(gu[w])}`)}</div><div class="cont">${tex(String.raw`= ${vector(uw.map((x, k) => x - lr * gu[w][k]))}`)}</div><div>${tex(String.raw`v_{\mathrm{${WORDS[c]}}}^{\mathrm{new}} = ${vector(vc)} - ${lr.toFixed(2)}\times ${vector(gv)}`)}</div><div class="cont">${tex(String.raw`= ${vector(vc.map((x, k) => x - lr * gv[k]))}`)}</div><div class="sg-note">V 的其他 7 行保持不变；U 的全部 8 行按各自梯度更新。</div>`
      $('status').innerHTML = `${last}当前 ${tex(String.raw`\ell = -\log P(\mathrm{${WORDS[o]}}\mid\mathrm{${WORDS[c]}}) = ${(-Math.log(p[o])).toFixed(3)}`)}。`
      typeset($('detail'))
      typeset($('status'))
    }
    const reset = () => {
      const rng = mulberry32(7)
      V = Float64Array.from({ length: 16 }, () => (rng() - 0.5) * 2)
      U = Float64Array.from({ length: 16 }, () => (rng() - 0.5) * 2)
      last = ''
      render()
    }
    this.querySelectorAll('[data-sg-mode]').forEach((b) => (b.onclick = () => {
      mode = b.dataset.sgMode
      render()
    }))
    $('step').onclick = () => {
      const { c, o, p } = state()
      stepSoftmax(V, U, n, d, c, o, +lrIn.value)
      const next = softmaxDist(V, U, n, d, c)
      last = `已更新：目标词概率从 ${fmt(p[o])} 变为 ${fmt(next[o])}。`
      render()
    }
    $('reset').onclick = reset
    cSel.onchange = () => {
      last = ''
      render()
    }
    oSel.onchange = () => {
      selected = +oSel.value
      last = ''
      render()
    }
    lrIn.oninput = () => {
      $('lr-value').textContent = (+lrIn.value).toFixed(2)
      render()
    }
    reset()
  }
}
