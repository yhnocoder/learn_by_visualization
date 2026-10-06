// 构建时把组件模板里的公式渲染成 SVG 的 HTML 字符串，只在 .astro 组件的 frontmatter 里使用（运行在 Node 中，不进入浏览器）。
// 组件模板里的静态公式（控件标签、读数、小标题）不经过 MDX，所以不会被正文的公式插件处理；
// 这里用 rehype-mathjax 渲染，输出与正文公式相同的 <mjx-container>。
// 每个公式自带字形定义（fontCache: 'local'），不依赖页面末尾的全局字形缓存。
import rehypeMathjax from 'rehype-mathjax/svg';
import { toHtml } from 'hast-util-to-html';

const transform = rehypeMathjax({ svg: { fontCache: 'local' } });
// 开发服务器每次请求都会重新渲染页面上的组件，同一段内容只渲染一次。
// 改动正文后开发服务器会重新执行这个模块，所以缓存放在 globalThis 上，不随模块重新执行而清空。
const cache = (globalThis.__texBuildCache ??= new Map());

function cached(key, render){
  if(!cache.has(key)) cache.set(key, render());
  return cache.get(key);
}

const mathNode = (t, display) => ({
  type: 'element', tagName: 'code',
  properties: { className: ['language-math', display ? 'math-display' : 'math-inline'] },
  children: [{ type: 'text', value: t }],
});

function render(children, source){
  const holder = { type: 'element', tagName: 'span', properties: {}, children };
  const tree = { type: 'root', children: [holder] };
  transform(tree, { message(reason, options){ throw new Error(`公式无法渲染：${source}`, { cause: options?.cause }); } });
  // rehype-mathjax 会在根节点末尾加一份样式表，页面的 base.css 已经给出 mjx-container 的样式，这里只取公式本身
  return toHtml(holder.children);
}

/** 返回 TeX 公式 t 渲染后的 HTML。display 为 true 时按行间公式渲染。公式有语法错误时构建失败。 */
export function texToHtml(t, display = false){
  return cached((display ? 'D:' : 'I:') + t, () => render([mathNode(t, display)], t));
}

/** 渲染一个行内公式，参数不带 $。 */
export const tex = t => texToHtml(t);

/** 把含 $...$ 的文字转成 HTML：$ 之间是行内公式，其余是普通文字（按文字转义）。 */
export function md(text){
  return cached('M:' + text, () => render(
    text.split('$')
      .map((part, i) => i % 2 ? mathNode(part, false) : { type: 'text', value: part })
      .filter(n => n.type === 'element' || n.value),
    text,
  ));
}
