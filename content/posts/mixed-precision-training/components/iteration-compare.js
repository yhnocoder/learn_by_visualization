import { onConfig, renderCompare } from './lib/iteration.js'
import './lib/figure.css'

export const layout = { width: 'wide', placeholder: { narrow: 1400, wide: 800 } }

export default class IterationCompare extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    this.classList.add('mp-figure')
    this.innerHTML = '<div class="tbl compare"></div>'
    const render = () => renderCompare(this.firstElementChild)
    render()
    this.stopListening = onConfig(render)
  }

  disconnectedCallback() {
    this.stopListening?.()
  }
}
