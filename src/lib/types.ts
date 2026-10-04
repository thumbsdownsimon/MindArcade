import type { ComponentType } from 'react';

export type GameId = 'ferry' | 'racer' | 'birds' | 'fish';

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
}

export interface GameProps {
  onFinish: (result: GameResult) => void;
}

export interface GameMeta {
  id: GameId;
  title: string;
  skill: string;
  tagline: string;
  measures: string;
  howTo: string[];
  duration: string;
  accent: string;
  Icon: ComponentType<{ size?: number }>;
  Component: ComponentType<GameProps>;
}
