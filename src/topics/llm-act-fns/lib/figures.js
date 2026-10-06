// 本页各曲线图的设置，在 index.mdx 里写成 <ActFnPlot {...figures.introNeg} />。
// 字段与 components/ActFnPlot.astro 的属性相同；标注的结构见 lib/guides.js。这个文件在构建时运行。
import { FN, C } from './fns.js';
import { band, point, ref } from './guides.js';

const shade = (a, b, label) => ({ ...band(a, b, null, label), shadeOnly: true });

/* 引言：四个要素的对照图 */
export const introNeg = {
  label: '负半轴远端', range: [-6, 2], yf: [-1.5, 2], yd: [-0.3, 1.2],
  fns: ['relu', 'silu', { fn: 'tanh', name: 'tanh' }],
  guides: {
    f: { bands: [shade(-6, -2, '负半轴远端')], references: [ref(-6, -2, 0, 'ReLU 严格为零；SiLU $\\to 0^-$', { labelX: -4 }), ref(-6, -2, -1, '$\\tanh\\to -1$', { labelX: -4, dy: 16, color: C(3) })], left: '当 $x\\to-\\infty$', right: '向原点方向' },
    d: { bands: [shade(-6, -2, '负半轴远端')], references: [ref(-6, -2, 0, 'ReLU 导数 $=0$；SiLU、tanh 导数 $\\to 0$', { labelX: -3.8 })], left: '当 $x\\to-\\infty$：导数 $\\to 0$', right: '向原点方向' },
  },
};

export const introZero = {
  label: '零点', range: [-2, 2], yf: [-0.5, 1.5], yd: [-0.2, 1.2],
  fns: ['relu', 'silu', { fn: 'sigmoid', key: 'sig' }],
  guides: {
    f: { verticals: [{ x: 0, label: '$x=0$' }], points: [point(0, 0, 'ReLU、SiLU：$f(0)=0$', { dy: 18 }), point(0, .5, 'Sigmoid：$f(0)=0.5$', { color: C(3) })], left: '向负半轴延伸', right: '向正半轴延伸' },
    d: { verticals: [{ x: 0, label: '' }], points: [point(0, 0, 'ReLU：左极限 $0$', { open: true, color: C(1), dy: 18 }), point(0, 1, 'ReLU：右极限 $1$，原点不可导', { open: true, color: C(1) }), point(0, .5, 'SiLU：$\\frac{df}{dx}(0)=0.5$', { color: C(2) }), point(0, .25, 'Sigmoid：$\\frac{df}{dx}(0)=0.25$', { color: C(3), dy: 14 })], left: '向负半轴延伸', right: '向正半轴延伸' },
  },
};

export const introTrans = {
  label: '过渡区', range: [-4, 4], yf: [-1, 3], yd: [-0.4, 1.6],
  fns: ['relu', 'gelu', { fn: 'sigmoid', key: 'sig' }],
  guides: {
    f: { bands: [band(-2, 2, C(2), 'GELU 主要变化范围 $\\approx[-2,2]$', 1)], verticals: [{ x: 0, label: 'ReLU：过渡集中在 $x=0$' }], points: [point(-.7518, FN.gelu.f(-.7518), 'GELU 最低点 $\\approx(-0.75,\\ -0.17)$', { color: C(2), dx: -118, dy: 22 })], left: '当 $x\\to-\\infty$', right: '当 $x\\to+\\infty$' },
    d: { bands: [band(-2, 2, C(2), 'GELU 主要变化范围 $\\approx[-2,2]$', 1)], verticals: [{ x: 0, label: 'ReLU：导数在 $x=0$ 跳变' }], points: [point(-Math.SQRT2, FN.gelu.d(-Math.SQRT2), 'GELU 导数最小 $\\approx -0.129$', { color: C(2), dx: -64, dy: 18 }), point(Math.SQRT2, FN.gelu.d(Math.SQRT2), 'GELU 导数最大 $\\approx 1.129$', { color: C(2), dx: -30, dy: -10 })], left: '当 $x\\to-\\infty$', right: '当 $x\\to+\\infty$' },
  },
};

