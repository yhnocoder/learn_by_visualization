// Markdown 页面里可以使用的交互图（custom element）。键是元素名，也就是指令名（:::gradient-figure），
// 值是加载定义这个元素的模块的函数。页面只加载正文里实际用到的元素。
//
// 每个元素的类可以声明静态字段 properties，列出读者或作者可能想调整的属性，编辑器据此显示属性面板：
//   static properties = { x0: { label: 'x₀', type: 'number', min: -2, max: 2, step: 0.01, default: 1.2 } }
export const elements = {
  'gradient-figure': () => import('../topics/matrix-calculus/elements/gradient-figure.js'),
};

/** 加载 root 里出现的所有已登记元素的定义。 */
export function loadElements(root = document){
  return Promise.all(Object.keys(elements).filter(name => root.querySelector(name)).map(defineElement));
}

/** 加载一个元素的定义，返回它的类。没有登记的名字返回 undefined。 */
export async function defineElement(name){
  if(!elements[name]) return undefined;
  if(!customElements.get(name)) await elements[name]();
  return customElements.get(name);
}
