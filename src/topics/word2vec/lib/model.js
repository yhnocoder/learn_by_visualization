// Skip-gram 的数值计算，供“一步更新”和“二维训练”两个图共用。
// 参数矩阵按行优先存放在 Float64Array 里：第 w 行是 M[w*d] 到 M[w*d+d-1]。

/** 带种子的伪随机数生成器（mulberry32）。返回的函数每次调用给出 [0, 1) 内的一个数；getState() 返回当前状态，用于从某一步恢复。 */
export function mulberry32(a){
  const next = function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  next.getState = () => a;
  return next;
}

/** 数值稳定的 sigmoid。 */
export const sig = x => x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));

/** 完整 softmax 的前向计算：返回中心词 c 对应的词表上的分布 P(· | c)。 */
export function softmaxDist(V, U, n, d, c){
  const s = new Float64Array(n); let mx = -Infinity;
  for(let w = 0; w < n; w++){ let t = 0; for(let k = 0; k < d; k++) t += U[w*d+k] * V[c*d+k]; s[w] = t; if(t > mx) mx = t; }
  let Z = 0; for(let w = 0; w < n; w++){ s[w] = Math.exp(s[w] - mx); Z += s[w]; }
  for(let w = 0; w < n; w++) s[w] /= Z;
  return s;
}

/** 对样本 (c, o) 做一步完整 softmax 的梯度下降，原地修改 V 和 U，返回更新前的 loss。共享矩阵时 V 和 U 传入同一个数组。 */
export function stepSoftmax(V, U, n, d, c, o, lr){
  const p = softmaxDist(V, U, n, d, c);
  const loss = -Math.log(p[o]);
  const gv = new Float64Array(d);
  for(let w = 0; w < n; w++){ const g = p[w] - (w === o ? 1 : 0); for(let k = 0; k < d; k++) gv[k] += g * U[w*d+k]; }
  const vc = Array.from(V.subarray(c*d, c*d+d));
  for(let w = 0; w < n; w++){ const g = p[w] - (w === o ? 1 : 0); for(let k = 0; k < d; k++) U[w*d+k] -= lr * g * vc[k]; }
  for(let k = 0; k < d; k++) V[c*d+k] -= lr * gv[k];
  return loss;
}