export const introPos = {
  label: '正半轴远端', range: [-2, 6], yf: [-1, 7], yd: [-0.3, 3],
  fns: [{ fn: 'silu', color: 1 }, { fn: 'tanh', name: 'tanh', color: 3 }, { fn: 'relu2', color: 2 }],
  guides: {
    f: { bands: [shade(2, 6, '正半轴远端')], references: [ref(2, 6, 1, '$\\tanh\\to 1$：有上界', { color: C(3), labelX: 4 }), ref(0, 6, 0, 'SiLU $\\approx x$：线性增长', { endY: 6, labelX: 4.4, labelY: 3.0, dy: 24, color: C(1) })], points: [point(2, 4, '$\\mathrm{ReLU}^2$：$x=2$ 时输出 $4$', { color: C(2), dx: -126, dy: -8 })], left: '向原点方向', right: '当 $x\\to+\\infty$' },
    d: { bands: [shade(2, 6, '正半轴远端')], references: [ref(2, 6, 1, 'SiLU 导数 $\\to 1$', { color: C(1), labelX: 4 }), ref(2, 6, 0, 'tanh 导数 $\\to 0$', { color: C(3), labelX: 4, dy: 16 })], points: [point(1, 2, '$\\mathrm{ReLU}^2$：导数 $=2x$，无上界', { color: C(2), dx: 8, dy: -8 })], left: '向原点方向', right: '当 $x\\to+\\infty$' },
  },
};

/* 总览 */
export const all = {
  label: '总览', range: [-4, 4], yf: [-1, 4], yd: [-0.5, 2.5], toggle: true,
  fns: [
    { fn: 'relu', color: 1 }, { fn: 'relu2', color: 2 }, { fn: 'gelu', color: 3 }, { fn: 'silu', color: 4 },
    { fn: 'softplus', color: 6, on: false }, { fn: 'sigmoid', color: 7, on: false }, { fn: 'tanh', color: 8, on: false },
  ],
};

export const logistic = {
  label: 'Logistic sigmoid', range: [-6, 6], yf: [-0.05, 1.05], yd: [-0.02, 0.45], guides: 'auto',
  fns: [{ fn: 'sigmoid', key: 'logistic', name: 'Logistic $\\sigma(x)$' }],
};

export const normalCdf = {
  label: '标准正态累积分布 Φ(x)', range: [-6, 6], yf: [-0.05, 1.05], yd: [-0.02, 0.45], guides: 'auto',
  fns: [{ fn: 'normalCdf', key: 'normal-cdf', color: 3 }],
};

/* Sigmoid 与 Tanh */
const sigBands = [{ a: -Math.log(9), b: Math.log(9), label: 'Sigmoid 10–90% · 宽 4.39', color: C(1) }, { a: -Math.log(9) / 2, b: Math.log(9) / 2, label: 'Tanh 10–90% · 宽 2.20', color: C(2) }];
export const sigTanh = {
  label: 'Sigmoid 与 Tanh', range: [-6, 6], yf: [-1.2, 1.2], yd: [-0.1, 1.1],
  fns: [{ fn: 'sigmoid', key: 'sig' }, 'tanh'],
  guides: {
    f: { references: [{ a: -6, b: 0, labelX: -4.4, y: 0, label: '$\\sigma\\to 0$', color: C(1) }, { a: -6, b: 0, labelX: -4.4, y: -1, label: '$\\tanh\\to -1$', color: C(2) }, { a: 0, b: 6, labelX: 4.4, y: 1, label: '饱和区 · $\\to 1$', dy: 16 }], left: '当 $x\\to-\\infty$：$\\sigma\\to 0$ / $\\tanh\\to -1$', right: '当 $x\\to+\\infty$：两者 $\\to 1$', bands: sigBands, points: [{ x: 0, y: .5, label: '$\\sigma(0)=0.5$', color: C(1) }, { x: 0, y: 0, label: '$\\tanh(0)=0$', dy: 18, color: C(2) }] },
    d: { references: [{ a: -6, b: 0, labelX: -4.4, y: 0, label: '饱和区 · 导数 $\\to 0$' }, { a: 0, b: 6, labelX: 4.4, y: 0, label: '饱和区 · 导数 $\\to 0$' }], left: '当 $x\\to-\\infty$：导数 $\\to 0^+$', right: '当 $x\\to+\\infty$：导数 $\\to 0^+$', bands: sigBands, points: [{ x: 0, y: .25, label: '$\\frac{d\\sigma}{dx}(0)=0.25$', color: C(1) }, { x: 0, y: 1, label: '$\\frac{d\\tanh}{dx}(0)=1$', dy: 16, color: C(2) }] },
  },
};

