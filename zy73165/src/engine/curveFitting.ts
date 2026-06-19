import type {
  DraftRow,
  FittingOutput,
  FittingCoefficients,
  FittingIntermediate,
  FittingQuality,
  FittingResultRow,
  FormulaType,
  BoundaryTableEntry,
} from "@/types";

export const FORMULA_LABELS: Record<FormulaType, { short: string; katex: string }> = {
  linear: { short: "y = a·x + b", katex: "y = ax + b" },
  quadratic: { short: "y = a·x² + b·x + c", katex: "y = ax^2 + bx + c" },
  exponential: { short: "y = a·e^{b·x}", katex: "y = a e^{bx}" },
};

function usableRows(rows: DraftRow[]) {
  return rows.filter((r) => r.status !== "withdrawn" && r.status !== "unit_missing");
}

function fitLinear(xs: number[], ys: number[]): { coef: FittingCoefficients; inter: FittingIntermediate } {
  const n = xs.length;
  const sumX = xs.reduce((s, v) => s + v, 0);
  const sumY = ys.reduce((s, v) => s + v, 0);
  const sumXY = xs.reduce((s, v, i) => s + v * ys[i], 0);
  const sumX2 = xs.reduce((s, v) => s + v * v, 0);
  const det = n * sumX2 - sumX * sumX;
  const a = det !== 0 ? (n * sumXY - sumX * sumY) / det : 0;
  const b = det !== 0 ? (sumY * sumX2 - sumX * sumXY) / det : sumY / n;
  return {
    coef: { a, b, formula: "linear" },
    inter: { n, sumX, sumY, sumXY, sumX2, determinant: det },
  };
}

function fitQuadratic(xs: number[], ys: number[]): { coef: FittingCoefficients; inter: FittingIntermediate } {
  const n = xs.length;
  const sumX = xs.reduce((s, v) => s + v, 0);
  const sumY = ys.reduce((s, v) => s + v, 0);
  const sumX2 = xs.reduce((s, v) => s + v * v, 0);
  const sumX3 = xs.reduce((s, v) => s + v * v * v, 0);
  const sumX4 = xs.reduce((s, v) => s + v * v * v * v, 0);
  const sumXY = xs.reduce((s, v, i) => s + v * ys[i], 0);
  const sumX2Y = xs.reduce((s, v, i) => s + v * v * ys[i], 0);

  const A = [
    [sumX4, sumX3, sumX2],
    [sumX3, sumX2, sumX],
    [sumX2, sumX, n],
  ];
  const B = [sumX2Y, sumXY, sumY];

  const det =
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);

  let a = 0;
  let b = 0;
  let c = 0;
  if (det !== 0) {
    a =
      (B[0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
        A[0][1] * (B[1] * A[2][2] - A[1][2] * B[2]) +
        A[0][2] * (B[1] * A[2][1] - A[1][1] * B[2])) /
      det;
    b =
      (A[0][0] * (B[1] * A[2][2] - A[1][2] * B[2]) -
        B[0] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
        A[0][2] * (A[1][0] * B[2] - B[1] * A[2][0])) /
      det;
    c =
      (A[0][0] * (A[1][1] * B[2] - B[1] * A[2][1]) -
        A[0][1] * (A[1][0] * B[2] - B[1] * A[2][0]) +
        B[0] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])) /
      det;
  }
  return {
    coef: { a, b, c, formula: "quadratic" },
    inter: { n, sumX, sumY, sumXY, sumX2, sumX3, sumX4, sumX2Y, determinant: det },
  };
}

function fitExponential(xs: number[], ys: number[]): { coef: FittingCoefficients; inter: FittingIntermediate } {
  const lns = ys.map((y) => (y > 0 ? Math.log(y) : NaN));
  const mask = lns.map((v) => !Number.isNaN(v) && Number.isFinite(v));
  const xs2 = xs.filter((_, i) => mask[i]);
  const ls2 = lns.filter((v, i) => mask[i]);
  const n = xs2.length;
  const sumX = xs2.reduce((s, v) => s + v, 0);
  const sumY = ls2.reduce((s, v) => s + v, 0);
  const sumXY = xs2.reduce((s, v, i) => s + v * ls2[i], 0);
  const sumX2 = xs2.reduce((s, v) => s + v * v, 0);
  const det = n * sumX2 - sumX * sumX;
  const b = det !== 0 ? (n * sumXY - sumX * sumY) / det : 0;
  const lnA = det !== 0 ? (sumY * sumX2 - sumX * sumXY) / det : sumY / n;
  const a = Math.exp(lnA);
  return {
    coef: { a, b, formula: "exponential" },
    inter: { n, sumX, sumY, sumXY, sumX2, determinant: det, usedLinearized: true },
  };
}

