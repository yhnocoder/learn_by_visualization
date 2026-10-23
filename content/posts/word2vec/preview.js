// 五组词的二维向量从随机初始位置移动到各自的簇，循环播放。
export default function preview(element) {
  const W = 320, H = 180
  const colors = ['var(--series-7)', 'var(--series-8)', 'var(--series-1)', 'var(--series-4)', 'var(--series-3)']
  const centers = [[70, 60], [250, 50], [90, 135], [235, 130], [160, 95]]
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const points = centers.flatMap((c, g) => Array.from({ length: 4 }, () => ({ g, x0: 40 + rnd() * (W - 80), y0: 25 + rnd() * (H - 50), x1: c[0] + (rnd() - 0.5) * 26, y1: c[1] + (rnd() - 0.5) * 22 })))
  element.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:100%">${points.map((p) => `<circle r="5" fill="${colors[p.g]}" stroke="var(--surface)" stroke-width="1.2"/>`).join('')}<text x="${W - 10}" y="${H - 8}" text-anchor="end" font-size="11" fill="var(--ink-3)" font-family="var(--font-mono)"></text></svg>`
  const render = (u) => {
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2
    element.querySelectorAll('circle').forEach((c, i) => {
      const p = points[i]
      c.setAttribute('cx', p.x0 + (p.x1 - p.x0) * e)
      c.setAttribute('cy', p.y0 + (p.y1 - p.y0) * e)
    })
    element.querySelector('text').textContent = 'epoch ' + Math.round(u * 60)
  }
  render(0)
  let t = 0, frame = 0
  return {
    start() {
      const step = () => {
        t = (t + 0.006) % 1.3
        render(Math.min(1, t))
        frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    },
    stop() {
      cancelAnimationFrame(frame)
    },
  }
}
