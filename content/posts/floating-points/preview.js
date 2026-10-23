// fp8 E4M3：1 位符号、4 位指数、3 位尾数。悬停时随机翻转一位并重新算值。
export default function preview(element) {
  const bits = [0, 1, 0, 0, 0, 0, 1, 0]
  const colors = ['#e83e5d', '#41ba63', '#41ba63', '#41ba63', '#41ba63', '#577ec7', '#577ec7', '#577ec7']
  element.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:4px">${bits.map((_, i) => `<span style="width:26px;height:38px;border-radius:5px;display:grid;place-items:center;font:500 16px var(--font-mono);color:#fff;background:${colors[i]};transition:opacity .2s"></span>`).join('')}</div><span style="position:absolute;right:10px;bottom:8px;font:11px var(--font-mono);color:var(--ink-3)"></span>`
  const cells = element.firstElementChild.children, label = element.lastElementChild
  const value = () => {
    const e = parseInt(bits.slice(1, 5).join(''), 2), m = parseInt(bits.slice(5).join(''), 2)
    const v = e === 0 ? (Math.pow(2, -6) * m) / 8 : Math.pow(2, e - 7) * (1 + m / 8)
    return bits[0] ? -v : v
  }
  const render = () => {
    bits.forEach((bit, i) => {
      cells[i].textContent = bit
      cells[i].style.opacity = bit ? 1 : 0.35
    })
    label.textContent = 'E4M3 = ' + value()
  }
  render()
  let timer = 0
  return {
    start() {
      timer = setInterval(() => {
        bits[Math.floor(Math.random() * 8)] ^= 1
        render()
      }, 450)
    },
    stop() {
      clearInterval(timer)
    },
  }
}
