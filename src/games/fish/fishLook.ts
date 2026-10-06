import { fish, type FishPattern } from '../../three/models';
import { flatParts, snapshot, type Model, type Part, type V3 } from '../../three/voxel';

export type FColor = 'orange' | 'purple' | 'blue' | 'yellow';
export type Pattern = FishPattern;

export interface Group {
  spot: number;
  color: FColor;
  pattern: Pattern;
  count: number;
}

const COLORS: Record<FColor, [string, string]> = {
  orange: ['#fb923c', '#c2410c'],
  purple: ['#a78bfa', '#6d28d9'],
  blue: ['#60a5fa', '#1d4ed8'],
  yellow: ['#facc15', '#a16207'],
};

const models = new Map<string, Model>();

export const fishId = (color: FColor, pattern: Pattern) => `fish-${color}-${pattern}`;

export function fishModel(color: FColor, pattern: Pattern): Model {
  const id = fishId(color, pattern);
  let m = models.get(id);
  if (!m) {
    m = fish(COLORS[color][0], COLORS[color][1], pattern);
    models.set(id, m);
  }
  return m;
}

/** Where each fish in a group of 1–3 sits, relative to the group centre. */
export const GROUP_OFFSETS: Record<number, V3[]> = {
  1: [[0, 0, 0]],
  2: [[-0.6, 0.06, -0.15], [0.6, -0.06, 0.2]],
  3: [[-0.7, 0, 0.25], [0.7, 0.05, 0.3], [0, 0.2, -0.3]],
};

/** A PNG of the whole group, for the question panel's answer buttons. */
export function groupPicture(g: Pick<Group, 'color' | 'pattern' | 'count'>) {
  const base = flatParts(fishModel(g.color, g.pattern));
  const parts: Part[] = GROUP_OFFSETS[g.count].flatMap(([ox, oy, oz]) => base.map((p) => ({ ...p, p: [p.p[0] + ox, p.p[1] + oy, p.p[2] + oz] as V3 })));
  return snapshot(`fishgrp-${g.color}-${g.pattern}-${g.count}`, parts, { yaw: 0, pitch: 0.3, w: 220, h: 140 });
}
