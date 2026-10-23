import { onConfig, renderTable } from './lib/iteration.js'
import './lib/figure.css'

export const layout = { width: 'wide', placeholder: { narrow: 900, wide: 760 } }

export default class IterationModules extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    this.classList.add('mp-figure')
    this.innerHTML = '<div class="tbl"></div>'
    const render = () => renderTable(this.firstElementChild)
    render()
    this.stopListening = onConfig(render)
  }

  disconnectedCallback() {
    this.stopListening?.()
  }
}
