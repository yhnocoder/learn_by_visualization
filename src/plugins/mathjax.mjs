// 构建时把正文公式渲染成 SVG 的 rehype 插件，处理 remark-math 输出的 math-inline、math-display 节点。
//
// 与 rehype-mathjax 的区别：使用全局字形缓存（fontCache: 'global'）。同一个字形在一页里只定义一次，
// 放在页面末尾一个隐藏的 <svg> 里，各个公式用 <use> 引用它。rehype-mathjax 只支持每个公式各带一份字形
// （fontCache: 'local'），公式多的页面（矩阵微积分译文有 700 多个公式）HTML 会大一倍以上。
//
// 字形缓存的 id 不使用 MathJax 默认的 MJX-SVG-global-cache：页面同时加载浏览器端 MathJax 时，
// 浏览器端 MathJax 找到同 id 的元素就不再插入自己的缓存，它后来生成的字形会因此缺失。
// 两份缓存里同名字形的路径相同，<use> 引用哪一份结果都一样。
import { h } from 'hastscript';
import { toText } from 'hast-util-to-text';
import { toHtml } from 'hast-util-to-html';
import { visitParents, SKIP } from 'unist-util-visit-parents';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { mathjax } from 'mathjax-full/js/mathjax.js';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

// MathJax 的 lite DOM 元素转成 hast 元素
function toHast(node){
  return h(node.kind, node.attributes, node.children.map(c => 'value' in c ? { type: 'text', value: c.value } : toHast(c)));
}

// 收集一个公式 SVG 里 <use> 引用的字形 id
function collectGlyphs(node, ids){
  const href = node.properties?.xLinkHref ?? node.properties?.['xlink:href'];
  if(typeof href === 'string' && href.startsWith('#')) ids.add(href.slice(1));
  for(const child of node.children ?? []) collectGlyphs(child, ids);
  return ids;
}

// 公式以 <Fragment set:html="..."> 的形式放进 MDX，而不是 hast 元素树。
// 元素树会被 MDX 编译成数百万字符的 JSX 调用，开发服务器每次保存后编译和执行这段代码要好几秒；
// 一个字符串属性只需要原样输出。data.html 留给目录插件使用（标题里的公式）。
function rawHtml(html, inline){
  return {
    type: inline ? 'mdxJsxTextElement' : 'mdxJsxFlowElement',
    name: 'Fragment',
    attributes: [{ type: 'mdxJsxAttribute', name: 'set:html', value: html }],
    children: [],
    data: { html },
  };
}

// 所有页面共用一个 MathJax 文档和输出对象，渲染过的公式按“TeX 源码 + 是否行间”缓存。
// 开发服务器每次保存文件都会重新编译整页，有了缓存，只有改动过的公式需要重新渲染。
// 共用的字形缓存会包含所有页面用到的字形，所以写入页面时只取这一页的公式引用到的字形。
const output = new SVG({ fontCache: 'global' });
const doc = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: output });
const formulas = new Map();
let styleSheet;

function render(tex, display){
  const key = (display ? 'D:' : 'I:') + tex;
  let entry = formulas.get(key);
  if(!entry){
    const hast = toHast(doc.convert(tex, { display }));
    entry = { id: entries.length, html: toHtml(hast), glyphs: collectGlyphs(hast, new Set()) };
    formulas.set(key, entry);
    entries.push(entry);
  }
  return entry;
}
const entries = [];

// 页面末尾的样式表和这一页用到的字形定义
function cacheHtml(glyphs){
  if(!styleSheet){
    const sheet = toHast(output.styleSheet(doc));
    delete sheet.properties.id;
    styleSheet = toHtml(sheet);
  }
  const defs = toHast(output.fontCache.getCache());
  defs.children = defs.children.filter(c => glyphs.has(c.properties?.id));
  return styleSheet + toHtml(h('svg', { id: 'MJX-SVG-build-cache', style: 'display:none', 'aria-hidden': 'true' }, [defs]));
}

