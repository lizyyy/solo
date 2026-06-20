import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DraftEntry,
  ParamVersion,
  CalculationRun,
  Anomaly,
} from "@/types";
import { runCalculation, buildSummary } from "@/engine/anomalies";

interface AppStateShape {
  drafts: DraftEntry[];
  paramVersions: ParamVersion[];
  activeParamVersionId: string | null;
  runs: CalculationRun[];
  currentAnomalies: Anomaly[];
  globalSummary: string;
  addDrafts: (drafts: DraftEntry[]) => void;
  removeDraft: (id: string) => void;
  clearDrafts: () => void;
  addParamVersion: (p: Omit<ParamVersion, "id" | "createdAt">) => void;
  setActiveParamVersion: (id: string) => void;
  runCalculationNow: () => CalculationRun | null;
  setAnomalyResolved: (anomalyId: string, resolved: boolean, note?: string) => void;
  updateDraftNote: (draftId: string, note: string) => void;
  setEditorNoteForRun: (runId: string, note: string) => void;
  recomputeGlobalSummary: () => void;
}

export const useAppStore = create<AppStateShape>()(
  persist(
    (set, get) => ({
      drafts: [],
      paramVersions: [],
      activeParamVersionId: null,
      runs: [],
      currentAnomalies: [],
      globalSummary: "尚未运行验算。请先导入学生草稿并选择参数版本。",

      addDrafts: (drafts) =>
        set((s) => ({ drafts: [...s.drafts, ...drafts] })),

      removeDraft: (id) =>
        set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id) })),

      clearDrafts: () => set({ drafts: [], currentAnomalies: [] }),

      addParamVersion: (p) => {
        const version: ParamVersion = {
          ...p,
          id: `pv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: Date.now(),
        };
        set((s) => ({
          paramVersions: [
            ...s.paramVersions.map((pv) => ({ ...pv, isActive: false })),
            { ...version, isActive: true },
          ],
          activeParamVersionId: version.id,
        }));
      },

      setActiveParamVersion: (id) =>
        set((s) => ({
          paramVersions: s.paramVersions.map((pv) => ({
            ...pv,
            isActive: pv.id === id,
          })),
          activeParamVersionId: id,
        })),

      runCalculationNow: () => {
        const state = get();
        const pv = state.paramVersions.find(
          (x) => x.id === state.activeParamVersionId
        );
        if (!pv || state.drafts.length === 0) return null;
        const result = runCalculation(state.drafts, pv);
        set({
          runs: [...state.runs, result.run],
          currentAnomalies: result.anomalies,
          globalSummary: result.summary,
        });
        return result.run;
      },

      setAnomalyResolved: (anomalyId, resolved, note) =>
        set((s) => {
          const updater = (a: Anomaly): Anomaly =>
            a.id === anomalyId
              ? { ...a, resolved, resolverNote: note ?? a.resolverNote }
              : a;
          return {
            currentAnomalies: s.currentAnomalies.map(updater),
            runs: s.runs.map((r) => ({
              ...r,
              anomalies: r.anomalies.map(updater),
            })),
          };
        }),

      updateDraftNote: (draftId, note) =>
        set((s) => ({
          drafts: s.drafts.map((d) =>
            d.id === draftId ? { ...d, supplementaryNote: note } : d
          ),
        })),

      setEditorNoteForRun: (runId, note) =>
        set((s) => ({
          runs: s.runs.map((r) =>
            r.id === runId ? { ...r, editorNote: note } : r
          ),
        })),

      recomputeGlobalSummary: () =>
        set((s) => {
          const pv =
            s.paramVersions.find((x) => x.id === s.activeParamVersionId)?.name ||
            "未选择";
          const summary = buildSummary(
            s.currentAnomalies,
            s.drafts.length,
            pv
          );
          return { globalSummary: summary };
        }),
    }),
    {
      name: "epb-workbench",
      partialize: (s) => ({
        drafts: s.drafts,
        paramVersions: s.paramVersions,
        activeParamVersionId: s.activeParamVersionId,
        runs: s.runs,
        currentAnomalies: s.currentAnomalies,
        globalSummary: s.globalSummary,
      }),
    }
  )
);
