// 本主题多个演示共用的函数：浮点舍入与 ulp、数字格式化、带种子的随机数、正态分布、SVG 坐标轴。
import { fmtByName, decode, encode } from '../../../lib/fmt.js';
import { el } from '../../../lib/svg.js';

export const F16 = fmtByName('float16');
export const BF16 = fmtByName('bfloat16');
export const F32 = fmtByName('float32');
export const E4M3 = fmtByName('float8_e4m3fn');
export const E5M2 = fmtByName('float8_e5m2');

// src/lib/fmt.js 内部有同名函数但没有导出
export const pow2 = n => Math.pow(2, n);

/** 把 x 舍入到格式 f 后的值 */
export function rt(f, x){ return decode(f, encode(f, x)).value; }

/** 格式 f 中 x 附近相邻两个可表示数的间距；subnormal 区间内是最小 subnormal */
export function ulpOf(f, x){
  const d = decode(f, encode(f, Math.abs(x)));
  if(d.cls === 'inf' || d.cls === 'nan') return NaN;
  if(d.cls === 'zero' || d.cls === 'sub') return pow2(1 - f.bias - f.m);
  return pow2(d.pow);
}

/** 保留 p 位有效数字；很大或很小的数用科学计数法 */
export function num(x, p){
  if(x !== x) return 'NaN';
  if(!isFinite(x)) return x > 0 ? 'inf' : '-inf';
  if(x === 0) return '0';
  const a = Math.abs(x); p = p || 5;
  if(a >= 1e6 || a < 1e-4) return x.toExponential(p - 1).replace(/\.?0+e/, 'e');
  return String(parseFloat(x.toPrecision(p)));
}

export function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

/** 带种子的伪随机数生成器（mulberry32），返回 [0, 1) 内的数 */
export function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Box-Muller 变换得到的标准正态样本 */
export function gauss(rnd){ let u = 0, v = 0; while(u === 0) u = rnd(); while(v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function erf(x){
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
/** 标准正态分布的累积分布函数 */
export function ncdf(x){ return 0.5 * (1 + erf(x / Math.SQRT2)); }

/** 坐标轴刻度的步长：取 1、2、5、10 乘以 10 的整数次幂中最接近 x 的值 */
export function niceStep(x){ const e = Math.pow(10, Math.floor(Math.log10(x))); const f = x / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; }

/**
 * 在 host 里画一张带网格和坐标轴的空图，返回坐标变换函数和两个图层。
 * o.xr、o.yr 是坐标范围，o.xt、o.yt 是刻度，o.xf、o.yf 格式化刻度文字，o.xl、o.yl 是坐标轴标题。
 * bg 图层在网格下面，用来画区间底色；body 图层在网格上面，用来画数据。
 */
export function mkPlot(host, o){
  const W = o.W || 680, H = o.H || 300, ml = o.ml || 58, mr = o.mr || 16, mt = o.mt || 14, mb = o.mb || 42;
  const X = x => ml + (x - o.xr[0]) / (o.xr[1] - o.xr[0]) * (W - ml - mr);
  const Y = y => H - mb - (y - o.yr[0]) / (o.yr[1] - o.yr[0]) * (H - mt - mb);
  let s = '';
  for(const t of o.xt){ const x = X(t); s += `<line x1="${x}" x2="${x}" y1="${mt}" y2="${H - mb}" stroke="var(--grid)"/><text x="${x}" y="${H - mb + 15}" text-anchor="middle">${o.xf ? o.xf(t) : t}</text>`; }
  for(const t of o.yt){ const y = Y(t); s += `<line x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${ml - 6}" y="${y + 4}" text-anchor="end">${o.yf ? o.yf(t) : t}</text>`; }
  s += `<line x1="${ml}" x2="${W - mr}" y1="${H - mb}" y2="${H - mb}" stroke="var(--axis)"/><line x1="${ml}" x2="${ml}" y1="${mt}" y2="${H - mb}" stroke="var(--axis)"/>`;
  if(o.xl) s += `<text class="lab" x="${(ml + W - mr) / 2}" y="${H - 6}" text-anchor="middle">${o.xl}</text>`;
  if(o.yl) s += `<text class="lab" transform="translate(13,${(mt + H - mb) / 2}) rotate(-90)" text-anchor="middle">${o.yl}</text>`;
  host.innerHTML = '';
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
  if(o.aria) svg.setAttribute('aria-label', o.aria);
  svg.innerHTML = `<g class="bg"></g>${s}<g class="body"></g>`;
  host.appendChild(svg);
  return { svg, X, Y, W, H, ml, mr, mt, mb, bg: svg.querySelector('.bg'), body: svg.querySelector('.body') };
}