// 行间公式的 <pre> 带有 source-lines.mjs 加的源码位置，转到 <mjx-container> 上，页面内编辑才能点开它
function withSource(html, attrs){
  return attrs ? html.replace('<mjx-container', `<mjx-container${attrs}`) : html;
}

// 开发服务器里，公式在 MDX 里只留一个占位标签 <mjx-pending data-id>，页面返回给浏览器之前
// 再由 expandMath 换成 SVG（见 inline-edit-server.mjs 里的中间件）。
// 700 个公式的 SVG 有约 1.5 MB，放进 MDX 编译出的模块后，开发服务器每次保存都要转换、执行这么大的模块；
// 占位标签让模块只有原来的五分之一大小。构建（astro build）时直接写入 SVG。
const deferred = process.env.NODE_ENV !== 'production';

export default function rehypeMathSvg(){
  return (tree, file) => {
    const glyphs = new Set();
    let found = false;

    visitParents(tree, 'element', (node, parents) => {
      const cls = Array.isArray(node.properties.className) ? node.properties.className : [];
      const inline = cls.includes('math-inline'), display = cls.includes('math-display');
      if(!inline && !display && !cls.includes('language-math')) return;
      let scope = node, parent = parents.at(-1);
      // remark-math 把行间公式输出成 <pre><code class="language-math math-display">，整个 <pre> 替换掉
      if(node.tagName === 'code' && parent?.type === 'element' && parent.tagName === 'pre'){ scope = parent; parent = parents.at(-2); }
      if(!parent) return;
      const tex = toText(scope, { whitespace: 'pre' });
      let entry;
      try{
        entry = render(tex, display || scope !== node);
      }catch(cause){
        file.fail(`公式无法渲染：${tex}`, { place: node.position, cause });
      }
      const { dataSource, dataSourceRange } = scope.properties;
      const attrs = dataSourceRange ? ` data-source="${dataSource}" data-source-range="${dataSourceRange}"` : '';
      const html = deferred ? `<mjx-pending data-id="${entry.id}"${attrs}></mjx-pending>` : withSource(entry.html, attrs);
      parent.children[parent.children.indexOf(scope)] = rawHtml(html, inline);
      for(const id of entry.glyphs) glyphs.add(id);
      found = true;
      return SKIP;
    });

    if(!found) return;
    tree.children.push(rawHtml(deferred ? '<mjx-pending-cache></mjx-pending-cache>' : cacheHtml(glyphs), false));
  };
}

const PENDING = /<mjx-pending data-id="(\d+)"([^>]*)><\/mjx-pending>/g;

function replacePending(html, glyphs){
  return html.replace(PENDING, (_, id, attrs) => {
    const entry = entries[Number(id)];
    for(const glyph of entry.glyphs) glyphs.add(glyph);
    return withSource(entry.html, attrs);
  });
}

/** 把开发服务器输出的整页 HTML 里的公式占位标签换成 SVG，并在 <mjx-pending-cache> 处写入这一页用到的字形定义。
 *  页面里没有占位标签时原样返回。 */
export function expandMath(html){
  if(!html.includes('<mjx-pending')) return html;
  const glyphs = new Set();
  html = replacePending(html, glyphs);
  // 一页可以包含多个 MDX 模块（例如论文版式引用正文页），字形定义只写一次
  let first = true;
  return html.replaceAll('<mjx-pending-cache></mjx-pending-cache>', () => first ? (first = false, cacheHtml(glyphs)) : '');
}

/** 页面内编辑的预览用：把一段 HTML 里的占位标签换成 SVG，字形定义单独返回（不带 id 和样式表，页面里已经有样式表）。 */
export function expandMathFragment(html){
  const glyphs = new Set();
  html = replacePending(html, glyphs).replaceAll('<mjx-pending-cache></mjx-pending-cache>', '');
  if(!glyphs.size) return { html, glyphs: '' };
  const defs = toHast(output.fontCache.getCache());
  defs.children = defs.children.filter(c => glyphs.has(c.properties?.id));
  return { html, glyphs: toHtml(h('svg', { style: 'display:none', 'aria-hidden': 'true' }, [defs])) };
}
