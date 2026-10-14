import { lazy } from 'react';
import type { GameMeta } from '../lib/types';
import { BirdIcon, FerryIcon, FishIcon, FocusIcon, MatrixIcon, NumbersIcon, RacerIcon, SwitchIcon, TowerIcon } from '../components/Icons';

// Games load on demand, so the landing page doesn't download the 3D engine.
const FerryGame = lazy(() => import('./ferry/FerryGame'));
const RacerGame = lazy(() => import('./racer/RacerGame'));
const BirdGame = lazy(() => import('./birds/BirdGame'));
const FishGame = lazy(() => import('./fish/FishGame'));
const MatrixGame = lazy(() => import('./matrix/MatrixGame'));
const NumbersGame = lazy(() => import('./numbers/NumbersGame'));
const TowerGame = lazy(() => import('./tower/TowerGame'));
const SwitchGame = lazy(() => import('./switch/SwitchGame'));
const FocusGame = lazy(() => import('./focus/FocusGame'));

export const GAMES: GameMeta[] = [
  {
    id: 'ferry',
    title: 'Ferry Game',
    skill: 'Problem solving',
    tagline: 'Get everyone across the river without anyone getting eaten, from warm-ups to famous IQ puzzles.',
    measures:
      'How you approach a problem: do you plan the whole crossing before you sail, or discover the rules by trial and error? We track planning time, trips used versus the minimum, and failed attempts.',
    howTo: [
      'Eight puzzles: 1 warm-up, 2 medium, 3 hard and 2 expert. Most are new animal mixes generated for each game, the rest are named classics. Each puzzle shows its rules, but the fewest trips possible stays hidden until you finish it.',
      'Usually a sailor rows the raft and guards the bank he is on. Click a character to board them, then press Sail. Passengers stay on board until you click them off.',
      'Animals left without the sailor eat each other: fox eats chicken, chicken eats larva, the black fox eats almost everyone, the bear eats sheep and foxes, and wolves eat a sheep when they outnumber the sheep. A sheepdog stops the eating on its bank (but not the bear), and the bear takes two seats.',
      "Expert puzzles may have no sailor: then only the police officer, father or mother can row, and the rules apply on both banks and on the raft. The thief robs the family when the police officer isn't there, the father can't be with a daughter without the mother, and the mother can't be with a son without the father.",
      'Drag to look around and scroll to zoom. Hover over a character to see who they are.',
      "Afterwards you can retry, unscored, every puzzle you didn't solve perfectly (fewest trips, nobody lost), this time with the target shown and hints.",
    ],
    practice: 'Two short puzzles, one with a sailor and one without, with a Hint button that shows the best next trip.',
    duration: '10–15 min',
    accent: '#0891b2',
    Icon: FerryIcon,
    Component: FerryGame,
  },
  {
    id: 'racer',
    title: 'Racer Game',
    skill: 'Cognitive flexibility',
    tagline: 'Find the fastest of four lanes, and keep finding it as it moves.',
    measures:
      'How quickly you notice that the situation has changed and adapt. We measure how fast you find the new fastest lane after it moves, and whether you stay put once you have it.',
    howTo: [
      'The road has four lanes, each with a hidden speed. You only see your own speedometer.',
      'Switch lanes by clicking a lane, using ← / →, or pressing 1–4. A lane change costs a little speed.',
      'Every 10 seconds the fastest lane moves to a different lane, without warning.',
      'Drive as far as possible in 100 seconds.',
    ],
    practice: 'A 30-second race where every lane you try shows its speed, and you are told when the fastest lane moves.',
    duration: '2 min',
    accent: '#e11d48',
    Icon: RacerIcon,
    Component: RacerGame,
  },
  {
    id: 'birds',
    title: 'Bird Spotting Game',
    skill: 'Speed vs. accuracy',
    tagline: 'Search a huge map for birds. Every correct find scores, every mistake costs.',
    measures:
      'How you balance speed and accuracy, and when you decide to switch search targets. Do you click fast and risk mistakes, or check carefully and find fewer?',
    howTo: [
      'You are given a random bird species to look for. The 3-minute timer starts.',
      'The map is a 3D world with forest, pine woods, meadow, lake, village and hills. Drag to move, right-drag (or Q / E) to rotate, scroll to zoom, and use the minimap to jump.',
      'Birds hide in tree tops, under trees, behind houses and in tall grass, and some fly to new spots. Rotate and zoom in to look underneath things.',
      'Click a bird of your species for +10. Clicking the wrong species costs −5.',
      'Ask for a new random bird whenever you like, for example when yours gets hard to find.',
    ],
    practice: 'One minute of spotting. A wrong click tells you which species you actually clicked.',
    duration: '3 min',
    accent: '#16a34a',
    Icon: BirdIcon,
    Component: BirdGame,
  },
  {
    id: 'fish',
    title: 'Fish Discovery Game',
    skill: 'Learning & memory',
    tagline: 'Watch fish appear around the pond, then answer a surprise question.',
    measures:
      'How much information you can take in and hold at once: positions, order, numbers and appearance. Rounds grow longer and faster to find the edge of your memory span.',
    howTo: [
      'Groups of fish leap out of the pond next to the lily pads, one group after another.',
      'They differ in colour, pattern and group size (1–3 fish).',
      'Afterwards you get a question, such as where a fish was, the order in reverse, or which area had the most fish.',
      'There are 10 rounds, and each one adds more fish.',
    ],
    practice: 'Three short rounds, shown more slowly, with a memory tip after each answer.',
    duration: '5–6 min',
    accent: '#ea580c',
    Icon: FishIcon,
    Component: FishGame,
  },
  {
    id: 'matrix',
    title: 'Pattern Matrix',
    skill: 'Inductive reasoning',
    tagline: 'Find the hidden rules in a 3×3 grid of shapes and pick the missing piece.',
    measures:
      'Inductive reasoning: spotting rules in abstract patterns. This is the most common question type in employer aptitude tests (SHL, Aon, Talent Q) and in Raven-style IQ tests.',
    howTo: [
      'Each puzzle is a 3×3 grid with the bottom-right cell missing. Choose the option (A–H) that completes the pattern.',
      'Rules run along the rows: a feature stays the same, appears once in each row, changes step by step, or adds up (third = first + second).',
      'Features: shape, number of shapes, colour, fill (solid, striped, outline) and the direction of an arrow.',
      '12 puzzles get harder from 1 rule up to 3 rules at once. You have 90 seconds per puzzle and get no feedback until the end.',
    ],
    practice: 'Three puzzles with no timer. After each one you see the answer and the rules behind it.',
    duration: '8–12 min',
    accent: '#7c3aed',
    Icon: MatrixIcon,
    Component: MatrixGame,
  },
  {
    id: 'numbers',
    title: 'Number Crunch',
    skill: 'Numerical reasoning',
    tagline: 'Read tables and charts, then work out percentages, ratios and projections.',
    measures:
      'Numerical reasoning: finding the right numbers in data and applying the right calculation under time pressure, as in SHL and Talent Q numerical tests.',
    howTo: [
      'You get three data sets: a revenue table, a bar chart and a staff survey. Each has three multiple-choice questions.',
      'Questions cover percentage change, shares of a total, averages, projections, currency conversion, ratios and weighted averages.',
      'Wrong options are based on common mistakes, like dividing by the wrong number, so check your method, not just your arithmetic.',
      'You have 90 seconds per question, and there is a calculator. You get no feedback until the end.',
    ],
    practice: 'One data set with three questions, no timer, and a worked solution after each answer.',
    duration: '10–14 min',
    accent: '#2563eb',
    Icon: NumbersIcon,
    Component: NumbersGame,
  },
  {
    id: 'tower',
    title: 'Tower Planner',
    skill: 'Planning',
    tagline: 'Rebuild the goal tower in as few moves as possible, but plan it first.',
    measures:
      'Planning ahead (the Tower of London task, used in Capp and Arctic Shores-style assessments): how well you can see a whole sequence of moves before acting.',
    howTo: [
      'Coloured blocks sit on three pegs of different heights. Make your board match the small goal board.',
      'You can only move the top block of a peg, one at a time, and a peg can never hold more blocks than its height.',
      'Before your first move, say how many moves you need. Planning accurately is part of your score.',
      'Click a peg to pick up its top block, then click the peg to put it on. 10 puzzles, from 3 blocks up to 4 blocks and 8 moves.',
    ],
    practice: 'Three short puzzles with a Hint button that shows the best next move.',
    duration: '6–10 min',
    accent: '#b45309',
    Icon: TowerIcon,
    Component: TowerGame,
  },
  {
    id: 'switch',
    title: 'Rule Switch',
    skill: 'Deductive flexibility',
    tagline: 'Sort cards by a secret rule, and notice when the rule changes.',
    measures:
      'Rule discovery and set-shifting (Wisconsin Card Sort style): working out a hidden rule from feedback, and letting go of it as soon as it stops working.',
    howTo: [
      'Each card shows shapes with a colour, a shape and a number. Put it on one of the four piles.',
      'The rule is secret: match by colour, by shape or by number. Use the ✓ / ✗ feedback to work it out.',
      'After 6 correct in a row, the rule changes without warning. Notice the ✗ and switch.',
      '60 cards. Click a pile or press 1–4.',
    ],
    practice: '18 cards where the rule changes after 4 correct, with hints when you get stuck.',
    duration: '3–4 min',
    accent: '#c026d3',
    Icon: SwitchIcon,
    Component: SwitchGame,
  },
  {
    id: 'focus',
    title: 'Focus Stream',
    skill: 'Attention & control',
    tagline: 'Three quick-fire tasks: arrows, colour words and 2-back letters.',
    measures:
      'Selective attention (flanker), inhibiting an automatic response (Stroop) and updating working memory (2-back). These are the building blocks of many game-based assessments.',
    howTo: [
      'Arrows: answer the direction of the middle arrow and ignore the ones around it.',
      'Colour words: answer the ink colour of the word, not what the word says.',
      '2-back: press MATCH when a letter is the same as the one two letters back.',
      'Speed and accuracy both count. Use the keyboard (← →, 1–4, Space) for the fastest responses.',
    ],
    practice: 'A few trials of each task, with feedback after every answer.',
    duration: '6–7 min',
    accent: '#0d9488',
    Icon: FocusIcon,
    Component: FocusGame,
  },
];
