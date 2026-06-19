import type { DraftRow, BoundaryTableEntry, RowStatus } from "@/types";

export function detectMissingUnits(rows: DraftRow[]): DraftRow[] {
  return rows.map((r) => {
    if (r.status === "withdrawn") return r;
    const missing = !r.xUnit || !r.yUnit;
    if (missing && r.status !== "unit_missing" && !r.unitConfirmReason) {
      return { ...r, status: "unit_missing" as RowStatus };
    }
    if (!missing && r.status === "unit_missing" && r.unitConfirmReason) {
      return { ...r, status: "normal" as RowStatus };
    }
    return r;
  });
}

function isNearBoundary(
  value: number,
  entry: BoundaryTableEntry,
): { hit: boolean; detail?: string } {
  const tol = entry.tolerancePct / 100;
  const range = entry.max - entry.min;
  const nearMin = value >= entry.min - range * tol && value <= entry.min + range * tol;
  const nearMax = value >= entry.max - range * tol && value <= entry.max + range * tol;
  const outOfRange = value < entry.min || value > entry.max;
  if (outOfRange) {
    return {
      hit: true,
      detail: `超出阈值范围 [${entry.min}, ${entry.max}] (${value.toFixed(4)})`,
    };
  }
  if (nearMin) {
    return {
      hit: true,
      detail: `接近下限 ${entry.min}，位于 ±${entry.tolerancePct}% 容差带内`,
    };
  }
  if (nearMax) {
    return {
      hit: true,
      detail: `接近上限 ${entry.max}，位于 ±${entry.tolerancePct}% 容差带内`,
    };
  }
  return { hit: false };
}

export function detectBoundarySamples(
  rows: DraftRow[],
  boundaries: BoundaryTableEntry[],
): (DraftRow & { __boundaryDetail?: string })[] {
  const xEntry = boundaries.find((b) => b.variable === "x");
  const yEntry = boundaries.find((b) => b.variable === "y");
  return rows.map((r) => {
    if (r.status === "withdrawn") return r;
    let detail: string | undefined;
    let hit = false;
    if (xEntry) {
      const rx = isNearBoundary(r.x, xEntry);
      if (rx.hit) {
        hit = true;
        detail = `x: ${rx.detail}`;
      }
    }
    if (yEntry) {
      const ry = isNearBoundary(r.y, yEntry);
      if (ry.hit) {
        hit = true;
        detail = detail ? `${detail}；y: ${ry.detail}` : `y: ${ry.detail}`;
      }
    }
    if (hit && r.status !== "boundary") {
      return { ...r, status: "boundary" as RowStatus, __boundaryDetail: detail };
    }
    if (!hit && r.status === "boundary") {
      return { ...r, status: "normal" as RowStatus };
    }
    return { ...r, __boundaryDetail: detail };
  });
}

export function applyUnitConfirmation(
  rows: DraftRow[],
  rowId: string,
  confirmed: { x?: string; y?: string },
  reason: string,
  scope: string,
): DraftRow[] {
  return rows.map((r) => {
    if (r.id !== rowId) return r;
    return {
      ...r,
      xUnit: r.xUnit ?? confirmed.x,
      yUnit: r.yUnit ?? confirmed.y,
      confirmedUnit: confirmed,
      unitConfirmReason: reason,
      unitConfirmScope: scope,
      status: "normal",
    };
  });
}

export function countExceptions(rows: DraftRow[]) {
  const withdrawn = rows.filter((r) => r.status === "withdrawn").length;
  const boundary = rows.filter((r) => r.status === "boundary").length;
  const missingUnit = rows.filter((r) => r.status === "unit_missing").length;
  return { withdrawn, boundary, missingUnit, valid: rows.length - withdrawn };
}
