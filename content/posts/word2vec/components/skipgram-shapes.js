import { typeset } from '../../../../components/lib/typeset.js'
import { fillGrids } from './lib/grid.js'
import { styleFigure } from '../../../../components/lib/figure.js'
import './skipgram-shapes.css'

export const layout = { placeholder: { narrow: 560, wide: 330 } }

const ARROW = '<svg viewBox="0 0 44 10"><line x1="0" y1="5" x2="38" y2="5"/><path d="M36,1 L44,5 L36,9 z"/></svg>'

export default class SkipgramShapes extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    styleFigure(this)
    this.innerHTML = `
      <div class="shapes-wrap"><div class="shapes" role="img" aria-label="Skip-gram 前向过程的形状图">
        <div class="shapes-group">
          <div class="m"><div class="lab">$x$</div><div class="gw"><div class="g" data-rows="9" data-cols="1" data-hl="c"></div><span class="side l">$c$</span></div><div class="dim">$|V| \\times 1$</div></div>
          <div class="a"><span class="t"></span>${ARROW}</div>
          <div class="m"><div class="lab">$\\mathbf{V}$</div><div class="g" data-rows="9" data-cols="3" data-hl="c"></div><div class="dim">$|V| \\times d$</div></div>
          <div class="a"><span class="t">取第$c$行</span>${ARROW}</div>
          <div class="m"><div class="lab">$v_c$</div><div class="g" data-rows="1" data-cols="3" data-hl="all-c"></div><div class="dim">$1 \\times d$</div></div>
        </div>
        <div class="shapes-group">
          <div class="a"><span class="t"></span>${ARROW}</div>
          <div class="m context-matrix"><div class="lab">$\\mathbf{U}$</div><div class="gw"><div class="g" data-rows="9" data-cols="3" data-hl="all-u"></div><span class="side r">$u_o$</span></div><div class="dim">$|V| \\times d$</div></div>
          <div class="a"><span class="t">$|V|$ 个点积</span>${ARROW}</div>
          <div class="m"><div class="lab">$s$</div><div class="g" data-rows="9" data-cols="1" data-hl="o"></div><div class="dim">$|V| \\times 1$</div></div>
          <div class="a"><span class="t">softmax</span>${ARROW}</div>
          <div class="m"><div class="lab">$P(\\cdot \\mid c)$</div><div class="gw"><div class="g" data-rows="9" data-cols="1" data-hl="o"></div><span class="side r">$o$</span></div><div class="dim">$|V| \\times 1$</div></div>
        </div>
      </div></div>
      <div class="shape-key">
        <span>$\\mathbf{V}$：中心词向量矩阵</span><span>$\\mathbf{U}$：上下文词向量矩阵</span>
        <span>$v_c$：中心词 $c$ 的向量</span><span>$u_o$：上下文词 $o$ 的向量</span>
      </div>`
    fillGrids(this)
    typeset(this)
  }
}
