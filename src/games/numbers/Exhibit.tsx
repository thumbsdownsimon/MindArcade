import { fmt, type BarData, type DataSet, type TableData } from './data';

function Table({ d }: { d: TableData }) {
  const show = (v: number, c: number) => (d.colFormat?.[c] === 'pct' ? `${v}%` : fmt(v));
  return (
    <div className="nc-table-wrap">
      <table className="nc-table">
        <thead>
          <tr>
            <th>{d.rowHead}</th>
            {d.cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r) => (
            <tr key={r.label}>
              <th>{r.label}</th>
              {r.values.map((v, c) => (
                <td key={c}>{show(v, c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Grouped column chart: one group per year, one colour per product, values printed on each bar. */
function Bars({ d }: { d: BarData }) {
  const max = Math.max(...d.series.flatMap((s) => s.values));
  const top = Math.ceil((max * 1.12) / 20) * 20;
  const ticks = Array.from({ length: top / 20 + 1 }, (_, i) => i * 20).filter((t) => t % (top > 100 ? 40 : 20) === 0);
  const W = 520, H = 260, L = 34, B = 26, T = 18;
  const gw = (W - L) / d.groups.length;
  const bw = Math.min(30, (gw - 22) / d.series.length - 2);
  const y = (v: number) => H - B - (v / top) * (H - B - T);
  return (
    <div className="nc-chart">
      <div className="nc-legend">
        {d.series.map((s, i) => (
          <span key={s.label}>
            <i style={{ background: `var(--series-${i + 1})` }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={d.title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W} y1={y(t)} y2={y(t)} className="nc-grid" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="nc-axis">
              {t}
            </text>
          </g>
        ))}
        {d.groups.map((g, gi) => {
          const x0 = L + gi * gw + (gw - d.series.length * (bw + 2)) / 2;
          return (
            <g key={g}>
              {d.series.map((s, si) => {
                const v = s.values[gi];
                const x = x0 + si * (bw + 2);
                const h = H - B - y(v);
                return (
                  <g key={s.label} className="nc-bar">
                    <title>{`${s.label}, ${g}: ${v}k units`}</title>
                    <path
                      d={`M${x},${H - B} v${-(h - 4)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${h - 4} z`}
                      style={{ fill: `var(--series-${si + 1})` }}
                    />
                    <text x={x + bw / 2} y={y(v) - 4} textAnchor="middle" className="nc-val">
                      {v}
                    </text>
                  </g>
                );
              })}
              <text x={L + gi * gw + gw / 2} y={H - 8} textAnchor="middle" className="nc-axis">
                {g}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Exhibit({ data }: { data: DataSet }) {
  return (
    <div className="nc-exhibit card-inset">
      <div className="nc-exhibit-head">
        <strong>{data.title}</strong>
        <span className="muted small">{data.unit}</span>
      </div>
      {data.type === 'table' ? <Table d={data} /> : <Bars d={data} />}
    </div>
  );
}
