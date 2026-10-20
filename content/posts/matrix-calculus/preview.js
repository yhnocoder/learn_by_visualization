const NAMESPACE = 'http://www.w3.org/2000/svg';
const EXPRESSIONS = ['2x', '0', 'y', 'x'];
const STAGE_MILLISECONDS = 4000;
const DIAGONAL = '#985b57';
const OFF_DIAGONAL = '#c4b17b';

export default function preview(element) {
  const svg = shape('svg', { viewBox: '0 0 320 180', 'aria-hidden': 'true' });
  svg.style.cssText = 'display:block;width:100%;height:100%';
  svg.append(
    text('f(x, y) = [x², xy]', { x: 160, y: 24, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--ink-2)' }),
    text('J =', { x: 48, y: 96, 'font-size': 20, fill: 'var(--ink-2)', 'font-style': 'italic' }),
    shape('path', { d: 'M103 38H95V142H103 M263 38H271V142H263', fill: 'none', stroke: 'var(--ink-3)', 'stroke-width': 1.5 }),
  );
  const entries = EXPRESSIONS.map((expression, index) => {
    const x = 110 + (index % 2) * 78;
    const y = 41 + Math.floor(index / 2) * 52;
    const entry = text('', { x: x + 33, y: y + 36, 'text-anchor': 'middle', 'font-size': 18, fill: 'var(--ink)' });
    svg.append(
      shape('rect', { x, y, width: 66, height: 46, rx: 6, fill: index === 0 || index === 3 ? DIAGONAL : OFF_DIAGONAL, 'fill-opacity': 0.18 }),
      text(expression, { x: x + 33, y: y + 15, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--ink-2)' }),
      entry,
    );
    return entry;
  });
  const xPoint = shape('circle', { cy: 149, r: 3.5, fill: DIAGONAL });
  const yPoint = shape('circle', { cx: 285, r: 3.5, fill: OFF_DIAGONAL });
  const inputs = text('', { x: 160, y: 164, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--ink-2)' });
  const stageLabel = text('', { x: 160, y: 177, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--ink-3)' });
  svg.append(
    shape('line', { x1: 110, y1: 149, x2: 254, y2: 149, stroke: 'var(--line)', 'stroke-width': 2 }),
    xPoint,
    text('x', { x: 99, y: 153, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--ink-3)' }),
    shape('line', { x1: 285, y1: 45, x2: 285, y2: 135, stroke: 'var(--line)', 'stroke-width': 2 }),
    yPoint,
    text('y', { x: 285, y: 35, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--ink-3)' }),
    inputs,
    stageLabel,
  );
  element.append(svg);
  let elapsed = 0;
  const format = (value) => (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);
  const draw = () => {
    const stage = Math.floor(elapsed / STAGE_MILLISECONDS) % 2;
    const moving = Math.cos(((elapsed % STAGE_MILLISECONDS) / STAGE_MILLISECONDS) * 2 * Math.PI);
    const x = stage === 0 ? moving : 1;
    const y = stage === 1 ? moving : 1;
    [2 * x, 0, y, x].forEach((value, index) => {
      entries[index].textContent = format(value);
    });
    xPoint.setAttribute('cx', 182 + 72 * x);
    yPoint.setAttribute('cy', 90 - 45 * y);
    inputs.textContent = `x = ${format(x)}    y = ${format(y)}`;
    stageLabel.textContent = stage === 0 ? 'x 变化 · y 保持不变' : 'y 变化 · x 保持不变';
  };
  draw();
  let frame = 0;
  return {
    start() {
      let last;
      const step = (now) => {
        if (last !== undefined) elapsed += Math.min(now - last, 50);
        last = now;
        draw();
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    },
    stop() {
      cancelAnimationFrame(frame);
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
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}
