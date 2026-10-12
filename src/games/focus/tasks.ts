// Trial lists and scoring helpers for the three attention tasks. No React here.

import { pick, shuffle } from '../../lib/util';

export type TaskId = 'flanker' | 'stroop' | 'nback';

export interface FlankerTrial {
  dir: 'left' | 'right';
  congruent: boolean;
}

export const INKS = [
  { name: 'Red', color: '#ef4444' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Yellow', color: '#facc15' },
];

export interface StroopTrial {
  word: number;
  ink: number;
}

export interface NbackTrial {
  letter: string;
  target: boolean;
}

/** Half congruent, half not, shuffled. */
export function flankerTrials(n: number): FlankerTrial[] {
  return shuffle(Array.from({ length: n }, (_, i) => ({ dir: i % 2 ? 'left' : 'right', congruent: i % 4 < 2 }) as FlankerTrial));
}

export function stroopTrials(n: number): StroopTrial[] {
  return shuffle(
    Array.from({ length: n }, (_, i) => {
      const ink = i % 4;
      // Half the trials show a mismatching word: the conflict trials.
      const word = i % 8 < 4 ? ink : pick([0, 1, 2, 3].filter((w) => w !== ink));
      return { word, ink };
    }),
  );
}

const LETTERS = 'BCDFGHJKLMNPRSTVXZ'.split('');

/** A 2-back stream of `n` letters with about 30% targets. Non-targets never match by accident. */
export function nbackTrials(n: number): NbackTrial[] {
  const set = shuffle(LETTERS).slice(0, 8);
  const targets = new Set(shuffle([...Array(n - 2).keys()].map((k) => k + 2)).slice(0, Math.round((n - 2) * 0.3)));
  const out: NbackTrial[] = [];
  for (let i = 0; i < n; i++) {
    if (targets.has(i)) out.push({ letter: out[i - 2].letter, target: true });
    else out.push({ letter: pick(set.filter((l) => i < 2 || l !== out[i - 2].letter)), target: false });
  }
  return out;
}

/** Inverse of the standard normal CDF (Acklam's approximation). */
function probit(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) return -probit(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Sensitivity d′ with the log-linear correction, so perfect scores stay finite. */
export function dPrime(hits: number, targets: number, falseAlarms: number, lures: number) {
  return probit((hits + 0.5) / (targets + 1)) - probit((falseAlarms + 0.5) / (lures + 1));
}
