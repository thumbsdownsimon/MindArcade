// Procedural 3×3 pattern matrices (Raven-style). Each puzzle picks a few attributes and gives each one a rule
// that holds along every row; the bottom-right cell is the answer. Kept free of React so it can be tested alone.

import { pick, randInt, shuffle } from '../../lib/util';

export type Shape = 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon' | 'star' | 'arrow';
export type Fill = 'solid' | 'striped' | 'outline';

export interface Cell {
  shape: Shape;
  count: number;
  fill: Fill;
  /** Index into COLORS. */
  color: number;
  /** Degrees clockwise. */
  rot: number;
}

export type Attr = keyof Cell;
export type RuleKind = 'rowConstant' | 'distribute' | 'progression' | 'add' | 'subtract';

export interface Rule {
  attr: Attr;
  kind: RuleKind;
  step?: number;
}

export interface Puzzle {
  level: 1 | 2 | 3;
  grid: Cell[][];
  rules: Rule[];
  options: Cell[];
  answer: number;
}

export const COLORS = ['#2563eb', '#ea580c', '#1f2937'];
export const COLOR_NAME = ['blue', 'orange', 'black'];
const SHAPES: Shape[] = ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'star'];
const FILLS: Fill[] = ['solid', 'striped', 'outline'];
export const MAX_COUNT = 5;

export const RULE_FAMILY: Record<RuleKind, string> = {
  rowConstant: 'Same within a row',
  distribute: 'One of each per row',
  progression: 'Step-by-step change',
  add: 'Arithmetic',
  subtract: 'Arithmetic',
};

const same = (a: Cell, b: Cell) => a.shape === b.shape && a.count === b.count && a.fill === b.fill && a.color === b.color && a.rot === b.rot;

/** Three distinct values of a categorical attribute. */
function three(attr: 'shape' | 'fill' | 'color') {
  if (attr === 'shape') return shuffle(SHAPES).slice(0, 3);
  if (attr === 'fill') return shuffle(FILLS);
  return shuffle([0, 1, 2]);
}

/** Values for one attribute across the 3×3 grid, following `rule`. */
function fillAttr(rule: Rule): (string | number)[][] {
  const { attr, kind } = rule;
  const g: (string | number)[][] = [[], [], []];
  if (kind === 'rowConstant') {
    const vals = attr === 'count' ? shuffle([1, 2, 3, 4]).slice(0, 3) : attr === 'rot' ? shuffle([0, 90, 180, 270]).slice(0, 3) : three(attr);
    for (let r = 0; r < 3; r++) g[r] = [vals[r], vals[r], vals[r]];
  } else if (kind === 'distribute') {
    const vals = attr === 'count' ? shuffle([1, 2, 3, 4, 5]).slice(0, 3) : attr === 'rot' ? shuffle([0, 90, 180, 270]).slice(0, 3) : three(attr);
    const shift = pick([1, 2]);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g[r][c] = vals[(c + r * shift) % 3];
  } else if (kind === 'progression') {
    const step = rule.step!;
    for (let r = 0; r < 3; r++) {
      if (attr === 'count') {
        const start = step > 0 ? randInt(1, MAX_COUNT - 2 * step) : randInt(1 - 2 * step, MAX_COUNT);
        g[r] = [0, 1, 2].map((c) => start + c * step);
      } else {
        const start = pick([0, 45, 90, 135, 180, 225, 270, 315]);
        g[r] = [0, 1, 2].map((c) => (((start + c * step) % 360) + 360) % 360);
      }
    }
  } else {
    for (let r = 0; r < 3; r++) {
      if (kind === 'add') {
        const a = randInt(1, 3);
        const b = randInt(1, MAX_COUNT - a);
        g[r] = [a, b, a + b];
      } else {
        const a = randInt(3, MAX_COUNT);
        const b = randInt(1, a - 1);
        g[r] = [a, b, a - b];
      }
    }
  }
  return g;
}

function ruleFor(attr: Attr, level: number): Rule {
  if (attr === 'count') {
    const kinds: RuleKind[] = level >= 3 ? ['progression', 'distribute', 'add', 'subtract'] : level === 2 ? ['progression', 'distribute', 'rowConstant'] : ['progression'];
    const kind = pick(kinds);
    return { attr, kind, step: kind === 'progression' ? pick(level >= 2 ? [1, -1, 2] : [1, -1]) : undefined };
  }
  if (attr === 'rot') return { attr, kind: 'progression', step: pick(level >= 2 ? [45, 90, -45, -90] : [90, 45]) };
  return { attr, kind: level === 1 ? 'distribute' : pick(['distribute', 'distribute', 'rowConstant']) };
}

