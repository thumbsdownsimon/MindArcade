// Generated data sets and numerical-reasoning questions in the style of SHL / Talent Q tests.
// Wrong options are built from the mistakes people actually make (wrong base for a % change,
// averaging percentages, using the wrong row), not random noise.

import { pick, randInt, shuffle, sum } from '../../lib/util';

export type Kind = 'percent change' | 'share of total' | 'totals & averages' | 'projection' | 'currency' | 'weighted average' | 'comparison';

export interface Question {
  prompt: string;
  options: string[];
  answer: number;
  explain: string;
  kind: Kind;
}

export interface TableData {
  type: 'table';
  title: string;
  unit: string;
  rowHead: string;
  cols: string[];
  rows: { label: string; values: number[] }[];
  /** How to print each column (e.g. '%' columns). */
  colFormat?: ('num' | 'pct' | 'money')[];
}

export interface BarData {
  type: 'bars';
  title: string;
  unit: string;
  groups: string[];
  series: { label: string; values: number[] }[];
}

export type DataSet = (TableData | BarData) & { questions: Question[] };

/* ---------- Formatting ---------- */

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;
export const fmt = (v: number, dp = 0) => v.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pctS = (v: number, dp = 1) => `${fmt(round(v, dp), dp)}%`;

/**
 * Five options: the answer plus distractors, formatted, de-duplicated and sorted ascending like a real test.
 * `nudge` makes extra plausible values if the mistakes collapse onto the same number.
 */
function options(answer: number, mistakes: number[], show: (v: number) => string, nudge: (v: number, k: number) => number) {
  const set = new Map<string, number>([[show(answer), answer]]);
  // Negative values only make sense as options when the answer itself is a fall.
  const ok = (v: number) => Number.isFinite(v) && (v > 0 || answer <= 0);
  for (const m of shuffle(mistakes)) if (ok(m) && set.size < 5) set.set(show(m), m);
  for (let k = 1; set.size < 5 && k < 50; k++) {
    const v = nudge(answer, k);
    if (ok(v)) set.set(show(v), v);
  }
  const sorted = [...set.entries()].sort((a, b) => a[1] - b[1]);
  return { options: sorted.map((e) => e[0]), answer: sorted.findIndex((e) => e[0] === show(answer)) };
}

const spread = (scale: number) => (v: number, k: number) => v + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * scale;

/* ---------- Data set 1: quarterly revenue (table) ---------- */

