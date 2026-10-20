const NAMESPACE = 'http://www.w3.org/2000/svg';
const WIDTH = 320;
const position = (exponent) => 20 + ((exponent + 40) / 40) * (WIDTH - 40);

export default function preview(element) {
  const svg = shape('svg', { viewBox: `0 0 ${WIDTH} 180`, 'aria-hidden': 'true' });
  svg.style.cssText = 'display:block;width:100%;height:100%';
  const limit = position(-24);
  svg.append(
    shape('rect', { x: limit, y: 70, width: WIDTH - 20 - limit, height: 40, fill: 'var(--series-3)', 'fill-opacity': 0.18 }),
    shape('rect', { x: 20, y: 70, width: limit - 20, height: 40, fill: 'var(--series-8)', 'fill-opacity': 0.14 }),
    shape('line', { x1: 20, y1: 90, x2: WIDTH - 20, y2: 90, stroke: 'var(--line)' }),
    text('2^-24 fp16 最小次正规数', { x: limit, y: 128, 'font-size': 10, fill: 'var(--ink-3)', 'text-anchor': 'middle' }),
    text('被吸收为 0', { x: 22, y: 60, 'font-size': 10, fill: 'var(--series-8)' }),
    text('可表示', { x: WIDTH - 22, y: 60, 'font-size': 10, fill: 'var(--series-3)', 'text-anchor': 'end' }),
  );
  const gradient = shape('circle', { cy: 90, r: 7, fill: 'var(--series-4)' });
  const value = shape('text', { y: 45, 'font-size': 11, fill: 'var(--ink)', 'text-anchor': 'middle', 'font-family': 'var(--font-mono)' });
  const label = shape('text', { x: 308, y: 170, 'text-anchor': 'end', 'font-size': 11, 'font-family': 'var(--font-mono)', fill: 'var(--ink-3)' });
  svg.append(gradient, value, label);
  element.append(svg);
  let scale = 0;
  const draw = () => {
    const exponent = -30 + scale;
    gradient.setAttribute('cx', position(exponent));
    value.setAttribute('x', position(exponent));
    value.textContent = `g·2^${scale} = 2^${exponent}`;
    label.textContent = exponent >= -24 ? 'loss scale 生效' : `loss scale = 2^${scale}`;
  };
  draw();
  let timer = 0;
  return {
    start() {
      timer = setInterval(() => {
        scale = (scale + 1) % 17;
        draw();
      }, 350);
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
