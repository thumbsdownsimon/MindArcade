import { useState } from 'react';

/** Evaluates + − × ÷ and brackets with the usual precedence. Returns null for anything malformed. */
export function evaluate(expr: string): number | null {
  const src = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '').replace(/\s+/g, '');
  if (!/^[\d.+\-*/()%]*$/.test(src) || !src) return null;
  let i = 0;
  const peek = () => src[i];
  function num(): number | null {
    if (peek() === '(') {
      i++;
      const v = add();
      if (peek() !== ')') return null;
      i++;
      return v;
    }
    if (peek() === '-') {
      i++;
      const v = num();
      return v === null ? null : -v;
    }
    const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    let v = parseFloat(m[0]);
    if (peek() === '%') {
      i++;
      v /= 100;
    }
    return v;
  }
  function mul(): number | null {
    let v = num();
    while (v !== null && (peek() === '*' || peek() === '/')) {
      const op = src[i++];
      const r = num();
      if (r === null) return null;
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function add(): number | null {
    let v = mul();
    while (v !== null && (peek() === '+' || peek() === '-')) {
      const op = src[i++];
      const r = mul();
      if (r === null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const v = add();
  return v !== null && i === src.length && Number.isFinite(v) ? v : null;
}

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '%', '+', '(', ')', 'C', '='];

export default function Calculator() {
  const [expr, setExpr] = useState('');
  // The last calculation, shown under the display. Pressing an operator next continues from its result.
  const [last, setLast] = useState<{ expr: string; value: string } | null>(null);

  function run() {
    if (!expr) return;
    const v = evaluate(expr);
    setLast({ expr, value: v === null ? 'Error' : String(Math.round(v * 1e6) / 1e6) });
    setExpr('');
  }

  function press(k: string) {
    if (k === 'C') {
      setExpr('');
      setLast(null);
    } else if (k === '=') run();
    else setExpr((e) => (!e && last && last.value !== 'Error' && '+−×÷%'.includes(k) ? last.value : e) + k);
  }

  return (
    <div className="calc card-inset">
      <input
        className="calc-display"
        value={expr}
        placeholder={last?.value ?? '0'}
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === '=') {
            e.preventDefault();
            run();
          }
          if (e.key === 'Escape') press('C');
          e.stopPropagation();
        }}
        aria-label="Calculator input"
      />
      <div className="calc-result" aria-live="polite">
        {last && (
          <>
            {last.expr} = <strong>{last.value}</strong>
          </>
        )}
      </div>
      <div className="calc-keys">
        {KEYS.map((k) => (
          <button key={k} className={`calc-key ${k === '=' ? 'eq' : '+−×÷'.includes(k) ? 'op' : ''}`} onClick={() => press(k)}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
