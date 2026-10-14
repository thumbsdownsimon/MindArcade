import type { ComponentType } from 'react';

export type GameId = 'ferry' | 'racer' | 'birds' | 'fish' | 'matrix' | 'numbers' | 'tower' | 'switch' | 'focus';

export interface Metric {
  label: string;
  value: string;
  hint?: string;
}

export interface ChartBar {
  label: string;
  value: number;
  display?: string;
}

export interface ResultChart {
  title: string;
  max: number;
  bars: ChartBar[];
  note?: string;
}

export interface GameResult {
  /** 0–100 overall score */
  score: number;
  profile?: { name: string; description: string };
  metrics: Metric[];
  strengths: string[];
  improvements: string[];
  chart?: ResultChart;
  /**
   * An unscored follow-up round the results page offers, e.g. the ferry puzzles that weren't solved perfectly.
   * `items` is handed back to the same game as `GameProps.retry`.
   */
  retry?: { label: string; items: unknown[] };
}

export interface GameProps {
  onFinish: (result: GameResult) => void;
  /** A short, untimed (or gentler) warm-up with extra explanations. Its result is not saved. */
  practice: boolean;
  /** Set for a retry round: the `retry.items` of an earlier result. Its result is not saved. */
  retry?: unknown[];
}

export interface GameMeta {
  id: GameId;
  title: string;
  skill: string;
  tagline: string;
  measures: string;
  howTo: string[];
  /** What the practice round contains, shown on the intro screen. */
  practice: string;
  duration: string;
  accent: string;
  Icon: ComponentType<{ size?: number }>;
  Component: ComponentType<GameProps>;
}
