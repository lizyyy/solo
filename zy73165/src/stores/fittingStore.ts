import { create } from "zustand";
import type {
  DraftRow,
  ParamVersion,
  FittingOutput,
  FittingSession,
  SummarySnapshot,
  VerdictLevel,
} from "@/types";
import { demoSession, demoParamVersions, demoDraftRows } from "@/mock/demoDataset";
import { runFitting, FORMULA_LABELS } from "@/engine/curveFitting";
import {
  detectMissingUnits,
  detectBoundarySamples,
  applyUnitConfirmation,
  countExceptions,
} from "@/engine/preflight";
import { buildSummaryHash, formatDateTime } from "@/utils/consistency";
import { buildHandoffNotes } from "@/utils/export";

const HIGH_DEVIATION_THRESHOLD = 5;

function computeVerdict(
  rSquared: number,
  missingUnit: number,
  boundary: number,
  highDev: number,
): { level: VerdictLevel; text: string } {
  if (missingUnit > 0) {
    return { level: "fail", text: `待处理·还有 ${missingUnit} 条单位缺失未人工确认` };
  }
  if (rSquared < 0.95 || highDev > 2) {
    return { level: "warn", text: `需复核·拟合质量 R²=${rSquared.toFixed(3)}，${highDev} 条样本偏差超阈值` };
  }
  if (boundary > 0) {
    return { level: "warn", text: `可通过·含 ${boundary} 条边界样本，建议二次核验` };
  }
  if (rSquared >= 0.99) {
    return { level: "pass", text: "通过·拟合质量优秀，可直接用于汇报" };
  }
  return { level: "pass", text: "通过·拟合质量符合要求" };
}

interface FittingState {
  session: FittingSession;
  paramVersions: ParamVersion[];
  currentParamId: string;
  rows: DraftRow[];
  boundaryDetails: Record<string, string>;
  fitting: FittingOutput | null;
  summary: SummarySnapshot | null;
  selectedRowId: string | null;
  unitDialogOpenFor: string | null;
  explainOpen: Record<string, boolean>;

  setCurrentParam: (id: string) => void;
  refreshFitting: () => void;
  rebuildSummary: () => void;
  openUnitDialog: (rowId: string) => void;
  closeUnitDialog: () => void;
  confirmUnit: (rowId: string, confirmed: { x?: string; y?: string }, reason: string, scope: string) => void;
  toggleExplain: (key: string) => void;
  selectRow: (rowId: string | null) => void;
  setVerdictOverride: (text: string) => void;
  addHandoffNote: (note: string) => void;
  removeHandoffNote: (idx: number) => void;
}

function preprocessRows(rows: DraftRow[], param: ParamVersion) {
  const step1 = detectMissingUnits(rows);
  const step2 = detectBoundarySamples(step1, param.boundaryTable);
  const boundaryMap: Record<string, string> = {};
  const cleanRows: DraftRow[] = step2.map((r) => {
    const { __boundaryDetail, ...rest } = r as DraftRow & { __boundaryDetail?: string };
    if (__boundaryDetail) boundaryMap[r.id] = __boundaryDetail;
    return rest as DraftRow;
  });
  return { rows: cleanRows, boundaryDetails: boundaryMap };
}

