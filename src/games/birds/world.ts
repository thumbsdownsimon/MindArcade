// Procedural map for the Bird Spotting Game: six terrain zones, blocky scenery, the spots where
// birds can perch, and simple boxes that block clicks (so you can't click a bird through a tree).

import * as THREE from 'three';
import { box, mergeParts, type Part } from '../../three/voxel';
import { mix } from '../../three/models';
import { pick, shuffle } from '../../lib/util';

export const TILE = 2;
export const COLS = 48;
export const ROWS = 32;
export const ZONE_TILES = 16;
export const WORLD_W = COLS * TILE;
export const WORLD_D = ROWS * TILE;
const STEP = 0.5; // height of one terrain level
const WATER_Y = -0.25;

export type ZoneKind = 'forest' | 'pines' | 'meadow' | 'lake' | 'village' | 'hills';

export const ZONE_NAME: Record<ZoneKind, string> = {
  forest: 'Oak forest',
  pines: 'Pine woods',
  meadow: 'Meadow',
  lake: 'Lake',
  village: 'Village',
  hills: 'Hills',
};

export interface Perch {
  x: number;
  y: number;
  z: number;
  /** Partly covered from above: under a canopy, behind a house, in tall grass. */
  hidden: boolean;
}

export interface Zone {
  kind: ZoneKind;
  col: number;
  row: number;
}

export interface World {
  zones: Zone[];
  /** Per-tile colour, for the minimap. */
  tileColor: string[];
  terrain: THREE.BufferGeometry;
  scenery: THREE.BufferGeometry[];
  water: { x: number; z: number; w: number; d: number }[];
  occluders: THREE.Box3[];
  perches: Perch[];
}

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

class Builder {
  parts: Part[] = [];
  occluders: THREE.Box3[] = [];
  perches: Perch[] = [];
  add(...p: Part[]) {
    this.parts.push(...p);
  }
  block(min: [number, number, number], max: [number, number, number]) {
    this.occluders.push(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)));
  }
  perch(x: number, y: number, z: number, hidden = false) {
    this.perches.push({ x, y, z, hidden });
  }
}

/* ---------- Props ---------- */

const LEAVES = ['#3f9b3a', '#368a33', '#4caf45', '#2f7d32'];

function oak(b: Builder, x: number, z: number, y: number) {
  const s = rnd(0.9, 1.25);
  const th = 2.2 * s;
  const leaf = pick(LEAVES);
  b.add(
    box([0.55, th, 0.55], [x, y + th / 2, z], '#6b4423'),
    box([3 * s, 1.8 * s, 3 * s], [x, y + th + 0.9 * s, z], leaf),
    box([2 * s, 0.9 * s, 2 * s], [x, y + th + 2.25 * s, z], mix(leaf, '#ffffff', 0.08)),
    box([1 * s, 0.8 * s, 1 * s], [x + 1.5 * s, y + th + 0.5 * s, z - 0.6 * s], leaf),
  );
  b.block([x - 1.5 * s, y + th, z - 1.5 * s], [x + 1.5 * s, y + th + 2.7 * s, z + 1.5 * s]);
  b.block([x - 0.3, y, z - 0.3], [x + 0.3, y + th, z + 0.3]);
  b.perch(x + rnd(-0.4, 0.4), y + th + 2.7 * s, z + rnd(-0.4, 0.4));
  b.perch(x - 1.2 * s, y + th + 1.8 * s, z + 1.2 * s);
  b.perch(x + rnd(0.7, 1.0), y, z + rnd(0.5, 0.9), true);
}

function pine(b: Builder, x: number, z: number, y: number) {
  const s = rnd(0.85, 1.25);
  const leaf = pick(['#2f6b3a', '#285e33', '#357544']);
  b.add(box([0.45, 1.2 * s, 0.45], [x, y + 0.6 * s, z], '#5b3a1e'));
  const layers = [2.8, 2.2, 1.6, 1.0, 0.5];
  layers.forEach((w, k) => b.add(box([w * s, 0.9 * s, w * s], [x, y + (1.2 + 0.45 + k * 0.85) * s, z], k % 2 ? leaf : mix(leaf, '#000000', 0.1))));
  const top = y + (1.2 + 5 * 0.85 + 0.1) * s;
  b.block([x - 1.4 * s, y + 1.2 * s, z - 1.4 * s], [x + 1.4 * s, top, z + 1.4 * s]);
  b.perch(x, top - 0.05, z);
  b.perch(x + 1.15 * s, y + 2.1 * s, z + 1.15 * s);
  b.perch(x - rnd(1.2, 1.6), y, z + rnd(-0.5, 0.5), true);
}

