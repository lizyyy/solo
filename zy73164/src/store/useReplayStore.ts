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

function normalizeOverride(o: ManualOverride): ManualOverride {
  const next = { ...o } as ManualOverride & { overriddenAt?: number };
  if (next.overriddenAt !== undefined && next.updatedAt === undefined) {
    next.updatedAt = next.overriddenAt;
    delete next.overriddenAt;
  }
  if (!next.originRunId) next.originRunId = next.runId;
  return next;
}

function normalizeNote(n: SupplementaryNote): SupplementaryNote {
  if (!n.originRunId) return { ...n, originRunId: n.runId };
  return n;
}

function initStore() {
  try {
    if (localStorage.getItem('mfpr.runs')) {
      const overridesRaw = load<Record<string, ManualOverride>>('overrides', {});
      const notesRaw = load<Record<string, SupplementaryNote>>('notes', {});
      const overrides: Record<string, ManualOverride> = {};
      for (const [k, v] of Object.entries(overridesRaw)) overrides[k] = normalizeOverride(v);
      const notes: Record<string, SupplementaryNote> = {};
      for (const [k, v] of Object.entries(notesRaw)) notes[k] = normalizeNote(v);
      const migrated =
        JSON.stringify(overrides) !== JSON.stringify(overridesRaw) ||
        JSON.stringify(notes) !== JSON.stringify(notesRaw);
      if (migrated) {
        save('overrides', overrides);
        save('notes', notes);
      }
      return {
        materials: load<HistoricalAnswer[]>('materials', []),
        runs: load<RunRecord[]>('runs', []),
        results: load<Record<string, ReplayResult>>('results', {}),
        overrides,
        notes,
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
  if (
    r.boundaries.some(
      (b) => b.severity === 'zero_boundary' || b.severity === 'div_zero',
    )
  )
    return 'pending_review';
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

/**
 * 从上游 runId 迁“控制台交互”相关的整段状态到新 runId：
 *  - 运行备注（已存在于 carriedNote，这里一并保留）
 *  - 人工改判（同一次改判 origin 不变，不计第二份）
 *  - 后补说明（同一份后补 origin 不变）
 *  - 边界事件已经由 buildReplay 重新生成（ReplayResult.boundaries），
 *    来源行/影响范围均跟着新 run 的分解结果走；同时在 RunRecord 上打
 *    continuityTag 作为整段状态迁移的指纹，方便 CSV 溯源。
 */
function migrateConsoleState(opts: {
  fromRunId: string;
  toRunId: string;
  overrides: Record<string, ManualOverride>;
  notes: Record<string, SupplementaryNote>;
  runs: RunRecord[];
}): {
  overrides: Record<string, ManualOverride>;
  notes: Record<string, SupplementaryNote>;
  runs: RunRecord[];
  migratedOverride: ManualOverride | undefined;
  migratedNote: SupplementaryNote | undefined;
  continuityTag: string;
  carriedNote: string;
} {
  const { fromRunId, toRunId } = opts;
  const overrides = { ...opts.overrides };
  const notes = { ...opts.notes };
  const srcRun = opts.runs.find((r) => r.runId === fromRunId);
  const carriedNote = srcRun?.note ?? '';

  const originRunId =
    (overrides[fromRunId]?.originRunId ??
      notes[fromRunId]?.originRunId ??
      srcRun?.rerunOf ??
      fromRunId);
  const continuityTag = `cont-${originRunId.slice(0, 10)}`;

  const runs = opts.runs.map((r) =>
    r.runId === toRunId ? { ...r, continuityTag, note: carriedNote } : r,
  );

  let migratedOverride: ManualOverride | undefined;
  const srcOverride = overrides[fromRunId];
  if (srcOverride) {
    migratedOverride = {
      runId: toRunId,
      reason: srcOverride.reason,
      by: srcOverride.by,
      updatedAt: srcOverride.updatedAt,
      copiedFromRunId: fromRunId,
      originRunId: srcOverride.originRunId ?? originRunId,
    };
    overrides[toRunId] = migratedOverride;
  }

  let migratedNote: SupplementaryNote | undefined;
  const srcNote = notes[fromRunId];
  if (srcNote) {
    migratedNote = {
      runId: toRunId,
      note: srcNote.note,
      updatedAt: srcNote.updatedAt,
      copiedFromRunId: fromRunId,
      originRunId: srcNote.originRunId ?? originRunId,
    };
    notes[toRunId] = migratedNote;
  }

  return { overrides, notes, runs, migratedOverride, migratedNote, continuityTag, carriedNote };
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
    const canonicalId = state.idempotency[fp] ?? state.lastRunId;
    const built = buildReplay(req, historical, { rerunOf: canonicalId });

    let runs = [built.run, ...state.runs];
    let overrides = { ...state.overrides };
    let notes = { ...state.notes };

    if (canonicalId) {
      const migrated = migrateConsoleState({
        fromRunId: canonicalId,
        toRunId: built.run.runId,
        overrides,
        notes,
        runs,
      });
      overrides = migrated.overrides;
      notes = migrated.notes;
      runs = migrated.runs;

      const overridden = !!overrides[built.run.runId];
      runs = runs.map((r) =>
        r.runId === built.run.runId
          ? {
              ...r,
              status: finalStatus(
                computeBaseStatus(built.validation, built.result.boundaries),
                overridden,
              ),
            }
          : r,
      );
    } else {
      const overridden = !!overrides[built.run.runId];
      runs = runs.map((r) =>
        r.runId === built.run.runId
          ? {
              ...r,
              status: finalStatus(
                computeBaseStatus(built.validation, built.result.boundaries),
                overridden,
              ),
            }
          : r,
      );
    }

    const next = {
      runs,
      results: { ...state.results, [built.run.runId]: built.result },
      overrides,
      notes,
      lastRunId: built.run.runId,
      lastHit: false,
    };
    set(next);
    persistAll(get());
    return built.run.runId;
  },

  setOverride: (runId, reason, by) => {
    const state = get();
    const prev = state.overrides[runId];
    const originRunId = prev?.originRunId ?? runId;
    if (prev && prev.reason === reason && prev.by === by) {
      return;
    }
    const overrides = {
      ...state.overrides,
      [runId]: {
        runId,
        reason,
        by,
        updatedAt: Date.now(),
        originRunId,
        copiedFromRunId: prev?.copiedFromRunId,
      },
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
    const prev = state.notes[runId];
    const notes = {
      ...state.notes,
      [runId]: {
        runId,
        note,
        updatedAt: Date.now(),
        originRunId: prev?.originRunId ?? runId,
        copiedFromRunId: prev?.copiedFromRunId,
      },
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
    const override = state.overrides[runId];
    const note = state.notes[runId];
    const rows = csvRowsForResult(result, run, historical, override, note);
    const safeToken = run.csvToken || runId;
    downloadCSV(`mfpr-${safeToken}.csv`, rows);
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
