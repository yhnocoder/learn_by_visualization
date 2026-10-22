import { onConfig, renderTable } from './lib/iteration.js'
import { styleFigure } from './lib/figure.js'

export const layout = { width: 'wide', placeholder: { narrow: 900, wide: 760 } }

export default class IterationModules extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    styleFigure(this)
    this.innerHTML = '<div class="tbl"></div>'
    const render = () => renderTable(this.firstElementChild)
    render()
    this.stopListening = onConfig(render)
  }

  disconnectedCallback() {
    this.stopListening?.()
  }
}
