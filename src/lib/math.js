// 浏览器端 MathJax 的入口。正文公式在构建时已经渲染成 SVG；图里动态生成的公式（tex()、label()）
// 需要浏览器端 MathJax，页面 frontmatter 里写 runtimeMath: true 时，布局会加载它。

let ready;
/** 等待浏览器端 MathJax 加载完成。页面没有加载 MathJax 时抛出错误。
 *  正文公式在构建时渲染，浏览器端 MathJax 不排版整页（startup.typeset 为 false），页面里因此没有它的样式表和全局字形缓存，
 *  tex2svg() 生成的 SVG 会缺少字形。这里在第一次调用时执行一次 updateDocument()，把两者插入页面。 */
export function mathReady(){
  if(!window.MathJax?.startup) throw new Error('页面没有加载浏览器端 MathJax：在 frontmatter 里写 runtimeMath: true');
  ready ??= window.MathJax.startup.promise.then(() => { window.MathJax.startup.document.updateDocument(); });
  return ready;
}

/** 排版运行时插入的、含有 $...$ 的元素。 */
export async function typeset(nodes){
  await mathReady();
  return window.MathJax.typesetPromise(nodes);
}
