import { lazy } from 'react';
import type { GameMeta } from '../lib/types';
import { BirdIcon, FerryIcon, FishIcon, RacerIcon } from '../components/Icons';

// Games load on demand, so the landing page doesn't download the 3D engine.
const FerryGame = lazy(() => import('./ferry/FerryGame'));
const RacerGame = lazy(() => import('./racer/RacerGame'));
const BirdGame = lazy(() => import('./birds/BirdGame'));
const FishGame = lazy(() => import('./fish/FishGame'));

export const GAMES: GameMeta[] = [
  {
    id: 'ferry',
    title: 'Ferry Game',
    skill: 'Problem solving',
    tagline: 'Get everyone across the river without anyone getting eaten.',
    measures:
      'How you approach a problem: do you plan the whole crossing before you sail, or discover the rules by trial and error? We track planning time, trips used versus the minimum, and failed attempts.',
    howTo: [
      'A sailor is always on board and rows the boat. He can also cross alone with nobody else on board.',
      'You stand on the start shore looking across the river. Click a character to board them, then press Sail. Passengers stay on the raft until you click them off, which is sometimes the smart move.',
      'Animals left on a bank without the sailor eat each other: fox eats chicken, chicken eats larva, and the black fox eats everyone except other black foxes.',
      'Family puzzles: a kid can never travel as the only passenger. Seats vary per puzzle, and each puzzle shows the fewest trips possible.',
      'Drag to look around and scroll to zoom. Hover over a character to see who they are.',
    ],
    duration: '5–8 min',
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
    duration: '5–6 min',
    accent: '#ea580c',
    Icon: FishIcon,
    Component: FishGame,
  },
];
