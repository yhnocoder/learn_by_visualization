import { VARIANTS, makeDemo, onConfig } from './lib/iteration.js'
import './lib/figure.css'

export const params = {
  variant: { label: '实现', type: 'enum', options: ['amp', 'ds', 'mlm', 'mlmpa'], default: 'amp' },
}

export const layout = { width: 'wide', placeholder: { narrow: 1900, wide: 1500 } }

export default class IterationSteps extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    this.classList.add('mp-figure')
    const demo = makeDemo(VARIANTS[this.params.variant], this)
    demo.build()
    this.stopListening = onConfig(() => demo.build())
  }

  disconnectedCallback() {
    this.stopListening?.()
  }
}
