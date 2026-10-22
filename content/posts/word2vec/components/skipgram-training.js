import { mulberry32, sigmoid, stepSoftmax } from './lib/skipgram.js'
import { styleFigure } from '../../../../components/lib/figure.js'
import './skipgram-training.css'

export const layout = { placeholder: { narrow: 560, wide: 640 } }

const GROUPS = [
  { name: '主语', color: 'var(--series-7)', words: ['i', 'you', 'we', 'they', 'he', 'she'] },
  { name: '吃', color: 'var(--series-8)', words: ['eat', 'ate', 'eats'] },
  { name: '喝', color: 'var(--series-1)', words: ['drink', 'drank', 'drinks'] },
  { name: '食物', color: 'var(--series-4)', words: ['bread', 'rice', 'apple', 'cake', 'soup'] },
  { name: '饮料', color: 'var(--series-3)', words: ['tea', 'coffee', 'water', 'milk', 'juice'] },
]
const NS = 'http://www.w3.org/2000/svg'
const el = (name, attrs, text) => {
  const node = document.createElementNS(NS, name)
  for (const key in attrs) node.setAttribute(key, attrs[key])
  if (text != null) node.textContent = text
  return node
}

export default class SkipgramTraining extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    styleFigure(this)
    this.innerHTML = `
      <div class="controls">
        <label>目标函数 <select data-id="mode"><option value="softmax">完整 softmax</option><option value="ns">负采样，k = 10</option></select></label>
        <label><input type="checkbox" data-id="shared"> 共享 U = V</label>
        <label><input type="checkbox" data-id="show-u"> 同时显示 U</label>
        <button class="btn" type="button" data-id="run">开始</button>
        <button class="btn quiet" type="button" data-id="one">跑 1 个 epoch</button>
        <button class="btn quiet" type="button" data-id="reset">重置</button>
      </div>
      <div class="legend">${GROUPS.map((g) => `<span style="--c:${g.color}"><i></i>${g.name}</span>`).join('')}<span><i class="u"></i>U 的行（勾选后显示）</span></div>
      <div class="plotwrap"><svg viewBox="0 0 640 400" role="img" aria-label="词向量在二维平面上的位置"></svg></div>
      <div class="tr-progress-wrap">
        <label data-id="progress-label">epoch 0 / 60</label>
        <input type="range" data-id="progress" min="0" max="60" step="1" value="0" aria-label="epoch">
      </div>
      <div class="chart-status" data-id="status"></div>`
    this.start()
  }

  disconnectedCallback() {
    this.stop?.()
  }

  start() {
    const $ = (id) => this.querySelector(`[data-id="${id}"]`)
    const vocab = GROUPS.flatMap((g) => g.words), n = vocab.length, d = 2
    const idx = Object.fromEntries(vocab.map((w, i) => [w, i]))
    const colorOf = vocab.map((w) => GROUPS.find((g) => g.words.includes(w)).color)
    const pick = (rng, a) => a[Math.floor(rng() * a.length)]
    // 语料：固定种子，300 句
    const sentences = (() => {
      const rng = mulberry32(11), out = []
      for (let i = 0; i < 300; i++) {
        const eat = rng() < 0.5
        out.push([idx[pick(rng, GROUPS[0].words)], idx[pick(rng, eat ? GROUPS[1].words : GROUPS[2].words)], idx[pick(rng, eat ? GROUPS[3].words : GROUPS[4].words)]])
      }
      return out
    })()
    // 负采样表：unigram^0.75 的累积分布
    const counts = new Float64Array(n)
    sentences.flat().forEach((w) => counts[w]++)
    const pw = Array.from(counts, (c) => Math.pow(c, 0.75)), Z = pw.reduce((a, b) => a + b, 0)
    const cum = []
    let acc = 0
    for (const x of pw) {
      acc += x / Z
      cum.push(acc)
    }
    const sampleNeg = (rng) => {
      const r = rng()
      let lo = 0, hi = n - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (cum[mid] < r) lo = mid + 1
        else hi = mid
      }
      return lo
    }

    const svg = this.querySelector('svg'), status = $('status')
    const modeSel = $('mode'), sharedIn = $('shared'), showU = $('show-u'), progress = $('progress')
    const runBtn = $('run')
    const k = 10
    let V, U, rng, epoch, E, lr0, mode, shared, timer = null, lastLoss = NaN, history = []
    const remember = () => {
      history[epoch] = { V: V.slice(), U: shared ? null : U.slice(), rng: rng.getState(), loss: lastLoss }
    }
    const restore = (target) => {
      const saved = history[target]
      V = saved.V.slice()
      U = shared ? V : saved.U.slice()
      rng = mulberry32(saved.rng)
      epoch = target
      lastLoss = saved.loss
    }
    const seek = (target) => {
      if (timer !== null) return
      target = Math.max(0, Math.min(E, Math.round(target)))
      if (history[target]) restore(target)
      else {
        restore(history.length - 1)
        while (epoch < target) runEpoch()
      }
      draw()
    }
    progress.addEventListener('input', () => seek(+progress.value))
    const reset = () => {
      stop()
      mode = modeSel.value
      shared = sharedIn.checked
      E = mode === 'softmax' ? 60 : 150
      lr0 = mode === 'softmax' ? 0.05 : 0.1
      rng = mulberry32(1)
      V = new Float64Array(n * d)
      for (let i = 0; i < n * d; i++) V[i] = (rng() - 0.5) / d
      U = shared ? V : new Float64Array(n * d)
      epoch = 0
      lastLoss = NaN
      history = []
      remember()
      draw()
    }
    const stepNS = (c, o, lr) => {
      let loss = 0
      const gv = new Float64Array(d), vc = Array.from(V.subarray(c * d, c * d + d))
      for (let j = 0; j <= k; j++) {
        let w, label
        if (j === 0) {
          w = o
          label = 1
        } else {
          w = sampleNeg(rng)
          if (w === o) continue
          label = 0
        }
        let x = 0
        for (let q = 0; q < d; q++) x += U[w * d + q] * vc[q]
        const p = sigmoid(x)
        loss += label ? -Math.log(p + 1e-12) : -Math.log(1 - p + 1e-12)
        const g = p - label
        for (let q = 0; q < d; q++) {
          gv[q] += g * U[w * d + q]
          U[w * d + q] -= lr * g * vc[q]
        }
      }
      for (let q = 0; q < d; q++) V[c * d + q] -= lr * gv[q]
      return loss
    }
    const runEpoch = () => {
      const lr = lr0 * (1 - epoch / E) + 0.0005
      let loss = 0, count = 0
      for (const s of sentences) {
        for (let t = 0; t < s.length; t++) {
          for (const j of [-1, 1]) {
            const u = t + j
            if (u < 0 || u >= s.length) continue
            loss += mode === 'softmax' ? stepSoftmax(V, U, n, d, s[t], s[u], lr) : stepNS(s[t], s[u], lr)
            count++
          }
        }
      }
      epoch++
      lastLoss = loss / count
      remember()
    }
    let motionFrame = null
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    const position = (node) => ({ x: +(node.getAttribute('cx') ?? node.getAttribute('x')), y: +(node.getAttribute('cy') ?? node.getAttribute('y')) })
    const draw = (animate = false) => {
      if (motionFrame !== null) cancelAnimationFrame(motionFrame)
      motionFrame = null
      const marks = '.pt, .pu, .word-label'
      const before = Array.from(svg.querySelectorAll(marks), position)
      svg.replaceChildren()
      // 两种目标函数共用固定坐标；横纵轴每单位均为 32 像素。
      const W = 640, H = 400, scale = 32
      const sx = (x) => W / 2 + x * scale, sy = (y) => H / 2 - (y + 1) * scale
      svg.appendChild(el('line', { class: 'axis', x1: sx(-8), y1: sy(0), x2: sx(8), y2: sy(0) }))
      svg.appendChild(el('line', { class: 'axis', x1: sx(0), y1: sy(-6), x2: sx(0), y2: sy(4) }))
      for (let x = -8; x <= 8; x += 2) {
        svg.appendChild(el('line', { class: 'axis', x1: sx(x), y1: sy(0) - 3, x2: sx(x), y2: sy(0) + 3 }))
        svg.appendChild(el('text', { class: 'lab', x: sx(x), y: sy(0) + 16, 'text-anchor': 'middle' }, x))
      }
      for (let y = -6; y <= 4; y += 2) {
        if (y === 0) continue
        svg.appendChild(el('line', { class: 'axis', x1: sx(0) - 3, y1: sy(y), x2: sx(0) + 3, y2: sy(y) }))
        svg.appendChild(el('text', { class: 'lab', x: sx(0) - 7, y: sy(y) + 4, 'text-anchor': 'end' }, y))
      }
      if (showU.checked && !shared) {
        for (let i = 0; i < n; i++) {
          svg.appendChild(el('circle', { class: 'pu', cx: sx(U[i * d]), cy: sy(U[i * d + 1]), r: 4.5, style: `stroke:${colorOf[i]}` }))
          svg.appendChild(el('text', { class: 'lab u word-label', x: sx(U[i * d]) + 7, y: sy(U[i * d + 1]) + 3.5 }, vocab[i]))
        }
      }
      for (let i = 0; i < n; i++) {
        svg.appendChild(el('circle', { class: 'pt', cx: sx(V[i * d]), cy: sy(V[i * d + 1]), r: 5, style: `fill:${colorOf[i]}` }))
        svg.appendChild(el('text', { class: 'lab word-label', x: sx(V[i * d]) + 7, y: sy(V[i * d + 1]) + 3.5 }, vocab[i]))
      }
      if (animate && !reducedMotion.matches) {
        const nodes = Array.from(svg.querySelectorAll(marks))
        const destinations = nodes.map(position)
        if (before.length === nodes.length) {
          const place = (fraction) =>
            nodes.forEach((node, i) => {
              const circle = node.tagName.toLowerCase() === 'circle'
              node.setAttribute(circle ? 'cx' : 'x', before[i].x + (destinations[i].x - before[i].x) * fraction)
              node.setAttribute(circle ? 'cy' : 'y', before[i].y + (destinations[i].y - before[i].y) * fraction)
            })
          place(0)
          const started = performance.now()
          const move = (now) => {
            const t = Math.min(1, (now - started) / 300)
            place(t * t * (3 - 2 * t))
            motionFrame = t < 1 ? requestAnimationFrame(move) : null
          }
          motionFrame = requestAnimationFrame(move)
        }
      }
      const dist = (a, b) => Math.hypot(V[idx[a] * d] - V[idx[b] * d], V[idx[a] * d + 1] - V[idx[b] * d + 1]).toFixed(2)
      progress.max = E
      progress.value = epoch
      progress.style.setProperty('--progress', `${(epoch / E) * 100}%`)
      progress.setAttribute('aria-valuetext', `epoch ${epoch} / ${E}`)
      $('progress-label').textContent = `epoch ${epoch} / ${E}`
      status.textContent = (isNaN(lastLoss) ? '' : `平均 loss ${lastLoss.toFixed(3)}，`) + `${mode === 'softmax' ? '完整 softmax' : '负采样 k = 10'}${shared ? '，共享 U = V' : ''}。输入词向量之间的欧氏距离：eat–bread ${dist('eat', 'bread')}，eat–drink ${dist('eat', 'drink')}，bread–rice ${dist('bread', 'rice')}。`
      status.dataset.epoch = epoch
    }
    const epochInterval = 1000 / 3
    let lastTick = null
    const tick = (now) => {
      if (lastTick === null) lastTick = now
      if (now - lastTick >= epochInterval) {
        runEpoch()
        draw(true)
        lastTick += epochInterval
        if (now - lastTick >= epochInterval) lastTick = now
        if (epoch >= E) {
          stop()
          return
        }
      }
      timer = requestAnimationFrame(tick)
    }
    const play = () => {
      if (epoch >= E) return
      lastTick = null
      progress.disabled = true
      runBtn.textContent = '暂停'
      timer = requestAnimationFrame(tick)
    }
    const stop = () => {
      if (timer !== null) cancelAnimationFrame(timer)
      timer = null
      lastTick = null
      progress.disabled = false
      runBtn.textContent = '开始'
    }
    this.stop = stop
    runBtn.addEventListener('click', () => (timer ? stop() : play()))
    $('one').addEventListener('click', () => {
      stop()
      if (epoch < E) {
        runEpoch()
        draw(true)
      }
    })
    $('reset').addEventListener('click', reset)
    modeSel.addEventListener('change', reset)
    sharedIn.addEventListener('change', reset)
    showU.addEventListener('change', () => draw())
    reset()
  }
}
