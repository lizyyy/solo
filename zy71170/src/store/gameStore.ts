import { create } from "zustand";
import type {
  Broadcast,
  GameState,
  ActionRecord,
  Phase,
  GameRun,
} from "../engine/types";
import { getLevel } from "../engine/levels";
import {
  computeCoverage,
  computeComplaints,
  computeScore,
  totalCost,
} from "../engine/engine";
import {
  generateRunId,
  saveRun,
  loadRuns,
  deleteRun,
  getRun,
} from "../engine/storage";

interface GameStore extends GameState {
  runs: GameRun[];
  loadRunsList: () => void;
  startLevel: (levelId: string) => void;
  setPhase: (phase: Phase) => void;
  placeBroadcast: (slotId: string) => void;
  removeBroadcast: (broadcastId: string) => void;
  adjustRadius: (broadcastId: string, radius: number) => void;
  selectSlot: (slotId: string | null) => void;
  setHoveredSlot: (slotId: string | null) => void;
  setPreviewRadius: (r: number) => void;
  reset: () => void;
  finish: () => void;
  clearResult: () => void;
  playRun: (runId: string, index: number) => void;
  deleteRunItem: (runId: string) => void;
}

function now(): number {
  return Date.now();
}

export const useGameStore = create<GameStore>((set, get) => ({
  levelId: null,
  phase: "menu",
  broadcasts: [],
  selectedSlotId: null,
  hoveredSlotId: null,
  previewRadius: 140,
  actions: [],
  result: null,
  runs: [],

  loadRunsList: () => set({ runs: loadRuns() }),

  startLevel: (levelId) => {
    const lvl = getLevel(levelId);
    if (!lvl) return;
    set({
      levelId,
      phase: "playing",
      broadcasts: [],
      selectedSlotId: null,
      hoveredSlotId: null,
      previewRadius: 140,
      actions: [
        {
          id: "start",
          at: now(),
          kind: "place",
          payload: { levelId },
        },
      ],
      result: null,
    });
  },

  setPhase: (phase) => set({ phase }),

  placeBroadcast: (slotId) => {
    const { levelId, broadcasts, actions, previewRadius } = get();
    const lvl = levelId ? getLevel(levelId) : undefined;
    if (!lvl) return;
    const slot = lvl.slots.find((s) => s.id === slotId);
    if (!slot) return;
    if (broadcasts.some((b) => b.slotId === slotId)) return;
    const bc: Broadcast = {
      id: "bc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      slotId,
      x: slot.x,
      y: slot.y,
      radius: previewRadius,
    };
    const next = [...broadcasts, bc];
    const record: ActionRecord = {
      id: bc.id,
      at: now(),
      kind: "place",
      payload: { broadcast: bc },
    };
    set({
      broadcasts: next,
      actions: [...actions, record],
      selectedSlotId: null,
    });
  },

  removeBroadcast: (broadcastId) => {
    const { broadcasts, actions } = get();
    const bc = broadcasts.find((b) => b.id === broadcastId);
    if (!bc) return;
    const record: ActionRecord = {
      id: "rm_" + Date.now().toString(36),
      at: now(),
      kind: "remove",
      payload: { broadcastId },
    };
    set({
      broadcasts: broadcasts.filter((b) => b.id !== broadcastId),
      actions: [...actions, record],
    });
  },

  adjustRadius: (broadcastId, radius) => {
    const { broadcasts, actions } = get();
    const next = broadcasts.map((b) =>
      b.id === broadcastId ? { ...b, radius } : b
    );
    const record: ActionRecord = {
      id: "adj_" + Date.now().toString(36),
      at: now(),
      kind: "adjust",
      payload: { broadcastId, radius },
    };
    set({ broadcasts: next, actions: [...actions, record] });
  },

  selectSlot: (slotId) => set({ selectedSlotId: slotId }),
  setHoveredSlot: (slotId) => set({ hoveredSlotId: slotId }),
  setPreviewRadius: (r) => set({ previewRadius: Math.max(60, Math.min(300, r)) }),

  reset: () => {
    const { levelId } = get();
    if (!levelId) return;
    set({
      phase: "playing",
      broadcasts: [],
      selectedSlotId: null,
      hoveredSlotId: null,
      previewRadius: 140,
      actions: [],
      result: null,
    });
  },

  finish: () => {
    const { levelId, broadcasts, actions } = get();
    const lvl = levelId ? getLevel(levelId) : undefined;
    if (!lvl) return;
    const coverage = computeCoverage(lvl, broadcasts);
    const complaints = computeComplaints(lvl, broadcasts);
    const score = computeScore(lvl, broadcasts);
    const runId = generateRunId();
    const run: GameRun = {
      runId,
      levelId,
      startedAt: actions[0]?.at ?? Date.now(),
      finishedAt: Date.now(),
      actions,
      finalBroadcasts: broadcasts,
      score,
      coverage,
      complaints,
    };
    saveRun(run);
    set({
      phase: "finished",
      result: { score, coverage, complaints },
      runs: loadRuns(),
    });
  },

  clearResult: () => set({ result: null }),

  playRun: (runId, index) => {
    const run = getRun(runId);
    if (!run) return;
    const lvl = getLevel(run.levelId);
    if (!lvl) return;
    const actions = run.actions.slice(0, Math.max(1, index + 1));
    const broadcasts: Broadcast[] = [];
    for (const a of actions) {
      if (a.kind === "place") {
        const bc = a.payload?.broadcast;
        if (bc) broadcasts.push(bc);
      } else if (a.kind === "remove") {
        const idx = broadcasts.findIndex((b) => b.id === a.payload?.broadcastId);
        if (idx >= 0) broadcasts.splice(idx, 1);
      } else if (a.kind === "adjust") {
        const idx = broadcasts.findIndex((b) => b.id === a.payload?.broadcastId);
        if (idx >= 0) broadcasts[idx] = { ...broadcasts[idx], radius: a.payload.radius };
      }
    }
    set({
      levelId: run.levelId,
      phase: "playing",
      broadcasts,
      selectedSlotId: null,
      hoveredSlotId: null,
      previewRadius: 140,
      actions,
      result: null,
    });
  },

  deleteRunItem: (runId) => {
    deleteRun(runId);
    set({ runs: loadRuns() });
  },
}));

export function computeLive(levelId: string | null, broadcasts: Broadcast[]) {
  if (!levelId) return null;
  const lvl = getLevel(levelId);
  if (!lvl) return null;
  return {
    level: lvl,
    coverage: computeCoverage(lvl, broadcasts),
    complaints: computeComplaints(lvl, broadcasts),
    score: computeScore(lvl, broadcasts),
    cost: totalCost(lvl, broadcasts),
  };
}
