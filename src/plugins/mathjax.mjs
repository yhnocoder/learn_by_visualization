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

export default function rehypeMathSvg(){
  return (tree, file) => {
    // 每个页面使用独立的 MathJax 文档和输出对象，字形缓存只包含这一页用到的字形
    const output = new SVG({ fontCache: 'global' });
    const doc = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: output });
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
      let result;
      try{
        result = toHast(doc.convert(tex, { display: display || scope !== node }));
      }catch(cause){
        file.fail(`公式无法渲染：${tex}`, { place: node.position, cause });
      }
      parent.children[parent.children.indexOf(scope)] = result;
      found = true;
      return SKIP;
    });

    if(!found) return;
    const sheet = toHast(output.styleSheet(doc));
    delete sheet.properties.id;
    tree.children.push(sheet, h('svg', { id: 'MJX-SVG-build-cache', style: 'display:none', 'aria-hidden': 'true' }, [toHast(output.fontCache.getCache())]));
  };
}
