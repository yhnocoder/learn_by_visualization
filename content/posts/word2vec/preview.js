const NAMESPACE = 'http://www.w3.org/2000/svg';
const WIDTH = 320;
const HEIGHT = 180;
const COLORS = ['var(--series-7)', 'var(--series-8)', 'var(--series-1)', 'var(--series-4)', 'var(--series-3)'];
const CENTERS = [
  [70, 60],
  [250, 50],
  [90, 135],
  [235, 130],
  [160, 95],
];

function random(seed) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

export default function preview(element) {
  const next = random(7);
  const points = CENTERS.flatMap((center, group) =>
    Array.from({ length: 4 }, () => ({
      group,
      x0: 40 + next() * (WIDTH - 80),
      y0: 25 + next() * (HEIGHT - 50),
      x1: center[0] + (next() - 0.5) * 26,
      y1: center[1] + (next() - 0.5) * 22,
    })),
  );
  const svg = shape('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, 'aria-hidden': 'true' });
  svg.style.cssText = 'display:block;width:100%;height:100%';
  const circles = points.map((point) => shape('circle', { r: 5, fill: COLORS[point.group], stroke: 'var(--surface)', 'stroke-width': 1.2 }));
  const label = shape('text', { x: WIDTH - 12, y: HEIGHT - 10, 'text-anchor': 'end', 'font-size': 11, 'font-family': 'var(--font-mono)', fill: 'var(--ink-3)' });
  svg.append(...circles, label);
  element.append(svg);
  const draw = (progress) => {
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
    circles.forEach((circle, index) => {
      const point = points[index];
      circle.setAttribute('cx', point.x0 + (point.x1 - point.x0) * eased);
      circle.setAttribute('cy', point.y0 + (point.y1 - point.y0) * eased);
    });
    label.textContent = `epoch ${Math.round(progress * 60)}`;
  };
  let time = 0;
  let frame = 0;
  draw(0);
  return {
    start() {
      const step = () => {
        time = (time + 0.006) % 1.3;
        draw(Math.min(1, time));
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
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}
