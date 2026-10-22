import { typeset } from '../../../../components/lib/typeset.js'
import { fillGrids } from './lib/grid.js'
import { styleFigure } from '../../../../components/lib/figure.js'
import './negative-sampling-rows.css'

export const layout = { placeholder: { narrow: 560, wide: 300 } }

export default class NegativeSamplingRows extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount > 0) return
    styleFigure(this)
    this.innerHTML = `
      <div class="ns-cmp">
        <div class="panel">
          <h4>完整 softmax</h4>
          <div class="shapes">
            <div class="rowlabels"><span></span><span></span><span></span><span></span><span></span><span></span><b class="o">o</b><span></span><span></span></div>
            <div class="m"><div class="g" data-rows="9" data-cols="3" data-hl="all-u"></div></div>
          </div>
          <div class="sum">系数 $p_w - y_w$，$|V|$ 行全部更新</div>
        </div>
        <div class="panel">
          <h4>负采样，$k = 4$</h4>
          <div class="shapes">
            <div class="rowlabels"><b class="k">w₁</b><span></span><span></span><b class="k">w₂</b><span></span><b class="k">w₃</b><b class="o">o</b><span></span><b class="k">w₄</b></div>
            <div class="m"><div class="g" data-rows="9" data-cols="3" data-hl="ns" data-neg="0,3,5,8"></div></div>
          </div>
          <div class="sum">系数 $\\sigma(u_w \\cdot v_c) - y_w$，$1 + k$ 行更新</div>
        </div>
      </div>
      <div class="ns-key"><span><i class="o"></i>真实上下文词 $o$，label 1</span><span><i class="k"></i>抽到的噪声词，label 0</span><span><i class="u"></i>有梯度的其他行</span><span><i></i>本步不变的行</span></div>`
    fillGrids(this)
    typeset(this)
  }
}