export const relu = { label: 'ReLU', range: [-4, 4], yf: [-1, 4], yd: [-0.2, 1.2], guides: 'auto', fns: ['relu'] };

/* GELU 与两种近似 */
const geluBands = [{ a: -2, b: 2, label: '主要过渡区 $\\approx[-2,2]$', color: C(1) }];
export const gelu = {
  label: 'GELU', zoom: { min: 0.25 }, range: [-4, 4], yf: [-1, 4], yd: [-0.3, 1.3],
  fns: [{ fn: 'gelu', name: 'GELU (erf)' }, { fn: 'geluTanh', key: 'gt', dash: true }, { fn: 'quickGelu', key: 'qg', dash: true }],
  guides: {
    f: { references: [], left: '当 $x\\to-\\infty$：输出 $\\to 0^-$', right: '当 $x\\to+\\infty$：输出 $\\approx x$', bands: geluBands, points: [{ x: -.7518, y: FN.gelu.f(-.7518), label: '最低点 $\\approx(-0.75,\\ -0.17)$', dx: -104, dy: 23 }, { x: 0, y: 0, label: '原点 $(0,0)$', dy: -14 }] },
    d: { references: [], left: '当 $x\\to-\\infty$：导数 $\\to 0^-$', right: '当 $x\\to+\\infty$：导数 $\\to 1$', bands: geluBands, points: [{ x: -Math.SQRT2, y: FN.gelu.d(-Math.SQRT2), label: '导数最小 $\\approx -0.129$', dx: -65, dy: 18 }, { x: 0, y: .5, label: '$x=0$，斜率 $0.5$' }, { x: Math.SQRT2, y: FN.gelu.d(Math.SQRT2), label: '导数最大 $\\approx 1.129$', dx: -20, dy: -10 }] },
  },
};

/* SiLU / Swish：β 可调 */
export const silu = {
  label: 'Swish', range: [-4, 4], yf: [-1, 4], yd: [-0.3, 1.3], guides: 'auto',
  fns: [{ fn: 'swish', key: 'sw' }, { fn: 'relu', name: 'ReLU（参考）', dash: true, faint: true }],
};

/* 限制 GLU 的输出：gate 分支的三种处理 */
export const cap = {
  label: 'gate 分支的三种处理', range: [-4, 12], yf: [-1, 12], yd: [-0.3, 1.5],
  fns: ['silu', { fn: 'gptoss', key: 'oss' }, 'situ'],
  guides: {
    f: { bands: [band(-Math.log(9), Math.log(9), C(1), '零附近的 gate 过渡')], verticals: [{ x: 7, label: '$g=7$：clamp' }], references: [ref(-4, 0, 0, '输出 $\\to 0$'), ref(0, 12, 4, 'SiTU $\\to 4$', { color: C(3), labelX: 10 }), ref(7, 12, FN.gptoss.f(7), 'clamp 后恒定 $\\approx 7$', { color: C(2), labelX: 9.5 }), ref(0, 12, 0, 'SiLU $\\approx g$', { endY: 12, labelX: 9, labelY: 9 })], points: [point(0, 0, '原点 $(0,0)$')] },
    d: { bands: [band(-Math.log(9), Math.log(9), C(1), '零附近的 gate 过渡')], verticals: [{ x: 7, label: '$g=7$：不可导' }], references: [ref(-4, 0, 0, '导数 $\\to 0$'), ref(0, 12, 1, 'SiLU $\\to 1$', { labelX: 10, dy: -12 }), ref(0, 12, 0, 'SiTU $\\to 0$', { color: C(3), labelX: 4, dy: 18 })], points: [point(7, 0, 'clamp 后斜率 $=0$', { open: true, dy: 18, color: C(2) }), point(7, FN.quickGelu.d(7), '', { open: true, color: C(2) }), point(0, .5, '原点斜率 $=0.5$')] },
  },
};

export const relu2 = {
  label: 'Squared ReLU', range: [-3, 3], yf: [-0.5, 6], yd: [-0.5, 6], guides: 'auto',
  fns: ['relu2', { fn: 'relu', dash: true, faint: true }],
};

export const softplus = {
  label: 'Softplus', range: [-5, 5], yf: [-0.5, 5], yd: [-0.1, 1.1], guides: 'auto',
  fns: [{ fn: 'softplus', key: 'sp' }, { fn: 'relu', dash: true, faint: true }],
};
