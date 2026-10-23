// The model of the Skip-gram figures: a seeded random generator and one step of full softmax.
export function mulberry32(a) {
  const next = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  next.getState = () => a
  return next
}

export const sigmoid = (x) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)))

// 完整 softmax 的前向：返回词表上的分布
export function softmaxDist(V, U, n, d, c) {
  const s = new Float64Array(n)
  let max = -Infinity
  for (let w = 0; w < n; w++) {
    let t = 0
    for (let k = 0; k < d; k++) t += U[w * d + k] * V[c * d + k]
    s[w] = t
    if (t > max) max = t
  }
  let Z = 0
  for (let w = 0; w < n; w++) {
    s[w] = Math.exp(s[w] - max)
    Z += s[w]
  }
  for (let w = 0; w < n; w++) s[w] /= Z
  return s
}

// 完整 softmax 的一步更新，返回 loss。共享矩阵时传入同一个数组即可。
export function stepSoftmax(V, U, n, d, c, o, lr) {
  const p = softmaxDist(V, U, n, d, c)
  const loss = -Math.log(p[o])
  const gv = new Float64Array(d)
  for (let w = 0; w < n; w++) {
    const g = p[w] - (w === o ? 1 : 0)
    for (let k = 0; k < d; k++) gv[k] += g * U[w * d + k]
  }
  const vc = Array.from(V.subarray(c * d, c * d + d))
  for (let w = 0; w < n; w++) {
    const g = p[w] - (w === o ? 1 : 0)
    for (let k = 0; k < d; k++) U[w * d + k] -= lr * g * vc[k]
  }
  for (let k = 0; k < d; k++) V[c * d + k] -= lr * gv[k]
  return loss
}
