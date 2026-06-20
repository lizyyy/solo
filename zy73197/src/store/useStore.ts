import { create } from "zustand";
import type {
  AttributionResult,
  ExceptionRecord,
  GroupId,
  HistoryEntry,
  ParamSet,
  Snapshot,
} from "@/engine/types";
import { runAttribution, evaluateParam } from "@/engine/attribution";
import { computeDiffs } from "@/engine/diff";
import { cloneSet, defaultParamSets } from "@/engine/samples";
import { buildCsv } from "@/engine/csv";

const LS_HISTORY = "attribution_history";
const LS_EXCEPTIONS = "attribution_exceptions";

function evaluateSet(set: ParamSet): ParamSet {
  const next = cloneSet(set);
  next.params = next.params.map((p) => {
    const { status, note } = evaluateParam(p);
    return { ...p, status, note };
  });
  return next;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function collectExceptions(setA: ParamSet, setB: ParamSet, result: AttributionResult): ExceptionRecord[] {
  const out: ExceptionRecord[] = [];
  (["A", "B"] as const).forEach((g) => {
    const set = g === "A" ? setA : setB;
    set.params.forEach((p) => {
      if (p.status === "unit_missing" || p.status === "blocked") {
        out.push({
          id: uid(),
          ts: result.ts,
          group: g,
          paramKey: p.key,
          paramName: p.canonicalName,
          reason: p.note ?? p.status,
          source: `${set.source}（字段：${p.rawFieldName}）`,
          resultStatus: result.status,
        });
      }
    });
  });
  return out;
}

const initial = defaultParamSets();
const initialEvalA = evaluateSet(initial.A);
const initialEvalB = evaluateSet(initial.B);
const initialResult = runAttribution(initialEvalA, initialEvalB);

export interface StoreState {
  setA: ParamSet;
  setB: ParamSet;
  result: AttributionResult;
  dirty: boolean;
  reportOpen: boolean;
  history: HistoryEntry[];
  exceptions: ExceptionRecord[];
  draftId: string | null;

  setParamValue: (group: GroupId, key: string, value: string) => void;
  setParamUnit: (group: GroupId, key: string, unit: string) => void;
  setRawFieldName: (group: GroupId, key: string, raw: string) => void;
  setSource: (group: GroupId, source: string) => void;
  loadSample: (setA: ParamSet, setB: ParamSet) => void;
  run: () => void;
  confirmLatest: (note: string) => void;
  toggleReport: (open?: boolean) => void;
  clearHistory: () => void;
  clearExceptions: () => void;
  exportMarkdown: () => string;
  exportCsv: () => string;
}

export const useStore = create<StoreState>((set, get) => ({
  setA: initialEvalA,
  setB: initialEvalB,
  result: initialResult,
  dirty: false,
  reportOpen: false,
  history: load<HistoryEntry[]>(LS_HISTORY, []),
  exceptions: load<ExceptionRecord[]>(LS_EXCEPTIONS, []),
  draftId: null,

  setParamValue: (group, key, value) =>
    set((s) => {
      const target = group === "A" ? "setA" : "setB";
      const next: ParamSet = {
        ...s[target],
        params: s[target].params.map((p) =>
          p.key === key ? { ...p, value, status: "ok", note: undefined } : p,
        ),
      };
      return { [target]: next, dirty: true } as Partial<StoreState>;
    }),

  setParamUnit: (group, key, unit) =>
    set((s) => {
      const target = group === "A" ? "setA" : "setB";
      const next: ParamSet = {
        ...s[target],
        params: s[target].params.map((p) =>
          p.key === key ? { ...p, unit, status: "ok", note: undefined } : p,
        ),
      };
      return { [target]: next, dirty: true } as Partial<StoreState>;
    }),

  setRawFieldName: (group, key, raw) =>
    set((s) => {
      const target = group === "A" ? "setA" : "setB";
      const next: ParamSet = {
        ...s[target],
        params: s[target].params.map((p) => (p.key === key ? { ...p, rawFieldName: raw } : p)),
      };
      return { [target]: next, dirty: true } as Partial<StoreState>;
    }),

  setSource: (group, source) =>
    set((s) => {
      const target = group === "A" ? "setA" : "setB";
      return { [target]: { ...s[target], source }, dirty: true } as Partial<StoreState>;
    }),

  loadSample: (setA, setB) =>
    set(() => {
      const a = evaluateSet(setA);
      const b = evaluateSet(setB);
      const result = runAttribution(a, b);
      return { setA: a, setB: b, result, dirty: false, reportOpen: false };
    }),

  run: () =>
    set((s) => {
      const a = evaluateSet(s.setA);
      const b = evaluateSet(s.setB);
      const result = runAttribution(a, b);
      const entry: HistoryEntry = {
        id: uid(),
        ts: result.ts,
        setA: cloneSet(a),
        setB: cloneSet(b),
        result,
        confirmed: false,
        diffs: [],
      };
      const history = [entry, ...s.history].slice(0, 100);
      const newEx = collectExceptions(a, b, result);
      const exceptions = [...newEx, ...s.exceptions].slice(0, 200);
      save(LS_HISTORY, history);
      save(LS_EXCEPTIONS, exceptions);
      return { setA: a, setB: b, result, dirty: false, history, exceptions, draftId: entry.id };
    }),

  confirmLatest: (note) =>
    set((s) => {
      if (!s.draftId) return {} as Partial<StoreState>;
      const idx = s.history.findIndex((h) => h.id === s.draftId);
      if (idx < 0) return {} as Partial<StoreState>;
      const entry = s.history[idx];
      const pre: Snapshot = {
        setA: entry.setA,
        setB: entry.setB,
        result: entry.result,
      };
      const a = evaluateSet(s.setA);
      const b = evaluateSet(s.setB);
      const postResult = runAttribution(a, b);
      const post: Snapshot = { setA: cloneSet(a), setB: cloneSet(b), result: postResult };
      const diffs = computeDiffs(pre, post);
      const updated: HistoryEntry = {
        ...entry,
        setA: cloneSet(a),
        setB: cloneSet(b),
        result: postResult,
        confirmed: true,
        confirmedAt: Date.now(),
        preConfirmSnapshot: pre,
        diffs,
        grayscaleNote: note.trim() ? note.trim() : undefined,
      };
      const history = [...s.history];
      history[idx] = updated;
      const newEx = collectExceptions(a, b, postResult);
      const exceptions = newEx.length ? [...newEx, ...s.exceptions].slice(0, 200) : s.exceptions;
      save(LS_HISTORY, history);
      save(LS_EXCEPTIONS, exceptions);
      return { setA: a, setB: b, result: postResult, dirty: false, history, exceptions, draftId: null };
    }),

  toggleReport: (open) => set((s) => ({ reportOpen: open ?? !s.reportOpen })),

  clearHistory: () => {
    save(LS_HISTORY, []);
    set({ history: [], draftId: null });
  },

  clearExceptions: () => {
    save(LS_EXCEPTIONS, []);
    set({ exceptions: [] });
  },

  exportMarkdown: () => get().result.markdown,

  exportCsv: () => {
    const { setA, setB, result } = get();
    return buildCsv(setA, setB, result);
  },
}));
