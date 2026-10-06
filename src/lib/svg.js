// 创建 SVG 元素、把公式放进 SVG 的工具函数。tex() 和 label() 依赖浏览器端 MathJax，
// 调用前先 await mathReady()（见 ./math.js）。

export const NS = 'http://www.w3.org/2000/svg';

/** 创建 SVG 元素 n，属性来自对象 a，可选文本内容 txt。 */
export const el = (n, a, txt) => {
  const e = document.createElementNS(NS, n);
  for(const k in a) e.setAttribute(k, a[k]);
  if(txt != null) e.textContent = txt;
  return e;
};

/** 用 MathJax 把 t 渲染成 svg，作为嵌套 <svg> 放进图里。fs 是字号（px），y 是基线位置，align 为 'middle' | 'start' | 'end'。 */
export function tex(t, fs, x, y, align, color){
  const node = MathJax.tex2svg(t, { display: false }).querySelector('svg');
  const ex = fs * 0.45;
  const w = parseFloat(node.getAttribute('width')) * ex, h = parseFloat(node.getAttribute('height')) * ex;
  const shift = parseFloat((node.getAttribute('style') || '').match(/vertical-align:\s*(-?[\d.]+)ex/)?.[1] || 0) * ex;
  const left = align === 'middle' ? x - w / 2 : (align === 'end' ? x - w : x);
  node.setAttribute('width', w); node.setAttribute('height', h);
  node.setAttribute('x', left); node.setAttribute('y', y - h - shift);
  node.removeAttribute('style'); node.classList.add('tex');
  if(color) node.style.color = color;
  return node;
}

/** 在 svg 的 <defs> 里加两个箭头 marker：arr-{svgId}（灰色）和 arrb-{svgId}（蓝色）。 */
export function addMarkers(svg, svgId){
  const defs = el('defs', {});
  for(const [id, col] of [['arr', 'var(--ink-2)'], ['arrb', 'var(--s1)']]){
    const m = el('marker', { id: id + '-' + svgId, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
    m.appendChild(el('path', { d: 'M0,0 L10,5 L0,10 z', fill: col }));
    defs.appendChild(m);
  }
  svg.appendChild(defs);
}

/** 标签：$...$ 之间的公式由 MathJax 渲染成嵌套 svg，其余文字用 <text>，按实际宽度横向拼接。 */
export function label(svg, x, y, t, fs, align, cls, color){
  const segs = t.split('$'), nodes = []; let total = 0;
  segs.forEach((seg, i) => {
    if(!seg) return;
    let node, w;
    if(i % 2){ node = tex(seg, fs, 0, y, 'start', color); w = +node.getAttribute('width'); }
    else{ node = el('text', { x: 0, y, 'xml:space': 'preserve', class: cls || '', style: `font-size:${fs}px` + (color ? `;fill:${color}` : '') }, seg); svg.appendChild(node); w = node.getComputedTextLength(); }
    nodes.push([node, w]); total += w;
  });
  let left = align === 'middle' ? x - total / 2 : (align === 'end' ? x - total : x);
  for(const [node, w] of nodes){ node.setAttribute('x', left); if(node.parentNode !== svg) svg.appendChild(node); left += w; }
}
