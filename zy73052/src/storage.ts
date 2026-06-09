import type {
  VersionedState,
  PersistedNote,
  PersistedSummary,
  Snapshot,
  Filters,
  ResultBundle,
} from './types';
import { buildBatchSignature } from './dataService';

const STORAGE_KEY = 'tower-crane-schedule::v1';

function defaultState(): VersionedState {
  return {
    currentSnapshotId: null,
    snapshots: [],
    notes: {},
    summaries: {},
  };
}

export function loadState(): VersionedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as VersionedState;
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

export function saveState(state: VersionedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function snapshotFromBundle(
  bundle: ResultBundle,
  note?: string,
): Snapshot {
  return {
    id: bundle.batchId,
    runAt: bundle.generatedAt,
    filters: bundle.filters,
    recordCount: bundle.stats.total,
    anomalyCount: bundle.stats.anomalyTotal,
    note,
  };
}

export function pushSnapshot(
  state: VersionedState,
  snapshot: Snapshot,
): VersionedState {
  const snapshots = [snapshot, ...state.snapshots.filter((s) => s.id !== snapshot.id)].slice(0, 30);
  return { ...state, snapshots, currentSnapshotId: snapshot.id };
}

export function getNote(state: VersionedState, recordId: string): PersistedNote | undefined {
  return state.notes[recordId];
}

export function upsertNote(
  state: VersionedState,
  recordId: string,
  content: string,
  batchId?: string,
): VersionedState {
  const existing = state.notes[recordId];
  const note: PersistedNote = {
    recordId,
    content,
    updatedAt: new Date().toISOString(),
    batchId: batchId || existing?.batchId,
  };
  return { ...state, notes: { ...state.notes, [recordId]: note } };
}

export function getSummary(
  state: VersionedState,
  filters: Filters,
): PersistedSummary | undefined {
  const sig = buildBatchSignature(filters);
  return state.summaries[sig];
}

export function upsertSummary(
  state: VersionedState,
  filters: Filters,
  content: string,
  runAt: string,
): VersionedState {
  const sig = buildBatchSignature(filters);
  const existing = state.summaries[sig];
  const history = existing
    ? [{ content: existing.content, updatedAt: existing.updatedAt, runAt }, ...existing.history].slice(0, 10)
    : [];
  const summary: PersistedSummary = {
    batchSignature: sig,
    content,
    updatedAt: new Date().toISOString(),
    history,
  };
  return { ...state, summaries: { ...state.summaries, [sig]: summary } };
}

export function clearAll(): VersionedState {
  const s = defaultState();
  saveState(s);
  return s;
}
