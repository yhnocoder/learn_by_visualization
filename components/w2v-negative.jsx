import { For } from 'solid-js';
import { Tex } from 'bake/kit';
import { CONTEXT_ROW, Grid } from './lib/w2v-grid.jsx';
import './lib/w2v-colors.css';
import './lib/w2v-grid.css';
import './lib/w2v-negative.css';

export const layout = {
  width: 'body',
  height: 290,
  narrowHeight: 560,
};

const NOISE = [0, 3, 5, 8];
const ROWS = 9;

function RowLabels(props) {
  const label = (row) => {
    if (row === CONTEXT_ROW) return { kind: 'w2v-negative-context', text: 'o' };
    const noise = props.noise.indexOf(row);
    return noise < 0 ? null : { kind: 'w2v-negative-noise', text: `w${'₁₂₃₄'[noise]}` };
  };
  return (
    <div class="w2v-negative-rows" aria-hidden="true">
      <For each={Array.from({ length: ROWS }, (_, row) => label(row))}>{(entry) => (entry === null ? <span /> : <b class={entry.kind}>{entry.text}</b>)}</For>
    </div>
  );
}

function Panel(props) {
  return (
    <div class="w2v-negative-panel">
      <h4>{props.title}</h4>
      <div class="w2v-negative-matrix">
        <RowLabels noise={props.noise} />
        <Grid rows={ROWS} columns={3} highlight={props.highlight} noise={props.noise} />
      </div>
      <div class="w2v-negative-sum">{props.children}</div>
    </div>
  );
}

export default function W2vNegative() {
  return (
    <div class="w2v-root w2v-negative">
      <div class="w2v-negative-panels">
        <Panel title="完整 softmax" noise={[]} highlight="all-context">
          系数 <Tex tex="p_w - y_w" />，<Tex tex="|V|" /> 行全部更新
        </Panel>
        <Panel title={<>负采样，<Tex tex="k = 4" /></>} noise={NOISE} highlight="negative">
          系数 <Tex tex="\sigma(u_w \cdot v_c) - y_w" />，<Tex tex="1 + k" /> 行更新
        </Panel>
      </div>
      <div class="w2v-negative-key">
        <span>
          <i class="w2v-negative-key-context" />
          真实上下文词 <Tex tex="o" />，label 1
        </span>
        <span>
          <i class="w2v-negative-key-noise" />
          抽到的噪声词，label 0
        </span>
        <span>
          <i class="w2v-negative-key-updated" />
          有梯度的其他行
        </span>
        <span>
          <i />
          本步不变的行
        </span>
      </div>
    </div>
  );
}
