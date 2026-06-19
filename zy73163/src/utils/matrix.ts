import type {
  BoundarySample,
  CalcSpec,
  MatrixCell,
  NoteSourceType,
  PageSummary,
  ScoringNote,
  UnitMissingRecord,
} from "@/types";

export const ANOMALY_THRESHOLD = 1.4;

export function cellKeyOf(userId: string, itemId: string): string {
  return `${userId}:${itemId}`;
}

export function emptySourceCount(): Record<NoteSourceType, number> {
  return { oldVersion: 0, normal: 0, verbal: 0 };
}

// 由持久态实时重算页面摘要（交叉印证基准）
export function computeSummary(args: {
  cells: MatrixCell[];
  notes: ScoringNote[];
  unitMissing: UnitMissingRecord[];
  calcSpecId: string;
}): PageSummary {
  const { cells, notes, unitMissing, calcSpecId } = args;
  const notesBySource = emptySourceCount();
  const conclusionInfluencingBySource = emptySourceCount();
  for (const n of notes) {
    notesBySource[n.sourceType] += 1;
    if (n.influencesConclusion) conclusionInfluencingBySource[n.sourceType] += 1;
  }
  const observedCells = cells.filter((c) => c.actualRating != null).length;
  const anomalyCount = cells.filter((c) => c.anomaly).length;
  const unitMissingCount = unitMissing.length;
  const unitMissingActiveCount = unitMissing.filter((u) => !u.restored).length;

  return {
    totalCells: cells.length,
    observedCells,
    anomalyCount,
    unitMissingCount,
    unitMissingActiveCount,
    notesBySource,
    conclusionInfluencingBySource,
    currentCalcSpecId: calcSpecId,
    lastSavedAt: new Date().toISOString(),
  };
}

// 交叉印证：摘要字段 vs 各页本地计数
export interface VerifyResult {
  ok: boolean;
  mismatches: { field: string; expected: number | string; actual: number | string }[];
}

export function verifySummary(args: {
  summary: PageSummary;
  cells: MatrixCell[];
  notes: ScoringNote[];
  unitMissing: UnitMissingRecord[];
}): VerifyResult {
  const { summary, cells, notes, unitMissing } = args;
  const recomputed = computeSummary({
    cells,
    notes,
    unitMissing,
    calcSpecId: summary.currentCalcSpecId,
  });
  const mismatches: VerifyResult["mismatches"] = [];

  const checks: { field: keyof PageSummary; expected: number | string; actual: number | string }[] = [
    { field: "totalCells", expected: recomputed.totalCells, actual: summary.totalCells },
    { field: "observedCells", expected: recomputed.observedCells, actual: summary.observedCells },
    { field: "anomalyCount", expected: recomputed.anomalyCount, actual: summary.anomalyCount },
    { field: "unitMissingCount", expected: recomputed.unitMissingCount, actual: summary.unitMissingCount },
    {
      field: "unitMissingActiveCount",
      expected: recomputed.unitMissingActiveCount,
      actual: summary.unitMissingActiveCount,
    },
  ];
  for (const c of checks) {
    if (c.expected !== c.actual) mismatches.push(c);
  }
  (["oldVersion", "normal", "verbal"] as NoteSourceType[]).forEach((s) => {
    if (recomputed.notesBySource[s] !== summary.notesBySource[s]) {
      mismatches.push({
        field: `notesBySource.${s}` as keyof PageSummary,
        expected: recomputed.notesBySource[s],
        actual: summary.notesBySource[s],
      });
    }
  });

  return { ok: mismatches.length === 0, mismatches };
}

// 按来源分组的备注计数
export function notesBySource(notes: ScoringNote[]) {
  const map = emptySourceCount();
  for (const n of notes) map[n.sourceType] += 1;
  return map;
}

// 影响结论的备注按来源分组
export function conclusionBySource(notes: ScoringNote[]) {
  const map = emptySourceCount();
  for (const n of notes) if (n.influencesConclusion) map[n.sourceType] += 1;
  return map;
}

// 取某格相关备注
export function notesForCell(notes: ScoringNote[], cellKey: string) {
  return notes.filter((n) => n.cellKey === cellKey);
}

// 取某边界样本相关备注
export function notesForSample(notes: ScoringNote[], sample: BoundarySample) {
  return notes.filter((n) => sample.noteIds.includes(n.id));
}

// 口径查找
export function findCalcSpec(specs: CalcSpec[], id: string): CalcSpec | undefined {
  return specs.find((s) => s.id === id);
}

// 数字来源线索：某格的来源链
export function provenanceTrail(args: {
  cell: MatrixCell;
  notes: ScoringNote[];
  specs: CalcSpec[];
}): { calcSpec?: CalcSpec; notes: ScoringNote[]; sourceType: NoteSourceType } {
  const { cell, notes, specs } = args;
  const key = cellKeyOf(cell.userId, cell.itemId);
  const cellNotes = notes.filter((n) => n.cellKey === key);
  const calcSpec = specs.find((s) => s.id === CURRENT_SPEC_FALLBACK(cellNotes));
  return { calcSpec, notes: cellNotes, sourceType: cell.sourceType };
}

function CURRENT_SPEC_FALLBACK(notes: ScoringNote[]): string {
  return notes[0]?.calcSpecId ?? "spec-v2";
}

export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes(),
    ).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}
