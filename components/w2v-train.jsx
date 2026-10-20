import { createComputed, createSignal, createUniqueId, For, on, onCleanup, Show } from 'solid-js';
import { Button, Controls, prefersReducedMotion, Segmented, Toggle } from 'bake/kit';
import { mulberry32, sigmoid, stepSoftmax } from './lib/w2v-model.js';
import './lib/w2v-colors.css';
import './lib/w2v-train.css';

export const params = {
  objective: { label: '目标函数', type: 'enum', options: ['softmax', 'negative'], default: 'softmax' },
  shared: { label: '共享 U = V', type: 'boolean', default: false },
  showContext: { label: '同时显示 U', type: 'boolean', default: false },
};

export const layout = {
  width: 'body',
  height: 666,
  narrowHeight: 560,
};

const GROUPS = [
  { name: '主语', color: 'var(--series-7)', words: ['i', 'you', 'we', 'they', 'he', 'she'] },
  { name: '吃', color: 'var(--series-8)', words: ['eat', 'ate', 'eats'] },
  { name: '喝', color: 'var(--series-1)', words: ['drink', 'drank', 'drinks'] },
  { name: '食物', color: 'var(--series-4)', words: ['bread', 'rice', 'apple', 'cake', 'soup'] },
  { name: '饮料', color: 'var(--series-3)', words: ['tea', 'coffee', 'water', 'milk', 'juice'] },
];
const OBJECTIVES = [
  { value: 'softmax', label: '完整 softmax' },
  { value: 'negative', label: '负采样，k = 10' },
];
const VOCABULARY = GROUPS.flatMap((group) => group.words);
const COUNT = VOCABULARY.length;
const DIMENSION = 2;
const NEGATIVES = 10;
const INDEX = Object.fromEntries(VOCABULARY.map((word, index) => [word, index]));
const COLORS = VOCABULARY.map((word) => GROUPS.find((group) => group.words.includes(word)).color);
const WIDTH = 640;
const HEIGHT = 400;
const UNIT = 32;
const EPOCH_INTERVAL = 1000 / 3;
const MOTION = 300;
const sx = (x) => WIDTH / 2 + x * UNIT;
const sy = (y) => HEIGHT / 2 - (y + 1) * UNIT;
const X_TICKS = [-8, -6, -4, -2, 0, 2, 4, 6, 8];
const Y_TICKS = [-6, -4, -2, 2, 4];

const pick = (random, words) => words[Math.floor(random() * words.length)];
const SENTENCES = (() => {
  const random = mulberry32(11);
  const sentences = [];
  for (let index = 0; index < 300; index++) {
    const eat = random() < 0.5;
    sentences.push([INDEX[pick(random, GROUPS[0].words)], INDEX[pick(random, eat ? GROUPS[1].words : GROUPS[2].words)], INDEX[pick(random, eat ? GROUPS[3].words : GROUPS[4].words)]]);
  }
  return sentences;
})();
const CUMULATIVE = (() => {
  const counts = new Float64Array(COUNT);
  for (const word of SENTENCES.flat()) counts[word]++;
  const weights = Array.from(counts, (count) => count ** 0.75);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let sum = 0;
  return weights.map((weight) => (sum += weight / total));
})();

