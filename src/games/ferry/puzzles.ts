import { pick, shuffle } from '../../lib/util';
import type { Puzzle } from './engine';

// Minimum trips (from the solver) are noted for reference. "Back" counts trips where the best solution
// brings a passenger back, which is the move most people find hardest to see.

const EASY: Puzzle[] = [
  { title: 'The classic crossing', tier: 'easy', kinds: ['fox', 'chicken', 'larva'], capacity: 1 }, // 7
  { title: 'Family trip', tier: 'easy', kinds: ['adult', 'adult', 'kid', 'kid', 'kid', 'kid'], capacity: 2 }, // 5
  { title: 'Double larva', tier: 'easy', kinds: ['fox', 'chicken', 'larva', 'larva'], capacity: 2 }, // 5
  { title: 'One parent, four kids', tier: 'easy', kinds: ['adult', 'kid', 'kid', 'kid', 'kid'], capacity: 2 }, // 5
];

const MEDIUM: Puzzle[] = [
  { title: 'Enter the black fox', tier: 'medium', kinds: ['blackfox', 'fox', 'chicken', 'larva'], capacity: 2 }, // 5
  { title: 'Crowded farm', tier: 'medium', kinds: ['fox', 'fox', 'chicken', 'chicken', 'larva'], capacity: 2 }, // 7
  { title: 'School outing', tier: 'medium', kinds: ['adult', 'adult', 'adult', 'kid', 'kid', 'kid'], capacity: 2 }, // 5
  { title: 'The sheepdog', tier: 'medium', kinds: ['dog', 'fox', 'chicken', 'larva'], capacity: 1 }, // 7
  { title: 'Wolves at the river', tier: 'medium', kinds: ['wolf', 'wolf', 'sheep', 'sheep'], capacity: 1 }, // 7
  { title: 'Heavy passenger', tier: 'medium', kinds: ['bear', 'sheep', 'fox', 'chicken'], capacity: 2 }, // 7, back 1
];

const HARD: Puzzle[] = [
  { title: 'Wolf pack', tier: 'hard', kinds: ['wolf', 'wolf', 'wolf', 'wolf', 'sheep', 'sheep', 'sheep'], capacity: 2 }, // 9, back 1
  { title: 'Black fox & the flock', tier: 'hard', kinds: ['blackfox', 'chicken', 'larva', 'sheep', 'sheep', 'wolf'], capacity: 2 }, // 9, back 4
  { title: 'Larva convoy', tier: 'hard', kinds: ['blackfox', 'fox', 'fox', 'chicken', 'larva', 'larva', 'larva'], capacity: 3 }, // 9, back 4
  { title: 'Bear and sheepdog', tier: 'hard', kinds: ['bear', 'dog', 'sheep', 'fox', 'chicken', 'larva'], capacity: 2 }, // 7
  { title: 'Dog on duty', tier: 'hard', kinds: ['dog', 'wolf', 'wolf', 'wolf', 'sheep', 'sheep', 'sheep'], capacity: 1 }, // 13
];

const EXPERT_ANIMALS: Puzzle[] = [
  { title: 'The whole farm', tier: 'expert', kinds: ['blackfox', 'fox', 'chicken', 'wolf', 'wolf', 'sheep', 'sheep'], capacity: 2 }, // 11, back 5
  { title: 'Predators everywhere', tier: 'expert', kinds: ['blackfox', 'fox', 'chicken', 'larva', 'wolf', 'wolf', 'wolf'], capacity: 2 }, // 11, back 5
];

/** The police-and-thief puzzles: no sailor, so the adults have to row and the rules apply everywhere. */
const EXPERT_PEOPLE: Puzzle[] = [
  { title: 'Police and thief', tier: 'expert', kinds: ['police', 'thief', 'father', 'mother', 'son', 'daughter'], capacity: 2, sailor: false }, // 9
  { title: 'Police, thief & a big family', tier: 'expert', kinds: ['police', 'thief', 'father', 'mother', 'son', 'daughter', 'daughter'], capacity: 2, sailor: false }, // 13
  { title: 'The famous IQ puzzle', tier: 'expert', kinds: ['police', 'thief', 'father', 'mother', 'son', 'son', 'daughter', 'daughter'], capacity: 2, sailor: false }, // 17
];

export const PRACTICE: Puzzle[] = [
  EASY[0],
  { title: 'A raft without a sailor', tier: 'easy', kinds: ['father', 'mother', 'son', 'daughter'], capacity: 2, sailor: false }, // 5
];

/** A run: 1 easy warm-up, 2 medium, 3 hard and 2 expert puzzles, drawn at random so replays differ. */
export function pickRun(): Puzzle[] {
  return [
    pick(EASY),
    ...shuffle(MEDIUM).slice(0, 2),
    ...shuffle(HARD).slice(0, 3),
    ...shuffle([pick(EXPERT_ANIMALS), pick(EXPERT_PEOPLE)]),
  ];
}

export const TIER_LABEL = { easy: 'Warm-up', medium: 'Medium', hard: 'Hard', expert: 'Expert' } as const;
