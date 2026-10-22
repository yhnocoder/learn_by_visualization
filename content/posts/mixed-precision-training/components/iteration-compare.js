import { onConfig, renderCompare } from './lib/iteration.js'
import { styleFigure } from './lib/figure.js'

export const layout = { width: 'wide', placeholder: { narrow: 1400, wide: 800 } }

export default class IterationCompare extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    styleFigure(this)
    this.innerHTML = '<div class="tbl compare"></div>'
    const render = () => renderCompare(this.firstElementChild)
    render()
    this.stopListening = onConfig(render)
  }

  disconnectedCallback() {
    this.stopListening?.()
  }
}
