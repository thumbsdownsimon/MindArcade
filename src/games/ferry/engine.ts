// River-crossing rules and solver. Kept free of React so it can be tested on its own.

export type Kind =
  | 'fox'
  | 'blackfox'
  | 'chicken'
  | 'larva'
  | 'dog'
  | 'wolf'
  | 'sheep'
  | 'bear'
  | 'adult'
  | 'kid'
  | 'police'
  | 'thief'
  | 'father'
  | 'mother'
  | 'son'
  | 'daughter';

export type Tier = 'easy' | 'medium' | 'hard' | 'expert';

export interface Puzzle {
  title: string;
  tier: Tier;
  kinds: Kind[];
  /**
   * Seats on the raft. With a sailor these are passenger seats (the sailor rows and takes no seat).
   * Without a sailor, one of the passengers must be able to row.
   */
  capacity: number;
  /** Defaults to true. Without the sailor nobody guards the banks and someone on board has to row. */
  sailor?: boolean;
}

/** Side of the river: 0 = start bank, 1 = destination bank. */
export interface State {
  side: (0 | 1)[];
  boat: 0 | 1;
}

export interface Conflict {
  by: number;
  victim: number;
  text: string;
  /** The victim disappears (eaten). People only argue, so they stay put. */
  vanish: boolean;
}

export const EATS: Partial<Record<Kind, Kind[]>> = {
  fox: ['chicken'],
  chicken: ['larva'],
  blackfox: ['fox', 'chicken', 'larva'],
  bear: ['sheep', 'fox'],
};

export const LABEL: Record<Kind, string> = {
  fox: 'Fox',
  blackfox: 'Black fox',
  chicken: 'Chicken',
  larva: 'Larva',
  dog: 'Sheepdog',
  wolf: 'Wolf',
  sheep: 'Sheep',
  bear: 'Bear',
  adult: 'Adult',
  kid: 'Kid',
  police: 'Police officer',
  thief: 'Thief',
  father: 'Father',
  mother: 'Mother',
  son: 'Son',
  daughter: 'Daughter',
};

/** Seats a character takes up. */
export const weight = (k: Kind) => (k === 'bear' ? 2 : 1);

/** Who can row when there is no sailor. */
export const ROWERS: Kind[] = ['police', 'father', 'mother', 'adult'];

const FAMILY: Kind[] = ['father', 'mother', 'son', 'daughter'];
const isPerson = (k: Kind) => k === 'adult' || k === 'kid' || k === 'police' || k === 'thief' || FAMILY.includes(k);
export const isPersonKind = isPerson;

const lc = (k: Kind) => LABEL[k].toLowerCase();

/**
 * First problem among a group left together without the sailor, or null if they are safe.
 * The sheepdog stops animals eating each other on its bank, except the bear, which it can't stop.
 */
export function conflict(kinds: Kind[], ids: number[]): Conflict | null {
  const has = (k: Kind) => ids.some((i) => kinds[i] === k);
  const dog = has('dog');
  for (const a of ids)
    for (const b of ids) {
      if (a === b || !EATS[kinds[a]]?.includes(kinds[b])) continue;
      if (dog && kinds[a] !== 'bear') continue;
      return { by: a, victim: b, text: `the ${lc(kinds[a])} ate the ${lc(kinds[b])}`, vanish: true };
    }
  const wolves = ids.filter((i) => kinds[i] === 'wolf');
  const sheep = ids.filter((i) => kinds[i] === 'sheep');
  if (!dog && sheep.length && wolves.length > sheep.length)
    return { by: wolves[0], victim: sheep[0], text: `the wolves outnumbered the sheep and ate one`, vanish: true };

  if (has('thief') && !has('police')) {
    const v = ids.find((i) => FAMILY.includes(kinds[i]));
    if (v !== undefined) return { by: ids.find((i) => kinds[i] === 'thief')!, victim: v, text: `the thief robbed the ${lc(kinds[v])} because no police officer was there`, vanish: false };
  }
  if (has('father') && !has('mother')) {
    const v = ids.find((i) => kinds[i] === 'daughter');
    if (v !== undefined) return { by: ids.find((i) => kinds[i] === 'father')!, victim: v, text: 'the father told off the daughter because the mother wasn\'t there', vanish: false };
  }
  if (has('mother') && !has('father')) {
    const v = ids.find((i) => kinds[i] === 'son');
    if (v !== undefined) return { by: ids.find((i) => kinds[i] === 'mother')!, victim: v, text: 'the mother told off the son because the father wasn\'t there', vanish: false };
  }
  return null;
}

