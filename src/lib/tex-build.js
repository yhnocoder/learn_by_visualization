// 构建时把一段 TeX 渲染成 SVG 的 HTML 字符串，只在 .astro 组件的 frontmatter 里使用（运行在 Node 中，不进入浏览器）。
// 组件模板里的静态公式（控件标签、小标题）不经过 MDX，所以不会被正文的 rehype-mathjax 处理；
// 这里直接调用同一个插件、使用与 astro.config.mjs 相同的选项，输出与正文公式相同的 <mjx-container>。
import rehypeMathjax from 'rehype-mathjax/svg';
import { toHtml } from 'hast-util-to-html';

const transform = rehypeMathjax({ svg: { fontCache: 'local' } });

/** 返回 TeX 公式 t 渲染后的 HTML。display 为 true 时按行间公式渲染。公式有语法错误时构建失败。 */
export function texToHtml(t, display = false){
  const math = { type: 'element', tagName: 'code', properties: { className: ['language-math', display ? 'math-display' : 'math-inline'] }, children: [{ type: 'text', value: t }] };
  const tree = { type: 'root', children: [{ type: 'element', tagName: 'span', properties: {}, children: [math] }] };
  transform(tree, { message(reason, options){ throw new Error(`公式无法渲染：${t}`, { cause: options?.cause }); } });
  return toHtml(tree.children[0].children);
}
