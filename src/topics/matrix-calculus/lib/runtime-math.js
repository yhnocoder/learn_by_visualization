// 等待浏览器端 MathJax，并把它的全局字形缓存放进页面。
// Base.astro 的 MathJax 配置是 fontCache: 'global'、startup.typeset: false。全局缓存是一个隐藏的 <svg>，
// MathJax 只在排版整个文档时才把它加到 <body> 里；页面不在启动时排版，tex() 生成的公式就引用不到字形，显示为空白。
// 这里在第一次使用前主动加入缓存（缓存里的字形之后随公式增加，元素本身不变）。
// 这个问题对所有 runtimeMath 页面都存在，建议改在 src/lib/math.js 的 mathReady() 里处理，届时删除本文件。
import { mathReady } from '../../../lib/math.js';

export async function runtimeMathReady(){
  await mathReady();
  window.MathJax.startup.document.addPageElements();
}