const REGIONS = ['North', 'South', 'East', 'West'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

function revenueTable(n: number, easy: boolean): DataSet {
  const rows = REGIONS.map((label) => {
    let v = randInt(16, 60) * 10;
    return {
      label,
      values: QUARTERS.map(() => {
        const out = v;
        v = Math.max(80, Math.round((v * (1 + randInt(-18, 25) / 100)) / 5) * 5);
        return out;
      }),
    };
  });
  const d: TableData = { type: 'table', title: 'Quarterly revenue by region', unit: '£ thousands', rowHead: 'Region', cols: QUARTERS, rows };
  const col = (q: number) => rows.map((r) => r.values[q]);
  const money = (v: number) => `£${fmt(round(v, 1), v % 1 ? 1 : 0)}k`;

  const make: Record<string, () => Question> = {
    change: () => {
      const r = pick(rows);
      const [a, b] = shuffle([0, 1, 2, 3]).slice(0, 2).sort();
      const x = r.values[a], y = r.values[b];
      if (x === y) return make.share();
      const ans = ((y - x) / x) * 100;
      const other = pick(rows.filter((o) => o !== r));
      const o = options(ans, [((y - x) / y) * 100, (y / x) * 100 - 100 + 2, ((other.values[b] - other.values[a]) / other.values[a]) * 100, ((y - x) / x) * 10], (v) => (v >= 0 ? `+${pctS(v)}` : pctS(v)), spread(1.5));
      return { prompt: `By what percentage did ${r.label}'s revenue change from ${QUARTERS[a]} to ${QUARTERS[b]}?`, ...o, kind: 'percent change', explain: `(${QUARTERS[b]} − ${QUARTERS[a]}) ÷ ${QUARTERS[a]} = (${y} − ${x}) ÷ ${x} = ${pctS(ans)}. Always divide by the starting value.` };
    },
    share: () => {
      const q = randInt(0, 3);
      const r = pick(rows);
      const tot = sum(col(q));
      const ans = (r.values[q] / tot) * 100;
      const o = options(ans, [(r.values[q] / sum(r.values)) * 100, (r.values[q] / sum(rows.flatMap((x) => x.values))) * 100, 25, (pick(rows.filter((x) => x !== r)).values[q] / tot) * 100], (v) => pctS(v), spread(1.2));
      return { prompt: `What share of total ${QUARTERS[q]} revenue came from ${r.label}?`, ...o, kind: 'share of total', explain: `${r.label} ÷ all regions in ${QUARTERS[q]} = ${r.values[q]} ÷ ${tot} = ${pctS(ans)}.` };
    },
    total: () => {
      const q = randInt(0, 3);
      const tot = sum(col(q));
      const r = pick(rows);
      const o = options(tot, [tot - r.values[q], sum(r.values), tot + pick(rows).values[(q + 1) % 4] - pick(rows).values[q], tot * 1.1], money, spread(15));
      return { prompt: `What was the total revenue across all four regions in ${QUARTERS[q]}?`, ...o, kind: 'totals & averages', explain: `Add the ${QUARTERS[q]} column: ${col(q).join(' + ')} = ${money(tot)}.` };
    },
    average: () => {
      const r = pick(rows);
      const avg = sum(r.values) / 4;
      const o = options(avg, [sum(r.values) / 3, (Math.max(...r.values) + Math.min(...r.values)) / 2 + 7.5, sum(pick(rows.filter((x) => x !== r)).values) / 4, r.values[3]], money, spread(6));
      return { prompt: `What was ${r.label}'s average revenue per quarter?`, ...o, kind: 'totals & averages', explain: `(${r.values.join(' + ')}) ÷ 4 = ${money(avg)}.` };
    },
    projection: () => {
      const r = pick(rows);
      const g = pick([5, 8, 12, 15, 20]);
      const v = r.values[3];
      const ans = v * (1 + g / 100);
      const o = options(ans, [v + g, r.values[2] * (1 + g / 100), v * (1 + g / 100) ** 2, v * (1 - g / 100)], money, spread(4));
      return { prompt: `If ${r.label}'s revenue grows by ${g}% from Q4 to next year's Q1, what will Q1 revenue be?`, ...o, kind: 'projection', explain: `Q4 × (1 + ${g}%) = ${v} × ${1 + g / 100} = ${money(ans)}.` };
    },
    currency: () => {
      const r = pick(rows);
      const q = randInt(0, 3);
      const rate = pick([1.15, 1.17, 1.18, 1.2]);
      const v = r.values[q];
      const ans = v * rate;
      const eur = (x: number) => `€${fmt(round(x, 1), 1)}k`;
      const o = options(ans, [v / rate, v * (rate - 0.1), rows.find((x) => x !== r)!.values[q] * rate, v * (1 + (rate - 1) / 10)], eur, spread(3));
      return { prompt: `£1 = €${rate}. What was ${r.label}'s ${QUARTERS[q]} revenue in euros?`, ...o, kind: 'currency', explain: `£ to € means multiplying: ${v} × ${rate} = ${eur(ans)}.` };
    },
    biggest: () => {
      const growth = rows.map((r) => (r.values[3] - r.values[0]) / r.values[0]);
      const abs = rows.map((r) => r.values[3] - r.values[0]);
      const best = growth.indexOf(Math.max(...growth));
      if (growth.filter((g) => Math.abs(g - growth[best]) < 0.001).length > 1) return make.change();
      // Point out the trap when the biggest rise in pounds is a different region.
      const absBest = abs.indexOf(Math.max(...abs));
      return {
        prompt: 'Which region had the largest percentage increase in revenue from Q1 to Q4?',
        options: [...REGIONS],
        answer: best,
        kind: 'comparison',
        explain: `${REGIONS.map((n, i) => `${n} ${growth[i] >= 0 ? '+' : ''}${pctS(growth[i] * 100)}`).join(', ')}.${absBest !== best ? ` Careful: ${REGIONS[absBest]} grew the most in pounds, but not in percent.` : ''}`,
      };
    },
  };
  const pool = easy ? ['total', 'change', 'share'] : shuffle(Object.keys(make)).slice(0, n);
  return { ...d, questions: pool.map((k) => make[k]()) };
}

/* ---------- Data set 2: units sold (grouped bar chart) ---------- */

const PRODUCTS = ['Bikes', 'Scooters', 'E-bikes'];
const YEARS = ['2022', '2023', '2024', '2025'];

function unitsChart(n: number): DataSet {
  const series = PRODUCTS.map((label, k) => {
    let v = randInt(20, 60) + k * 3;
    return {
      label,
      values: YEARS.map(() => {
        const out = v;
        v = Math.max(8, v + randInt(-8, 14) + (label === 'E-bikes' ? 6 : 0));
        return out;
      }),
    };
  });
  const d: BarData = { type: 'bars', title: 'Units sold per year by product', unit: 'thousand units', groups: YEARS, series };
  const yearTotal = (y: number) => sum(series.map((s) => s.values[y]));
  const units = (v: number) => `${fmt(round(v, 1), v % 1 ? 1 : 0)}k`;

  const make: Record<string, () => Question> = {
    change: () => {
      const s = pick(series);
      const a = randInt(0, 2), b = randInt(a + 1, 3);
      const x = s.values[a], y = s.values[b];
      if (x === y) return make.share();
      const ans = ((y - x) / x) * 100;
      const o = options(ans, [((y - x) / y) * 100, y - x, ((series.find((o) => o !== s)!.values[b] - series.find((o) => o !== s)!.values[a]) / series.find((o) => o !== s)!.values[a]) * 100], (v) => (v >= 0 ? `+${pctS(v)}` : pctS(v)), spread(2));
      return { prompt: `By what percentage did ${s.label} sales change from ${YEARS[a]} to ${YEARS[b]}?`, ...o, kind: 'percent change', explain: `(${y} − ${x}) ÷ ${x} = ${pctS(ans)}.` };
    },
    share: () => {
      const y = randInt(0, 3);
      const s = pick(series);
      const ans = (s.values[y] / yearTotal(y)) * 100;
      const o = options(ans, [(s.values[y] / sum(s.values)) * 100, 100 / 3, (pick(series.filter((o) => o !== s)).values[y] / yearTotal(y)) * 100], (v) => pctS(v), spread(1.5));
      return { prompt: `What percentage of all units sold in ${YEARS[y]} were ${s.label}?`, ...o, kind: 'share of total', explain: `${s.values[y]} ÷ (${series.map((x) => x.values[y]).join(' + ')}) = ${s.values[y]} ÷ ${yearTotal(y)} = ${pctS(ans)}.` };
    },
    difference: () => {
      const s = pick(series);
      const t = pick(series.filter((o) => o !== s));
      const ans = sum(s.values) - sum(t.values);
      if (ans <= 0) return make.difference();
      const o = options(ans, [s.values[3] - t.values[3], ans + t.values[0], sum(s.values) - sum(t.values.slice(1))], units, spread(3));
      return { prompt: `Over all four years combined, how many more ${s.label.toLowerCase()} than ${t.label.toLowerCase()} were sold?`, ...o, kind: 'totals & averages', explain: `${s.label}: ${s.values.join(' + ')} = ${sum(s.values)}k. ${t.label}: ${t.values.join(' + ')} = ${sum(t.values)}k. Difference ${units(ans)}.` };
    },
    firstAbove: () => {
      const totals = YEARS.map((_, y) => yearTotal(y));
      const sorted = [...totals].sort((a, b) => a - b);
      const threshold = Math.round((sorted[1] + sorted[2]) / 2 / 5) * 5;
      const ans = totals.findIndex((t) => t > threshold);
      return {
        prompt: `In which year did total sales across all three products first exceed ${threshold}k units?`,
        options: [...YEARS, 'Never'],
        answer: ans < 0 ? 4 : ans,
        kind: 'comparison',
        explain: `Year totals: ${YEARS.map((y, i) => `${y} ${totals[i]}k`).join(', ')}.`,
      };
    },
    ratio: () => {
      const y = randInt(0, 3);
      const [s, t] = shuffle(series).slice(0, 2);
      const ans = s.values[y] / t.values[y];
      const o = options(ans, [t.values[y] / s.values[y], s.values[(y + 1) % 4] / t.values[(y + 1) % 4], ans + 0.5], (v) => `${fmt(round(v, 2), 2)}×`, spread(0.15));
      return { prompt: `In ${YEARS[y]}, how many ${s.label.toLowerCase()} were sold for every one ${t.label.toLowerCase().replace(/s$/, '')} sold?`, ...o, kind: 'comparison', explain: `${s.label} ÷ ${t.label} = ${s.values[y]} ÷ ${t.values[y]} = ${fmt(round(ans, 2), 2)}×.` };
    },
  };
  return { ...d, questions: shuffle(Object.keys(make)).slice(0, n).map((k) => make[k]()) };
}

/* ---------- Data set 3: staff survey (table with percentages) ---------- */

const DEPTS = ['Sales', 'Engineering', 'Support', 'Finance', 'Marketing'];

function staffSurvey(n: number): DataSet {
  // Head-counts are multiples of 20 and percentages multiples of 5, so every count of people is a whole number.
  const rows = DEPTS.map((label) => ({ label, values: [randInt(2, 15) * 20, randInt(9, 18) * 5, randInt(2, 14) * 5] }));
  const d: TableData = {
    type: 'table',
    title: 'Staff survey results by department',
    unit: 'Employees and % of each department',
    rowHead: 'Department',
    cols: ['Employees', '% satisfied', '% remote'],
    colFormat: ['num', 'pct', 'pct'],
    rows,
  };
  const satisfied = rows.map((r) => (r.values[0] * r.values[1]) / 100);

  const make: Record<string, () => Question> = {
    count: () => {
      const r = pick(rows);
      const ans = (r.values[0] * r.values[2]) / 100;
      const o = options(ans, [r.values[0] - ans, (r.values[0] * r.values[1]) / 100, r.values[2], ans * 1.1], (v) => fmt(round(v, 1), v % 1 ? 1 : 0), spread(2));
      return { prompt: `How many ${r.label} employees work remotely?`, ...o, kind: 'share of total', explain: `${r.values[0]} × ${r.values[2]}% = ${fmt(round(ans, 1), ans % 1 ? 1 : 0)}.` };
    },
    mostSatisfied: () => {
      const best = satisfied.indexOf(Math.max(...satisfied));
      if (satisfied.filter((v) => v === satisfied[best]).length > 1) return make.count();
      const topPct = rows.map((r) => r.values[1]).indexOf(Math.max(...rows.map((r) => r.values[1])));
      return {
        prompt: 'Which department has the largest number of satisfied employees?',
        options: DEPTS,
        answer: best,
        kind: 'comparison',
        explain: `Satisfied = employees × % satisfied: ${DEPTS.map((n, i) => `${n} ${fmt(round(satisfied[i], 1), satisfied[i] % 1 ? 1 : 0)}`).join(', ')}.${topPct !== best ? ` ${DEPTS[topPct]} has the highest percentage, but fewer people.` : ''}`,
      };
    },
    overall: () => {
      const ans = (sum(satisfied) / sum(rows.map((r) => r.values[0]))) * 100;
      const naive = sum(rows.map((r) => r.values[1])) / rows.length;
      const o = options(ans, [naive, (sum(satisfied) / sum(rows.map((r) => r.values[0])) * 100 + naive) / 2 + 3, Math.max(...rows.map((r) => r.values[1])) - 10], (v) => pctS(v), spread(1.5));
      return { prompt: 'What percentage of all employees in the company are satisfied?', ...o, kind: 'weighted average', explain: `Add up satisfied people (${fmt(round(sum(satisfied), 1), 1)}) and divide by all employees (${sum(rows.map((r) => r.values[0]))}) = ${pctS(ans)}. Simply averaging the five percentages (${pctS(naive)}) is wrong, because the departments are different sizes.` };
    },
    diff: () => {
      const [a, b] = shuffle(rows).slice(0, 2);
      const ra = (a.values[0] * a.values[2]) / 100, rb = (b.values[0] * b.values[2]) / 100;
      const ans = Math.abs(ra - rb);
      if (ans < 1) return make.count();
      const o = options(ans, [Math.abs(a.values[2] - b.values[2]), Math.abs(a.values[0] - b.values[0]), ra + rb], (v) => fmt(round(v, 1), v % 1 ? 1 : 0), spread(2));
      return { prompt: `What is the difference between the number of remote workers in ${a.label} and in ${b.label}?`, ...o, kind: 'totals & averages', explain: `${a.label}: ${a.values[0]} × ${a.values[2]}% = ${fmt(round(ra, 1), 1)}. ${b.label}: ${b.values[0]} × ${b.values[2]}% = ${fmt(round(rb, 1), 1)}. Difference ${fmt(round(ans, 1), 1)}.` };
    },
    target: () => {
      const r = pick(rows);
      const target = Math.min(98, r.values[1] + pick([5, 10, 15]));
      const ans = Math.ceil((r.values[0] * (target - r.values[1])) / 100);
      if (ans < 1) return make.count();
      const o = options(ans, [target - r.values[1], Math.ceil((r.values[0] * target) / 100), ans + Math.ceil(r.values[0] / 20)], (v) => fmt(v), spread(1));
      return { prompt: `Headcount stays the same. How many more ${r.label} employees need to become satisfied to reach ${target}% satisfied?`, ...o, kind: 'projection', explain: `${r.values[0]} × (${target}% − ${r.values[1]}%) = ${r.values[0]} × ${target - r.values[1]}% = ${ans} (rounded up to a whole person).` };
    },
  };
  return { ...d, questions: shuffle(Object.keys(make)).slice(0, n).map((k) => make[k]()) };
}

/** A run: three data sets in random order, three questions each. */
export function buildRun(): DataSet[] {
  return shuffle([revenueTable(3, false), unitsChart(3), staffSurvey(3)]);
}

export function buildPractice(): DataSet[] {
  return [revenueTable(3, true)];
}
