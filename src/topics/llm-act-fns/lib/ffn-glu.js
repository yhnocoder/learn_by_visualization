// FfnGluDiagram 组件的浏览器端脚本：对照普通 FFN 与 GLU 的一次前向计算。
// 参数矩阵的宽和高、activation 的宽度按真实比例绘制：维度 d 对应 U 像素，activation 的宽度等于右侧参数矩阵的高度。
// 序列长度 T 通常远小于 d（T 为 4 到 128，d 为 4096 量级），无法按比例绘制，activation 的高度固定为 BH 像素。
import { el, addMarkers } from '../../../lib/svg.js';
import { richHTML, putLabel } from './labels.js';

const W = 720, H = 216, CY = 92, U = 42, BH = 27, OP = 30;
const STYLE = {
  act: { fill: 'var(--s4)', 'fill-opacity': .2, stroke: 'var(--ink-2)' },
  param: { fill: 'var(--s1)', 'fill-opacity': .28, stroke: 'var(--ink-2)' },
};
let uid = 0;

/** 初始化一个 .ffn-glu 元素：它的两个 .panel 分别画普通 FFN 和 GLU。 */
export function initFfnGlu(host){
  const [ffnPanel, gluPanel] = host.querySelectorAll('.panel');

  function setup(panel){
    const h4 = panel.querySelector('h4'); h4.innerHTML = richHTML(h4.dataset.title);
    const svg = panel.querySelector('.plotwrap > svg'), svgId = 'ffn-glu-' + (uid++);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    addMarkers(svg, svgId);
    svg.dataset.marker = 'arr-' + svgId;
    return svg;
  }
  const text = (svg, t, x, y, o = {}) => putLabel(svg, t, { x, y, anchor: 'middle', size: 10, fill: 'var(--ink-2)', halo: false, ...o });
  // 矩阵：左边缘 x，竖直中心 cy。名字写在矩形内，形状写在下方
  function mat(svg, x, cy, w, h, kind, name, shape){
    svg.appendChild(el('rect', { x, y: cy - h / 2, width: w, height: h, rx: 5, ...STYLE[kind], 'stroke-width': 1.4 }));
    text(svg, name, x + w / 2, cy + 4, { size: 12, fill: 'var(--ink)' });
    text(svg, '$' + shape + '$', x + w / 2, cy + h / 2 + 15);
    return x + w;
  }
  const op = (svg, x, t, y = CY) => (text(svg, t, x + OP / 2, y + 4, { size: 13 }), x + OP);
  const path = (svg, d) => svg.appendChild(el('path', { d, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 1.4, 'marker-end': `url(#${svg.dataset.marker})` }));
  const act = (svg, x, w, name, shape) => mat(svg, x, CY, w, BH, 'act', name, shape);
  // 逐元素函数：圆角框，左边缘 x，竖直中心 y
  function fn(svg, x, y, w, t){
    svg.appendChild(el('rect', { x, y: y - 12, width: w, height: 24, rx: 12, fill: 'var(--surface)', stroke: 'var(--ink-2)', 'stroke-width': 1.4 }));
    text(svg, t, x + w / 2, y + 4, { size: 10.5, fill: 'var(--ink)' });
    return x + w;
  }

  // 上：普通 FFN，d_ff = 4d
  {
    const svg = setup(ffnPanel);
    const F = 4 * U, SW = 40;
    let x = (W - (2 * U + F + 3 * OP + F + U + 34 + SW + 34)) / 2;
    x = act(svg, x, U, '$X$', 'T\\times d'); x = op(svg, x, '$@$');
    x = mat(svg, x, CY, F, U, 'param', '$W_1$', 'd\\times d_{ff}');
    path(svg, `M${x + 2},${CY}H${x + 32}`); text(svg, '$Z$', x + 17, CY - 6, { fill: 'var(--ink)' }); x += 34;
    x = fn(svg, x, CY, SW, '$\\phi$');
    path(svg, `M${x + 2},${CY}H${x + 32}`); x += 34;
    x = act(svg, x, F, '$H$', 'T\\times d_{ff}'); x = op(svg, x, '$@$');
    x = mat(svg, x, CY, U, F, 'param', '$W_2$', 'd_{ff}\\times d'); x = op(svg, x, '$=$');
    act(svg, x, U, '$Y$', 'T\\times d');
    text(svg, '参数合计 $2\\,d\\,d_{ff}$；$d_{ff}=4d$ 时为 $8d^2$', W / 2, H - 8, { size: 10.5 });
  }
  // 下：GLU，d_ff = 8d/3。W_g 与 W_u 上下排列，都与 X 相乘
  {
    const svg = setup(gluPanel);
    const F = 8 / 3 * U, DY = 34, yg = CY - DY, yu = CY + DY, SW = 40, R = 11, RC = 8; // RC：连接线拐角的圆弧半径
    let x = (W - (2 * U + F + 3 * OP + F + 34 + SW + 34 + 2 * R + 44 + U)) / 2;
    x = act(svg, x, U, '$X$', 'T\\times d'); op(svg, x, '$@$', yg); x = op(svg, x, '$@$', yu);
    mat(svg, x, yg, F, U, 'param', '$W_g$', 'd\\times d_{ff}');
    x = mat(svg, x, yu, F, U, 'param', '$W_u$', 'd\\times d_{ff}');
    // 门控分支：G 经过激活函数
    const xs = x + 34, xc = xs + SW + 34 + R;
    path(svg, `M${x + 2},${yg}H${xs - 2}`); text(svg, '$G$', (x + xs) / 2, yg - 6, { fill: 'var(--ink)' });
    fn(svg, xs, yg, SW, '$\\phi$');
    // 两条分支用圆角正交连接线汇入逐元素相乘
    path(svg, `M${xs + SW},${yg}H${xc - RC}A${RC},${RC} 0 0 1 ${xc},${yg + RC}V${CY - R - 2}`);
    path(svg, `M${x + 2},${yu}H${xc - RC}A${RC},${RC} 0 0 0 ${xc},${yu - RC}V${CY + R + 2}`); text(svg, '$U$', (x + xs) / 2, yu - 6, { fill: 'var(--ink)' });
    svg.appendChild(el('circle', { cx: xc, cy: CY, r: R, fill: 'var(--surface)', stroke: 'var(--ink-2)', 'stroke-width': 1.4 }));
    text(svg, '$\\odot$', xc, CY + 4, { size: 12, fill: 'var(--ink)' });
    x = xc + R; path(svg, `M${x + 2},${CY}H${x + 40}`); x += 44;
    x = act(svg, x, F, '$H$', 'T\\times d_{ff}'); x = op(svg, x, '$@$');
    x = mat(svg, x, CY, U, F, 'param', '$W_d$', 'd_{ff}\\times d'); x = op(svg, x, '$=$');
    act(svg, x, U, '$Y$', 'T\\times d');
    text(svg, '参数合计 $3\\,d\\,d_{ff}$；$d_{ff}=\\tfrac{8}{3}d$ 时为 $8d^2$', W / 2, H - 8, { size: 10.5 });
  }
}
