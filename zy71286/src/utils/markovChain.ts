import type {
  WeeklyRecord,
  ProductStatus,
  TransitionMatrix,
  ForecastResult,
  AbsorbingAnalysis,
  StatusTransition,
  ConfirmationStatus,
  MatrixType,
} from '@/types';
import { PRODUCT_STATUSES } from '@/types';

function multiplyMatrix(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const m = B[0].length;
  const p = B.length;
  const result: number[][] = Array(n).fill(null).map(() => Array(m).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      for (let k = 0; k < p; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }

  return result;
}

function matrixPower(P: number[][], n: number): number[][] {
  let result: number[][] = P.map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));
  let base = P;
  let exp = n;

  while (exp > 0) {
    if (exp % 2 === 1) {
      result = multiplyMatrix(result, base);
    }
    base = multiplyMatrix(base, base);
    exp = Math.floor(exp / 2);
  }

  return result;
}

function invertMatrix(A: number[][]): number[][] | null {
  const n = A.length;
  const augmented: number[][] = [];

  for (let i = 0; i < n; i++) {
    augmented.push([...A[i], ...Array(n).fill(0)]);
    augmented[i][n + i] = 1;
  }

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }

    if (Math.abs(augmented[maxRow][col]) < 1e-10) {
      return null;
    }

    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    const pivot = augmented[col][col];
    for (let j = col; j < 2 * n; j++) {
      augmented[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row !== col && Math.abs(augmented[row][col]) > 1e-10) {
        const factor = augmented[row][col];
        for (let j = col; j < 2 * n; j++) {
          augmented[row][j] -= factor * augmented[col][j];
        }
      }
    }
  }

  const inverse: number[][] = [];
  for (let i = 0; i < n; i++) {
    inverse.push(augmented[i].slice(n));
  }

  return inverse;
}

function extractTransitions(
  records: WeeklyRecord[],
  filter: ConfirmationStatus | 'ALL',
  includePromo: boolean | null
): StatusTransition[] {
  const sorted = [...records].sort((a, b) => {
    if (a.sku !== b.sku) return a.sku.localeCompare(b.sku);
    return a.weekNum - b.weekNum;
  });

  const transitions: StatusTransition[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (prev.sku !== curr.sku) continue;

    if (filter !== 'ALL' && curr.confirmationStatus !== filter) continue;

    if (includePromo !== null) {
      if (includePromo && !prev.isPromotion && !curr.isPromotion) continue;
      if (!includePromo && (prev.isPromotion || curr.isPromotion)) continue;
    }

    transitions.push({
      id: `${prev.id}->${curr.id}`,
      sku: prev.sku,
      fromStatus: prev.status,
      toStatus: curr.status,
      weekNum: curr.weekNum,
      isPromotion: prev.isPromotion || curr.isPromotion,
      confirmationStatus: curr.confirmationStatus,
    });
  }

  return transitions;
}

export function calculateTransitionMatrix(
  records: WeeklyRecord[],
  windowSize: number = 1,
  filter: ConfirmationStatus | 'ALL' = 'ALL',
  includePromo: boolean | null = null,
  matrixType: MatrixType = 'FULL'
): TransitionMatrix {
  const transitions = extractTransitions(records, filter, includePromo);

  const stateCount = PRODUCT_STATUSES.length;
  const transitionCounts: number[][] = Array(stateCount)
    .fill(null)
    .map(() => Array(stateCount).fill(0));

  transitions.forEach(t => {
    const fromIdx = PRODUCT_STATUSES.indexOf(t.fromStatus);
    const toIdx = PRODUCT_STATUSES.indexOf(t.toStatus);
    if (fromIdx >= 0 && toIdx >= 0) {
      transitionCounts[fromIdx][toIdx]++;
    }
  });

  const alpha = 1;
  const probabilities: number[][] = Array(stateCount)
    .fill(null)
    .map(() => Array(stateCount).fill(0));

  const sampleCounts = transitionCounts.map(row => [...row]);

  for (let i = 0; i < stateCount; i++) {
    const rowTotal = transitionCounts[i].reduce((a, b) => a + b, 0);
    const smoothedTotal = rowTotal + alpha * stateCount;

    for (let j = 0; j < stateCount; j++) {
      probabilities[i][j] = (transitionCounts[i][j] + alpha) / smoothedTotal;
    }
  }

  return {
    id: `matrix-${Date.now()}`,
    states: PRODUCT_STATUSES,
    probabilities,
    sampleCounts,
    windowSize,
    includePromo: includePromo !== false,
    matrixType,
    generatedAt: new Date(),
  };
}

