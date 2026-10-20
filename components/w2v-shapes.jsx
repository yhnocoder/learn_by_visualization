import { Tex } from 'bake/kit';
import { Grid } from './lib/w2v-grid.jsx';
import './lib/w2v-colors.css';
import './lib/w2v-grid.css';
import './lib/w2v-shapes.css';

export const layout = {
  width: 'body',
  height: 300,
  narrowHeight: 520,
};

function Arrow(props) {
  return (
    <div class="w2v-shapes-arrow" classList={{ 'w2v-shapes-arrow-wide': props.wide }}>
      <span class="w2v-shapes-arrow-text">{props.children}</span>
      <svg viewBox="0 0 44 10" aria-hidden="true">
        <line x1="0" y1="5" x2="38" y2="5" />
        <path d="M36,1 L44,5 L36,9 z" />
      </svg>
    </div>
  );
}

function Matrix(props) {
  return (
    <div class="w2v-shapes-matrix" classList={{ 'w2v-shapes-matrix-context': props.context }}>
      <div class="w2v-shapes-name">
        <Tex tex={props.name} />
      </div>
      <div class="w2v-shapes-holder">
        <Grid rows={props.rows} columns={props.columns} highlight={props.highlight} />
        {props.left && (
          <span class="w2v-shapes-side w2v-shapes-side-left">
            <Tex tex={props.left} />
          </span>
        )}
        {props.right && (
          <span class="w2v-shapes-side w2v-shapes-side-right">
            <Tex tex={props.right} />
          </span>
        )}
      </div>
      <div class="w2v-shapes-dimension">
        <Tex tex={props.dimension} />
      </div>
    </div>
  );
}

export default function W2vShapes() {
  return (
    <div class="w2v-root w2v-shapes">
      <div class="w2v-shapes-row" role="img" aria-label="Skip-gram 前向过程的形状图">
        <div class="w2v-shapes-group">
          <Matrix name="x" rows={9} columns={1} highlight="center" left="c" dimension="|V| \times 1" />
          <Arrow />
          <Matrix name="\mathbf{V}" rows={9} columns={3} highlight="center" dimension="|V| \times d" />
          <Arrow wide>
            取第<Tex tex="c" />行
          </Arrow>
          <Matrix name="v_c" rows={1} columns={3} highlight="all-center" dimension="1 \times d" />
        </div>
        <div class="w2v-shapes-group">
          <Arrow />
          <Matrix name="\mathbf{U}" rows={9} columns={3} highlight="all-context" right="u_o" dimension="|V| \times d" context />
          <Arrow wide>
            <Tex tex="|V|" /> 个点积
          </Arrow>
          <Matrix name="s" rows={9} columns={1} highlight="context" dimension="|V| \times 1" />
          <Arrow wide>softmax</Arrow>
          <Matrix name="P(\cdot \mid c)" rows={9} columns={1} highlight="context" right="o" dimension="|V| \times 1" />
        </div>
      </div>
      <div class="w2v-shapes-key">
        <span>
          <Tex tex="\mathbf{V}" />：中心词向量矩阵
        </span>
        <span>
          <Tex tex="\mathbf{U}" />：上下文词向量矩阵
        </span>
        <span>
          <Tex tex="v_c" />：中心词 <Tex tex="c" /> 的向量
        </span>
        <span>
          <Tex tex="u_o" />：上下文词 <Tex tex="o" /> 的向量
        </span>
      </div>
    </div>
  );
}
