export function cloneMatrix(m: number[][]): number[][] {
  return m.map((r) => r.slice());
}

export function zeros(n: number, m: number): number[][] {
  return Array.from({ length: n }, () => Array.from({ length: m }, () => 0));
}

export function identity(n: number): number[][] {
  const I = zeros(n, n);
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

export function transpose(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  const t = zeros(cols, rows);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) t[j][i] = m[i][j];
  return t;
}

export function multiply(a: number[][], b: number[][]): number[][] {
  const n = a.length;
  const k = a[0]?.length ?? 0;
  const m = b[0]?.length ?? 0;
  const c = zeros(n, m);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let p = 0; p < k; p++) s += a[i][p] * b[p][j];
      c[i][j] = s;
    }
  return c;
}

export function subtract(a: number[][], b: number[][]): number[][] {
  return a.map((r, i) => r.map((v, j) => v - b[i][j]));
}

export function frobeniusNorm(m: number[][]): number {
  let s = 0;
  for (const r of m) for (const v of r) s += v * v;
  return Math.sqrt(s);
}

export function isEmptyMatrix(m?: number[][] | null): boolean {
  return !m || m.length === 0 || m.every((r) => !r || r.length === 0);
}

export function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i < end; i++) out.push(i);
  return out;
}

export function fmt(n: number, digits = 4): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  if (Math.abs(n) < 1e-12) return '0';
  return Number(n.toFixed(digits)).toString();
}

export function sameShape(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if ((a[i]?.length ?? 0) !== (b[i]?.length ?? 0)) return false;
  return true;
}
