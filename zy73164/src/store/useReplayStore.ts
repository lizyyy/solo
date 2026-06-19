import { create } from 'zustand';
import type {
  AnomalyItem,
  HistoricalAnswer,
  ManualOverride,
  ReplayRequest,
  ReplayResult,
  RunRecord,
  RunStatus,
  SupplementaryNote,
} from '@/types';
import { fingerprint } from '@/lib/fingerprint';
import { buildReplay, computeBaseStatus, finalStatus } from '@/lib/replay';
import { clearAllStorage, load, save } from '@/lib/storage';
import { createSeedState } from '@/lib/seed';
import { computeAnomalies } from '@/lib/anomalies';
import type { ValidationResult } from '@/lib/validator';
import { downloadCSV } from '@/lib/csv';
import { csvRowsForResult } from '@/lib/replay';

function initStore() {
  try {
    if (localStorage.getItem('mfpr.runs')) {
      return {
        materials: load<HistoricalAnswer[]>('materials', []),
        runs: load<RunRecord[]>('runs', []),
        results: load<Record<string, ReplayResult>>('results', {}),
        overrides: load<Record<string, ManualOverride>>('overrides', {}),
        notes: load<Record<string, SupplementaryNote>>('notes', {}),
        idempotency: load<Record<string, string>>('idempotency', {}),
      };
    }
  } catch {
    /* fall through to seed */
  }
  const seed = createSeedState();
  save('materials', seed.materials);
  save('runs', seed.runs);
  save('results', seed.results);
  save('overrides', seed.overrides);
  save('notes', seed.notes);
  save('idempotency', seed.idempotency);
  return seed;
}

export function baseStatusFromResult(r: ReplayResult): RunStatus {
  if (r.verified) return 'pass';
  if (r.emptySetFlag === 'EMPTY_ANOMALY') return 'pending_review';
  if (r.boundaries.some((b) => b.severity === 'div_zero')) return 'pending_review';
  return 'fail';
}

interface ReplayState {
  materials: HistoricalAnswer[];
  runs: RunRecord[];
  results: Record<string, ReplayResult>;
  overrides: Record<string, ManualOverride>;
  notes: Record<string, SupplementaryNote>;
  idempotency: Record<string, string>;
  lastRunId: string | null;
  lastHit: boolean | null;

  submitReplay: (req: ReplayRequest) => { runId: string; hit: boolean };
  forceRerun: (req: ReplayRequest) => string;
  setOverride: (runId: string, reason: string, by: string) => void;
  removeOverride: (runId: string) => void;
  setSupplementaryNote: (runId: string, note: string) => void;
  setRunNote: (runId: string, note: string) => void;
  exportCsv: (runId: string) => void;
  resetToSeed: () => void;
  selectAnomalies: () => AnomalyItem[];
}

const initial = initStore();

function persistAll(s: ReplayState) {
  save('materials', s.materials);
  save('runs', s.runs);
  save('results', s.results);
  save('overrides', s.overrides);
  save('notes', s.notes);
  save('idempotency', s.idempotency);
}

export const useReplayStore = create<ReplayState>((set, get) => ({
  ...initial,
  lastRunId: initial.runs[0]?.runId ?? null,
  lastHit: null,

  submitReplay: (req) => {
    const fp = fingerprint(req);
    const state = get();
    const hitRunId = state.idempotency[fp];
    if (hitRunId && state.results[hitRunId]) {
      set({ lastRunId: hitRunId, lastHit: true });
      return { runId: hitRunId, hit: true };
    }
    const historical = state.materials.find((m) => m.matrixId === req.matrixId);
    const built = buildReplay(req, historical);
    const overrides = { ...state.overrides };
    const overridden = !!overrides[built.run.runId];
    built.run.status = finalStatus(
      computeBaseStatus(built.validation, built.result.boundaries),
      overridden,
    );
    const next = {
      runs: [built.run, ...state.runs],
      results: { ...state.results, [built.run.runId]: built.result },
      idempotency: { ...state.idempotency, [fp]: built.run.runId },
      lastRunId: built.run.runId,
      lastHit: false,
    };
    set(next);
    persistAll(get());
    return { runId: built.run.runId, hit: false };
  },

  forceRerun: (req) => {
    const fp = fingerprint(req);
    const state = get();
    const historical = state.materials.find((m) => m.matrixId === req.matrixId);
    const canonicalId = state.idempotency[fp];
    const carriedNote = canonicalId
      ? state.runs.find((r) => r.runId === canonicalId)?.note ?? ''
      : '';
    const built = buildReplay(req, historical, {
      rerunOf: canonicalId,
      note: carriedNote,
    });
    const overridden = !!state.overrides[built.run.runId];
    built.run.status = finalStatus(
      computeBaseStatus(built.validation, built.result.boundaries),
      overridden,
    );
    const next = {
      runs: [built.run, ...state.runs],
      results: { ...state.results, [built.run.runId]: built.result },
      lastRunId: built.run.runId,
      lastHit: false,
    };
    set(next);
    persistAll(get());
    return built.run.runId;
  },

  setOverride: (runId, reason, by) => {
    const state = get();
    const overrides = {
      ...state.overrides,
      [runId]: { runId, reason, overriddenAt: Date.now(), by },
    };
    const runs = state.runs.map((r) =>
      r.runId === runId ? { ...r, status: 'override' as RunStatus } : r,
    );
    set({ overrides, runs });
    persistAll(get());
  },

  removeOverride: (runId) => {
    const state = get();
    const overrides = { ...state.overrides };
    delete overrides[runId];
    const runs = state.runs.map((r) => {
      if (r.runId !== runId) return r;
      const result = state.results[runId];
      const base = result ? baseStatusFromResult(result) : r.status;
      return { ...r, status: base };
    });
    set({ overrides, runs });
    persistAll(get());
  },

  setSupplementaryNote: (runId, note) => {
    const state = get();
    const notes = {
      ...state.notes,
      [runId]: { runId, note, updatedAt: Date.now() },
    };
    set({ notes });
    persistAll(get());
  },

  setRunNote: (runId, note) => {
    const state = get();
    const runs = state.runs.map((r) => (r.runId === runId ? { ...r, note } : r));
    set({ runs });
    persistAll(get());
  },

  exportCsv: (runId) => {
    const state = get();
    const run = state.runs.find((r) => r.runId === runId);
    const result = state.results[runId];
    if (!run || !result) return;
    const historical = state.materials.find((m) => m.matrixId === run.matrixId);
    const rows = csvRowsForResult(
      result,
      run,
      historical,
      state.overrides[runId],
      state.notes[runId],
    );
    downloadCSV(`${runId}.csv`, rows);
  },

  resetToSeed: () => {
    clearAllStorage();
    const seed = createSeedState();
    set({
      ...seed,
      lastRunId: seed.runs[0]?.runId ?? null,
      lastHit: null,
    });
    persistAll(get());
  },

  selectAnomalies: () => computeAnomalies({ runs: get().runs, results: get().results }),
}));

export type { ValidationResult };
