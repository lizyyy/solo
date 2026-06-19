import type { BoundaryEvent, Factors, PivotStrategy } from '@/types';
import { SRC, SRC_FILE } from './sourceLines';
import {
  cloneMatrix,
  frobeniusNorm,
  identity,
  multiply,
  range,
  subtract,
  transpose,
  zeros,
} from './matrix';

export interface DecomposeOutput {
  factors: Factors;
  boundaries: BoundaryEvent[];
  sourceLines: number[];
  reconError: number;
}

let bid = 0;
const nextId = () => `b${(++bid).toString(36)}`;

export function decomposeLU(A: number[][], tol: number, pivot: PivotStrategy): DecomposeOutput {
  const n = A.length;
  const U = cloneMatrix(A);
  const L = identity(n);
  const P = range(0, n);
  const boundaries: BoundaryEvent[] = [];
  const lines = new Set<number>();

  for (let k = 0; k < n; k++) {
    let pivRow = k;
    if (pivot === 'partial') {
      let max = Math.abs(U[k][k]);
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(U[i][k]) > max) {
          max = Math.abs(U[i][k]);
          pivRow = i;
        }
      }
      if (pivRow !== k) {
        [U[k], U[pivRow]] = [U[pivRow], U[k]];
        for (let j = 0; j < k; j++) {
          const t = L[k][j];
          L[k][j] = L[pivRow][j];
          L[pivRow][j] = t;
        }
        [P[k], P[pivRow]] = [P[pivRow], P[k]];
      }
    }
    const pivVal = U[k][k];
    if (Math.abs(pivVal) <= tol) { // SRC:lu_pivot
      const sev = pivVal === 0 ? 'div_zero' : 'near_zero';
      const b: BoundaryEvent = {
        id: nextId(),
        step: 'LU 主元搜索',
        position: { row: k, col: k },
        pivotValue: pivVal,
        impactRange: { rows: range(k, n), cols: range(k, n) },
        sourceLine: SRC.lu_pivot,
        sourceFile: SRC_FILE,
        severity: sev,
        message: `第 ${k + 1} 步主元 ≈ ${pivVal.toExponential(2)}（≤ 容差 ${tol}），跳过该列消元，下游存在除零风险`,
      };
      lines.add(SRC.lu_pivot);
      boundaries.push(b);
      continue;
    }
    for (let i = k + 1; i < n; i++) {
      const factor = U[i][k] / pivVal; // SRC:lu_eliminate
      lines.add(SRC.lu_eliminate);
      L[i][k] = factor;
      for (let j = k; j < n; j++) U[i][j] -= factor * U[k][j];
    }
  }

  const PA = P.map((p) => A[p]);
  const reconError = frobeniusNorm(subtract(PA, multiply(L, U)));
  for (const b of boundaries) {
    b.impactRange = { rows: range(b.position.row, n), cols: range(b.position.col, n) };
  }
  return { factors: { L, U, P }, boundaries, sourceLines: [...lines], reconError };
}

export function decomposeQR(A: number[][], tol: number): DecomposeOutput {
  const m = A.length;
  const n = A[0]?.length ?? 0;
  const R = cloneMatrix(A);
  const Q = identity(m);
  const boundaries: BoundaryEvent[] = [];
  const lines = new Set<number>();
  const kmax = Math.min(m, n);

  for (let k = 0; k < kmax; k++) {
    const x: number[] = [];
    for (let i = k; i < m; i++) x.push(R[i][k]);
    let normx = 0;
    for (const v of x) normx += v * v;
    normx = Math.sqrt(normx);
    if (normx <= tol) { // SRC:qr_norm
      lines.add(SRC.qr_norm);
      boundaries.push({
        id: nextId(),
        step: 'QR Householder 列范数',
        position: { row: k, col: k },
        pivotValue: normx,
        impactRange: { rows: range(k, m), cols: range(k, n) },
        sourceLine: SRC.qr_norm,
        sourceFile: SRC_FILE,
        severity: 'near_zero',
        message: `第 ${k + 1} 列范数 ≈ ${normx.toExponential(2)}（≤ 容差），Householder 向量退化，跳过该列反射`,
      });
      continue;
    }
    const alpha = x[0] >= 0 ? -normx : normx;
    const v = x.slice();
    v[0] -= alpha;
    let vnorm = 0;
    for (const vv of v) vnorm += vv * vv;
    vnorm = Math.sqrt(vnorm);
    if (vnorm <= tol) continue;
    for (let i = 0; i < v.length; i++) v[i] /= vnorm; // SRC:qr_vnormalize
    lines.add(SRC.qr_vnormalize);
    for (let j = k; j < n; j++) {
      let dot = 0;
      for (let i = 0; i < v.length; i++) dot += v[i] * R[k + i][j];
      for (let i = 0; i < v.length; i++) R[k + i][j] -= 2 * v[i] * dot;
    }
    for (let i = 0; i < m; i++) {
      let dot = 0;
      for (let j = 0; j < v.length; j++) dot += Q[i][k + j] * v[j];
      for (let j = 0; j < v.length; j++) Q[i][k + j] -= 2 * v[j] * dot;
    }
  }

  const reconError = frobeniusNorm(subtract(A, multiply(Q, R)));
  return { factors: { Q, R }, boundaries, sourceLines: [...lines], reconError };
}

export function decomposeCholesky(A: number[][], tol: number): DecomposeOutput {
  const n = A.length;
  const L = zeros(n, n);
  const boundaries: BoundaryEvent[] = [];
  const lines = new Set<number>();

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i][j];
      for (let p = 0; p < j; p++) sum -= L[i][p] * L[j][p];
      if (i === j) {
        if (sum <= tol) { // SRC:chol_diag
          lines.add(SRC.chol_diag);
          boundaries.push({
            id: nextId(),
            step: 'Cholesky 对角开方',
            position: { row: i, col: i },
            pivotValue: sum,
            impactRange: { rows: range(i, n), cols: range(i, n) },
            sourceLine: SRC.chol_diag,
            sourceFile: SRC_FILE,
            severity: sum <= 0 ? 'div_zero' : 'near_zero',
            message: `对角元 d_${i + 1} ≈ ${sum.toExponential(2)}（≤ 容差），非正定，无法开方`,
          });
          L[i][i] = 0;
          continue;
        }
        L[i][i] = Math.sqrt(sum); // SRC:chol_sqrt
        lines.add(SRC.chol_sqrt);
      } else {
        const denom = L[j][j];
        if (Math.abs(denom) <= tol) { // SRC:chol_offdiag
          lines.add(SRC.chol_offdiag);
          boundaries.push({
            id: nextId(),
            step: 'Cholesky 非对角除法',
            position: { row: i, col: j },
            pivotValue: denom,
            impactRange: { rows: range(i, n), cols: range(j, j + 1) },
            sourceLine: SRC.chol_offdiag,
            sourceFile: SRC_FILE,
            severity: 'div_zero',
            message: `L[${i + 1}][${j + 1}] 依赖的 L[${j + 1}][${j + 1}] ≈ 0，除零`,
          });
          L[i][j] = 0;
          continue;
        }
        L[i][j] = sum / denom; // SRC:chol_offdiag_div
        lines.add(SRC.chol_offdiag);
      }
    }
  }

  const reconError = frobeniusNorm(subtract(A, multiply(L, transpose(L))));
  return { factors: { L }, boundaries, sourceLines: [...lines], reconError };
}