export function forecastStates(
  matrix: TransitionMatrix,
  initialState: Record<ProductStatus, number>,
  weeks: number
): ForecastResult[] {
  const results: ForecastResult[] = [];
  const P = matrix.probabilities;

  let currentPi = PRODUCT_STATUSES.map(s => initialState[s] || 0);
  const total = currentPi.reduce((a, b) => a + b, 0);
  if (total > 0) {
    currentPi = currentPi.map(p => p / total);
  } else {
    currentPi = Array(PRODUCT_STATUSES.length).fill(1 / PRODUCT_STATUSES.length);
  }

  results.push({
    week: 0,
    probabilities: Object.fromEntries(
      PRODUCT_STATUSES.map((s, i) => [s, currentPi[i]])
    ) as Record<ProductStatus, number>,
    confidenceInterval: {
      lower: Object.fromEntries(
        PRODUCT_STATUSES.map((s, i) => [s, Math.max(0, currentPi[i] * 0.85)])
      ) as Record<ProductStatus, number>,
      upper: Object.fromEntries(
        PRODUCT_STATUSES.map((s, i) => [s, Math.min(1, currentPi[i] * 1.15 + 0.02)])
      ) as Record<ProductStatus, number>,
    },
  });

  for (let w = 1; w <= weeks; w++) {
    const Pn = matrixPower(P, w);
    const nextPi: number[] = Array(PRODUCT_STATUSES.length).fill(0);

    for (let j = 0; j < PRODUCT_STATUSES.length; j++) {
      for (let i = 0; i < PRODUCT_STATUSES.length; i++) {
        nextPi[j] += currentPi[i] * Pn[i][j];
      }
    }

    const se = Math.sqrt(w * 0.005 + 0.01);

    results.push({
      week: w,
      probabilities: Object.fromEntries(
        PRODUCT_STATUSES.map((s, i) => [s, nextPi[i]])
      ) as Record<ProductStatus, number>,
      confidenceInterval: {
        lower: Object.fromEntries(
          PRODUCT_STATUSES.map((s, i) => [s, Math.max(0, nextPi[i] - 1.96 * se * nextPi[i])])
        ) as Record<ProductStatus, number>,
        upper: Object.fromEntries(
          PRODUCT_STATUSES.map((s, i) => [s, Math.min(1, nextPi[i] + 1.96 * se * (1 - nextPi[i]))])
        ) as Record<ProductStatus, number>,
      },
    });
  }

  return results;
}

export function analyzeAbsorbingStates(
  matrix: TransitionMatrix,
  absorbingStates: ProductStatus[] = ['SLOW', 'CLEAR']
): AbsorbingAnalysis | null {
  const P = matrix.probabilities;
  const allStates = matrix.states;

  const absorbingIdx = absorbingStates.map(s => allStates.indexOf(s)).filter(i => i >= 0);
  const transientIdx = allStates
    .map((_, i) => i)
    .filter(i => !absorbingIdx.includes(i));

  if (absorbingIdx.length === 0 || transientIdx.length === 0) {
    return null;
  }

  const Q: number[][] = transientIdx.map(i =>
    transientIdx.map(j => P[i][j])
  );

  const R: number[][] = transientIdx.map(i =>
    absorbingIdx.map(j => P[i][j])
  );

  const n = Q.length;
  const IminusQ: number[][] = Array(n)
    .fill(null)
    .map((_, i) => Array(n).fill(0).map((_, j) => (i === j ? 1 : 0) - Q[i][j]));

  const N = invertMatrix(IminusQ);
  if (!N) return null;

  const B = multiplyMatrix(N, R);

  const ones = Array(n).fill(1);
  const t: number[] = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      t[i] += N[i][j] * ones[j];
    }
  }

  const transientStates = transientIdx.map(i => allStates[i]);
  const absorptionProbabilities: Record<ProductStatus, Record<ProductStatus, number>> =
    {} as Record<ProductStatus, Record<ProductStatus, number>>;

  transientStates.forEach((ts, ti) => {
    absorptionProbabilities[ts] = {} as Record<ProductStatus, number>;
    absorbingStates.forEach((as, ai) => {
      absorptionProbabilities[ts][as] = B[ti][ai];
    });
  });

  const expectedTimeToAbsorption: Record<ProductStatus, number> =
    {} as Record<ProductStatus, number>;
  transientStates.forEach((ts, ti) => {
    expectedTimeToAbsorption[ts] = t[ti];
  });

  return {
    absorbingStates,
    transientStates,
    absorptionProbabilities,
    expectedTimeToAbsorption,
    fundamentalMatrix: N,
  };
}

export function calculateSteadyState(matrix: TransitionMatrix): Record<ProductStatus, number> | null {
  const P = matrix.probabilities;
  const n = P.length;

  const A: number[][] = Array(n)
    .fill(null)
    .map((_, i) => Array(n + 1).fill(0));

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (i === j) {
        A[j][i] = P[i][j] - 1;
      } else {
        A[j][i] = P[i][j];
      }
    }
  }

  for (let j = 0; j < n; j++) {
    A[n - 1][j] = 1;
  }
  A[n - 1][n] = 1;

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) {
        maxRow = row;
      }
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];

    const pivot = A[col][col];
    if (Math.abs(pivot) < 1e-10) return null;

    for (let j = col; j <= n; j++) {
      A[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row !== col && Math.abs(A[row][col]) > 1e-10) {
        const factor = A[row][col];
        for (let j = col; j <= n; j++) {
          A[row][j] -= factor * A[col][j];
        }
      }
    }
  }

  const result: Record<ProductStatus, number> = {} as Record<ProductStatus, number>;
  for (let i = 0; i < n; i++) {
    result[matrix.states[i]] = Math.max(0, A[i][n]);
  }

  return result;
}
