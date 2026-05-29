import { DTWResult, EditDistanceResult } from '@/types';

export function dynamicTimeWarping(
  sequenceA: number[],
  sequenceB: number[]
): DTWResult {
  const n = sequenceA.length;
  const m = sequenceB.length;

  if (n === 0 || m === 0) {
    return {
      distance: Infinity,
      normalizedDistance: 1,
      path: [],
      costMatrix: [],
    };
  }

  const costMatrix: number[][] = Array(n + 1)
    .fill(null)
    .map(() => Array(m + 1).fill(Infinity));
  costMatrix[0][0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(sequenceA[i - 1] - sequenceB[j - 1]);
      costMatrix[i][j] =
        cost +
        Math.min(
          costMatrix[i - 1][j],
          costMatrix[i][j - 1],
          costMatrix[i - 1][j - 1]
        );
    }
  }

  const path: [number, number][] = [];
  let i = n;
  let j = m;

  while (i > 0 && j > 0) {
    path.unshift([i - 1, j - 1]);
    const minPrev = Math.min(
      costMatrix[i - 1][j],
      costMatrix[i][j - 1],
      costMatrix[i - 1][j - 1]
    );
    if (minPrev === costMatrix[i - 1][j - 1]) {
      i--;
      j--;
    } else if (minPrev === costMatrix[i - 1][j]) {
      i--;
    } else {
      j--;
    }
  }

  const maxPossibleDistance = Math.max(n, m) * 12;
  const normalizedDistance = Math.min(1, costMatrix[n][m] / maxPossibleDistance);

  return {
    distance: costMatrix[n][m],
    normalizedDistance,
    path,
    costMatrix: costMatrix.slice(1).map((row) => row.slice(1)),
  };
}

export function editDistance(
  a: number[],
  b: number[],
  tolerance: number = 0.1
): EditDistanceResult {
  const operations: string[] = [];
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (Math.abs(a[i - 1] - b[j - 1]) <= tolerance) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(a[i - 1] - b[j - 1]) <= tolerance) {
      operations.unshift(`保持: ${a[i - 1].toFixed(2)}`);
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      operations.unshift(`替换: ${a[i - 1].toFixed(2)} → ${b[j - 1].toFixed(2)}`);
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      operations.unshift(`删除: ${a[i - 1].toFixed(2)}`);
      i--;
    } else if (j > 0) {
      operations.unshift(`插入: ${b[j - 1].toFixed(2)}`);
      j--;
    }
  }

  const normalizedDistance = dp[m][n] / Math.max(m, n);

  return {
    distance: dp[m][n],
    normalizedDistance,
    operations,
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function normalizeScore(raw: number, invert: boolean = false): number {
  const normalized = Math.max(0, Math.min(1, raw));
  return invert ? 1 - normalized : normalized;
}
