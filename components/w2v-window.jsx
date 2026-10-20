import { createComputed, createMemo, createSignal, For, Show } from 'solid-js';
import { Controls, Slider, Tex } from 'bake/kit';
import { SENTENCE } from './lib/w2v-model.js';
import './lib/w2v-colors.css';
import './lib/w2v-window.css';

export const params = {
  t: { label: '中心词位置 t', type: 'number', min: 1, max: SENTENCE.length, step: 1, default: 4 },
  m: { label: '窗口大小 m', type: 'number', min: 1, max: 3, step: 1, default: 2 },
};

export const layout = {
  width: 'body',
  height: 380,
  narrowHeight: 360,
  autoHeight: true,
};

const WIDTH = 720;
const GAP = 8;
const PADDING = 10;
const ROW = 150;
const BOX = 34;
const WIDTHS = SENTENCE.map((word) => Math.max(52, word.length * 8.4 + 22));
const TOTAL = WIDTHS.reduce((sum, width) => sum + width, 0) + GAP * (SENTENCE.length - 1);
const SCALE = Math.min(1, (WIDTH - 2 * PADDING) / TOTAL);
const LEFTS = WIDTHS.reduce((lefts, width, index) => [...lefts, index === 0 ? PADDING + (WIDTH - 2 * PADDING - TOTAL * SCALE) / 2 : lefts[index - 1] + WIDTHS[index - 1] * SCALE + GAP], []);
const middle = (index) => LEFTS[index] + (WIDTHS[index] * SCALE) / 2;
const right = (index) => LEFTS[index] + WIDTHS[index] * SCALE;
const BRACE = ROW + BOX + 26;

function totalPairs(m) {
  let count = 0;
  for (let t = 0; t < SENTENCE.length; t++) count += Math.min(t, m) + Math.min(SENTENCE.length - 1 - t, m);
  return count;
}

export default function W2vWindow(props) {
  const [t, setT] = createSignal();
  const [m, setM] = createSignal();
  createComputed(() => setT(props.t));
  createComputed(() => setM(props.m));
  const center = () => t() - 1;
  const low = () => Math.max(0, center() - m());
  const high = () => Math.min(SENTENCE.length - 1, center() + m());
  const contexts = createMemo(() => {
    const indices = [];
    for (let index = low(); index <= high(); index++) if (index !== center()) indices.push(index);
    return indices;
  });
  const arc = (index) => {
    const offset = index - center();
    const height = 34 + Math.abs(offset) * 30;
    const x0 = middle(center());
    const x1 = middle(index);
    const y0 = ROW - 2;
    return { offset, height, x0, x1, y0, d: `M${x0},${y0} Q${(x0 + x1) / 2},${y0 - height * 1.6} ${x1},${y0}` };
  };
  const status = () => {
    const count = contexts().length;
    return `位置 t = ${t()} 产生 ${count} 个样本${count < 2 * m() ? '（窗口在语料边界被截断）' : ''}；这句话共 ${SENTENCE.length} 个位置，m = ${m()} 时一共产生 ${totalPairs(m())} 个样本，上限 2mT = ${2 * m() * SENTENCE.length}。`;
  };
  const choose = (index) => setT(index + 1);
  const brace = (from, to, kind, text) => {
    const x0 = () => LEFTS[from()];
    const x1 = () => right(to());
    return (
      <>
        <path class="w2v-window-brace" d={`M${x0()},${BRACE} v6 H${x1()} v-6`} />
        <text class={`w2v-window-caption ${kind}`} x={(x0() + x1()) / 2} y={BRACE + 24} text-anchor="middle">
          {text()}
        </text>
      </>
    );
  };

  return (
    <div class="w2v-root w2v-window">
      <Controls>
        <Slider label={<>中心词位置 <Tex tex="t" /></>} min={1} max={SENTENCE.length} step={1} value={t()} onInput={setT} format={String} />
        <Slider label={<>窗口大小 <Tex tex="m" /></>} min={1} max={3} step={1} value={m()} onInput={setM} format={String} />
      </Controls>
      <div class="w2v-window-plot">
        <svg viewBox={`0 0 ${WIDTH} 250`} role="img" aria-label="滑动窗口示意图">
          <defs>
            <marker id="w2v-window-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--w2v-context)" />
            </marker>
          </defs>
          <For each={contexts()}>
            {(index) => {
              const shape = () => arc(index);
              return (
                <>
                  <path class="w2v-window-arc" d={shape().d} marker-end="url(#w2v-window-arrow)" />
                  <text
                    class="w2v-window-label"
                    x={(shape().x0 + shape().x1) / 2 + (shape().offset < 0 ? 6 : -6)}
                    y={shape().y0 - shape().height * 0.8 - 4}
                    text-anchor={shape().offset < 0 ? 'end' : 'start'}
                  >
                    <tspan>P(w</tspan>
                    <tspan dy="4" font-size="9px">
                      {shape().offset < 0 ? `t−${-shape().offset}` : `t+${shape().offset}`}
                    </tspan>
                    <tspan dy="-4"> | w</tspan>
                    <tspan dy="4" font-size="9px">
                      t
                    </tspan>
                    <tspan dy="-4">)</tspan>
                  </text>
                </>
              );
            }}
          </For>
          <For each={SENTENCE}>
            {(word, index) => (
              <g
                class="w2v-window-token"
                classList={{ 'w2v-window-center': index() === center(), 'w2v-window-context': index() !== center() && index() >= low() && index() <= high() }}
                tabindex="0"
                role="button"
                aria-label={`把 ${word} 设为中心词`}
                onClick={() => choose(index())}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  choose(index());
                }}
              >
                <rect x={LEFTS[index()]} y={ROW} width={WIDTHS[index()] * SCALE} height={BOX} rx="4" />
                <text x={middle(index())} y={ROW + BOX / 2 + 5} text-anchor="middle">
                  {word}
                </text>
                <text class="w2v-window-index" x={middle(index())} y={ROW + BOX + 16} text-anchor="middle">
                  {index() + 1}
                </text>
              </g>
            )}
          </For>
          <Show when={low() < center()}>{brace(low, () => center() - 1, '', () => `左侧上下文，${center() - low()} 个`)}</Show>
          {brace(center, center, 'w2v-window-caption-center', () => `中心词 w_t，t = ${t()}`)}
          <Show when={high() > center()}>{brace(() => center() + 1, high, '', () => `右侧上下文，${high() - center()} 个`)}</Show>
        </svg>
      </div>
      <div class="w2v-window-pairs" aria-live="polite">
        <For each={contexts()}>
          {(index) => (
            <span>
              (<b>{SENTENCE[center()]}</b>, <i>{SENTENCE[index]}</i>)
            </span>
          )}
        </For>
      </div>
      <p class="w2v-window-status">{status()}</p>
    </div>
  );
}