export const hasSailor = (p: Puzzle) => p.sailor !== false;

export const seatsUsed = (p: Puzzle, load: number[]) => load.reduce((s, i) => s + weight(p.kinds[i]), 0);

/** Why this boat load can't sail, or null if it can. */
export function boatProblem(p: Puzzle, load: number[]): string | null {
  if (seatsUsed(p, load) > p.capacity) return `The raft only has ${p.capacity} seat${p.capacity > 1 ? 's' : ''}.`;
  if (hasSailor(p)) {
    if (load.length === 1 && p.kinds[load[0]] === 'kid') return 'A kid can never travel alone. They need another passenger with them.';
  } else if (!load.some((i) => ROWERS.includes(p.kinds[i]))) {
    const rowers = [...new Set(p.kinds.filter((k) => ROWERS.includes(k)))].map(lc);
    return `There is no sailor here. Someone who can row (${rowers.join(', ')}) must be on board.`;
  }
  return null;
}

/** Entities left on the bank the boat departs from, once it has left. */
export function leftBehind(s: State, load: number[]) {
  return s.side.map((_, i) => i).filter((i) => s.side[i] === s.boat && !load.includes(i));
}

export function cross(s: State, load: number[]): State {
  const to = (1 - s.boat) as 0 | 1;
  return { side: s.side.map((side, i) => (load.includes(i) ? to : side)), boat: to };
}

/**
 * What goes wrong if this load sails, or null if the trip is safe.
 * With a sailor only the bank left behind is at risk. Without one, every group counts: the bank left
 * behind, the passengers on the raft, and everyone on the bank the raft arrives at.
 */
export function tripConflict(p: Puzzle, s: State, load: number[]): Conflict | null {
  const behind = conflict(p.kinds, leftBehind(s, load));
  if (behind || hasSailor(p)) return behind;
  const onBoard = conflict(p.kinds, load);
  if (onBoard) return onBoard;
  const to = 1 - s.boat;
  return conflict(p.kinds, [...s.side.map((_, i) => i).filter((i) => s.side[i] === to), ...load]);
}

const key = (s: State) => s.side.join('') + s.boat;

function subsets(ids: number[], max: number): number[][] {
  const out: number[][] = [[]];
  for (const id of ids) {
    const n = out.length;
    for (let i = 0; i < n; i++) if (out[i].length < max) out.push([...out[i], id]);
  }
  return out;
}

/** Breadth-first search from `start`. Returns the loads of a shortest solution, or null when unsolvable. */
export function solve(p: Puzzle, start: State = { side: p.kinds.map(() => 0), boat: 0 }): number[][] | null {
  const prev = new Map<string, { from: string; load: number[] } | null>([[key(start), null]]);
  let frontier = [start];
  while (frontier.length) {
    const next: State[] = [];
    for (const s of frontier) {
      if (s.side.every((x) => x === 1)) {
        const path: number[][] = [];
        for (let k = key(s), step = prev.get(k); step; k = step.from, step = prev.get(k)) path.unshift(step.load);
        return path;
      }
      const here = s.side.map((_, i) => i).filter((i) => s.side[i] === s.boat);
      for (const load of subsets(here, p.capacity)) {
        if (boatProblem(p, load) || tripConflict(p, s, load)) continue;
        const n = cross(s, load);
        const k = key(n);
        if (!prev.has(k)) {
          prev.set(k, { from: key(s), load });
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** Fewest crossings, or null when unsolvable. */
export function minCrossings(p: Puzzle): number | null {
  return solve(p)?.length ?? null;
}
