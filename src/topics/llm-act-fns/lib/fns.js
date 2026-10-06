// 激活函数的数值实现与登记表。不依赖 DOM：交互图在浏览器里用它画曲线，
// lib/figures.js 在构建时也用它计算图中标注点的坐标。

export const sig = x => x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
const tanh = Math.tanh;

/** 误差函数的 Abramowitz–Stegun 7.1.26 近似，绝对误差小于 1.5e-7。 */
export function erf(x){
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
/** 标准正态分布的累积分布函数 Φ(x) 与概率密度 p(x)。 */
export const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
export const phi = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
const softplus = x => x > 20 ? x : Math.log1p(Math.exp(x));
const K = Math.sqrt(2 / Math.PI);

/** 参数为 β 的 Swish：x·σ(βx) 及其导数。 */
export const swish = b => ({
  f: x => x * sig(b * x),
  d: x => { const s = sig(b * x); return s * (1 + b * x * (1 - s)); },
});

/** 每个函数的输出 f 与导数 d。导数在不可导点返回 NaN，悬停提示里显示为“不可导”。 */
export const FN = {
  sigmoid:   { f: sig, d: x => sig(x) * (1 - sig(x)) },
  tanh:      { f: tanh, d: x => 1 - tanh(x) ** 2 },
  relu:      { f: x => Math.max(0, x), d: x => x === 0 ? NaN : (x > 0 ? 1 : 0) },
  relu2:     { f: x => Math.max(0, x) ** 2, d: x => x > 0 ? 2 * x : 0 },
  gelu:      { f: x => x * Phi(x), d: x => Phi(x) + x * phi(x) },
  geluTanh:  { f: x => 0.5 * x * (1 + tanh(K * (x + 0.044715 * x ** 3))),
               d: x => { const t = tanh(K * (x + 0.044715 * x ** 3)); return 0.5 * (1 + t) + 0.5 * x * (1 - t * t) * K * (1 + 3 * 0.044715 * x * x); } },
  quickGelu: { f: x => x * sig(1.702 * x), d: x => { const s = sig(1.702 * x); return s * (1 + 1.702 * x * (1 - s)); } },
  silu:      { f: x => x * sig(x), d: x => { const s = sig(x); return s * (1 + x * (1 - s)); } },
  softplus:  { f: softplus, d: sig },
  normalCdf: { f: Phi, d: phi },
  situ:      { f: (x, b1 = 4) => b1 * tanh(x / b1) * sig(x),
               d: (x, b1 = 4) => { const t = tanh(x / b1), s = sig(x); return (1 - t * t) * s + b1 * t * s * (1 - s); } },
  gptoss:    { f: x => { const g = Math.min(x, 7); return g * sig(1.702 * g); },
               d: x => { if(x === 7) return NaN; if(x > 7) return 0; const s = sig(1.702 * x); return s * (1 + 1.702 * x * (1 - s)); } },
};

/**
 * 交互图可以使用的函数。字段：
 *   name    图例和悬停提示里的名字，$...$ 之间是公式
 *   tex     函数名的 TeX 写法，供热力图等需要写出 φ(g)·u 的图使用
 *   guide   单函数图的自动标注类型（见 lib/guides.js 的 curveGuides）
 *   dBreaks 导数在这些横坐标处间断，画导数曲线时在此断开，不画连接线
 *   param   可调参数：key 是状态里的名字，其余是滑块的设置
 *   status  有可调参数时，图下方状态行的文字（可以含公式）
 *   f, d    输出与导数；有可调参数时第二个参数是当前参数值
 */
export const REGISTRY = {
  relu:      { name: 'ReLU', tex: '\\mathrm{ReLU}', guide: 'relu', dBreaks: [0], ...FN.relu },
  relu2:     { name: '$\\mathrm{ReLU}^2$', tex: '\\mathrm{ReLU}^2', guide: 'relu2', ...FN.relu2 },
  gelu:      { name: 'GELU', tex: '\\mathrm{GELU}', guide: 'gelu', ...FN.gelu },
  geluTanh:  { name: 'GELU (tanh 近似)', tex: '\\mathrm{GELU}_{\\tanh}', ...FN.geluTanh },
  quickGelu: { name: 'GELU (quick 近似)', tex: '\\mathrm{GELU}_{\\text{quick}}', ...FN.quickGelu },
  silu:      { name: 'SiLU', tex: '\\mathrm{SiLU}', guide: 'silu', ...FN.silu },
  sigmoid:   { name: 'Sigmoid', tex: '\\sigma', guide: 'sigmoid', ...FN.sigmoid },
  tanh:      { name: 'Tanh', tex: '\\tanh', guide: 'tanh', ...FN.tanh },
  softplus:  { name: 'Softplus', tex: '\\mathrm{softplus}', guide: 'softplus', ...FN.softplus },
  normalCdf: { name: '$\\Phi(x)$', tex: '\\Phi', guide: 'normal', ...FN.normalCdf },
  situ:      { name: 'SiTU gate（$\\beta_1=4$）', tex: '\\mathrm{SiTU}', ...FN.situ },
  gptoss:    { name: 'gpt-oss gate', tex: '\\phi_{\\text{gpt-oss}}', dBreaks: [7], ...FN.gptoss },
  swish: {
    name: '$\\mathrm{Swish}_\\beta$', tex: '\\mathrm{Swish}_\\beta', guide: 'sw',
    param: { key: 'b', name: '$\\beta$', min: 0.1, max: 5, step: 0.05, value: 1 },
    f: (x, b) => swish(b).f(x),
    d: (x, b) => swish(b).d(x),
    status: b => {
      const w = Math.log(9) / b, xmin = -1.278465 / b;
      return 'gate 过渡区：$[' + (-w).toFixed(2) + ',\\ ' + w.toFixed(2) + ']$；宽 ' + (2 * w).toFixed(2)
        + (w > 4 ? '（色带超出当前视野）' : '')
        + (xmin < -4 ? '；最低点位于视野左侧，$x\\approx ' + xmin.toFixed(2) + '$' : '');
    },
  },
};

/** 由 token 序号得到分类色，例如 C(2) 是 var(--s2)。 */
export const C = n => `var(--s${n})`;
