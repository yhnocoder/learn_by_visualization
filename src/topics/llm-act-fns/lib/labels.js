// 本主题的图共用的文字工具：把含 $...$ 的字符串转成 HTML 或放进 SVG。
// 依赖浏览器端 MathJax，调用前先 await mathReady()。
import { el, label } from '../../../lib/svg.js';
import { mathReady } from '../../../lib/math.js';

let prepared;
/**
 * 等待浏览器端 MathJax，并把它的页面元素和样式表加进页面。
 * 布局把 MathJax 配置成 startup.typeset: false，MathJax 启动时不排版页面，也就不会插入全局字形缓存
 * （fontCache: 'global' 时 tex2svg 输出的 <use> 引用这里的字形）和隐藏辅助 MathML 的样式表；
 * 缺少它们时，脚本生成的公式不显示字形，辅助 MathML 以纯文本出现。updateDocument() 会插入这两样东西。
 */
export function prepareMath(){
  prepared ??= mathReady().then(() => { MathJax.startup.document.updateDocument(); });
  return prepared;
}

const segs = src => src.split('$').map((t, i) => ({ math: i % 2 === 1, t })).filter(x => x.t);
const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const texCache = new Map();
function texHTML(tex){
  if(!texCache.has(tex)) texCache.set(tex, MathJax.tex2svg(tex, { display: false }).outerHTML);
  return texCache.get(tex);
}

/** 把字符串转成 HTML：$...$ 之间的公式同步渲染成 MathJax SVG，其余文字转义。用于图例、悬停提示和状态行。 */
export const richHTML = src => segs(src).map(x => x.math ? texHTML(x.t) : esc(x.t)).join('');

/** 把字符串里的公式换成近似的纯文本，用于 aria-label 和 <title>。 */
const PLAIN = { to: '→', approx: '≈', infty: '∞', sigma: 'σ', Phi: 'Φ', beta: 'β', phi: 'φ', tanh: 'tanh', ln: 'ln', odot: '⊙', cdot: '·', times: '×', in: '∈', mathbb: '', mathrm: '', tfrac: '', text: '' };
export const plain = src => src.replace(/\$/g, '').replace(/\\([A-Za-z]+|[,;! ])/g, (m, k) => PLAIN[k] ?? ' ').replace(/[{}]/g, '');

/**
 * 在 parent 里放一条标签，返回包住它的 <g>。a 的字段：x、y（基线）、anchor（start | middle | end）、
 * fill（颜色）、size（字号，默认 10.5）、halo（默认 true：文字外加一圈底色描边，压在曲线上时仍可读）、
 * pe（false 时标签不响应指针）。排版由 src/lib/svg.js 的 label() 完成。
 */
export function putLabel(parent, src, a){
  const g = el('g', { class: 'lbl' + (a.halo === false ? '' : ' halo') });
  parent.appendChild(g);
  label(g, a.x, a.y, src, a.size || 10.5, a.anchor || 'start', 'lbl', a.fill || 'var(--ink)');
  if(a.pe === false) g.style.pointerEvents = 'none';
  return g;
}
