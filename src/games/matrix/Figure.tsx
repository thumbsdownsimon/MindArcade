import { COLORS, type Cell, type Shape } from './generate';

/** Where each of 1–5 figures sits in a 100×100 cell, and how big they are. */
const LAYOUT: Record<number, { pts: [number, number][]; r: number }> = {
  1: { pts: [[50, 50]], r: 26 },
  2: { pts: [[29, 50], [71, 50]], r: 17 },
  3: { pts: [[50, 28], [28, 70], [72, 70]], r: 16 },
  4: { pts: [[29, 29], [71, 29], [29, 71], [71, 71]], r: 15 },
  5: { pts: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]], r: 13 },
};

const poly = (n: number, r: number, start = -Math.PI / 2) =>
  Array.from({ length: n }, (_, k) => {
    const a = start + (k * 2 * Math.PI) / n;
    return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');

const star = (r: number) =>
  Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    return `${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`;
  }).join(' ');

function ShapeEl({ shape, r, fill, stroke }: { shape: Shape; r: number; fill: string; stroke: string }) {
  const common = { fill, stroke, strokeWidth: 2.5, strokeLinejoin: 'round' as const };
  switch (shape) {
    case 'circle':
      return <circle r={r * 0.92} {...common} />;
    case 'square':
      return <rect x={-r * 0.8} y={-r * 0.8} width={r * 1.6} height={r * 1.6} {...common} />;
    case 'triangle':
      return <polygon points={poly(3, r, -Math.PI / 2)} transform={`translate(0 ${r * 0.18})`} {...common} />;
    case 'diamond':
      return <polygon points={poly(4, r)} {...common} />;
    case 'hexagon':
      return <polygon points={poly(6, r * 0.95, 0)} {...common} />;
    case 'star':
      return <polygon points={star(r * 1.05)} {...common} />;
    case 'arrow': {
      const w = r * 0.42;
      return (
        <polygon
          points={`0,${-r} ${r * 0.85},${-r * 0.1} ${w},${-r * 0.1} ${w},${r} ${-w},${r} ${-w},${-r * 0.1} ${-r * 0.85},${-r * 0.1}`}
          {...common}
        />
      );
    }
  }
}

/** Shared <defs> for striped fills. Render once per page. */
export function FigureDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {COLORS.map((c, i) => (
          <pattern key={i} id={`mx-stripe-${i}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#ffffff" />
            <rect width="3" height="6" fill={c} />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}

export default function Figure({ cell }: { cell: Cell }) {
  const { pts, r } = LAYOUT[cell.count];
  const color = COLORS[cell.color];
  const fill = cell.fill === 'solid' ? color : cell.fill === 'outline' ? '#ffffff' : `url(#mx-stripe-${cell.color})`;
  return (
    <svg viewBox="0 0 100 100" className="mx-figure" role="img" aria-hidden="true">
      {pts.map(([x, y], k) => (
        <g key={k} transform={`translate(${x} ${y}) rotate(${cell.rot})`}>
          <ShapeEl shape={cell.shape} r={r} fill={fill} stroke={color} />
        </g>
      ))}
    </svg>
  );
}