function bush(b: Builder, x: number, z: number, y: number) {
  const c = pick(['#4d9f3c', '#58ad45', '#3e8a35']);
  b.add(box([1.6, 1, 1.4], [x, y + 0.5, z], c), box([1, 0.6, 1], [x + 0.5, y + 1.1, z - 0.2], mix(c, '#ffffff', 0.1)));
  if (Math.random() < 0.4) for (let k = 0; k < 3; k++) b.add(box([0.14, 0.14, 0.14], [x - 0.5 + k * 0.4, y + 1.02, z + 0.71], '#dc2626'));
  b.block([x - 0.8, y, z - 0.7], [x + 0.8, y + 1.4, z + 0.7]);
  b.perch(x - 0.3, y + 1, z + 0.2);
  b.perch(x + rnd(-0.4, 0.4), y, z - 1.1, true);
}

function rock(b: Builder, x: number, z: number, y: number, big = false) {
  const s = big ? rnd(1.4, 2) : rnd(0.7, 1.1);
  b.add(box([1.4 * s, 0.8 * s, 1.1 * s], [x, y + 0.4 * s, z], '#9ca3af'), box([0.9 * s, 0.5 * s, 0.8 * s], [x + 0.2 * s, y + 1.0 * s, z], '#b6bcc6'));
  if (big) b.block([x - 0.7 * s, y, z - 0.55 * s], [x + 0.7 * s, y + 1.25 * s, z + 0.55 * s]);
  b.perch(x + 0.2 * s, y + 1.25 * s, z);
}

function house(b: Builder, x: number, z: number, y: number) {
  const wall = pick(['#f5f0e6', '#e9d8b4', '#d6c3a5', '#f1e4d0']);
  const roof = pick(['#b91c1c', '#1d4ed8', '#7c2d12', '#15803d']);
  const w = 4.2, d = 3.4, h = 2.6;
  b.add(box([w, h, d], [x, y + h / 2, z], wall));
  // stepped roof along x
  for (let k = 0; k < 4; k++) b.add(box([w + 0.4, 0.45, d + 0.4 - k * 1.0], [x, y + h + 0.22 + k * 0.45, z], k % 2 ? roof : mix(roof, '#000000', 0.12)));
  b.add(box([0.9, 1.5, 0.08], [x - 0.8, y + 0.75, z + d / 2 + 0.02], '#7c4a1e'));
  b.add(box([0.8, 0.7, 0.08], [x + 1.0, y + 1.5, z + d / 2 + 0.02], '#93c5fd'), box([1, 0.1, 0.25], [x + 1.0, y + 1.1, z + d / 2 + 0.1], '#8b5a2b'));
  b.add(box([0.6, 1.2, 0.6], [x + 1.3, y + h + 1.3, z - 0.6], '#78716c'));
  b.block([x - w / 2 - 0.2, y, z - d / 2 - 0.2], [x + w / 2 + 0.2, y + h + 1.8, z + d / 2 + 0.2]);
  b.perch(x + rnd(-1.4, 1.4), y + h + 1.8, z);
  b.perch(x + 1.3, y + h + 1.9, z - 0.6);
  b.perch(x + 1.0, y + 1.15, z + d / 2 + 0.15);
  b.perch(x + rnd(-1.2, 1.2), y, z - d / 2 - 0.8, true);
}

