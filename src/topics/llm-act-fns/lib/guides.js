// 曲线图的标注。一份标注 guides 的结构：
//   bands       色带 [{ a, b, color, label, index, shadeOnly }]：横轴区间 [a, b] 加底色；
//               shadeOnly 不为 true 时，第 index 条曲线在这一段加粗并可悬停查看 label
//   references  参考线 [{ a, b, y, endY, label, labelX, labelY, dy, color }]：从 (a, y) 到 (b, endY ?? y) 的点线
//   verticals   竖虚线 [{ x, label }]
//   points      关键点 [{ x, y, label, color, open, dx, dy }]：open 为 true 时画空心圆
//   left, right 曲线两端方向箭头的说明文字
// 标注的文字里 $...$ 之间是公式。
import { FN, swish, phi, C } from './fns.js';

export const band = (a, b, color, label, index = 0) => ({ a, b, color, label, index });
export const point = (x, y, label, extra = {}) => ({ x, y, label, ...extra });
export const ref = (a, b, y, label, extra = {}) => ({ a, b, y, label, ...extra });

/**
 * 单个函数的自动标注。key 是 lib/fns.js 里 REGISTRY 条目的 guide 字段，derivative 为 true 时生成导数面板的标注，
 * beta 是 Swish 的参数，color 是曲线颜色，range 是横轴范围。
 */
export function curveGuides(key, derivative, beta = 1, color = C(1), range = [-4, 4]){
  const [lo, hi] = range;
  const result = { bands: [], points: [], references: [], verticals: [], left: '当输入趋向负无穷', right: '当输入趋向正无穷' };
  const zero = () => result.references.push(ref(lo, 0, 0, derivative ? '导数 $\\to 0$' : '输出 $\\to 0$', { labelX: lo * .72 }));
  const linear = () => result.references.push(derivative
    ? ref(0, hi, 1, '导数 $\\to 1$', { labelX: hi * .72, dy: 18 })
    : ref(0, hi, 0, '$y=x$', { endY: hi, labelX: hi * .72, labelY: hi * .72, dy: 18 }));
  if(key === 'relu' || key === 'relu2'){
    result.bands = [{ ...band(lo, 0, color, '负半轴：输出与导数严格为零'), shadeOnly: true }];
    result.verticals = [{ x: 0, label: key === 'relu' ? '$x=0$：折点' : '$x=0$：导数连续' }];
    result.references = [ref(lo, 0, 0, '严格为零', { labelX: lo * .65 })];
    if(key === 'relu'){
      if(derivative){
        result.references.push(ref(0, hi, 1, '斜率 $=1$', { dy: 18 }));
        result.points = [point(0, 0, '', { open: true }), point(0, 1, '原点不可导', { open: true, dy: 18 })];
      }else result.points = [point(0, 0, '原点 $(0,0)$')];
    }else{
      result.points = [
        point(0, 0, derivative ? '原点斜率 $=0$' : '原点 $(0,0)$'),
        point(2, 4, derivative ? '$x=2$：斜率 $4$' : '$x=2$：输出 $4$', { dx: -100 }),
        point(2, derivative ? 1 : 2, derivative ? 'ReLU：斜率 $1$' : 'ReLU：输出 $2$', { dx: -100, color: C(2) }),
      ];
    }
  }else if(['sigmoid', 'tanh', 'normal'].includes(key)){
    const w = key === 'normal' ? 1.281552 : Math.log(9) / (key === 'tanh' ? 2 : 1);
    result.bands = [band(-w, w, color, '输出变化的 10%–90%：宽 ' + (2 * w).toFixed(2))];
    const f0 = key === 'tanh' ? 0 : .5, d0 = key === 'normal' ? phi(0) : key === 'tanh' ? 1 : .25;
    result.points = [point(0, derivative ? d0 : f0, derivative ? '原点斜率 $' + d0.toFixed(3) + '$' : '$x=0$，输出 $' + f0 + '$', { dy: 18 })];
    result.references = [
      ref(lo, 0, derivative ? 0 : key === 'tanh' ? -1 : 0, derivative ? '导数 $\\to 0$' : '饱和参考', { labelX: lo * .7, dy: 16 }),
      ref(0, hi, derivative ? 0 : 1, derivative ? '导数 $\\to 0$' : '输出 $\\to 1$', { labelX: hi * .7, dy: 16 }),
    ];
  }else if(['silu', 'sw', 'gelu', 'softplus'].includes(key)){
    const w = key === 'gelu' ? 2 : Math.log(9) / (key === 'sw' ? beta : 1);
    result.bands = [band(-w, w, color, key === 'gelu' ? '主要变化范围 $\\approx[-2,2]$' : (key === 'softplus' ? '斜率' : 'gate') + ' 10%–90%，宽 ' + (2 * w).toFixed(2))];
    zero(); linear();
    result.points = [point(0, derivative ? .5 : key === 'softplus' ? Math.log(2) : 0, derivative ? '原点斜率 $=0.5$' : key === 'softplus' ? '$f(0)=\\ln 2\\approx 0.693$' : '原点 $(0,0)$')];
    if(!derivative && key !== 'softplus'){
      const x = key === 'gelu' ? -.7518 : -1.278465 / (key === 'sw' ? beta : 1);
      const y = key === 'gelu' ? FN.gelu.f(x) : swish(key === 'sw' ? beta : 1).f(x);
      result.points.push(point(x, y, '最低点 $(' + x.toFixed(2) + ',\\ ' + y.toFixed(2) + ')$', { dx: -70, dy: 22 }));
    }
  }
  result.points = result.points.map(p => ({ color, ...p }));
  return result;
}
