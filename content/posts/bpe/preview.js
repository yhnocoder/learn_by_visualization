const NAMESPACE = 'http://www.w3.org/2000/svg';
const STEPS = [
  ['l', 'o', 'w', 'e', 'r', '</w>'],
  ['l', 'o', 'w', 'er', '</w>'],
  ['lo', 'w', 'er', '</w>'],
  ['low', 'er', '</w>'],
  ['lower', '</w>'],
];
const CHARACTER_WIDTH = 8.4;
const PADDING = 9;
const GAP = 6;

export default function preview(element) {
  const svg = shape('svg', { viewBox: '0 0 320 180', 'aria-hidden': 'true' });
  svg.style.cssText = 'display:block;width:100%;height:100%';
  const symbols = shape('g', {});
  const label = shape('text', { x: 308, y: 170, 'text-anchor': 'end', 'font-size': 11, 'font-family': 'var(--font-mono)', fill: 'var(--ink-3)' });
  svg.append(symbols, label);
  element.append(svg);
  let step = 0;
  const draw = () => {
    const previous = STEPS[Math.max(step - 1, 0)];
    const current = STEPS[step];
    const widths = current.map((symbol) => symbol.length * CHARACTER_WIDTH + 2 * PADDING);
    let x = (320 - widths.reduce((sum, width) => sum + width, 0) - GAP * (current.length - 1)) / 2;
    symbols.replaceChildren();
    current.forEach((symbol, index) => {
      const merged = step > 0 && !previous.includes(symbol);
      const end = symbol === '</w>';
      symbols.append(
        shape('rect', { x, y: 74, width: widths[index], height: 32, rx: 6, fill: merged ? 'var(--accent-soft)' : 'var(--surface)', stroke: merged ? 'var(--accent)' : 'var(--line)' }),
        text(symbol, { x: x + widths[index] / 2, y: 95, 'text-anchor': 'middle', 'font-size': 14, 'font-family': 'var(--font-mono)', fill: merged ? 'var(--accent)' : end ? 'var(--ink-3)' : 'var(--ink)' }),
      );
      x += widths[index] + GAP;
    });
    label.textContent = `merge ${step} / ${STEPS.length - 1}`;
  };
  draw();
  let timer = 0;
  return {
    start() {
      timer = setInterval(() => {
        step = (step + 1) % STEPS.length;
        draw();
      }, 700);
    },
    stop() {
      clearInterval(timer);
    },
  };
}

function text(content, attributes) {
  const node = shape('text', attributes);
  node.textContent = content;
  return node;
}

function shape(name, attributes) {
  const node = document.createElementNS(NAMESPACE, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}
