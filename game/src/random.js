// Deterministic randomness for Neon Bay 3D: a mulberry32 generator plus the
// helpers the city builder leans on — range, int, pick, chance, shuffle.
// Everything here is a pure function, so a seed always rebuilds the same city.
// Exports: createRandom, range, int, pick, chance, shuffle.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, low, high) {
  return low + rng() * (high - low);
}

export function int(rng, low, high) {
  return Math.floor(range(rng, low, high + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function chance(rng, probability) {
  return rng() < probability;
}

export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
