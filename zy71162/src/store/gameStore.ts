import { create } from 'zustand';
import type { GameState, Speed, ReplayEntry } from '../engine/types';
import { getLevelById } from '../levels';
import { makeInitialState, tick, dispatchVehicle, skipStop, toggleAltPath, setHeadway } from '../engine/SimulationEngine';
import { computeStats, computeScore, checkFailures } from '../engine/scoring';

const REPLAY_KEY = 'bus-dispatch-replays';

function cloneState(s: GameState): GameState {
  return JSON.parse(
    JSON.stringify(s, (_k, v) => (v instanceof Set ? Array.from(v) : v))
  );
}

function reviveState(s: any): GameState {
  s.vehicles = (s.vehicles || []).map((v: any) => ({
    ...v,
    skippedStops: new Set(v.skippedStops || []),
  }));
  return s as GameState;
}

function loadReplays(): ReplayEntry[] {
  try {
    const raw = localStorage.getItem(REPLAY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveReplays(list: ReplayEntry[]) {
  try {
    localStorage.setItem(REPLAY_KEY, JSON.stringify(list));
  } catch {}
}

interface Store extends GameState {
  replays: ReplayEntry[];
  loadLevel: (id: string) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  setSpeed: (s: Speed) => void;
  advance: (dtSec: number) => void;
  doDispatch: (vehicleId: string, routeId: string) => void;
  doSkipStop: (vehicleId: string, stopId: string) => void;
  doToggleAltPath: (routeId: string, enable: boolean) => void;
  doSetHeadway: (routeId: string, headwayMin: number) => void;
  reset: () => void;
  toMenu: () => void;
  saveReplay: () => void;
  loadReplay: (id: string) => void;
  setHistoryIndex: (i: number) => void;
  deleteReplay: (id: string) => void;
  exportReport: () => { json: string; text: string };
}

export const useGameStore = create<Store>((set, get) => ({
  phase: 'menu',
  levelId: null,
  level: null,
  currentMinute: 0,
  speed: 1,
  routes: [],
  vehicles: [],
  waitingPassengers: {},
  closures: [],
  logs: [],
  stats: { punctuality: 1, intervalCV: 0, complaints: 0, loadFactor: 0, coverage: 0 },
  failures: [],
  score: 0,
  history: [],
  historyIndex: 0,
  actions: [],
  replays: loadReplays(),

  loadLevel: (id) => {
    const level = getLevelById(id);
    if (!level) return;
    const init = makeInitialState(level);
    set({ ...init, replays: get().replays });
  },
  start: () => {
    const s = get();
    if (s.phase === 'ready' || s.phase === 'paused') {
      set({ phase: 'running' });
    }
  },
  pause: () => set({ phase: 'paused' }),
  resume: () => set({ phase: 'running' }),
  setSpeed: (speed) => set({ speed }),
  advance: (dtSec) => {
    const s = get();
    if (s.phase !== 'running' || !s.level) return;
    const dtMin = (dtSec / 1000) * s.speed;
    const next = tick({ ...s }, dtMin);
    const failures = checkFailures(next, s.level);
    const shouldEnd = next.currentMinute >= s.level.durationMin || failures.length > 0;
    if (shouldEnd) {
      const stats = computeStats(next, s.level);
      const score = computeScore(stats, s.level, failures);
      const history = [...s.history, cloneState(next)];
      set({ ...next, stats, score, failures, phase: 'ended', history });
      const { saveReplay } = get();
      saveReplay();
      return;
    }
    const stats = computeStats(next, s.level);
    const history = [...s.history, cloneState({ ...next, stats })];
    set({ ...next, stats, history });
  },
  doDispatch: (vehicleId, routeId) => {
    const s = get();
    const next = dispatchVehicle({ ...s }, vehicleId, routeId);
    set({ ...next });
  },
  doSkipStop: (vehicleId, stopId) => {
    const s = get();
    const next = skipStop({ ...s }, vehicleId, stopId);
    set({ ...next });
  },
  doToggleAltPath: (routeId, enable) => {
    const s = get();
    const next = toggleAltPath({ ...s }, routeId, enable);
    set({ ...next });
  },
  doSetHeadway: (routeId, headwayMin) => {
    const s = get();
    const next = setHeadway({ ...s }, routeId, headwayMin);
    set({ ...next });
  },
  reset: () => {
    const s = get();
    if (!s.levelId) return;
    const level = getLevelById(s.levelId);
    if (!level) return;
    const init = makeInitialState(level);
    set({ ...init, replays: get().replays });
  },
  toMenu: () => set({ phase: 'menu', replays: loadReplays() }),
  saveReplay: () => {
    const s = get();
    if (!s.level || s.phase !== 'ended') return;
    const entry: ReplayEntry = {
      id: `R${Date.now()}`,
      levelId: s.level.id,
      levelName: s.level.name,
      finishedAt: Date.now(),
      score: s.score,
      failures: s.failures,
      stats: s.stats,
      durationMin: s.currentMinute,
      snapshots: s.history,
      actions: s.actions,
    };
    const list = [entry, ...get().replays].slice(0, 30);
    saveReplays(list);
    set({ replays: list });
  },
  loadReplay: (id) => {
    const entry = get().replays.find((r) => r.id === id);
    if (!entry) return;
    const snapshots = entry.snapshots.map(reviveState);
    const last = snapshots[snapshots.length - 1];
    set({
      ...last,
      phase: 'replay',
      history: snapshots,
      historyIndex: snapshots.length - 1,
      replays: get().replays,
      levelId: entry.levelId,
    });
  },
  setHistoryIndex: (i) => {
    const s = get();
    if (!s.history.length) return;
    const idx = Math.max(0, Math.min(s.history.length - 1, i));
    const snap = reviveState(JSON.parse(JSON.stringify(s.history[idx])));
    set({ ...snap, phase: 'replay', history: s.history, historyIndex: idx, replays: s.replays });
  },
  deleteReplay: (id) => {
    const list = get().replays.filter((r) => r.id !== id);
    saveReplays(list);
    set({ replays: list });
  },
  exportReport: () => {
    const s = get();
    const level = s.level;
    if (!level) return { json: '', text: '' };
    const report = {
      levelId: level.id,
      levelName: level.name,
      finishedAt: new Date().toISOString(),
      durationMin: s.currentMinute,
      score: s.score,
      failures: s.failures,
      stats: s.stats,
      logs: s.logs.slice(-50),
      actions: s.actions,
    };
    const json = JSON.stringify(report, null, 2);
    const text = [
      `公交调度报告`,
      `关卡：${level.name}（${level.id}）`,
      `时长：${s.currentMinute.toFixed(1)} 分钟`,
      `总分：${s.score}`,
      `失败原因：${s.failures.length ? s.failures.join('；') : '无'}`,
      ``,
      `分项指标：`,
      `- 准点率：${(s.stats.punctuality * 100).toFixed(1)}%`,
      `- 间隔变异系数 CV：${s.stats.intervalCV.toFixed(2)}`,
      `- 投诉次数：${s.stats.complaints}`,
      `- 平均满载率：${(s.stats.loadFactor * 100).toFixed(1)}%`,
      `- 服务覆盖：${(s.stats.coverage * 100).toFixed(1)}%`,
    ].join('\n');
    return { json, text };
  },
}));
