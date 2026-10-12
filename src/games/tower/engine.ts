// Tower of London: coloured blocks on pegs of different heights. Move one top block at a time
// to turn the start layout into the goal layout in as few moves as possible.

import { pick, shuffle } from '../../lib/util';

/** Block ids per peg, bottom to top. */
export type Pegs = number[][];

export interface Puzzle {
  caps: number[];
  start: Pegs;
  goal: Pegs;
  min: number;
}

export type Move = [from: number, to: number];

const key = (p: Pegs) => p.map((s) => s.join('')).join('|');

export function same(a: Pegs, b: Pegs) {
  return key(a) === key(b);
}

export function legalMoves(p: Pegs, caps: number[]): Move[] {
  const out: Move[] = [];
  p.forEach((from, f) => {
    if (!from.length) return;
    p.forEach((to, t) => {
      if (t !== f && to.length < caps[t]) out.push([f, t]);
    });
  });
  return out;
}

export function apply(p: Pegs, [f, t]: Move): Pegs {
  const n = p.map((s) => [...s]);
  n[t].push(n[f].pop()!);
  return n;
}

/** Shortest move sequence from `a` to `b`. */
export function solve(a: Pegs, b: Pegs, caps: number[]): Move[] {
  const goal = key(b);
  const prev = new Map<string, { from: string; move: Move } | null>([[key(a), null]]);
  let frontier = [a];
  while (frontier.length) {
    const next: Pegs[] = [];
    for (const s of frontier) {
      const k = key(s);
      if (k === goal) {
        const path: Move[] = [];
        for (let c = k, step = prev.get(c); step; c = step.from, step = prev.get(c)) path.unshift(step.move);
        return path;
      }
      for (const m of legalMoves(s, caps)) {
        const n = apply(s, m);
        const nk = key(n);
        if (!prev.has(nk)) {
          prev.set(nk, { from: k, move: m });
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return [];
}

/** All layouts at exactly `depth` moves from `a`. */
function atDepth(a: Pegs, caps: number[], depth: number): Pegs[] {
  const seen = new Set([key(a)]);
  let frontier = [a];
  for (let d = 0; d < depth; d++) {
    const next: Pegs[] = [];
    for (const s of frontier)
      for (const m of legalMoves(s, caps)) {
        const n = apply(s, m);
        const k = key(n);
        if (!seen.has(k)) {
          seen.add(k);
          next.push(n);
        }
      }
    frontier = next;
  }
  return frontier;
}

function randomLayout(caps: number[], blocks: number): Pegs {
  const p: Pegs = caps.map(() => []);
  for (const b of shuffle([...Array(blocks).keys()])) {
    const open = caps.map((_, i) => i).filter((i) => p[i].length < caps[i]);
    p[pick(open)].push(b);
  }
  return p;
}

/** A puzzle whose shortest solution is exactly `min` moves. */
export function generate(caps: number[], blocks: number, min: number): Puzzle {
  for (;;) {
    const start = randomLayout(caps, blocks);
    const goals = atDepth(start, caps, min);
    if (goals.length) return { caps, start, goal: pick(goals), min };
  }
}

/** The plan for a real run: 3-block puzzles first, then 4 blocks on taller pegs. */
export const PLAN: [blocks: number, min: number][] = [
  [3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6],
  [4, 5], [4, 6], [4, 7], [4, 8],
];
export const PRACTICE_PLAN: [blocks: number, min: number][] = [[3, 2], [3, 3], [3, 4]];

export const capsFor = (blocks: number) => (blocks === 3 ? [3, 2, 1] : [4, 3, 2]);