/** Builds one puzzle. Level 1 has one rule, level 2 two, level 3 three (and can include arithmetic). */
export function generate(level: 1 | 2 | 3): Puzzle {
  for (;;) {
    // Rotation only reads well on the arrow, so it excludes a shape rule.
    let attrs: Attr[] = shuffle(['shape', 'count', 'fill', 'color', 'rot'] as Attr[]).slice(0, level);
    if (attrs.includes('rot') && attrs.includes('shape')) continue;
    if (level === 3 && !attrs.includes('count')) attrs = ['count', ...attrs.slice(1)];
    const rules = attrs.map((a) => ruleFor(a, level));
    if (rules.filter((r) => r.kind === 'rowConstant').length > 1) continue; // keep it from being too samey

    const base: Cell = {
      shape: attrs.includes('rot') ? 'arrow' : pick(SHAPES),
      count: attrs.includes('count') ? 1 : pick([1, 1, 2, 3]),
      fill: pick(FILLS),
      color: randInt(0, 2),
      rot: 0,
    };
    const grid: Cell[][] = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ ...base })));
    for (const rule of rules) {
      const vals = fillAttr(rule);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) (grid[r][c] as unknown as Record<string, string | number>)[rule.attr] = vals[r][c];
    }
    // Reject puzzles where a row repeats the same cell (they look broken) or the answer appears elsewhere.
    const flat = grid.flat();
    if (grid.some((row) => same(row[0], row[1]) && same(row[1], row[2])) && level > 1) continue;
    const answer = grid[2][2];
    if (flat.slice(0, 8).some((c) => same(c, answer)) && level > 1) continue;

    const options = buildOptions(answer, rules);
    if (!options) continue;
    return { level, grid, rules, options: options.cells, answer: options.answer };
  }
}

/** A different but plausible value for one attribute of the answer. */
function altValue(cell: Cell, attr: Attr, rule?: Rule): string | number {
  switch (attr) {
    case 'count': {
      const opts = [cell.count - 1, cell.count + 1].filter((v) => v >= 1 && v <= MAX_COUNT);
      return pick(opts);
    }
    case 'rot':
      return (cell.rot + (rule?.step ? Math.abs(rule.step) : 90) * pick([1, -1]) + 360) % 360;
    case 'shape':
      return pick(SHAPES.filter((s) => s !== cell.shape));
    case 'fill':
      return pick(FILLS.filter((f) => f !== cell.fill));
    case 'color':
      return pick([0, 1, 2].filter((c) => c !== cell.color));
  }
}

/**
 * Eight options from three attributes, each either the correct or one alternative value (2×2×2).
 * Every value then appears in exactly half the options, so the answer can't be spotted by elimination.
 */
function buildOptions(answer: Cell, rules: Rule[]) {
  const ruled = rules.map((r) => r.attr);
  const others = shuffle((['count', 'fill', 'color', 'shape', 'rot'] as Attr[]).filter((a) => !ruled.includes(a) && !(a === 'rot' && answer.shape !== 'arrow') && !(a === 'shape' && answer.shape === 'arrow')));
  const attrs = [...ruled, ...others].slice(0, 3);
  if (attrs.length < 3) return null;
  const alts = attrs.map((a) => altValue(answer, a, rules.find((r) => r.attr === a)));
  const cells: Cell[] = [];
  for (let m = 0; m < 8; m++) {
    const c = { ...answer } as unknown as Record<string, string | number>;
    attrs.forEach((a, k) => {
      if (m & (1 << k)) c[a] = alts[k];
    });
    cells.push(c as unknown as Cell);
  }
  const order = shuffle([...cells.keys()]);
  return { cells: order.map((i) => cells[i]), answer: order.indexOf(0) };
}

/* ---------- Explanations ---------- */

const ATTR_NAME: Record<Attr, string> = { shape: 'shape', count: 'number of shapes', fill: 'fill', color: 'colour', rot: 'direction of the arrow' };

export function explainRule(r: Rule): string {
  const name = ATTR_NAME[r.attr];
  switch (r.kind) {
    case 'rowConstant':
      return `The ${name} stays the same along each row, but changes from row to row.`;
    case 'distribute':
      return `Each row (and each column) contains each ${name} exactly once, so the missing cell takes the ${name} that row hasn't used yet.`;
    case 'progression':
      if (r.attr === 'count') return `The number of shapes goes ${r.step! > 0 ? 'up' : 'down'} by ${Math.abs(r.step!)} from left to right.`;
      return `The arrow turns ${Math.abs(r.step!)}° ${r.step! > 0 ? 'clockwise' : 'anticlockwise'} at every step to the right.`;
    case 'add':
      return 'In each row, the third cell has as many shapes as the first two together.';
    case 'subtract':
      return 'In each row, the third cell has the first cell\'s shapes minus the second cell\'s.';
  }
}

export function describeCell(c: Cell) {
  const rot = c.shape === 'arrow' ? `, pointing ${c.rot}°` : '';
  return `${c.count} ${c.fill} ${COLOR_NAME[c.color]} ${c.shape}${c.count > 1 ? 's' : ''}${rot}`;
}
