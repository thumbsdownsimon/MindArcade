export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

export const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

export function shuffle<T>(a: readonly T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

export const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);

export function median(a: number[]) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function std(a: number[]) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
}

/** Pearson correlation, or null when either series has no variance. */
export function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/** Linear 0..1 score: `worst` maps to 0, `best` maps to 1 (works in either direction). */
export const scale = (v: number, worst: number, best: number) => clamp((v - worst) / (best - worst));

export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const ms = (v: number) => `${Math.round(v)} ms`;
export const secs = (v: number) => `${(v / 1000).toFixed(1)} s`;
