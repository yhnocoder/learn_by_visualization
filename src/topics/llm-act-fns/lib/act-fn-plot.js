// ActFnPlot 组件的浏览器端脚本：读取组件写在 data-config 里的设置，画出 f(x) 与 df(x)/dx 两个面板，
// 并生成图例、复选框、参数滑块、横轴缩放滑块和状态行。设置的字段见 components/ActFnPlot.astro。
import { REGISTRY, C } from './fns.js';
import { curveGuides } from './guides.js';
import { richHTML } from './labels.js';
import { plot } from './plot.js';

let uid = 0;

/** 初始化一个 .act-fn-plot 元素。 */
export function initActFnPlot(host){
  const cfg = JSON.parse(host.dataset.config);
  const id = host.closest('figure')?.id || host.id || 'act-fn-plot-' + (uid++);
  const range = cfg.range || [-4, 4];
  const legend = host.querySelector('.legend'), controls = host.querySelector('.controls'), status = host.querySelector('.chart-status');
  const pf = host.querySelector('.panel[data-panel="f"]'), pd = host.querySelector('.panel[data-panel="d"]');
  pf.querySelector('h4').innerHTML = richHTML('$f(x)$');
  pd.querySelector('h4').innerHTML = richHTML('$\\frac{df(x)}{dx}$');

  const state = {};
  const items = cfg.fns.map((spec, i) => {
    const s = typeof spec === 'string' ? { fn: spec } : spec;
    const entry = REGISTRY[s.fn];
    if(!entry) throw new Error(`ActFnPlot：没有名为 ${s.fn} 的函数，可选：${Object.keys(REGISTRY).join('、')}`);
    const color = s.color == null ? C(i + 1) : typeof s.color === 'number' ? C(s.color) : s.color;
    return { ...s, key: s.key || s.fn, entry, name: s.name || entry.name, color, hidden: s.on === false };
  });
  const value = (s, d) => x => (d ? s.entry.d : s.entry.f)(x, s.entry.param ? state[s.entry.param.key] : undefined);

  // 未给出纵轴范围时，按当前显示的曲线在横轴范围内的取值确定，上下各留 12%
  const fit = (d, a, b) => {
    let lo = Infinity, hi = -Infinity;
    for(const s of items){
      if(s.hidden) continue;
      const fn = value(s, d);
      for(let i = 0; i <= 200; i++){ const y = fn(a + (b - a) * i / 200); if(isFinite(y)){ lo = Math.min(lo, y); hi = Math.max(hi, y); } }
    }
    const pad = Math.max((hi - lo) * 0.12, 1e-3);
    return [lo - pad, hi + pad];
  };

  let P1, P2;
  function build(xr, yf, yd){
    P1?.remove(); P2?.remove();
    P1 = plot(pf, { x: xr, y: yf || fit(false, ...xr), label: cfg.label + ' 函数' });
    P2 = plot(pd, { x: xr, y: yd || fit(true, ...xr), label: cfg.label + ' 导数' });
  }

  if(cfg.toggle){
    for(const s of items){
      const l = document.createElement('label'); l.style.setProperty('--c', s.color);
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !s.hidden; c.id = id + '-' + s.key;
      c.addEventListener('change', () => { s.hidden = !c.checked; render(); });
      const sw = document.createElement('i'); sw.className = 'sw';
      const nm = document.createElement('span'); nm.innerHTML = richHTML(s.name);
      l.append(c, sw, nm); controls.appendChild(l);
    }
  }else{
    for(const s of items){
      const sp = document.createElement('span'), i = document.createElement('i');
      i.style.setProperty('--c', s.color); if(s.dash) i.className = 'dash';
      const nm = document.createElement('span'); nm.innerHTML = richHTML(s.name);
      sp.append(i, nm); legend.appendChild(sp);
    }
  }

  function slider(name, min, max, step, val, key, onInput){
    const l = document.createElement('label'), nm = document.createElement('span'); nm.innerHTML = richHTML(name);
    const inp = document.createElement('input'); Object.assign(inp, { type: 'range', min, max, step, value: val, id: id + '-' + key });
    const v = document.createElement('span'); v.className = 'v'; v.textContent = (+val).toFixed(2);
    inp.addEventListener('input', () => { v.textContent = (+inp.value).toFixed(2); onInput(+inp.value); });
    l.append(nm, inp, v); controls.appendChild(l);
    return inp;
  }

  // 有可调参数的函数（例如 Swish 的 β）各有一个滑块
  for(const s of items){
    const p = s.entry.param; if(!p || p.key in state) continue;
    state[p.key] = s.value ?? p.value;
    slider(p.name, p.min, p.max, p.step, state[p.key], p.key, v => { state[p.key] = v; render(); });
  }

  build(range, cfg.yf, cfg.yd);
  if(cfg.zoom){
    let w = range[1], c = 0;
    const apply = () => {
      if(w >= range[1] && c === 0) build(range, cfg.yf, cfg.yd);
      else{ const xr = [c - w, c + w]; build(xr, fit(false, ...xr), fit(true, ...xr)); }
      render();
    };
    slider('横轴范围 ±', cfg.zoom.min, range[1], cfg.zoom.step || 0.25, range[1], 'zoom', v => { w = v; apply(); });
    slider('横轴中心', range[0], range[1], 0.1, 0, 'center', v => { c = v; apply(); });
  }
  if(!controls.children.length) controls.remove();

  const statusItem = items.find(s => s.entry.status);
  const guides = d => {
    if(cfg.guides === 'auto') return curveGuides(items[0].entry.guide, d, state.b, items[0].color, range);
    return cfg.guides ? (d ? cfg.guides.d : cfg.guides.f) : undefined;
  };
  function render(){
    const data = d => items.map(s => ({ name: s.name, color: s.color, dash: s.dash, faint: s.faint, hidden: s.hidden, breaks: d ? s.entry.dBreaks || [] : [], fn: value(s, d) }));
    P1.draw(data(false), guides(false));
    P2.draw(data(true), guides(true));
    if(statusItem) status.innerHTML = richHTML(statusItem.entry.status(state[statusItem.entry.param.key]));
    else status.textContent = '';
  }
  render();
}