function predict(x: number, coef: FittingCoefficients): number {
  switch (coef.formula) {
    case "linear":
      return coef.a * x + coef.b;
    case "quadratic":
      return coef.a * x * x + coef.b * x + (coef.c ?? 0);
    case "exponential":
      return coef.a * Math.exp(coef.b * x);
  }
}

function computeQuality(
  ys: number[],
  fitted: number[],
  used: boolean[],
): FittingQuality {
  const indices = used.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const mean = indices.reduce((s, i) => s + ys[i], 0) / indices.length;
  const ssTot = indices.reduce((s, i) => s + (ys[i] - mean) ** 2, 0);
  const ssRes = indices.reduce((s, i) => s + (ys[i] - fitted[i]) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const rmse = Math.sqrt(ssRes / Math.max(1, indices.length));
  const maxDev = Math.max(
    ...indices.map((i) => (ys[i] !== 0 ? Math.abs((fitted[i] - ys[i]) / ys[i]) * 100 : 0)),
    0,
  );
  const meanRes = indices.reduce((s, i) => s + (fitted[i] - ys[i]), 0) / Math.max(1, indices.length);
  return { rSquared, rmse, maxDeviationPct: maxDev, meanResidual: meanRes };
}

export function runFitting(
  rows: DraftRow[],
  formula: FormulaType,
  boundaries: BoundaryTableEntry[] = [],
): FittingOutput {
  const usable = usableRows(rows);
  const xs = usable.map((r) => r.x);
  const ys = usable.map((r) => r.y);

  let fit: { coef: FittingCoefficients; inter: FittingIntermediate };
  switch (formula) {
    case "quadratic":
      fit = fitQuadratic(xs, ys);
      break;
    case "exponential":
      fit = fitExponential(xs, ys);
      break;
    default:
      fit = fitLinear(xs, ys);
  }

  const perRowMap = new Map<string, FittingResultRow>();
  usable.forEach((r) => {
    const fittedY = predict(r.x, fit.coef);
    const residual = fittedY - r.y;
    const deviationPct = r.y !== 0 ? (residual / r.y) * 100 : 0;
    let hitBoundary = r.status === "boundary";
    let boundaryDetail: string | undefined;
    if (boundaries.length) {
      const xB = boundaries.find((b) => b.variable === "x");
      const yB = boundaries.find((b) => b.variable === "y");
      if (xB && (r.x < xB.min || r.x > xB.max)) {
        hitBoundary = true;
        boundaryDetail = `x=${r.x}超出[${xB.min},${xB.max}]`;
      }
      if (yB && (r.y < yB.min || r.y > yB.max)) {
        hitBoundary = true;
        boundaryDetail = boundaryDetail
          ? `${boundaryDetail}; y=${r.y}超出[${yB.min},${yB.max}]`
          : `y=${r.y}超出[${yB.min},${yB.max}]`;
      }
    }
    perRowMap.set(r.id, {
      rowId: r.id,
      fittedY,
      residual,
      deviationPct,
      hitBoundary,
      boundaryDetail,
      usedInFitting: true,
    });
  });

  rows.forEach((r) => {
    if (!perRowMap.has(r.id)) {
      perRowMap.set(r.id, {
        rowId: r.id,
        fittedY: NaN,
        residual: NaN,
        deviationPct: NaN,
        hitBoundary: false,
        usedInFitting: false,
      });
    }
  });

  const perRow = rows.map((r) => perRowMap.get(r.id)!);
  const used = rows.map((r) => perRowMap.get(r.id)!.usedInFitting);
  const ysAll = rows.map((r) => r.y);
  const fittedAll = rows.map((r) => perRowMap.get(r.id)!.fittedY);
  const quality = computeQuality(ysAll, fittedAll, used);

  const scatter = usable.map((r) => ({
    x: r.x,
    y: r.y,
    fitted: predict(r.x, fit.coef),
    label: r.studentId,
  }));

  return {
    coefficients: fit.coef,
    intermediate: fit.inter,
    quality,
    perRow,
    scatter,
  };
}
