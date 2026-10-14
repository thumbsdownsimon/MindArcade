import { pick, shuffle } from '../../lib/util';
import type { Puzzle, Tier } from './engine';
import { generatePuzzle, puzzleKey } from './generate';
import { rate } from './rating';

// Named puzzles: hand-made ones and classics that fit these rules. Their tier isn't set by hand but comes from
// the rating (rating.ts), the same as for generated puzzles. Each note gives the fewest trips and the rated tier.

type Named = Omit<Puzzle, 'tier'>;

const CLASSIC: Named = { title: 'The classic crossing', kinds: ['fox', 'chicken', 'larva'], capacity: 1 }; // 7, easy

const ANIMALS: Named[] = [
  CLASSIC,
  { title: 'Double larva', kinds: ['fox', 'chicken', 'larva', 'larva'], capacity: 2 }, // 5, easy
  { title: 'The sheepdog', kinds: ['dog', 'fox', 'chicken', 'larva'], capacity: 1 }, // 7, easy
  { title: 'Wolves at the river', kinds: ['wolf', 'wolf', 'sheep', 'sheep'], capacity: 1 }, // 7, easy
  { title: 'Heavy passenger', kinds: ['bear', 'sheep', 'fox', 'chicken'], capacity: 2 }, // 7, easy
  { title: 'Bear and sheepdog', kinds: ['bear', 'dog', 'sheep', 'fox', 'chicken', 'larva'], capacity: 2 }, // 7, easy
  { title: 'Dog on duty', kinds: ['dog', 'wolf', 'wolf', 'wolf', 'sheep', 'sheep', 'sheep'], capacity: 1 }, // 13, easy
  { title: 'Enter the black fox', kinds: ['blackfox', 'fox', 'chicken', 'larva'], capacity: 2 }, // 5, medium
  { title: 'Crowded farm', kinds: ['fox', 'fox', 'chicken', 'chicken', 'larva'], capacity: 2 }, // 7, medium
  { title: 'Wolf pack', kinds: ['wolf', 'wolf', 'wolf', 'wolf', 'sheep', 'sheep', 'sheep'], capacity: 2 }, // 9, medium
  { title: 'Black fox in the henhouse', kinds: ['blackfox', 'chicken', 'chicken', 'larva'], capacity: 2 }, // 5, medium
  { title: 'One brave sheep', kinds: ['wolf', 'wolf', 'wolf', 'wolf', 'sheep'], capacity: 1 }, // 11, medium
  { title: 'Bear among wolves', kinds: ['bear', 'wolf', 'wolf', 'wolf', 'sheep', 'sheep'], capacity: 2 }, // 9, medium
  { title: 'Big raft, big appetites', kinds: ['bear', 'blackfox', 'chicken', 'larva', 'sheep'], capacity: 3 }, // 5, medium
  { title: 'Black fox & the flock', kinds: ['blackfox', 'chicken', 'larva', 'sheep', 'sheep', 'wolf'], capacity: 2 }, // 9, hard
  { title: 'Two foxes & the flock', kinds: ['blackfox', 'fox', 'chicken', 'wolf', 'sheep', 'sheep'], capacity: 2 }, // 9, hard
  { title: 'Black fox meets the wolf', kinds: ['blackfox', 'chicken', 'larva', 'wolf', 'sheep'], capacity: 2 }, // 7, hard
  { title: 'Bear and black fox', kinds: ['bear', 'blackfox', 'fox', 'larva', 'larva', 'larva'], capacity: 2 }, // 9, hard
  { title: 'Three seats, seven passengers', kinds: ['bear', 'blackfox', 'fox', 'chicken', 'wolf', 'wolf', 'sheep'], capacity: 3 }, // 7, hard
  { title: 'Larva convoy', kinds: ['blackfox', 'fox', 'fox', 'chicken', 'larva', 'larva', 'larva'], capacity: 3 }, // 9, expert
  { title: 'Small farm, big trouble', kinds: ['blackfox', 'fox', 'chicken', 'chicken', 'wolf', 'sheep'], capacity: 2 }, // 9, expert
  { title: 'The whole farm', kinds: ['blackfox', 'fox', 'chicken', 'wolf', 'wolf', 'sheep', 'sheep'], capacity: 2 }, // 11, expert
  { title: 'Predators everywhere', kinds: ['blackfox', 'fox', 'chicken', 'larva', 'wolf', 'wolf', 'wolf'], capacity: 2 }, // 11, expert
  { title: 'Long night on the farm', kinds: ['blackfox', 'chicken', 'larva', 'larva', 'wolf', 'sheep', 'sheep'], capacity: 2 }, // 11, expert
];

