// Difficulty rating for ferry puzzles. The trip count alone is a poor guide: a long puzzle can be a chore with no
// real decisions, while a short one can hinge on a move nobody wants to make. Like Tower of London ratings, this
// counts the decisions that trip people up. Kept free of React so it can be tested on its own.

import { boatProblem, cross, hasSailor, stateKey, subsets, tripConflict, type Puzzle, type State, type Tier } from './engine';

export interface Rating {
  /** Fewest trips. */
  min: number;
  /** Return trips in the best solution that must bring a passenger back: the counter-intuitive move. */
  detours: number;
  /** Summed share of wrong choices along the best solution: trips that are unsafe or lead nowhere. */
  traps: number;
  difficulty: number;
  tier: Tier;
}

/** Difficulty where each tier starts. Tuned so the classic fox-chicken-larva puzzle is a warm-up and the famous IQ puzzle is expert. */
const TIER_FROM: [Tier, number][] = [
  ['expert', 13],
  ['hard', 8.5],
  ['medium', 5],
  ['easy', 0],
];

/** Rates a puzzle, or returns null when it can't be solved. */
export function rate(p: Puzzle): Rating | null {
  const start: State = { side: p.kinds.map(() => 0), boat: 0 };
  const goal = stateKey({ side: p.kinds.map(() => 1), boat: 1 });

  // Every safe state that can be reached, and the safe trips out of it. A Map visits entries added while it is
  // being iterated, so this loop is a breadth-first search.
  const states = new Map([[stateKey(start), start]]);
  const trips = new Map<string, { load: number[]; to: string }[]>();
  for (const [k, s] of states) {
    const here = s.side.map((_, i) => i).filter((i) => s.side[i] === s.boat);
    const out: { load: number[]; to: string }[] = [];
    for (const load of subsets(here, p.capacity)) {
      if (boatProblem(p, load) || tripConflict(p, s, load)) continue;
      const n = cross(s, load);
      const to = stateKey(n);
      out.push({ load, to });
      if (!states.has(to)) states.set(to, n);
    }
    trips.set(k, out);
  }
  if (!states.has(goal)) return null;

  // Trips left to the goal from every state, by searching backwards from the goal.
  const into = new Map<string, string[]>();
  for (const [from, out] of trips) for (const t of out) into.set(t.to, [...(into.get(t.to) ?? []), from]);
  const left = new Map([[goal, 0]]);
  for (const [k, d] of left) for (const from of into.get(k) ?? []) if (!left.has(from)) left.set(from, d + 1);

  const isDetour = (s: State, load: number[]) => s.boat === 1 && load.length > (hasSailor(p) ? 0 : 1);
  const best = (k: string) => trips.get(k)!.filter((t) => left.get(t.to) === left.get(k)! - 1);
  // Fewest detours from each state among the shortest solutions. `left` is ordered nearest the goal first.
  const detours = new Map<string, number>();
  for (const k of left.keys())
    detours.set(k, k === goal ? 0 : Math.min(...best(k).map((t) => detours.get(t.to)! + +isDetour(states.get(k)!, t.load))));

  // Walk the shortest solution with the fewest detours and add up the share of choices that are wrong at each step.
  let traps = 0;
  for (let k = stateKey(start); k !== goal; ) {
    const s = states.get(k)!;
    const here = s.side.map((_, i) => i).filter((i) => s.side[i] === s.boat);
    const options = subsets(here, p.capacity).filter((load) => !boatProblem(p, load)).length;
    const good = best(k);
    // Sailing back empty is the natural default, so a return trip only tests you when that default is wrong.
    if (!(hasSailor(p) && s.boat === 1 && good.some((t) => !t.load.length))) traps += 1 - good.length / options;
    k = good.find((t) => detours.get(t.to)! + +isDetour(s, t.load) === detours.get(k))!.to;
  }

  const d = detours.get(stateKey(start))!;
  // Without a sailor every trip has three groups to check (both banks and the raft), which the trap count understates.
  const difficulty = Math.round((traps + 1.5 * d + (hasSailor(p) ? 0 : 2)) * 10) / 10;
  return { min: left.get(stateKey(start))!, detours: d, traps, difficulty, tier: TIER_FROM.find(([, from]) => difficulty >= from)![0] };
}
