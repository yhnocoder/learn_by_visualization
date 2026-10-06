// 标题相关的 remark / rehype 插件。
//
// remarkHeadingId：标题末尾可以写一个 MDX 注释作为属性块，例如
//     ## Sigmoid 与 Tanh：门控与 soft-capping {/* #s2 toc="Sigmoid 与 Tanh" */}
//   #id 设定标题的 id，迁移前的锚点链接因此仍然有效；toc="..." 设定目录里显示的短标题，可以含 $...$ 公式。
//   用注释而不是常见的 {#id} 写法，是因为 MDX 把 { } 当作 JavaScript 表达式解析。
// rehypeSections（在 MathJax 之前运行）：
//   1. 给没有 id 的 h2、h3 生成 id；
//   2. 把每个顶层 h2 和它后面直到下一个 h2 之前的内容包进 <section>；锚点 id 留在 h2 上；
//   3. 把目录条目作为一个临时元素放到文档末尾，让 MathJax 一并渲染其中的公式。
// rehypeCollectToc（在 MathJax 之后运行）：取出临时元素，把每个目录条目的 HTML 写进 frontmatter.toc，
//   布局用 frontmatter.toc 生成目录。
import Slugger from 'github-slugger';
import { toHtml } from 'hast-util-to-html';
import { visit } from 'unist-util-visit';

const ATTRS = /^\s*\/\*\s*(#[\w:.-]+)?((?:\s+\w+="[^"]*")*)\s*\*\/\s*$/;

export function remarkHeadingId(){
  return tree => visit(tree, 'heading', node => {
    const last = node.children.at(-1);
    if(last?.type !== 'mdxTextExpression') return;
    const m = last.value.match(ATTRS);
    if(!m || (!m[1] && !m[2])) return;
    node.children.pop();
    const prev = node.children.at(-1);
    if(prev?.type === 'text') prev.value = prev.value.trimEnd();
    const props = {};
    if(m[1]) props.id = m[1].slice(1);
    for(const [, k, v] of m[2].matchAll(/(\w+)="([^"]*)"/g)) props['data-' + k] = v;
    node.data ??= {};
    node.data.hProperties = { ...node.data.hProperties, ...props };
  });
}

const text = node => node.type === 'text' ? node.value : (node.children || []).map(text).join('');
const isMathText = s => s.includes('$');

// 把含 $...$ 的纯文本拆成文本节点和 remark-math 输出的那种行内公式节点，交给 rehype-mathjax 渲染
function inlineMath(s){
  return s.split('$').map((part, i) => i % 2
    ? { type: 'element', tagName: 'code', properties: { className: ['language-math', 'math-inline'] }, children: [{ type: 'text', value: part }] }
    : { type: 'text', value: part }).filter(n => n.type === 'element' || n.value);
}

export function rehypeSections(){
  return tree => {
    const slugger = new Slugger();
    const items = [];
    visit(tree, 'element', node => {
      if(node.tagName !== 'h2' && node.tagName !== 'h3') return;
      node.properties.id ??= slugger.slug(text(node).trim() || 'section');
      const short = node.properties.dataToc;
      delete node.properties.dataToc;
      const children = short != null
        ? (isMathText(short) ? inlineMath(short) : [{ type: 'text', value: short }])
        : structuredClone(node.children).filter(c => !(c.type === 'element' && (c.properties?.className || []).includes('n')));
      items.push({ type: 'element', tagName: 'li', properties: { dataDepth: node.tagName === 'h2' ? '2' : '3', dataId: String(node.properties.id) }, children });
    });

    const out = [];
    let section = null;
    for(const child of tree.children){
      if(child.type === 'element' && child.tagName === 'h2'){
        section = { type: 'element', tagName: 'section', properties: {}, children: [] };
        out.push(section);
      }
      (section ? section.children : out).push(child);
    }
    out.push({ type: 'element', tagName: 'div', properties: { dataTocCollect: true }, children: items });
    tree.children = out;
  };
}

// 公式插件把公式换成带 data.html 的 MDX 节点，hast-util-to-html 不能输出 MDX 节点，换回 HTML 字符串
function toRaw(node){
  if(typeof node.data?.html === 'string') return { type: 'raw', value: node.data.html };
  return node.children ? { ...node, children: node.children.map(toRaw) } : node;
}

export function rehypeCollectToc(){
  return (tree, file) => {
    const index = tree.children.findIndex(c => c.type === 'element' && c.properties?.dataTocCollect);
    if(index < 0) return;
    const holder = tree.children[index];
    tree.children.splice(index, 1);
    const toc = holder.children.map(li => ({
      depth: Number(li.properties.dataDepth),
      id: li.properties.dataId,
      html: toHtml({ type: 'root', children: li.children.map(toRaw) }, { allowDangerousHtml: true }).trim(),
    }));
    const astro = (file.data.astro ??= {});
    astro.frontmatter = { ...astro.frontmatter, toc };
  };
}
