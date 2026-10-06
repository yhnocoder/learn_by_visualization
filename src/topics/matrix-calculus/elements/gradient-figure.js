// <gradient-figure>：偏导数与梯度的交互图，内容与 components/deep-learning/GradientFigure.astro 相同，
// 写成 custom element 后，同一个元素既用在 Markdown 页面上，也用在编辑器里。
// 属性 x0、y0 是初始位置。元素里原有的子元素（图题 <figcaption>）保留在图的最后。
// 样式在元素定义加载时才插入页面，不随页面的样式表一起加载到所有页面
import css from './gradient-figure.css?inline';
import { mathReady } from '../../../lib/math.js';
import { initGradient } from '../lib/gradient.js';

let count = 0;
const tex = t => window.MathJax.tex2svg(t, { display: false }).outerHTML;
const num = (v, fallback) => Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback;

class GradientFigure extends HTMLElement {
  static properties = {
    x0: { label: 'x₀ 初始值', type: 'number', min: -2, max: 2, step: 0.01, default: 1.2 },
    y0: { label: 'y₀ 初始值', type: 'number', min: -2, max: 2, step: 0.01, default: 0.8 },
  };
  static observedAttributes = Object.keys(GradientFigure.properties);

  connectedCallback(){
    if(!this.id) this.id = `grad-${++count}`;
    this.classList.add('fig', 'grad');
    this.setAttribute('role', 'figure');
    this.build();
  }

  attributeChangedCallback(){
    if(this.isConnected) this.build();
  }

  // 生成图的结构并初始化；属性变化时整张图重新生成。
  // 图的部分放在 contenteditable=false 的容器里，编辑器中光标不会进入图内部
  async build(){
    const seq = this.seq = (this.seq ?? 0) + 1;
    await mathReady();
    if(seq !== this.seq || !this.isConnected) return;
    this.querySelector(':scope > .widget-ui')?.remove();
    const ui = document.createElement('div');
    ui.className = 'widget-ui';
    ui.contentEditable = 'false';
    const x0 = num(this.getAttribute('x0'), 1.2), y0 = num(this.getAttribute('y0'), 0.8);
    ui.innerHTML = `
      <div class="controls">
        <label>${tex('x_0')} <input type="range" data-grad="x" min="-2" max="2" step="0.01"> <span class="v" data-grad="xv"></span></label>
        <label>${tex('y_0')} <input type="range" data-grad="y" min="-2" max="2" step="0.01"> <span class="v" data-grad="yv"></span></label>
      </div>
      <div class="stage">
        <div class="plot field"><svg id="${this.id}-field" data-grad="field" viewBox="0 0 348 300" role="img" aria-label="f(x,y) 的取值和等值线、当前位置、两个偏导数和梯度"></svg></div>
        <div>
          <div class="plot"><svg id="${this.id}-sx" data-grad="sx" viewBox="0 0 460 140" role="img" aria-label="固定 y，只动 x 的剖面曲线和切线"></svg></div>
          <div class="plot"><svg id="${this.id}-sy" data-grad="sy" viewBox="0 0 460 140" role="img" aria-label="固定 x，只动 y 的剖面曲线和切线"></svg></div>
        </div>
      </div>
      <div class="readout">
        <div class="x">${tex('\\dfrac{\\partial f}{\\partial x} = 6x_0y_0')} = <b data-grad="px"></b></div>
        <div class="y">${tex('\\dfrac{\\partial f}{\\partial y} = 3x_0^2')} = <b data-grad="py"></b></div>
        <div class="g">${tex('\\nabla f')} = [<b data-grad="g1"></b>&nbsp; <b data-grad="g2"></b>]</div>
      </div>`;
    this.prepend(ui);
    initGradient(this, { x0, y0 });
  }
}

document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
customElements.define('gradient-figure', GradientFigure);
