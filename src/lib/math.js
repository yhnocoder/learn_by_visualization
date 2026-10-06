// 浏览器端 MathJax 的入口。正文公式在构建时已经渲染成 SVG；图里动态生成的公式（tex()、label()）
// 需要浏览器端 MathJax，页面 frontmatter 里写 runtimeMath: true 时，布局会加载它。

/** 等待浏览器端 MathJax 加载完成。页面没有加载 MathJax 时抛出错误。 */
export function mathReady(){
  if(!window.MathJax?.startup) throw new Error('页面没有加载浏览器端 MathJax：在 frontmatter 里写 runtimeMath: true');
  return window.MathJax.startup.promise;
}

/** 排版运行时插入的、含有 $...$ 的元素。 */
export async function typeset(nodes){
  await mathReady();
  return window.MathJax.typesetPromise(nodes);
}
