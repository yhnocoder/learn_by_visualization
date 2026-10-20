import { createComputed, createMemo, createSignal, For, Show } from 'solid-js';
import { Button, Controls, Segmented, Slider, Tex } from 'bake/kit';
import { mulberry32, SENTENCE, softmaxDistribution, stepSoftmax } from './lib/w2v-model.js';
import './lib/w2v-colors.css';
import './lib/w2v-step.css';

export const params = {
  center: { label: '中心词 c', type: 'enum', options: SENTENCE, default: 'banking' },
  context: { label: '上下文词 o', type: 'enum', options: SENTENCE, default: 'crises' },
  rate: { label: '学习率 η', type: 'number', min: 0.05, max: 1, step: 0.05, default: 0.5 },
};

export const layout = {
  width: 'body',
  height: 760,
  narrowHeight: 1660,
  autoHeight: true,
};

const COUNT = SENTENCE.length;
const DIMENSION = 2;
const MODES = [
  { value: 'forward', label: '1 · 分数与概率' },
  { value: 'gradient', label: '2 · 梯度' },
  { value: 'update', label: '3 · 更新预览' },
];
const NOTES = {
  forward: '条形长度表示概率（0 至 1）',
  gradient: '每行显示两个偏导数，不是标量系数',
  update: '预览下一次更新；左侧是当前参数',
};

const format = (value) => value.toFixed(3);
const pair = (values) => `(${values.map(format).join(', ')})`;
const vector = (values) => String.raw`\left(${values.map(format).join(',\;')}\right)^{\!\top}`;

function initial() {
  const random = mulberry32(7);
  const V = Float64Array.from({ length: COUNT * DIMENSION }, () => (random() - 0.5) * 2);
  const U = Float64Array.from({ length: COUNT * DIMENSION }, () => (random() - 0.5) * 2);
  return { V, U };
}

function Cell(props) {
  return (
    <span class="w2v-step-cell" style={{ '--w2v-strength': Math.min(0.24, Math.abs(props.value) * 0.18), '--w2v-tone': props.value < 0 ? 'var(--w2v-center)' : 'var(--w2v-context)' }}>
      {format(props.value)}
    </span>
  );
}

