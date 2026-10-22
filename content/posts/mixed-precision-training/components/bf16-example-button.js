import { styleFigure } from './lib/figure.js'

export const layout = { placeholder: { narrow: 44, wide: 44 }, frame: false }

// Loads the bf16 absorption example into the update-absorption figure and scrolls to it.
export default class Bf16ExampleButton extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    styleFigure(this)
    this.innerHTML = '<button class="btn primary" type="button">在第二节演示中载入 bf16 吸收示例</button>'
    this.firstElementChild.addEventListener('click', () => dispatchEvent(new Event('mixed-precision-bf16-example')))
  }
}
