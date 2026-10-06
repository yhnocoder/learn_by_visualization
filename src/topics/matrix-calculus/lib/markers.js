// 本文几张图共用的箭头 marker。src/lib/svg.js 的 addMarkers 只给出固定的两种颜色，
// 这里按给定的 id 和颜色创建，供路径图、梯度图和 RoPE 图使用。
import { el } from '../../../lib/svg.js';

/** 创建一个三角形箭头 marker。refX 是箭头尖端在 10×10 坐标里的位置，size 是 markerWidth 和 markerHeight。 */
export function arrowMarker(id, color, { refX = 9, size = 7 } = {}){
  const m = el('marker', { id, viewBox: '0 0 10 10', refX: String(refX), refY: '5', markerWidth: String(size), markerHeight: String(size), orient: 'auto' });
  m.appendChild(el('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }));
  return m;
}

/** 在 svg 里加一个 <defs>，内含 pairs 给出的各个 [id, 颜色] 的箭头 marker。 */
export function addArrowMarkers(svg, pairs, options){
  const defs = el('defs', {});
  for(const [id, color] of pairs) defs.appendChild(arrowMarker(id, color, options));
  svg.appendChild(defs);
  return defs;
}
