// 逐步应用一组固定的合并规则，循环播放。
export default function preview(element) {
  const steps = [['l', 'o', 'w', 'e', 'r', '</w>'], ['l', 'o', 'w', 'er', '</w>'], ['lo', 'w', 'er', '</w>'], ['low', 'er', '</w>'], ['lower', '</w>']]
  element.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap;padding:0 14px;font-family:var(--font-mono)"></div><span style="position:absolute;right:10px;bottom:8px;font:11px var(--font-mono);color:var(--ink-3)"></span>'
  const [row, label] = element.children
  let i = 0, timer = 0
  const symbol = (s, isNew) => {
    const span = document.createElement('span')
    span.textContent = s
    span.style.cssText = `padding:5px 9px;border-radius:6px;font-size:14px;border:1px solid ${isNew ? 'var(--accent)' : 'var(--line)'};background:${isNew ? 'var(--accent-soft)' : 'var(--surface)'};color:${isNew ? 'var(--accent)' : s === '</w>' ? 'var(--ink-3)' : 'var(--ink)'}`
    return span
  }
  const render = () => {
    const previous = steps[Math.max(i - 1, 0)]
    row.replaceChildren(...steps[i].map((s) => symbol(s, i > 0 && !previous.includes(s))))
    label.textContent = `merge ${i} / ${steps.length - 1}`
  }
  render()
  return {
    start() {
      timer = setInterval(() => {
        i = (i + 1) % steps.length
        render()
      }, 700)
    },
    stop() {
      clearInterval(timer)
    },
  }
}
