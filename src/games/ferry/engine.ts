// River-crossing rules and solver. Kept free of React so it can be tested on its own.

export type Kind = 'fox' | 'blackfox' | 'chicken' | 'larva' | 'adult' | 'kid';

export interface Puzzle {
  title: string;
  kinds: Kind[];
  /** Passenger seats. The sailor is always on board, rows, and doesn't take a seat. */
  capacity: number;
}

/** Side of the river: 0 = start bank, 1 = destination bank. */
export interface State {
  side: (0 | 1)[];
  boat: 0 | 1;
}

export const EATS: Partial<Record<Kind, Kind[]>> = {
  fox: ['chicken'],
  chicken: ['larva'],
  blackfox: ['fox', 'chicken', 'larva'],
};

export const LABEL: Record<Kind, string> = {
  fox: 'Fox',
  blackfox: 'Black fox',
  chicken: 'Chicken',
  larva: 'Larva',
  adult: 'Adult',
  kid: 'Kid',
};

/** First predator/prey pair found among the given entities, or null if they are safe together. */
export function conflict(kinds: Kind[], ids: number[]): [number, number] | null {
  for (const a of ids) for (const b of ids) if (a !== b && EATS[kinds[a]]?.includes(kinds[b])) return [a, b];
  return null;
}

/** Why this boat load can't sail, or null if it can. */
export function boatProblem(p: Puzzle, load: number[]): string | null {
  if (load.length > p.capacity) return `The boat only has ${p.capacity} seat${p.capacity > 1 ? 's' : ''}.`;
  if (load.length === 1 && p.kinds[load[0]] === 'kid') return 'A kid can never travel alone. They need another passenger with them.';
  return null;
}

/** Entities left on the bank the boat departs from, once it has left. */
export function leftBehind(s: State, load: number[]) {
  return s.side.map((side, i) => i).filter((i) => s.side[i] === s.boat && !load.includes(i));
}

export function cross(s: State, load: number[]): State {
  const to = (1 - s.boat) as 0 | 1;
  return { side: s.side.map((side, i) => (load.includes(i) ? to : side)), boat: to };
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

/** Breadth-first search for the fewest crossings. Returns null when unsolvable. */
export function minCrossings(p: Puzzle): number | null {
  const start: State = { side: p.kinds.map(() => 0), boat: 0 };
  const seen = new Set([key(start)]);
  let frontier = [start];
  for (let depth = 0; frontier.length; depth++) {
    const next: State[] = [];
    for (const s of frontier) {
      if (s.side.every((x) => x === 1)) return depth;
      const here = s.side.map((_, i) => i).filter((i) => s.side[i] === s.boat);
      for (const load of subsets(here, p.capacity)) {
        if (boatProblem(p, load)) continue;
        if (conflict(p.kinds, leftBehind(s, load))) continue;
        const n = cross(s, load);
        const k = key(n);
        if (!seen.has(k)) {
          seen.add(k);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return null;
}