function sampleNegative(random) {
  const target = random();
  let low = 0;
  let high = COUNT - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (CUMULATIVE[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function stepNegative(V, U, center, context, rate, random) {
  let loss = 0;
  const centerGradient = new Float64Array(DIMENSION);
  const centerVector = Array.from(V.subarray(center * DIMENSION, center * DIMENSION + DIMENSION));
  for (let sample = 0; sample <= NEGATIVES; sample++) {
    let word = context;
    let label = 1;
    if (sample > 0) {
      word = sampleNegative(random);
      if (word === context) continue;
      label = 0;
    }
    let score = 0;
    for (let k = 0; k < DIMENSION; k++) score += U[word * DIMENSION + k] * centerVector[k];
    const probability = sigmoid(score);
    loss += label ? -Math.log(probability + 1e-12) : -Math.log(1 - probability + 1e-12);
    const coefficient = probability - label;
    for (let k = 0; k < DIMENSION; k++) {
      centerGradient[k] += coefficient * U[word * DIMENSION + k];
      U[word * DIMENSION + k] -= rate * coefficient * centerVector[k];
    }
  }
  for (let k = 0; k < DIMENSION; k++) V[center * DIMENSION + k] -= rate * centerGradient[k];
  return loss;
}

function points(V, U, shared) {
  const point = (matrix, word) => ({ x: sx(matrix[word * DIMENSION]), y: sy(matrix[word * DIMENSION + 1]) });
  return { center: VOCABULARY.map((_, word) => point(V, word)), context: shared ? [] : VOCABULARY.map((_, word) => point(U, word)) };
}

export default function W2vTrain(props) {
  const [objective, setObjective] = createSignal('softmax');
  const [shared, setShared] = createSignal(false);
  const [showContext, setShowContext] = createSignal(false);
  const [epoch, setEpoch] = createSignal(0);
  const [loss, setLoss] = createSignal(NaN);
  const [running, setRunning] = createSignal(false);
  const [view, setView] = createSignal({ center: [], context: [] });
  const [distances, setDistances] = createSignal(['', '', '']);

  let V;
  let U;
  let random;
  let history = [];
  let timer = null;
  let lastTick = null;
  let motion = null;

  const epochs = () => (objective() === 'softmax' ? 60 : 150);
  const firstRate = () => (objective() === 'softmax' ? 0.05 : 0.1);

  const remember = () => {
    history[epoch()] = { V: V.slice(), U: shared() ? null : U.slice(), random: random.state(), loss: loss() };
  };
  const restore = (target) => {
    const saved = history[target];
    V = saved.V.slice();
    U = shared() ? V : saved.U.slice();
    random = mulberry32(saved.random);
    setEpoch(target);
    setLoss(saved.loss);
  };
  const distance = (a, b) => Math.hypot(V[INDEX[a] * DIMENSION] - V[INDEX[b] * DIMENSION], V[INDEX[a] * DIMENSION + 1] - V[INDEX[b] * DIMENSION + 1]).toFixed(2);

  const draw = (animate = false) => {
    if (motion !== null) cancelAnimationFrame(motion);
    motion = null;
    const target = points(V, U, shared());
    setDistances([distance('eat', 'bread'), distance('eat', 'drink'), distance('bread', 'rice')]);
    const before = view();
    if (!animate || prefersReducedMotion() || before.center.length !== target.center.length || before.context.length !== target.context.length) {
      setView(target);
      return;
    }
    const mix = (from, to, fraction) => from.map((point, index) => ({ x: point.x + (to[index].x - point.x) * fraction, y: point.y + (to[index].y - point.y) * fraction }));
    const started = performance.now();
    const move = (now) => {
      const progress = Math.min(1, (now - started) / MOTION);
      const fraction = progress * progress * (3 - 2 * progress);
      setView({ center: mix(before.center, target.center, fraction), context: mix(before.context, target.context, fraction) });
      motion = progress < 1 ? requestAnimationFrame(move) : null;
    };
    motion = requestAnimationFrame(move);
  };

  const runEpoch = () => {
    const rate = firstRate() * (1 - epoch() / epochs()) + 0.0005;
    let total = 0;
    let count = 0;
    for (const sentence of SENTENCES) {
      for (let position = 0; position < sentence.length; position++) {
        for (const offset of [-1, 1]) {
          const other = position + offset;
          if (other < 0 || other >= sentence.length) continue;
          total += objective() === 'softmax' ? stepSoftmax(V, U, COUNT, DIMENSION, sentence[position], sentence[other], rate) : stepNegative(V, U, sentence[position], sentence[other], rate, random);
          count++;
        }
      }
    }
    setEpoch(epoch() + 1);
    setLoss(total / count);
    remember();
  };

  const stop = () => {
    if (timer !== null) cancelAnimationFrame(timer);
    timer = null;
    lastTick = null;
    setRunning(false);
  };
  const tick = (now) => {
    if (lastTick === null) lastTick = now;
    if (now - lastTick >= EPOCH_INTERVAL) {
      runEpoch();
      draw(true);
      lastTick += EPOCH_INTERVAL;
      if (now - lastTick >= EPOCH_INTERVAL) lastTick = now;
      if (epoch() >= epochs()) return stop();
    }
    timer = requestAnimationFrame(tick);
  };
  const start = () => {
    if (epoch() >= epochs()) return;
    lastTick = null;
    setRunning(true);
    timer = requestAnimationFrame(tick);
  };
  const reset = () => {
    stop();
    random = mulberry32(1);
    V = new Float64Array(COUNT * DIMENSION);
    for (let index = 0; index < COUNT * DIMENSION; index++) V[index] = (random() - 0.5) / DIMENSION;
    U = shared() ? V : new Float64Array(COUNT * DIMENSION);
    history = [];
    setEpoch(0);
    setLoss(NaN);
    remember();
    draw();
  };
  const seek = (target) => {
    if (timer !== null) return;
    const goal = Math.max(0, Math.min(epochs(), Math.round(target)));
    if (history[goal]) restore(goal);
    else {
      restore(history.length - 1);
      while (epoch() < goal) runEpoch();
    }
    draw();
  };
  const runOne = () => {
    stop();
    if (epoch() < epochs()) {
      runEpoch();
      draw(true);
    }
  };

  createComputed(() => setObjective(props.objective));
  createComputed(() => setShared(props.shared));
  createComputed(() => setShowContext(props.showContext));
  createComputed(on([objective, shared], () => reset()));
  onCleanup(() => {
    stop();
    if (motion !== null) cancelAnimationFrame(motion);
  });

  const progressId = `w2v-train-progress-${createUniqueId()}`;
  const progress = () => `${(epoch() / epochs()) * 100}%`;
  const status = () =>
    `${Number.isNaN(loss()) ? '' : `平均 loss ${loss().toFixed(3)}，`}${objective() === 'softmax' ? '完整 softmax' : '负采样 k = 10'}${shared() ? '，共享 U = V' : ''}。输入词向量之间的欧氏距离：eat–bread ${distances()[0]}，eat–drink ${distances()[1]}，bread–rice ${distances()[2]}。`;

  return (
    <div class="w2v-root w2v-train">
      <Controls>
        <Segmented label="目标函数" options={OBJECTIVES} value={objective()} onChange={setObjective} />
        <Toggle label="共享 U = V" checked={shared()} onChange={setShared} />
        <Toggle label="同时显示 U" checked={showContext()} onChange={setShowContext} />
        <Button onClick={() => (running() ? stop() : start())}>{running() ? '暂停' : '开始'}</Button>
        <Button onClick={runOne}>跑 1 个 epoch</Button>
        <Button onClick={reset}>重置</Button>
      </Controls>
      <div class="w2v-train-legend">
        <For each={GROUPS}>
          {(group) => (
            <span>
              <i style={{ background: group.color }} />
              {group.name}
            </span>
          )}
        </For>
        <span>
          <i class="w2v-train-legend-context" />U 的行（勾选后显示）
        </span>
      </div>
      <div class="w2v-train-plot">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="词向量在二维平面上的位置">
          <rect class="w2v-train-background" width={WIDTH} height={HEIGHT} rx="6" />
          <line class="w2v-train-axis" x1={sx(-8)} y1={sy(0)} x2={sx(8)} y2={sy(0)} />
          <line class="w2v-train-axis" x1={sx(0)} y1={sy(-6)} x2={sx(0)} y2={sy(4)} />
          <For each={X_TICKS}>
            {(x) => (
              <>
                <line class="w2v-train-axis" x1={sx(x)} y1={sy(0) - 3} x2={sx(x)} y2={sy(0) + 3} />
                <text class="w2v-train-label" x={sx(x)} y={sy(0) + 16} text-anchor="middle">
                  {x}
                </text>
              </>
            )}
          </For>
          <For each={Y_TICKS}>
            {(y) => (
              <>
                <line class="w2v-train-axis" x1={sx(0) - 3} y1={sy(y)} x2={sx(0) + 3} y2={sy(y)} />
                <text class="w2v-train-label" x={sx(0) - 7} y={sy(y) + 4} text-anchor="end">
                  {y}
                </text>
              </>
            )}
          </For>
          <Show when={showContext() && !shared()}>
            <For each={VOCABULARY}>
              {(word, index) => (
                <Show when={view().context[index()]}>
                  {(point) => (
                    <>
                      <circle class="w2v-train-context" cx={point().x} cy={point().y} r="4.5" stroke={COLORS[index()]} />
                      <text class="w2v-train-label w2v-train-label-context" x={point().x + 7} y={point().y + 3.5}>
                        {word}
                      </text>
                    </>
                  )}
                </Show>
              )}
            </For>
          </Show>
          <For each={VOCABULARY}>
            {(word, index) => (
              <Show when={view().center[index()]}>
                {(point) => (
                  <>
                    <circle class="w2v-train-point" cx={point().x} cy={point().y} r="5" fill={COLORS[index()]} />
                    <text class="w2v-train-label" x={point().x + 7} y={point().y + 3.5}>
                      {word}
                    </text>
                  </>
                )}
              </Show>
            )}
          </For>
        </svg>
      </div>
      <div class="w2v-train-progress">
        <label for={progressId}>
          epoch {epoch()} / {epochs()}
        </label>
        <input
          id={progressId}
          type="range"
          min="0"
          max={epochs()}
          step="1"
          value={epoch()}
          disabled={running()}
          aria-valuetext={`epoch ${epoch()} / ${epochs()}`}
          style={{ '--w2v-progress': progress() }}
          onInput={(event) => seek(Number(event.currentTarget.value))}
        />
      </div>
      <p class="w2v-train-status">{status()}</p>
    </div>
  );
}
