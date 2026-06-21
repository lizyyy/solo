import { create } from "zustand";
import type {
  DraftEntry,
  ParamVersion,
  CalculationRun,
  Anomaly,
} from "@/types";
import { api, type FullRunResponse } from "@/utils/apiClient";
import { parseDraftText, parsedLineToDraft } from "@/utils/parseDraft";

interface AppStateShape {
  drafts: DraftEntry[];
  paramVersions: ParamVersion[];
  activeParamVersionId: string | null;
  runs: CalculationRun[];
  currentRunId: string | null;
  currentAnomalies: Anomaly[];
  globalSummary: string;
  loading: boolean;
  error: string | null;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  refreshParamVersions: () => Promise<void>;
  createParamVersion: (
    p: Omit<ParamVersion, "id" | "createdAt">
  ) => Promise<void>;
  setActiveParamVersion: (id: string) => Promise<void>;
  parseAndStageDrafts: (text: string) => DraftEntry[];
  addStagedDrafts: (drafts: DraftEntry[]) => void;
  removeStagedDraft: (id: string) => void;
  clearStagedDrafts: () => void;
  updateStagedDraftNote: (draftId: string, note: string) => void;
  submitBatch: (editorNote?: string) => Promise<CalculationRun | null>;
  refreshAll: () => Promise<void>;
  selectRun: (runId: string) => Promise<void>;
  rerun: (runId: string) => Promise<void>;
  setEditorNoteForRun: (runId: string, note: string) => Promise<void>;
  setAnomalyResolved: (
    anomalyId: string,
    resolved: boolean,
    note?: string
  ) => Promise<void>;
  updateDraftNote: (draftId: string, note: string) => Promise<void>;
  exportMarkdown: (runId: string) => Promise<string>;
}

function applyFull(state: AppStateShape, payload: FullRunResponse) {
  const runMap = new Map(state.runs.map((r) => [r.id, r]));
  runMap.set(payload.run.id, payload.run);
  const draftMap = new Map(state.drafts.map((d) => [d.id, d]));
  for (const d of payload.drafts) draftMap.set(d.id, d);
  state.drafts = [...draftMap.values()];
  state.paramVersions = payload.paramVersions;
  state.runs = [...runMap.values()].sort((a, b) => b.startedAt - a.startedAt);
  state.currentRunId = payload.run.id;
  state.currentAnomalies = payload.run.anomalies;
  state.globalSummary = payload.globalSummary;
  state.activeParamVersionId =
    payload.paramVersions.find((p) => p.isActive)?.id ?? null;
}

export const useAppStore = create<AppStateShape>((set, get) => ({
  drafts: [],
  paramVersions: [],
  activeParamVersionId: null,
  runs: [],
  currentRunId: null,
  currentAnomalies: [],
  globalSummary:
    "尚未运行验算。请先导入学生草稿并选择参数版本，然后点击『启动验算』。",
  loading: false,
  error: null,

  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),

  refreshParamVersions: async () => {
    const list = await api.listParamVersions();
    set({
      paramVersions: list,
      activeParamVersionId: list.find((p) => p.isActive)?.id ?? null,
    });
  },

  createParamVersion: async (p) => {
    set({ loading: true });
    try {
      const pv = await api.createParamVersion(p);
      const list = await api.listParamVersions();
      set({
        paramVersions: list,
        activeParamVersionId: pv.isActive ? pv.id : get().activeParamVersionId,
      });
    } finally {
      set({ loading: false });
    }
  },

  setActiveParamVersion: async (id) => {
    await api.activateParamVersion(id);
    set({
      paramVersions: get().paramVersions.map((pv) => ({
        ...pv,
        isActive: pv.id === id,
      })),
      activeParamVersionId: id,
    });
  },

  parseAndStageDrafts: (text) => {
    const parsed = parseDraftText(text);
    return parsed.map((p, i) => parsedLineToDraft(p, Date.now() + i));
  },

  addStagedDrafts: (drafts) =>
    set((s) => ({ drafts: [...s.drafts, ...drafts] })),

  removeStagedDraft: (id) =>
    set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id) })),

  clearStagedDrafts: () => set({ drafts: [], currentAnomalies: [] }),

  updateStagedDraftNote: (draftId, note) =>
    set((s) => ({
      drafts: s.drafts.map((d) =>
        d.id === draftId ? { ...d, supplementaryNote: note } : d
      ),
    })),

  submitBatch: async (editorNote) => {
    const state = get();
    if (state.drafts.length === 0) return null;
    set({ loading: true, error: null });
    try {
      const resp = await api.submitBatch({
        drafts: state.drafts.map((d) => ({
          questionNo: d.questionNo,
          answerContent: d.answerContent,
          answerVersion: d.answerVersion,
          supplementaryNote: d.supplementaryNote,
          rawSource: d.rawSource,
        })),
        paramVersionId: state.activeParamVersionId ?? undefined,
        editorNote,
      });
      applyFull(get(), resp);
      set({ drafts: [] });
      return resp.run;
    } catch (e: any) {
      set({ error: e?.message ?? "提交失败" });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  refreshAll: async () => {
    set({ loading: true });
    try {
      const [pvs, runs] = await Promise.all([
        api.listParamVersions(),
        api.listRuns(),
      ]);
      const latest = runs[0];
      set({
        paramVersions: pvs,
        activeParamVersionId: pvs.find((p) => p.isActive)?.id ?? null,
        runs,
        currentRunId: latest?.id ?? null,
        currentAnomalies: latest?.anomalies ?? [],
        globalSummary: latest?.summary ?? get().globalSummary,
      });
    } finally {
      set({ loading: false });
    }
  },

  selectRun: async (runId) => {
    const resp = await api.getRun(runId);
    applyFull(get(), resp);
  },

  rerun: async (runId) => {
    set({ loading: true, error: null });
    try {
      const resp = await api.rerun(runId);
      applyFull(get(), resp);
    } catch (e: any) {
      set({ error: e?.message ?? "重跑失败" });
    } finally {
      set({ loading: false });
    }
  },

  setEditorNoteForRun: async (runId, note) => {
    await api.setEditorNote(runId, note);
    set((s) => ({
      runs: s.runs.map((r) =>
        r.id === runId ? { ...r, editorNote: note } : r
      ),
    }));
  },

  setAnomalyResolved: async (anomalyId, resolved, note) => {
    const a = await api.resolveAnomaly(anomalyId, resolved, note);
    set((s) => {
      const updater = (x: Anomaly): Anomaly =>
        x.id === anomalyId ? a : x;
      return {
        currentAnomalies: s.currentAnomalies.map(updater),
        runs: s.runs.map((r) => ({
          ...r,
          anomalies: r.anomalies.map(updater),
        })),
      };
    });
  },

  updateDraftNote: async (draftId, note) => {
    const d = await api.updateDraftNote(draftId, note);
    set((s) => ({
      drafts: s.drafts.map((x) => (x.id === draftId ? d : x)),
    }));
  },

  exportMarkdown: async (runId) => {
    const resp = await api.exportRun(runId);
    return resp.markdown;
  },
}));
