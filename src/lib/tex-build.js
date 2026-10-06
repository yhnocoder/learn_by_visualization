// 构建时把一段 TeX 渲染成 SVG 的 HTML 字符串，只在 .astro 组件的 frontmatter 里使用（运行在 Node 中，不进入浏览器）。
// 组件模板里的静态公式（控件标签、小标题）不经过 MDX，所以不会被正文的 rehype-mathjax 处理；
// 这里直接调用同一个插件、使用与 astro.config.mjs 相同的选项，输出与正文公式相同的 <mjx-container>。
import rehypeMathjax from 'rehype-mathjax/svg';
import { toHtml } from 'hast-util-to-html';

const transform = rehypeMathjax({ svg: { fontCache: 'local' } });
// 开发服务器每次请求都会重新渲染页面上的组件，同一个公式只渲染一次。
// 改动正文后开发服务器会重新执行这个模块，所以缓存放在 globalThis 上，不随模块重新执行而清空。
const cache = (globalThis.__texBuildCache ??= new Map());

/** 返回 TeX 公式 t 渲染后的 HTML。display 为 true 时按行间公式渲染。公式有语法错误时构建失败。 */
export function texToHtml(t, display = false){
  const key = (display ? 'D:' : 'I:') + t;
  if(!cache.has(key)) cache.set(key, render(t, display));
  return cache.get(key);
}

function render(t, display){
  const math = { type: 'element', tagName: 'code', properties: { className: ['language-math', display ? 'math-display' : 'math-inline'] }, children: [{ type: 'text', value: t }] };
  const tree = { type: 'root', children: [{ type: 'element', tagName: 'span', properties: {}, children: [math] }] };
  transform(tree, { message(reason, options){ throw new Error(`公式无法渲染：${t}`, { cause: options?.cause }); } });
  return toHtml(tree.children[0].children);
}
