import { PREC, config, setConfig } from './lib/iteration.js'
import { styleFigure } from './lib/figure.js'

export const layout = { placeholder: { narrow: 260, wide: 140 }, frame: false }

export default class IterationConfig extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    styleFigure(this)
    const options = (values, chosen) => values.map((value) => `<option value="${value}"${value === String(chosen) ? ' selected' : ''}>${value}</option>`).join('')
    this.innerHTML = `
      <div class="controls">
        <label>模型 <select data-key="model">${options(['0.6B', '1.7B', '4B', '8B', '14B', '32B'], config.model)}</select></label>
        <label>序列长度 s <select data-key="s">${options(['512', '1024', '2048', '4096', '8192'], config.s)}</select></label>
        <label>micro-batch b <input type="range" data-key="b" min="1" max="8" step="1" value="${config.b}"> <span class="v">${config.b}</span></label>
        <label>注意力实现 <select data-key="attn"><option value="flash">FlashAttention（不保留概率矩阵）</option><option value="naive">朴素实现（保留 softmax 输出）</option></select></label>
        <label>AdamW 矩的精度 <select data-key="opt"><option value="fp32">fp32</option><option value="bf16">bf16</option></select></label>
      </div>
      <div class="legend prec">${Object.values(PREC).map((p) => `<span><i style="--c:${p.c}"></i>${p.n}</span>`).join('')}</div>`
    for (const control of this.querySelectorAll('[data-key]')) {
      control.value = String(config[control.dataset.key])
      control.addEventListener('input', () => {
        if (control.dataset.key === 'b') control.nextElementSibling.textContent = control.value
        setConfig({ [control.dataset.key]: control.value })
      })
    }
  }
}
