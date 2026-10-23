// 指数轴上 fp16 的可表示下界是 2^-24；一个 2^-30 的梯度乘以 2^k 后才进入范围。
export default function preview(element) {
  const W = 320, H = 180, X = (e) => 20 + ((e + 40) / 40) * (W - 40)
  element.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:100%;font-family:var(--font-mono)">
    <rect x="${X(-24)}" y="70" width="${W - 20 - X(-24)}" height="40" fill="var(--series-3)" fill-opacity=".18"/>
    <rect x="20" y="70" width="${X(-24) - 20}" height="40" fill="var(--series-8)" fill-opacity=".14"/>
    <line x1="20" y1="90" x2="${W - 20}" y2="90" stroke="var(--line)"/>
    <text x="${X(-24)}" y="128" font-size="10" fill="var(--ink-3)" text-anchor="middle">2^-24 fp16 最小次正规数</text>
    <text x="22" y="60" font-size="10" fill="var(--series-8)">被吸收为 0</text><text x="${W - 22}" y="60" font-size="10" fill="var(--series-3)" text-anchor="end">可表示</text>
    <circle class="g" cy="90" r="7" fill="var(--series-4)"/><text class="gl" y="45" font-size="11" fill="var(--ink)" text-anchor="middle"></text>
    <text class="lbl" x="${W - 10}" y="${H - 8}" text-anchor="end" font-size="11" fill="var(--ink-3)"></text></svg>`
  let k = 0, timer = 0
  const render = () => {
    const e = -30 + k
    element.querySelector('.g').setAttribute('cx', X(e))
    const label = element.querySelector('.gl')
    label.setAttribute('x', X(e))
    label.textContent = `g·2^${k} = 2^${e}`
    element.querySelector('.lbl').textContent = e >= -24 ? 'loss scale 生效' : 'loss scale = 2^' + k
  }
  render()
  return {
    start() {
      timer = setInterval(() => {
        k = (k + 1) % 17
        render()
      }, 350)
    },
    stop() {
      clearInterval(timer)
    },
  }
}
