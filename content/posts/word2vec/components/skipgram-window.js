import { typeset } from 'bake/kit'
import '../../../../components/lib/figure.css'
import './skipgram-window.css'

export const layout = { placeholder: { narrow: 330, wide: 400 } }

const WORDS = ['problems', 'turning', 'into', 'banking', 'crises', 'as', 'has', 'happened']
const NS = 'http://www.w3.org/2000/svg'
const el = (name, attrs, text) => {
  const node = document.createElementNS(NS, name)
  for (const key in attrs) node.setAttribute(key, attrs[key])
  if (text != null) node.textContent = text
  return node
}

export default class SkipgramWindow extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    this.classList.add('figure')
    this.innerHTML = `
      <div class="controls">
        <label>中心词位置 $t$ <input type="range" data-id="t" min="1" max="${WORDS.length}" value="4" step="1"><span class="v" data-id="t-value">4</span></label>
        <label>窗口大小 $m$ <input type="range" data-id="m" min="1" max="3" value="2" step="1"><span class="v" data-id="m-value">2</span></label>
      </div>
      <div class="plotwrap"><svg class="win" viewBox="0 0 720 250" role="img" aria-label="滑动窗口示意图"></svg></div>
      <div class="pairs" data-id="pairs" aria-live="polite"></div>
      <div class="chart-status" data-id="status"></div>`
    typeset(this)
    const $ = (id) => this.querySelector(`[data-id="${id}"]`)
    const svg = this.querySelector('svg.win')
    const tIn = $('t'), mIn = $('m')
    const W = 720, gap = 8, padX = 10, rowY = 150, boxH = 34
    // 每个词的宽度按字符数估算，等宽字体 14px 约 8.4px 一个字符。
    const widths = WORDS.map((w) => Math.max(52, w.length * 8.4 + 22))
    const total = widths.reduce((a, b) => a + b, 0) + gap * (WORDS.length - 1)
    const scale = Math.min(1, (W - 2 * padX) / total)
    const xs = []
    let x = padX + (W - 2 * padX - total * scale) / 2
    for (let i = 0; i < WORDS.length; i++) {
      xs.push(x)
      x += widths[i] * scale + gap
    }
    const cx = (i) => xs[i] + (widths[i] * scale) / 2

    // 样本总数：每个位置的窗口在两端截断。
    const totalPairs = (m) => {
      let n = 0
      for (let t = 0; t < WORDS.length; t++) n += Math.min(t, m) + Math.min(WORDS.length - 1 - t, m)
      return n
    }

    const render = () => {
      const t = +tIn.value, m = +mIn.value, ti = t - 1
      $('t-value').textContent = t
      $('m-value').textContent = m
      svg.replaceChildren()
      const defs = el('defs', {})
      const marker = el('marker', { id: 'skipgram-window-arrow', viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' })
      marker.appendChild(el('path', { d: 'M0,0 L8,4 L0,8 z', fill: 'var(--ctx)' }))
      defs.appendChild(marker)
      svg.appendChild(defs)

      const lo = Math.max(0, ti - m), hi = Math.min(WORDS.length - 1, ti + m)
      // 弧线与标签：偏移越大弧线越高。
      for (let i = lo; i <= hi; i++) {
        if (i === ti) continue
        const j = i - ti, h = 34 + Math.abs(j) * 30
        const x0 = cx(ti), x1 = cx(i), y0 = rowY - 2
        svg.appendChild(el('path', { class: 'arc', d: `M${x0},${y0} Q${(x0 + x1) / 2},${y0 - h * 1.6} ${x1},${y0}` }))
        const sub = j < 0 ? `t−${-j}` : `t+${j}`
        // 负偏移的标签向左对齐，正偏移的向右对齐，避免 j = ±1 的两个标签在中心词上方重叠。
        const label = el('text', { class: 'lbl', x: (x0 + x1) / 2 + (j < 0 ? 6 : -6), y: y0 - h * 0.8 - 4, 'text-anchor': j < 0 ? 'end' : 'start' })
        label.appendChild(el('tspan', {}, 'P(w'))
        label.appendChild(el('tspan', { dy: '4', 'font-size': '9px' }, sub))
        label.appendChild(el('tspan', { dy: '-4' }, ' | w'))
        label.appendChild(el('tspan', { dy: '4', 'font-size': '9px' }, 't'))
        label.appendChild(el('tspan', { dy: '-4' }, ')'))
        svg.appendChild(label)
      }
      WORDS.forEach((w, i) => {
        const g = el('g', { class: 'tok' + (i === ti ? ' center' : i >= lo && i <= hi ? ' ctx' : ''), tabindex: '0', role: 'button', 'aria-label': `把 ${w} 设为中心词` })
        g.appendChild(el('rect', { x: xs[i], y: rowY, width: widths[i] * scale, height: boxH, rx: 4 }))
        g.appendChild(el('text', { x: cx(i), y: rowY + boxH / 2 + 5, 'text-anchor': 'middle' }, w))
        g.appendChild(el('text', { class: 'idx', x: cx(i), y: rowY + boxH + 16, 'text-anchor': 'middle' }, String(i + 1)))
        const set = () => {
          tIn.value = i + 1
          render()
        }
        g.addEventListener('click', set)
        g.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            set()
          }
        })
        svg.appendChild(g)
      })
      const braceY = rowY + boxH + 26
      const brace = (a, b, cls, text) => {
        const x0 = xs[a], x1 = xs[b] + widths[b] * scale
        svg.appendChild(el('path', { class: 'brace', d: `M${x0},${braceY} v6 H${x1} v-6` }))
        svg.appendChild(el('text', { class: 'cap ' + cls, x: (x0 + x1) / 2, y: braceY + 24, 'text-anchor': 'middle' }, text))
      }
      if (lo < ti) brace(lo, ti - 1, '', `左侧上下文，${ti - lo} 个`)
      brace(ti, ti, 'c', `中心词 w_t，t = ${t}`)
      if (hi > ti) brace(ti + 1, hi, '', `右侧上下文，${hi - ti} 个`)

      const pairs = []
      for (let i = lo; i <= hi; i++) if (i !== ti) pairs.push(`<span>(<b>${WORDS[ti]}</b>, <i>${WORDS[i]}</i>)</span>`)
      $('pairs').innerHTML = pairs.join('')
      const n = pairs.length
      $('status').textContent = `位置 t = ${t} 产生 ${n} 个样本${n < 2 * m ? '（窗口在语料边界被截断）' : ''}；这句话共 ${WORDS.length} 个位置，m = ${m} 时一共产生 ${totalPairs(m)} 个样本，上限 2mT = ${2 * m * WORDS.length}。`
    }
    tIn.addEventListener('input', render)
    mIn.addEventListener('input', render)
    render()
  }
}
