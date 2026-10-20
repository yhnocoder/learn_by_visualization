const NAMESPACE = 'http://www.w3.org/2000/svg';
const KINDS = ['var(--series-8)', 'var(--series-3)', 'var(--series-3)', 'var(--series-3)', 'var(--series-3)', 'var(--series-1)', 'var(--series-1)', 'var(--series-1)'];
const BIT_WIDTH = 30;
const BIT_GAP = 5;

export default function preview(element) {
  const bits = [0, 1, 0, 0, 0, 0, 1, 0];
  const svg = shape('svg', { viewBox: '0 0 320 180', 'aria-hidden': 'true' });
  svg.style.cssText = 'display:block;width:100%;height:100%';
  const left = (320 - (BIT_WIDTH * 8 + BIT_GAP * 7)) / 2;
  const cells = bits.map((_, index) => {
    const x = left + index * (BIT_WIDTH + BIT_GAP);
    const rect = shape('rect', { x, y: 68, width: BIT_WIDTH, height: 44, rx: 5, fill: KINDS[index] });
    const text = shape('text', { x: x + BIT_WIDTH / 2, y: 96, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 500, 'font-family': 'var(--font-mono)', fill: '#fff' });
    svg.append(rect, text);
    return { rect, text };
  });
  const label = shape('text', { x: 308, y: 170, 'text-anchor': 'end', 'font-size': 11, 'font-family': 'var(--font-mono)', fill: 'var(--ink-3)' });
  svg.append(label);
  element.append(svg);
  const value = () => {
    const exponent = parseInt(bits.slice(1, 5).join(''), 2);
    const mantissa = parseInt(bits.slice(5).join(''), 2);
    const magnitude = exponent === 0 ? 2 ** -6 * (mantissa / 8) : 2 ** (exponent - 7) * (1 + mantissa / 8);
    return bits[0] ? -magnitude : magnitude;
  };
  const draw = () => {
    cells.forEach(({ rect, text }, index) => {
      rect.setAttribute('opacity', bits[index] ? 1 : 0.35);
      text.textContent = String(bits[index]);
    });
    label.textContent = `E4M3 = ${value()}`;
  };
  draw();
  let timer = 0;
  return {
    start() {
      timer = setInterval(() => {
        bits[Math.floor(Math.random() * 8)] ^= 1;
        draw();
      }, 450);
    },
    stop() {
      clearInterval(timer);
    },
  };
}

function shape(name, attributes) {
  const node = document.createElementNS(NAMESPACE, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}
