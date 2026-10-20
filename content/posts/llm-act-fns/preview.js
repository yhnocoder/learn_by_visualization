const NAMESPACE = 'http://www.w3.org/2000/svg';
const WIDTH = 320;
const HEIGHT = 180;
const X_SCALE = 34;
const Y_SCALE = 24;
const COLOR = '#1baf7a';

const toX = (x) => WIDTH / 2 + x * X_SCALE;
const toY = (y) => HEIGHT * 0.74 - y * Y_SCALE;

export default function preview(element) {
  const svg = shape('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, 'aria-hidden': 'true' });
  svg.style.cssText = 'display:block;width:100%;height:100%';
  const curve = shape('path', { fill: 'none', stroke: COLOR, 'stroke-width': 2.5, 'stroke-linejoin': 'round' });
  const label = shape('text', { x: 12, y: 22, 'font-size': 12, 'font-family': 'var(--font-mono)', fill: 'var(--ink-2)' });
  svg.append(
    shape('line', { x1: 0, y1: toY(0), x2: WIDTH, y2: toY(0), stroke: 'var(--line)' }),
    shape('line', { x1: toX(0), y1: 0, x2: toX(0), y2: HEIGHT, stroke: 'var(--line)' }),
    shape('path', { d: `M0 ${toY(0)} H${toX(0)} L${WIDTH} ${toY(WIDTH / 2 / X_SCALE)}`, fill: 'none', stroke: 'var(--ink-3)', 'stroke-dasharray': '3 3' }),
    curve,
    label,
  );
  element.append(svg);
  const draw = (beta) => {
    let path = '';
    for (let x = -4.7; x <= 4.7; x += 0.1) path += `${path ? 'L' : 'M'}${toX(x).toFixed(1)} ${toY(x / (1 + Math.exp(-beta * x))).toFixed(1)} `;
    curve.setAttribute('d', path);
    label.textContent = `SiLU  β = ${beta.toFixed(2)}`;
  };
  draw(1);
  let phase = 0;
  let frame = 0;
  return {
    start() {
      const step = () => {
        phase += 0.02;
        draw(0.5 + (7.5 * (1 - Math.cos(phase))) / 2);
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    },
    stop() {
      cancelAnimationFrame(frame);
    },
  };
}

function shape(name, attributes) {
  const node = document.createElementNS(NAMESPACE, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}
