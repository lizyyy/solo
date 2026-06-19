import type { EmptySetFlag, HistoricalAnswer, ReplayRequest } from '@/types';
import type { DecomposeOutput } from './decompose';
import { decomposeCholesky, decomposeLU, decomposeQR } from './decompose';
import { frobeniusNorm, isEmptyMatrix, subtract } from './matrix';

export interface ValidationResult {
  emptySetFlag: EmptySetFlag;
  residual: number;
  mathOk: boolean;
  matchOk: boolean;
  verified: boolean;
  note: string;
}

export function runDecomposition(req: ReplayRequest): DecomposeOutput {
  const tol = req.tolerance;
  if (req.method === 'LU') return decomposeLU(req.matrix, tol, req.pivot);
  if (req.method === 'QR') return decomposeQR(req.matrix, tol);
  return decomposeCholesky(req.matrix, tol);
}

export function validate(
  out: DecomposeOutput,
  req: ReplayRequest,
  historical: HistoricalAnswer | undefined,
): ValidationResult {
  let emptySetFlag: EmptySetFlag = 'NONE';
  if (historical && historical.emptySet) {
    emptySetFlag = 'EMPTY_ANOMALY';
  } else if (isEmptyMatrix(req.matrix)) {
    emptySetFlag = 'NORMAL_EMPTY';
  }

  let residual = out.reconError;
  let note = `重建误差 ${out.reconError.toExponential(2)}`;
  if (emptySetFlag === 'EMPTY_ANOMALY') {
    residual = NaN;
    note = '历史答案为空集合，无法比对（旧逻辑会当正常输入通过，已拦截）';
  } else if (
    historical &&
    !isEmptyMatrix(historical.expectedU) &&
    out.factors.U &&
    req.method === 'LU'
  ) {
    residual = frobeniusNorm(subtract(out.factors.U, historical.expectedU!));
    note = `与历史答案 U 的误差 ${residual.toExponential(2)}`;
  }

  const tol = req.tolerance;
  const mathOk = Number.isFinite(out.reconError) && out.reconError <= tol;
  const matchOk = emptySetFlag === 'EMPTY_ANOMALY' ? false : residual <= tol;
  const verified = mathOk && matchOk && emptySetFlag !== 'EMPTY_ANOMALY';

  return { emptySetFlag, residual, mathOk, matchOk, verified, note };
}
