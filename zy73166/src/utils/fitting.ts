import type { DataPoint, FittingResult, Material, JumpCause, FilterCriteria } from '../types';

export function polynomialFit(points: { x: number; y: number }[], degree: number): {
  coefficients: number[];
  rSquared: number;
  fitted: { x: number; y: number }[];
} {
  const n = points.length;
  if (n <= degree) {
    degree = n - 1;
  }
  const m = degree + 1;

  const X: number[][] = [];
  const Y: number[] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < m; j++) {
      row.push(Math.pow(points[i].x, j));
    }
    X.push(row);
    Y.push(points[i].y);
  }

  const XtX: number[][] = [];
  const XtY: number[] = [];
  for (let i = 0; i < m; i++) {
    XtX.push(new Array(m).fill(0));
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * Y[k];
    }
    XtY.push(sum);
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) {
        s += X[k][i] * X[k][j];
      }
      XtX[i][j] = s;
    }
  }

  const coefficients = solveLinearSystem(XtX, XtY);

  let yMean = 0;
  for (let i = 0; i < n; i++) yMean += Y[i];
  yMean /= n;

  let ssTot = 0;
  let ssRes = 0;
  const fitted: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const yPred = evaluatePolynomial(coefficients, points[i].x);
    fitted.push({ x: points[i].x, y: yPred });
    ssTot += Math.pow(Y[i] - yMean, 2);
    ssRes += Math.pow(Y[i] - yPred, 2);
  }
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { coefficients, rSquared, fitted };
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) {
        maxRow = row;
      }
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let j = col; j <= n; j++) M[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  return M.map(row => row[n]);
}

export function evaluatePolynomial(coefficients: number[], x: number): number {
  let y = 0;
  for (let i = 0; i < coefficients.length; i++) {
    y += coefficients[i] * Math.pow(x, i);
  }
  return y;
}

export function fitMaterial(material: Material, filter: FilterCriteria): FittingResult {
  const points = material.dataPoints
    .filter(dp => !filter.excludeOutliers || !dp.note?.includes('离群'))
    .map(dp => ({ x: dp.x, y: dp.y }));

  const { coefficients, rSquared } = polynomialFit(points, filter.fittingDegree);

  const boundaryPoints = material.dataPoints.filter(dp => dp.isBoundary);
  const boundarySampleCount = boundaryPoints.length;
  const boundaryWarning = boundarySampleCount < filter.boundarySampleMinCount;

  const sortedX = [...material.dataPoints].sort((a, b) => a.x - b.x);
  const minX = sortedX[0]?.x ?? 0;
  const maxX = sortedX[sortedX.length - 1]?.x ?? 0;
  const predictedAtBoundary = [
    { x: minX, y: evaluatePolynomial(coefficients, minX) },
    { x: maxX, y: evaluatePolynomial(coefficients, maxX) },
  ];

  let unstableSort: FittingResult['unstableSort'] = undefined;
  if (material.sortNote?.includes('排序不稳定') || material.sortNote?.includes('⚠️')) {
    const sortedNames = sortedX.map(dp => dp.label);
    const originalNames = material.dataPoints.map(dp => dp.label);
    const orderChanged = sortedNames.join(',') !== originalNames.join(',');
    unstableSort = {
      unstable: orderChanged || boundaryWarning,
      originalDraftText: material.draftOriginalText || '无草稿记录',
      suggestedOrder: sortedNames,
    };
  }

  return {
    materialId: material.id,
    coefficients,
    rSquared,
    boundaryPoints,
    boundaryWarning,
    boundarySampleCount,
    predictedAtBoundary,
    unstableSort,
  };
}