export const useFittingStore = create<FittingState>((set, get) => {
  const initialParam = demoParamVersions[0];
  const { rows: initRows, boundaryDetails: initBd } = preprocessRows(demoDraftRows, initialParam);
  const initialFitting = runFitting(initRows, initialParam.formula, initialParam.boundaryTable);

  const counts = countExceptions(initRows);
  const highDev = initialFitting.perRow.filter(
    (r) => r.usedInFitting && Math.abs(r.deviationPct) > HIGH_DEVIATION_THRESHOLD,
  ).length;
  const verdict = computeVerdict(initialFitting.quality.rSquared, counts.missingUnit, counts.boundary, highDev);

  const formulaLabel = FORMULA_LABELS[initialParam.formula].short;
  const auditedAt = new Date().toISOString();
  const boundaryNote =
    counts.boundary > 0
      ? `${counts.boundary} 条样本位于阈值边界容差带内，已参与拟合但标记为需重点复核；详情见左侧边界阈值表。`
      : "无样本命中边界容差带。";
  const unitNote =
    counts.missingUnit > 0
      ? `${counts.missingUnit} 条样本单位缺失，等待教练人工确认后进入结果。`
      : "所有样本单位字段完整（m / N）。";
  const exceptionNote =
    counts.withdrawn > 0 || highDev > 0
      ? `撤回 ${counts.withdrawn} 条（不参与拟合），偏差超阈值 ${highDev} 条。`
      : "无。";
  const handoff = buildHandoffNotes(counts.boundary, counts.missingUnit, counts.withdrawn, highDev);

  const summaryBase: Omit<SummarySnapshot, "hash"> = {
    sessionId: demoSession.id,
    coachName: demoSession.coachName,
    auditedAt,
    paramVersionId: initialParam.id,
    paramVersionName: initialParam.name,
    totalRows: initRows.length,
    validRows: counts.valid,
    withdrawnRows: counts.withdrawn,
    boundaryRows: counts.boundary,
    missingUnitRows: counts.missingUnit,
    highDeviationRows: highDev,
    formulaLabel,
    rSquared: initialFitting.quality.rSquared,
    rmse: initialFitting.quality.rmse,
    verdictLevel: verdict.level,
    verdictText: verdict.text,
    boundaryNote,
    unitNote,
    exceptionNote,
    handoffNotes: handoff,
  };

  const initSummary: SummarySnapshot = {
    ...summaryBase,
    hash: buildSummaryHash(summaryBase),
  };

  return {
    session: demoSession,
    paramVersions: demoParamVersions,
    currentParamId: initialParam.id,
    rows: initRows,
    boundaryDetails: initBd,
    fitting: initialFitting,
    summary: initSummary,
    selectedRowId: null,
    unitDialogOpenFor: initRows.find((r) => r.status === "unit_missing")?.id ?? null,
    explainOpen: {},

    setCurrentParam: (id) => {
      const param = get().paramVersions.find((p) => p.id === id);
      if (!param) return;
      const { rows, boundaryDetails } = preprocessRows(get().rows, param);
      const fitting = runFitting(rows, param.formula, param.boundaryTable);
      set({ currentParamId: id, rows, boundaryDetails, fitting });
      get().rebuildSummary();
    },

    refreshFitting: () => {
      const param = get().paramVersions.find((p) => p.id === get().currentParamId)!;
      const { rows, boundaryDetails } = preprocessRows(get().rows, param);
      const fitting = runFitting(rows, param.formula, param.boundaryTable);
      set({ rows, boundaryDetails, fitting });
      get().rebuildSummary();
    },

    rebuildSummary: () => {
      const st = get();
      const param = st.paramVersions.find((p) => p.id === st.currentParamId)!;
      const f = st.fitting!;
      const counts = countExceptions(st.rows);
      const highDev = f.perRow.filter(
        (r) => r.usedInFitting && Math.abs(r.deviationPct) > HIGH_DEVIATION_THRESHOLD,
      ).length;
      const verdict = computeVerdict(f.quality.rSquared, counts.missingUnit, counts.boundary, highDev);
      const auditedAt = new Date().toISOString();
      const base: Omit<SummarySnapshot, "hash"> = {
        sessionId: st.session.id,
        coachName: st.session.coachName,
        auditedAt,
        paramVersionId: param.id,
        paramVersionName: param.name,
        totalRows: st.rows.length,
        validRows: counts.valid,
        withdrawnRows: counts.withdrawn,
        boundaryRows: counts.boundary,
        missingUnitRows: counts.missingUnit,
        highDeviationRows: highDev,
        formulaLabel: FORMULA_LABELS[param.formula].short,
        rSquared: f.quality.rSquared,
        rmse: f.quality.rmse,
        verdictLevel: verdict.level,
        verdictText: verdict.text,
        boundaryNote:
          counts.boundary > 0
            ? `${counts.boundary} 条样本位于阈值边界容差带内，已参与拟合但标记为需重点复核；详情见左侧边界阈值表。`
            : "无样本命中边界容差带。",
        unitNote:
          counts.missingUnit > 0
            ? `${counts.missingUnit} 条样本单位缺失，等待教练人工确认后进入结果。`
            : "所有样本单位字段完整（m / N）。",
        exceptionNote:
          counts.withdrawn > 0 || highDev > 0
            ? `撤回 ${counts.withdrawn} 条（不参与拟合），偏差超阈值 ${highDev} 条。`
            : "无。",
        handoffNotes: buildHandoffNotes(counts.boundary, counts.missingUnit, counts.withdrawn, highDev),
      };
      set({ summary: { ...base, hash: buildSummaryHash(base) } });
    },

    openUnitDialog: (rowId) => set({ unitDialogOpenFor: rowId }),
    closeUnitDialog: () => set({ unitDialogOpenFor: null }),

    confirmUnit: (rowId, confirmed, reason, scope) => {
      const updated = applyUnitConfirmation(get().rows, rowId, confirmed, reason, scope);
      set({ rows: updated, unitDialogOpenFor: null });
      get().refreshFitting();
    },

    toggleExplain: (key) =>
      set((s) => ({ explainOpen: { ...s.explainOpen, [key]: !s.explainOpen[key] } })),

    selectRow: (rowId) => set({ selectedRowId: rowId }),

    setVerdictOverride: (text) => {
      set((s) => {
        if (!s.summary) return {};
        const level: VerdictLevel = text.includes("不通过") || text.includes("待处理")
          ? "fail"
          : text.includes("复核") || text.includes("二次")
            ? "warn"
            : "pass";
        const next: Omit<SummarySnapshot, "hash"> = { ...s.summary, verdictText: text, verdictLevel: level };
        return { summary: { ...next, hash: buildSummaryHash(next) } };
      });
    },

    addHandoffNote: (note) => {
      set((s) => {
        if (!s.summary) return {};
        const next: Omit<SummarySnapshot, "hash"> = {
          ...s.summary,
          handoffNotes: [...s.summary.handoffNotes, note],
        };
        return { summary: { ...next, hash: buildSummaryHash(next) } };
      });
    },

    removeHandoffNote: (idx) => {
      set((s) => {
        if (!s.summary) return {};
        const next: Omit<SummarySnapshot, "hash"> = {
          ...s.summary,
          handoffNotes: s.summary.handoffNotes.filter((_, i) => i !== idx),
        };
        return { summary: { ...next, hash: buildSummaryHash(next) } };
      });
    },
  };
});

export { formatDateTime };
