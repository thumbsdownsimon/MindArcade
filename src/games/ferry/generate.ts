// Random animal puzzles. Most random mixes are pointless (a bear with nothing to eat) or unsolvable, so a candidate
// is kept only if every animal takes part in a rule, the solver can solve it, and its rating lands in the wanted tier.
// People puzzles aren't generated: every useful police-and-thief family is already in the named list.

import { pick, randInt } from '../../lib/util';
import { EATS, LABEL, type Kind, type Puzzle, type Tier } from './engine';
import { rate } from './rating';

/** Most of each animal a puzzle can have. The bank fits 8 characters. */
const MAX: [Kind, number][] = [
  ['blackfox', 1],
  ['fox', 2],
  ['chicken', 2],
  ['larva', 3],
  ['wolf', 4],
  ['sheep', 3],
  ['bear', 1],
  ['dog', 1],
];

/** Longest generated puzzle. Long single-seat puzzles are mostly ferrying, not thinking. */
const MAX_TRIPS = 13;

/** Whether every animal can eat or be eaten by another one, and the sheepdog has someone to guard. */
function allInvolved(kinds: Kind[]) {
  const eats = (a: Kind, b: Kind) => (EATS[a]?.includes(b) ?? false) || (a === 'wolf' && b === 'sheep');
  return kinds.every((k) =>
    k === 'dog' ? kinds.some((a) => a !== 'bear' && kinds.some((b) => eats(a, b))) : kinds.some((o) => eats(k, o) || eats(o, k)),
  );
}

const PLURAL: Partial<Record<Kind, string>> = { fox: 'foxes', blackfox: 'black foxes', larva: 'larvae', wolf: 'wolves', sheep: 'sheep' };

/** A title listing the cast, e.g. "A black fox, 2 chickens & a larva". */
function titleFor(kinds: Kind[]) {
  const parts = MAX.map(([k]) => [k, kinds.filter((x) => x === k).length] as const)
    .filter(([, n]) => n)
    .map(([k, n]) => (n > 1 ? `${n} ${PLURAL[k] ?? LABEL[k].toLowerCase() + 's'}` : `a ${LABEL[k].toLowerCase()}`));
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}` : parts[0];
  return text[0].toUpperCase() + text.slice(1);
}

/** Canonical identity of a puzzle, so a run never shows the same cast and raft twice. */
export const puzzleKey = (p: Pick<Puzzle, 'kinds' | 'capacity' | 'sailor'>) =>
  `${[...p.kinds].sort().join(',')}/${p.capacity}/${p.sailor !== false}`;

/** One random animal puzzle of the given tier, avoiding `taken` keys, or null if none turned up in time. */
export function generatePuzzle(tier: Tier, taken: Set<string>, attempts = 1000): Puzzle | null {
  // Nearly every hard puzzle, and every expert one, has the black fox, no sheepdog and a raft with 2 or 3 seats.
  // Drawing only those keeps the search short.
  const tough = tier === 'hard' || tier === 'expert';
  const count = (k: Kind, max: number) => {
    if (tough && k === 'blackfox') return 1;
    if (tough && k === 'dog') return 0;
    // Skip each animal half the time, so casts vary in size instead of always being full.
    return Math.random() < 0.5 ? 0 : randInt(1, max);
  };
  for (let i = 0; i < attempts; i++) {
    const kinds = MAX.flatMap(([k, max]) => Array<Kind>(count(k, max)).fill(k));
    // A warm-up should be quick to take in, so it gets a smaller cast.
    if (kinds.length < 3 || kinds.length > (tier === 'easy' ? 5 : 8) || !allInvolved(kinds)) continue;
    const capacity = tough || kinds.includes('bear') ? pick([2, 3]) : pick([1, 2, 2, 3]);
    const p: Puzzle = { title: titleFor(kinds), tier, kinds, capacity };
    if (taken.has(puzzleKey(p))) continue;
    const r = rate(p);
    if (r && r.tier === tier && r.min <= MAX_TRIPS && r.difficulty >= 2.5) return p;
  }
  return null;
}