export function analyzeJumpCauses(
  current: Record<string, FittingResult>,
  previous: Record<string, FittingResult> | undefined,
  materials: Material[],
  currentFilter: FilterCriteria,
  previousFilter?: FilterCriteria,
): JumpCause[] {
  const causes: JumpCause[] = [];

  if (previousFilter && (
    currentFilter.boundaryThreshold !== previousFilter.boundaryThreshold ||
    currentFilter.boundarySampleMinCount !== previousFilter.boundarySampleMinCount ||
    currentFilter.fittingDegree !== previousFilter.fittingDegree ||
    currentFilter.excludeOutliers !== previousFilter.excludeOutliers
  )) {
    causes.push({
      type: 'threshold',
      description: '筛选阈值或拟合参数变更',
      detail: `拟合度: ${previousFilter.fittingDegree} → ${currentFilter.fittingDegree}；边界最小样本数: ${previousFilter.boundarySampleMinCount} → ${currentFilter.boundarySampleMinCount}；阈值: ${previousFilter.boundaryThreshold} → ${currentFilter.boundaryThreshold}；排除离群: ${previousFilter.excludeOutliers ? '是' : '否'} → ${currentFilter.excludeOutliers ? '是' : '否'}`,
    });
  }

  const unitChanges: string[] = [];
  const nameChanges: string[] = [];
  for (const m of materials) {
    if (m.sortNote?.includes('单位') || m.sortNote?.includes('⚠️单位')) {
      unitChanges.push(m.currentName);
    }
    if (m.nameHistory.length > 2) {
      const recent = m.nameHistory[m.nameHistory.length - 1];
      if (recent.reason?.includes('临时改名') || recent.operator.includes('交接')) {
        nameChanges.push(`${m.nameHistory[0].name} → ${m.currentName}`);
      }
    }
  }
  if (unitChanges.length > 0) {
    causes.push({
      type: 'unit',
      description: '单位存在历史变更或存疑',
      detail: `涉及材料: ${unitChanges.join('、')}。建议确认单位统一后再比较结果。`,
      affectedMaterials: unitChanges,
    });
  }
  if (nameChanges.length > 0) {
    causes.push({
      type: 'name_mismatch',
      description: '材料名称前后写法不一致',
      detail: `名称变更链路: ${nameChanges.join('；')}。请在"材料名称历史"中逐条核对。`,
      affectedMaterials: materials.filter(m => m.nameHistory.length > 2).map(m => m.currentName),
    });
  }

  if (previous) {
    for (const [matId, cur] of Object.entries(current)) {
      const prev = previous[matId];
      if (prev && Math.abs(cur.rSquared - prev.rSquared) > 0.001) {
        causes.push({
          type: 'threshold',
          description: `材料 ${matId} 拟合优度跳变`,
          detail: `R² 从 ${prev.rSquared.toFixed(6)} 变为 ${cur.rSquared.toFixed(6)}，变化量 ${(cur.rSquared - prev.rSquared).toFixed(6)}`,
          beforeValue: prev.rSquared,
          afterValue: cur.rSquared,
          affectedMaterials: [matId],
        });
      }
    }
  }

  return causes;
}

export function generateCurvePoints(coefficients: number[], xMin: number, xMax: number, nPoints = 100): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const step = (xMax - xMin) / (nPoints - 1);
  for (let i = 0; i < nPoints; i++) {
    const x = xMin + step * i;
    pts.push({ x, y: evaluatePolynomial(coefficients, x) });
  }
  return pts;
}

export function formatEquation(coefficients: number[]): string {
  const terms: string[] = [];
  for (let i = coefficients.length - 1; i >= 0; i--) {
    const c = coefficients[i];
    if (Math.abs(c) < 1e-8) continue;
    const sign = c >= 0 && terms.length > 0 ? '+' : '';
    const cStr = Math.abs(c - 1) < 1e-8 && i > 0 ? '' : (Math.abs(c + 1) < 1e-8 && i > 0 ? '-' : c.toFixed(4));
    const xStr = i === 0 ? '' : i === 1 ? 'x' : `x^${i}`;
    terms.push(`${sign}${cStr}${xStr}`);
  }
  return terms.length ? terms.join(' ') : '0';
}

export function computeDataHash(snapshot: {
  materialCount: number;
  totalPoints: number;
  rSquaredValues: Record<string, number>;
  boundaryWarnings: string[];
}): string {
  const str = JSON.stringify(snapshot);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}