function fence(b: Builder, x: number, z: number, y: number, len: number, alongX: boolean) {
  for (let k = 0; k <= len; k++) {
    const px = alongX ? x + k : x;
    const pz = alongX ? z : z + k;
    b.add(box([0.18, 0.9, 0.18], [px, y + 0.45, pz], '#8b5a2b'));
    if (k % 2 === 0) b.perch(px, y + 0.9, pz);
  }
  for (const hgt of [0.35, 0.7]) b.add(box(alongX ? [len, 0.1, 0.08] : [0.08, 0.1, len], [alongX ? x + len / 2 : x, y + hgt, alongX ? z : z + len / 2], '#a0703c'));
}

function hay(b: Builder, x: number, z: number, y: number) {
  b.add(box([1.4, 1, 1], [x, y + 0.5, z], '#e3c35a'), box([1.42, 0.12, 1.02], [x, y + 0.5, z], '#c9a640'));
  b.block([x - 0.7, y, z - 0.5], [x + 0.7, y + 1, z + 0.5]);
  b.perch(x + rnd(-0.3, 0.3), y + 1, z);
}

function lamp(b: Builder, x: number, z: number, y: number) {
  b.add(box([0.16, 2.4, 0.16], [x, y + 1.2, z], '#374151'), box([0.4, 0.4, 0.4], [x, y + 2.55, z], '#fde68a'), box([0.5, 0.1, 0.5], [x, y + 2.8, z], '#374151'));
  b.perch(x, y + 2.85, z);
}

function well(b: Builder, x: number, z: number, y: number) {
  b.add(box([1.6, 0.8, 1.6], [x, y + 0.4, z], '#9ca3af'), box([1.2, 0.1, 1.2], [x, y + 0.75, z], '#1e3a8a'));
  b.add(box([0.15, 1.6, 0.15], [x - 0.7, y + 1.2, z], '#7c4a1e'), box([0.15, 1.6, 0.15], [x + 0.7, y + 1.2, z], '#7c4a1e'));
  b.add(box([2, 0.3, 1.4], [x, y + 2.1, z], '#b91c1c'));
  b.block([x - 1, y, z - 0.8], [x + 1, y + 2.25, z + 0.8]);
  b.perch(x, y + 2.25, z);
}

function crates(b: Builder, x: number, z: number, y: number) {
  b.add(box([0.9, 0.9, 0.9], [x, y + 0.45, z], '#b07a3e'), box([0.9, 0.9, 0.9], [x + 0.95, y + 0.45, z + 0.1], '#a16207'), box([0.8, 0.8, 0.8], [x + 0.45, y + 1.3, z], '#c08a4a'));
  b.block([x - 0.45, y, z - 0.45], [x + 1.4, y + 1.7, z + 0.55]);
  b.perch(x + 0.45, y + 1.7, z);
}

function log(b: Builder, x: number, z: number, y: number) {
  b.add(box([2.2, 0.55, 0.55], [x, y + 0.28, z], '#7c4a1e'), box([0.05, 0.45, 0.45], [x + 1.11, y + 0.28, z], '#d6b07a'));
  b.perch(x + rnd(-0.6, 0.6), y + 0.55, z);
}

function flowers(b: Builder, x: number, z: number, y: number, n: number) {
  const cols = ['#f43f5e', '#facc15', '#a855f7', '#f8fafc', '#fb923c', '#38bdf8'];
  for (let k = 0; k < n; k++) {
    const fx = x + rnd(-0.9, 0.9);
    const fz = z + rnd(-0.9, 0.9);
    b.add(box([0.05, 0.3, 0.05], [fx, y + 0.15, fz], '#3f8f2f'), box([0.18, 0.15, 0.18], [fx, y + 0.35, fz], pick(cols)));
  }
}

function tallGrass(b: Builder, x: number, z: number, y: number) {
  for (let k = 0; k < 5; k++) b.add(box([0.12, rnd(0.6, 0.9), 0.12], [x + rnd(-0.6, 0.6), y + 0.38, z + rnd(-0.6, 0.6)], pick(['#5aa83f', '#6dbb4c', '#4e9637'])));
  b.block([x - 0.6, y, z - 0.6], [x + 0.6, y + 0.7, z + 0.6]);
  b.perch(x + rnd(-0.3, 0.3), y, z + rnd(-0.3, 0.3), true);
}

