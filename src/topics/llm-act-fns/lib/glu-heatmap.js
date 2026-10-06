// GluHeatmap 组件的浏览器端脚本：画 φ(g)·u 的热力图，横轴是门控分支 g，纵轴是线性分支 u。
// 设置写在 data-config 里：gate（lib/fns.js 的 REGISTRY 键）、range（两个轴的范围 ±range）、limit（色阶的范围 ±limit）。
import { REGISTRY } from './fns.js';
import { richHTML } from './labels.js';
import { readColor, onColorSchemeChange } from '../../../lib/tokens.js';

const N = 160;
const mix = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t));

/** 初始化一个 .glu-heatmap 元素。 */
export function initGluHeatmap(host){
  const { gate, range: R, limit: L } = JSON.parse(host.dataset.config);
  const f = REGISTRY[gate].f, product = `$${REGISTRY[gate].tex}(g)\\cdot u$`;
  const cv = host.querySelector('canvas'), tip = host.querySelector('.tip');
  cv.width = N; cv.height = N;
  host.querySelector('.heat-y-title').innerHTML = richHTML('线性分支 $u$');
  host.querySelector('.heat-x-label').innerHTML = richHTML('门控分支 $g$');
  host.querySelector('.cbar-title').innerHTML = richHTML(product);

  function draw(){
    const neg = readColor('--div-neg'), mid = readColor('--div-mid'), pos = readColor('--div-pos');
    const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N);
    for(let j = 0; j < N; j++){
      const u = R - 2 * R * j / (N - 1);
      for(let i = 0; i < N; i++){
        const g = -R + 2 * R * i / (N - 1);
        const v = Math.max(-L, Math.min(L, f(g) * u)) / L;
        const c = v < 0 ? mix(mid, neg, -v) : mix(mid, pos, v), k = (j * N + i) * 4;
        img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  draw();
  onColorSchemeChange(draw);

  cv.addEventListener('pointermove', ev => {
    const r = cv.getBoundingClientRect();
    const g = -R + 2 * R * (ev.clientX - r.left) / r.width, u = R - 2 * R * (ev.clientY - r.top) / r.height;
    tip.innerHTML = `${richHTML('$g$')} ${g.toFixed(2)} ${richHTML('$u$')} ${u.toFixed(2)}<br>${richHTML(product)} ${(f(g) * u).toFixed(3)}`;
    tip.hidden = false;
    const x = ev.clientX - r.left;
    tip.style.top = (ev.clientY - r.top + 14) + 'px';
    tip.style.left = (x > r.width * 0.6 ? x - tip.offsetWidth - 12 : x + 12) + 'px';
  });
  cv.addEventListener('pointerleave', () => { tip.hidden = true; });
}
