export const SENTENCE = ['problems', 'turning', 'into', 'banking', 'crises', 'as', 'has', 'happened'];

export function mulberry32(seed) {
  let state = seed;
  const next = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  next.state = () => state;
  return next;
}

export const sigmoid = (x) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)));

export function softmaxDistribution(V, U, count, dimension, center) {
  const scores = new Float64Array(count);
  let largest = -Infinity;
  for (let word = 0; word < count; word++) {
    let score = 0;
    for (let k = 0; k < dimension; k++) score += U[word * dimension + k] * V[center * dimension + k];
    scores[word] = score;
    if (score > largest) largest = score;
  }
  let total = 0;
  for (let word = 0; word < count; word++) {
    scores[word] = Math.exp(scores[word] - largest);
    total += scores[word];
  }
  for (let word = 0; word < count; word++) scores[word] /= total;
  return scores;
}

export function stepSoftmax(V, U, count, dimension, center, context, rate) {
  const probabilities = softmaxDistribution(V, U, count, dimension, center);
  const loss = -Math.log(probabilities[context]);
  const centerGradient = new Float64Array(dimension);
  for (let word = 0; word < count; word++) {
    const coefficient = probabilities[word] - (word === context ? 1 : 0);
    for (let k = 0; k < dimension; k++) centerGradient[k] += coefficient * U[word * dimension + k];
  }
  const centerVector = Array.from(V.subarray(center * dimension, center * dimension + dimension));
  for (let word = 0; word < count; word++) {
    const coefficient = probabilities[word] - (word === context ? 1 : 0);
    for (let k = 0; k < dimension; k++) U[word * dimension + k] -= rate * coefficient * centerVector[k];
  }
  for (let k = 0; k < dimension; k++) V[center * dimension + k] -= rate * centerGradient[k];
  return loss;
}
