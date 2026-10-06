// 读取 CSS token 的实际颜色。token 用 light-dark() 定义，getPropertyValue() 只能读到原文，
// 所以这里把 token 赋给一个隐藏元素的 color，再读计算后的 rgb 值。

let probe;
/** 返回 [r, g, b]，每个分量在 0 到 255 之间。name 是不带 var() 的 token 名，例如 '--s1'。 */
export function readColor(name, scope = document.documentElement){
  if(!probe){ probe = document.createElement('span'); probe.style.display = 'none'; }
  scope.appendChild(probe);
  probe.style.color = `var(${name})`;
  const rgb = getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number);
  probe.remove();
  return rgb;
}

/** 系统配色或 data-theme 变化时调用 fn，用于重绘依赖颜色数值的 canvas。 */
export function onColorSchemeChange(fn){
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn);
  new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
