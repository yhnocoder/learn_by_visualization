// f(x, y) = [x², xy] 的 Jacobian：x 和 y 轮流变化，矩阵的每一项随之更新。
export default function preview(element) {
  const expressions = ['2x', '0', 'y', 'x']
  element.innerHTML = `<svg viewBox="0 0 320 180" aria-hidden="true" style="display:block;width:100%;height:100%;font-family:var(--font-mono)">
    <text x="160" y="24" text-anchor="middle" font-size="13" fill="var(--ink-2)">f(x, y) = [x², xy]</text>
    <text x="48" y="96" font-size="20" fill="var(--ink-2)" font-style="italic">J =</text>
    <path d="M103 38H95V142H103 M263 38H271V142H263" fill="none" stroke="var(--ink-3)" stroke-width="1.5"/>
    ${expressions.map((expression, i) => {
      const x = 110 + (i % 2) * 78, y = 41 + Math.floor(i / 2) * 52
      return `<rect x="${x}" y="${y}" width="66" height="46" rx="6" fill="${i === 0 || i === 3 ? '#985b57' : '#c4b17b'}" fill-opacity=".18"/>
        <text x="${x + 33}" y="${y + 15}" text-anchor="middle" font-size="12" fill="var(--ink-2)">${expression}</text>
        <text class="entry" x="${x + 33}" y="${y + 36}" text-anchor="middle" font-size="18" fill="var(--ink)"></text>`
    }).join('')}
    <line x1="110" y1="149" x2="254" y2="149" stroke="var(--line)" stroke-width="2"/>
    <circle class="x-point" cy="149" r="3.5" fill="#985b57"/>
    <text x="99" y="153" text-anchor="end" font-size="10" fill="var(--ink-3)">x</text>
    <line x1="285" y1="45" x2="285" y2="135" stroke="var(--line)" stroke-width="2"/>
    <circle class="y-point" cx="285" r="3.5" fill="#b49a58"/>
    <text x="285" y="35" text-anchor="middle" font-size="10" fill="var(--ink-3)">y</text>
    <text class="input-values" x="160" y="164" text-anchor="middle" font-size="11" fill="var(--ink-2)"></text>
    <text class="phase-label" x="160" y="177" text-anchor="middle" font-size="10" fill="var(--ink-3)"></text>
  </svg>`
  let elapsed = 0, frame = 0
  const render = () => {
    // Each four-second stage returns to 1 before the other variable starts moving.
    const stage = Math.floor(elapsed / 4000) % 2
    const moving = Math.cos(((elapsed % 4000) / 4000) * 2 * Math.PI)
    const x = stage === 0 ? moving : 1, y = stage === 1 ? moving : 1
    const values = [2 * x, 0, y, x]
    const format = (value) => (Math.abs(value) < 0.005 ? 0 : value).toFixed(2)
    element.querySelectorAll('.entry').forEach((node, i) => (node.textContent = format(values[i])))
    element.querySelector('.x-point').setAttribute('cx', 182 + 72 * x)
    element.querySelector('.y-point').setAttribute('cy', 90 - 45 * y)
    element.querySelector('.input-values').textContent = `x = ${format(x)}    y = ${format(y)}`
    element.querySelector('.phase-label').textContent = stage === 0 ? 'x 变化 · y 保持不变' : 'y 变化 · x 保持不变'
  }
  render()
  return {
    start() {
      let last
      const step = (now) => {
        if (last !== undefined) elapsed += Math.min(now - last, 50)
        last = now
        render()
        frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    },
    stop() {
      cancelAnimationFrame(frame)
    },
  }
}