/**
 * People puzzles. With a sailor, kids can't travel alone. Without one, these are the police-and-thief family from
 * the well-known Japanese IQ test and its variants: every hard and expert family the solver finds is here.
 */
const PEOPLE: Named[] = [
  { title: 'Family trip', kinds: ['adult', 'adult', 'kid', 'kid', 'kid', 'kid'], capacity: 2 }, // 5, easy
  { title: 'One parent, four kids', kinds: ['adult', 'kid', 'kid', 'kid', 'kid'], capacity: 2 }, // 5, easy
  { title: 'School outing', kinds: ['adult', 'adult', 'adult', 'kid', 'kid', 'kid'], capacity: 2 }, // 5, easy
  { title: 'Mother, daughters & the thief', kinds: ['police', 'thief', 'mother', 'daughter', 'daughter'], capacity: 2, sailor: false }, // 7, medium
  { title: 'Father, sons & the thief', kinds: ['police', 'thief', 'father', 'son', 'son'], capacity: 2, sailor: false }, // 7, medium
  { title: 'Father, mother & the girls', kinds: ['father', 'mother', 'daughter', 'daughter'], capacity: 2, sailor: false }, // 7, medium
  { title: 'Police and thief', kinds: ['police', 'thief', 'father', 'mother', 'son', 'daughter'], capacity: 2, sailor: false }, // 9, hard
  { title: 'Police, thief & the boys', kinds: ['police', 'thief', 'father', 'mother', 'son', 'son'], capacity: 2, sailor: false }, // 11, hard
  { title: 'Police, thief & the girls', kinds: ['police', 'thief', 'father', 'mother', 'daughter', 'daughter'], capacity: 2, sailor: false }, // 11, hard
  { title: 'Police escort', kinds: ['police', 'father', 'mother', 'son', 'son', 'daughter', 'daughter'], capacity: 2, sailor: false }, // 11, hard
  { title: 'Police, thief & a big family', kinds: ['police', 'thief', 'father', 'mother', 'son', 'daughter', 'daughter'], capacity: 2, sailor: false }, // 13, expert
  { title: 'Police, thief & two sons', kinds: ['police', 'thief', 'father', 'mother', 'son', 'son', 'daughter'], capacity: 2, sailor: false }, // 13, expert
  { title: 'The famous IQ puzzle', kinds: ['police', 'thief', 'father', 'mother', 'son', 'son', 'daughter', 'daughter'], capacity: 2, sailor: false }, // 17, expert
];

function rated(p: Named): Puzzle {
  const draft: Puzzle = { ...p, tier: 'easy' };
  return { ...draft, tier: rate(draft)!.tier };
}

export const PRACTICE: Puzzle[] = [
  rated(CLASSIC),
  rated({ title: 'A raft without a sailor', kinds: ['father', 'mother', 'son', 'daughter'], capacity: 2, sailor: false }), // 5
];

type Cast = 'animals' | 'people';
let named: Record<Cast, Puzzle[]> | null = null;

/** Share of slots that get a named puzzle instead of a freshly generated one. */
const NAMED_SHARE = 0.35;

/**
 * A run: 1 warm-up, 2 medium, 3 hard and 2 expert puzzles. Most slots get a freshly generated animal puzzle and the
 * rest a named one, so replays rarely repeat. One expert slot is always a police-and-thief family, the hardest
 * kind in real tests.
 */
export function pickRun(): Puzzle[] {
  named ??= { animals: ANIMALS.map(rated), people: PEOPLE.map(rated) };
  const taken = new Set<string>();
  const take = (tier: Tier, casts: Cast[], generate: boolean) => {
    const options = casts.flatMap((c) => named![c]).filter((p) => p.tier === tier && !taken.has(puzzleKey(p)));
    const p = (generate && Math.random() >= NAMED_SHARE && generatePuzzle(tier, taken)) || pick(options);
    taken.add(puzzleKey(p));
    return p;
  };
  const any = (tier: Tier) => take(tier, ['animals', 'people'], true);
  return [
    any('easy'),
    any('medium'),
    any('medium'),
    any('hard'),
    any('hard'),
    any('hard'),
    ...shuffle([take('expert', ['animals'], true), take('expert', ['people'], false)]),
  ];
}

export const TIER_LABEL = { easy: 'Warm-up', medium: 'Medium', hard: 'Hard', expert: 'Expert' } as const;
