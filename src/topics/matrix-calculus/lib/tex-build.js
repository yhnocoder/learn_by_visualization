// 在构建时把组件模板里的公式渲染成 SVG（在 Node 里运行，不进入浏览器端脚本）。
// 正文公式由 MDX 的 remark-math 与 rehype-mathjax 渲染；组件模板不经过这条流程，
// 所以图的控件、读数里的 $...$ 用这里的函数渲染，输出与正文公式相同的 <mjx-container>。
import rehypeMathjax from 'rehype-mathjax/svg';
import { toHtml } from 'hast-util-to-html';

// fontCache 为 none：每个公式自带字形路径，不引用页面里其他公式定义的字形
const render = rehypeMathjax({ svg: { fontCache: 'none' } });

const mathNode = src => ({
  type: 'element', tagName: 'code',
  properties: { className: ['language-math', 'math-inline'] },
  children: [{ type: 'text', value: src }],
});

/** 把含 $...$ 的文字转成 HTML：$ 之间是行内公式，其余是普通文字（按文字转义）。 */
export function md(text){
  const children = text.split('$')
    .map((part, i) => i % 2 ? mathNode(part) : { type: 'text', value: part })
    .filter(n => n.type === 'element' || n.value);
  const holder = { type: 'element', tagName: 'span', properties: {}, children };
  const root = { type: 'root', children: [holder] };
  render(root, { message(reason, opts){ throw new Error(`公式渲染失败：${text}`, { cause: opts?.cause }); } });
  // rehype-mathjax 会在根节点末尾加一份样式表，页面的 base.css 已经给出 mjx-container 的样式，这里只取公式本身
  return toHtml(holder.children);
}

/** 渲染一个行内公式，参数不带 $。 */
export const tex = src => md(`$${src}$`);