function mushrooms(b: Builder, x: number, z: number, y: number) {
  for (let k = 0; k < 3; k++) {
    const mx = x + rnd(-0.6, 0.6), mz = z + rnd(-0.6, 0.6);
    b.add(box([0.1, 0.25, 0.1], [mx, y + 0.12, mz], '#f5f5f4'), box([0.35, 0.14, 0.35], [mx, y + 0.3, mz], k % 2 ? '#dc2626' : '#b45309'));
  }
}

/* ---------- Terrain ---------- */

interface TileInfo {
  zone: number;
  level: number; // -1 = water
  color: string;
  path: boolean;
}

function buildTiles(zones: Zone[]): TileInfo[] {
  const tiles: TileInfo[] = [];
  const seeds = zones.map(() => [rnd(0, 6), rnd(0, 6)]);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const zi = Math.floor(r / ZONE_TILES) * 3 + Math.floor(c / ZONE_TILES);
      const kind = zones[zi].kind;
      const u = c % ZONE_TILES;
      const v = r % ZONE_TILES;
      const edge = Math.min(1, Math.min(u, ZONE_TILES - 1 - u, v, ZONE_TILES - 1 - v) / 3.5);
      const check = (c + r) % 2 === 0;
      let level = 0;
      let color = check ? '#7cbd57' : '#75b551';
      let path = false;
      if (kind === 'forest') color = check ? '#4f9a3a' : '#4a9236';
      if (kind === 'pines') color = check ? '#45844a' : '#407c45';
      if (kind === 'meadow') color = check ? '#8fcf5f' : '#88c859';
      if (kind === 'hills') {
        const [a, b] = seeds[zi];
        const n = (Math.sin(u * 0.55 + a) * Math.cos(v * 0.5 + b) + 1) * 0.5;
        level = Math.round(n * 4.4 * edge);
        color = level >= 4 ? '#a8adb5' : level === 3 ? (check ? '#5f9e44' : '#5a9640') : check ? '#6cae4b' : '#67a847';
      }
      if (kind === 'lake') {
        const d = ((u - 7.5) / 6.2) ** 2 + ((v - 7.5) / 5.2) ** 2 + Math.sin(u * 1.3 + v) * 0.08;
        if (d < 1) {
          level = -1;
          color = '#3b9ae0';
        } else if (d < 1.45) color = check ? '#e8d6a0' : '#e2cf97';
      }
      if (kind === 'village' && (u === 7 || u === 8 || v === 7 || v === 8) && edge > 0.2) {
        path = true;
        color = check ? '#b9925e' : '#b08a5a';
      }
      tiles.push({ zone: zi, level, color, path });
    }
  return tiles;
}

const tileX = (c: number) => c * TILE + TILE / 2;
const tileZ = (r: number) => r * TILE + TILE / 2;

/* ---------- World ---------- */