export default function W2vStep(props) {
  const [center, setCenter] = createSignal(0);
  const [context, setContext] = createSignal(0);
  const [rate, setRate] = createSignal(0.5);
  const [selected, setSelected] = createSignal(0);
  createComputed(() => setCenter(SENTENCE.indexOf(props.center)));
  createComputed(() => {
    setContext(SENTENCE.indexOf(props.context));
    setSelected(SENTENCE.indexOf(props.context));
  });
  createComputed(() => setRate(props.rate));
  const [mode, setMode] = createSignal('forward');
  const [weights, setWeights] = createSignal(initial());
  const [message, setMessage] = createSignal('');

  const row = (matrix, word) => Array.from(matrix.slice(word * DIMENSION, word * DIMENSION + DIMENSION));
  const state = createMemo(() => {
    const { V, U } = weights();
    const c = center();
    const o = context();
    const centerVector = row(V, c);
    const probabilities = softmaxDistribution(V, U, COUNT, DIMENSION, c);
    const coefficients = Array.from(probabilities, (value, word) => value - (word === o ? 1 : 0));
    const parts = SENTENCE.map((_, word) => row(U, word).map((value) => value * coefficients[word]));
    const centerGradient = [0, 1].map((k) => parts.reduce((sum, part) => sum + part[k], 0));
    const contextGradients = SENTENCE.map((_, word) => centerVector.map((value) => value * coefficients[word]));
    return { V, U, c, o, centerVector, probabilities, coefficients, parts, centerGradient, contextGradients };
  });

  const chooseCenter = (word) => {
    setCenter(word);
    setMessage('');
  };
  const chooseContext = (word) => {
    setContext(word);
    setSelected(word);
    setMessage('');
  };
  const step = () => {
    const { V, U } = weights();
    const nextV = V.slice();
    const nextU = U.slice();
    const before = state().probabilities[context()];
    stepSoftmax(nextV, nextU, COUNT, DIMENSION, center(), context(), rate());
    const after = softmaxDistribution(nextV, nextU, COUNT, DIMENSION, center())[context()];
    setWeights({ V: nextV, U: nextU });
    setMessage(`已更新：目标词概率从 ${format(before)} 变为 ${format(after)}。`);
  };
  const reset = () => {
    setWeights(initial());
    setMessage('');
  };

  const resultValues = (word) => {
    const { U, contextGradients } = state();
    if (mode() === 'gradient') return contextGradients[word];
    return row(U, word).map((value, k) => value - rate() * contextGradients[word][k]);
  };

  const detail = createMemo(() => {
    const { U, c, o, centerVector, probabilities, coefficients, parts, centerGradient, contextGradients } = state();
    const word = selected();
    const output = row(U, word);
    const score = output.reduce((sum, value, k) => sum + value * centerVector[k], 0);
    const total = SENTENCE.reduce((sum, _, j) => sum + Math.exp(row(U, j).reduce((dot, value, k) => dot + value * centerVector[k], 0)), 0);
    const learning = rate().toFixed(2);
    return {
      word: SENTENCE[word],
      center: SENTENCE[c],
      learning,
      product: String.raw`s_w = (${format(output[0])})\times(${format(centerVector[0])})`,
      productRest: String.raw`+\, (${format(output[1])})\times(${format(centerVector[1])})`,
      score: `= ${format(score)}`,
      probability: String.raw`p_w = \frac{e^{${format(score)}}}{${format(total)}} = ${format(probabilities[word])}`,
      coefficient: `p_w-y_w=${format(probabilities[word])}-${word === o ? 1 : 0}=${format(coefficients[word])}`,
      contextGradient: String.raw`\frac{\partial\ell}{\partial u_w} = ${format(coefficients[word])}\times ${vector(centerVector)}`,
      contextGradientValue: `= ${vector(contextGradients[word])}`,
      contribution: String.raw`${format(coefficients[word])}\times ${vector(output)}`,
      contributionValue: `= ${vector(parts[word])}`,
      centerGradientValue: `= ${vector(centerGradient)}`,
      rate: String.raw`\eta = ${learning}`,
      contextUpdate: String.raw`u_{\mathrm{${SENTENCE[word]}}}^{\mathrm{new}} = ${vector(output)} - ${learning}\times ${vector(contextGradients[word])}`,
      contextUpdateValue: `= ${vector(output.map((value, k) => value - rate() * contextGradients[word][k]))}`,
      centerUpdate: String.raw`v_{\mathrm{${SENTENCE[c]}}}^{\mathrm{new}} = ${vector(centerVector)} - ${learning}\times ${vector(centerGradient)}`,
      centerUpdateValue: `= ${vector(centerVector.map((value, k) => value - rate() * centerGradient[k]))}`,
    };
  });

  const matrix = (name, values, active, onChoose, label) => (
    <For each={SENTENCE}>
      {(word, index) => (
        <button type="button" class="w2v-step-row" classList={{ 'w2v-step-selected': active() === index() }} aria-pressed={active() === index()} aria-label={`${label} ${word}`} onClick={() => onChoose(index())}>
          <span>
            {word}
            <small>{name === 'v' && index() === center() ? ' c' : name === 'u' && index() === context() ? ' o' : ''}</small>
          </span>
          <For each={row(values(), index())}>{(value) => <Cell value={value} />}</For>
        </button>
      )}
    </For>
  );

  return (
    <div class="w2v-root w2v-step">
      <Controls>
        <label class="w2v-step-select">
          <span>
            中心词 <Tex tex="c" />
          </span>
          <select value={center()} onChange={(event) => chooseCenter(Number(event.currentTarget.value))}>
            <For each={SENTENCE}>{(word, index) => <option value={index()} selected={index() === center()}>{word}</option>}</For>
          </select>
        </label>
        <label class="w2v-step-select">
          <span>
            上下文词 <Tex tex="o" />
          </span>
          <select value={context()} onChange={(event) => chooseContext(Number(event.currentTarget.value))}>
            <For each={SENTENCE}>{(word, index) => <option value={index()} selected={index() === context()}>{word}</option>}</For>
          </select>
        </label>
        <Slider label={<>学习率 <Tex tex="\eta" /></>} min={0.05} max={1} step={0.05} value={rate()} onInput={setRate} format={(value) => value.toFixed(2)} />
        <Button onClick={step}>执行一步更新</Button>
        <Button onClick={reset}>重置参数</Button>
      </Controls>
      <div class="w2v-step-modes">
        <Segmented label="计算步骤" options={MODES} value={mode()} onChange={setMode} />
      </div>
      <div class="w2v-step-flow">
        <section>
          <h4>
            <Tex tex="\mathbf{V}" />{' '}
            <small>
              <Tex tex="8\times 2" /> · 输入向量
            </small>
          </h4>
          <div>{matrix('v', () => state().V, center, chooseCenter, '选择中心词')}</div>
          <p class="w2v-step-note">标记 c 的行参与本次计算</p>
        </section>
        <section>
          <h4>
            <Tex tex="\mathbf{U}" />{' '}
            <small>
              <Tex tex="8\times 2" /> · 输出向量
            </small>
          </h4>
          <div>{matrix('u', () => state().U, selected, setSelected, '查看输出词')}</div>
          <p class="w2v-step-note">全部行参与计算；点击一行查看</p>
        </section>
        <section>
          <h4>
            <Show when={mode() === 'forward'}>
              <Tex tex="\mathbf{U}v_c \xrightarrow{\operatorname{softmax}} p" />
            </Show>
            <Show when={mode() === 'gradient'}>
              <Tex tex="\nabla_{\mathbf{U}}\ell" /> <small>· 完整梯度</small>
            </Show>
            <Show when={mode() === 'update'}>
              <Tex tex="\mathbf{U}-\eta\nabla_{\mathbf{U}}\ell" /> <small>· 更新后</small>
            </Show>
          </h4>
          <div class="w2v-step-result">
            <For each={SENTENCE}>
              {(word, index) => (
                <button type="button" class="w2v-step-output" classList={{ 'w2v-step-selected': selected() === index() }} aria-pressed={selected() === index()} onClick={() => setSelected(index())}>
                  <span>
                    {word}
                    {index() === context() ? ' · o' : ''}
                  </span>
                  <Show when={mode() === 'forward'} fallback={<span class="w2v-step-pair">{pair(resultValues(index()))}</span>}>
                    <span class="w2v-step-probability">
                      <i style={{ width: `${state().probabilities[index()] * 100}%` }} />
                      <b>{format(state().probabilities[index()])}</b>
                    </span>
                  </Show>
                </button>
              )}
            </For>
          </div>
          <p class="w2v-step-note">{NOTES[mode()]}</p>
        </section>
      </div>
      <div class="w2v-step-detail" aria-live="polite">
        <Show when={mode() === 'forward'}>
          <strong>{detail().word}：点积 → 概率</strong>
          <div>
            <Tex tex={detail().product} />
          </div>
          <div class="w2v-step-continued">
            <Tex tex={detail().productRest} />
          </div>
          <div class="w2v-step-continued">
            <Tex tex={detail().score} />
          </div>
          <div>
            <Tex tex={detail().probability} />{' '}
            <span class="w2v-step-note">
              （分母为全部 8 个 <Tex tex="e^{s_j}" /> 之和）
            </span>
          </div>
        </Show>
        <Show when={mode() === 'gradient'}>
          <strong>
            {detail().word}：系数 <Tex tex={detail().coefficient} />
          </strong>
          <div>
            <Tex tex={detail().contextGradient} />
          </div>
          <div class="w2v-step-continued">
            <Tex tex={detail().contextGradientValue} />
          </div>
          <div>
            对 <Tex tex="\frac{\partial\ell}{\partial v_c}" /> 的贡献：<Tex tex={detail().contribution} />
          </div>
          <div class="w2v-step-continued">
            <Tex tex={detail().contributionValue} />
          </div>
          <div>
            <Tex tex="\frac{\partial\ell}{\partial v_c} = \sum_{w=1}^{8}(p_w-y_w)u_w" />
          </div>
          <div class="w2v-step-continued">
            <Tex tex={detail().centerGradientValue} />
          </div>
        </Show>
        <Show when={mode() === 'update'}>
          <strong>
            下一次更新 · <Tex tex={detail().rate} />
          </strong>
          <div>
            <Tex tex={detail().contextUpdate} />
          </div>
          <div class="w2v-step-continued">
            <Tex tex={detail().contextUpdateValue} />
          </div>
          <div>
            <Tex tex={detail().centerUpdate} />
          </div>
          <div class="w2v-step-continued">
            <Tex tex={detail().centerUpdateValue} />
          </div>
          <div class="w2v-step-note">V 的其他 7 行保持不变；U 的全部 8 行按各自梯度更新。</div>
        </Show>
      </div>
      <p class="w2v-step-status" aria-live="polite">
        {message()}当前 <Tex tex={String.raw`\ell = -\log P(\mathrm{${SENTENCE[context()]}}\mid\mathrm{${SENTENCE[center()]}}) = ${(-Math.log(state().probabilities[context()])).toFixed(3)}`} />。
      </p>
    </div>
  );
}