export function buildWorld(): World {
  const kinds = shuffle<ZoneKind>(['forest', 'pines', 'meadow', 'lake', 'village', 'hills']);
  const zones: Zone[] = kinds.map((kind, i) => ({ kind, col: i % 3, row: Math.floor(i / 3) }));
  const tiles = buildTiles(zones);
  const level = (c: number, r: number) => tiles[r * COLS + c].level;
  const groundY = (c: number, r: number) => Math.max(0, level(c, r)) * STEP;

  // Terrain: one column per tile, merged into a single mesh.
  const ground: Part[] = [];
  tiles.forEach((t, i) => {
    const c = i % COLS, r = Math.floor(i / COLS);
    const top = t.level < 0 ? -0.9 : t.level * STEP;
    const bottom = -2;
    ground.push(box([TILE, top - bottom, TILE], [tileX(c), (top + bottom) / 2, tileZ(r)], t.level < 0 ? '#c9b98a' : t.color));
  });

  // Scenery per zone, placed on free tiles so props don't overlap.
  const used = new Uint8Array(COLS * ROWS);
  const builders = zones.map(() => new Builder());
  const water: World['water'] = [];

  zones.forEach((z, zi) => {
    const b = builders[zi];
    const c0 = z.col * ZONE_TILES, r0 = z.row * ZONE_TILES;
    const free = shuffle(
      Array.from({ length: ZONE_TILES * ZONE_TILES }, (_, k) => [c0 + (k % ZONE_TILES), r0 + Math.floor(k / ZONE_TILES)] as const).filter(
        ([c, r]) => tiles[r * COLS + c].level >= 0 && !tiles[r * COLS + c].path,
      ),
    );
    const place = (n: number, fn: (x: number, z: number, y: number, c: number, r: number) => void, jitter = 0.5) => {
      let placed = 0;
      for (const [c, r] of free) {
        if (placed >= n) break;
        if (used[r * COLS + c]) continue;
        // keep a one-tile gap around big props
        used[r * COLS + c] = 1;
        fn(tileX(c) + rnd(-jitter, jitter), tileZ(r) + rnd(-jitter, jitter), groundY(c, r), c, r);
        placed++;
      }
    };
    const claimAround = (c: number, r: number) => {
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
        const cc = c + dc, rr = r + dr;
        if (cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS) used[rr * COLS + cc] = 1;
      }
    };

    switch (z.kind) {
      case 'forest':
        place(30, (x, zz, y, c, r) => { oak(b, x, zz, y); claimAround(c, r); });
        place(12, (x, zz, y) => bush(b, x, zz, y));
        place(6, (x, zz, y) => log(b, x, zz, y));
        place(10, (x, zz, y) => mushrooms(b, x, zz, y));
        place(8, (x, zz, y) => rock(b, x, zz, y));
        break;
      case 'pines':
        place(34, (x, zz, y, c, r) => { pine(b, x, zz, y); claimAround(c, r); });
        place(10, (x, zz, y) => rock(b, x, zz, y, Math.random() < 0.4));
        place(6, (x, zz, y) => log(b, x, zz, y));
        place(8, (x, zz, y) => bush(b, x, zz, y));
        break;
      case 'meadow': {
        const fc = c0 + 3, fr = r0 + 3;
        fence(b, tileX(fc), tileZ(fr), 0, 12, true);
        fence(b, tileX(fc), tileZ(fr), 0, 8, false);
        place(10, (x, zz, y) => hay(b, x, zz, y));
        place(28, (x, zz, y) => tallGrass(b, x, zz, y));
        place(5, (x, zz, y, c, r) => { oak(b, x, zz, y); claimAround(c, r); });
        place(40, (x, zz, y) => flowers(b, x, zz, y, 5), 0.2);
        // birds also forage in the open grass
        for (let k = 0; k < 14; k++) b.perch(tileX(c0) + rnd(2, 30), 0, tileZ(r0) + rnd(2, 30));
        break;
      }
      case 'lake': {
        const x0 = tileX(c0), z0 = tileZ(r0);
        water.push({ x: x0 - TILE / 2 + ZONE_TILES, z: z0 - TILE / 2 + ZONE_TILES, w: ZONE_TILES * TILE, d: ZONE_TILES * TILE });
        // dock on the south shore, rocks and lily pads in the water
        const dx = x0 + 15, dz = z0 + 26;
        for (let k = 0; k < 7; k++) b.add(box([1.6, 0.15, 0.95], [dx, 0.05, dz - k], k % 2 ? '#b07a3e' : '#c08a4a'));
        for (const [px, pz] of [[dx - 0.8, dz - 2], [dx + 0.8, dz - 2], [dx - 0.8, dz - 6], [dx + 0.8, dz - 6]] as const) {
          b.add(box([0.2, 1.2, 0.2], [px, -0.1, pz], '#6b4423'));
          b.perch(px, 0.5, pz);
        }
        b.perch(dx, 0.13, dz - 4);
        b.add(box([1.2, 0.3, 2.4], [dx + 2.2, -0.15, dz - 4], '#92400e'), box([1.0, 0.2, 2.2], [dx + 2.2, 0.02, dz - 4], '#c08a4a'));
        b.perch(dx + 2.2, 0.12, dz - 4.6);
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2;
          const lx = x0 + 15 + Math.cos(a) * rnd(4, 9), lz = z0 + 15 + Math.sin(a) * rnd(3, 7);
          if (Math.abs(lx - dx) < 3.5 && lz > dz - 8) continue;
          if (k % 3 === 0) {
            b.add(box([1.3, 0.7, 1.1], [lx, WATER_Y + 0.15, lz], '#9ca3af'));
            b.perch(lx, WATER_Y + 0.5, lz);
          } else {
            b.add(box([1, 0.06, 1], [lx, WATER_Y + 0.03, lz], '#4d9f45'));
            b.perch(lx, WATER_Y + 0.06, lz);
          }
        }
        place(18, (x, zz, y) => {
          for (let k = 0; k < 4; k++) b.add(box([0.12, rnd(0.8, 1.3), 0.12], [x + rnd(-0.5, 0.5), y + 0.5, zz + rnd(-0.5, 0.5)], '#4d7c2f'));
          b.block([x - 0.5, y, zz - 0.5], [x + 0.5, y + 1.1, zz + 0.5]);
          b.perch(x + 0.3, y, zz - 0.2, true);
        });
        place(7, (x, zz, y, c, r) => { oak(b, x, zz, y); claimAround(c, r); });
        place(6, (x, zz, y) => rock(b, x, zz, y));
        place(6, (x, zz, y) => bush(b, x, zz, y));
        break;
      }
      case 'village': {
        // houses in each block between the paths
        const spots = [[3, 3], [11, 3], [3, 11], [11, 11], [4, 13], [12, 5]] as const;
        spots.slice(0, 4).forEach(([u, v]) => {
          const c = c0 + u, r = r0 + v;
          house(b, tileX(c) + 1, tileZ(r) + 1, 0);
          for (let dc = -1; dc <= 2; dc++) for (let dr = -1; dr <= 2; dr++) used[(r + dr) * COLS + c + dc] = 1;
        });
        well(b, tileX(c0 + 8), tileZ(r0 + 8), 0);
        for (const [u, v] of [[6, 2], [9, 13], [6, 9], [9, 6]] as const) lamp(b, tileX(c0 + u) + 0.6, tileZ(r0 + v), 0);
        fence(b, tileX(c0 + 1), tileZ(r0 + 6) + 0.6, 0, 9, true);
        fence(b, tileX(c0 + 10), tileZ(r0 + 9) + 0.6, 0, 9, true);
        place(6, (x, zz, y) => crates(b, x, zz, y));
        place(6, (x, zz, y, c, r) => { oak(b, x, zz, y); claimAround(c, r); });
        place(8, (x, zz, y) => bush(b, x, zz, y));
        place(14, (x, zz, y) => flowers(b, x, zz, y, 4), 0.2);
        for (let k = 0; k < 6; k++) b.perch(tileX(c0 + 7) + rnd(0, 2), 0, tileZ(r0) + rnd(2, 30));
        break;
      }
      case 'hills':
        place(10, (x, zz, y) => rock(b, x, zz, y, true));
        place(10, (x, zz, y) => rock(b, x, zz, y));
        place(10, (x, zz, y, c, r) => { (Math.random() < 0.5 ? pine : oak)(b, x, zz, y); claimAround(c, r); });
        place(14, (x, zz, y) => tallGrass(b, x, zz, y));
        place(12, (x, zz, y) => flowers(b, x, zz, y, 3), 0.2);
        // birds on the open slopes
        for (let k = 0; k < 10; k++) {
          const c = c0 + 2 + Math.floor(rnd(0, 12)), r = r0 + 2 + Math.floor(rnd(0, 12));
          b.perch(tileX(c), groundY(c, r), tileZ(r));
        }
        break;
    }
  });

  return {
    zones,
    tileColor: tiles.map((t) => t.color),
    terrain: mergeParts(ground)!,
    scenery: builders.map((b) => mergeParts(b.parts)).filter((g): g is THREE.BufferGeometry => !!g),
    water,
    occluders: builders.flatMap((b) => b.occluders),
    perches: builders.flatMap((b) => b.perches).filter((p) => p.x > 1 && p.z > 1 && p.x < WORLD_W - 1 && p.z < WORLD_D - 1),
  };
}

export const WATER_LEVEL = WATER_Y;
