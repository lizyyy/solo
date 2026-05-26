import { create } from "zustand";
import type {
  CoilConfig,
  CraneConfig,
  EventType,
  GameSession,
  GameStatus,
  LevelConfig,
  Snapshot,
  Vec3,
  ZoneConfig,
} from "@/types/game";
import { computeScore, createSession } from "@/utils/replay";
import { getLevel } from "@/levels";

interface BestScore {
  score: number;
  status: GameStatus;
}

interface GameStore {
  currentLevelId: string | null;
  currentLevel: LevelConfig | null;
  session: GameSession | null;
  currentCoilId: string | null;
  targetZoneId: string | null;
  cranePositions: Record<string, { x: number; z: number; y: number }>;
  coilPositions: Record<string, {
    x: number;
    y: number;
    z: number;
    tilt: number;
    tiltAxis: { x: number; y: number };
    delivered: boolean;
  }>;
  selectedCoilId: string | null;
  selectedZoneId: string | null;
  phase: "idle" | "selecting" | "planning" | "lifting" | "moving" | "lowering" | "done" | "failed";
  status: GameStatus;
  failureReason?: string;
  failureType?: EventType;
  timeRemaining: number;
  bestScores: Record<string, BestScore>;
  replayIndex: number;
  replayPlaying: boolean;

  setLevel: (id: string) => void;
  startSession: () => void;
  resetSession: () => void;
  selectCoil: (coilId: string | null) => void;
  selectZone: (zoneId: string | null) => void;
  setCranePosition: (id: string, pos: { x: number; z: number; y: number }) => void;
  setCoilPosition: (
    id: string,
    pos: {
      x: number;
      y: number;
      z: number;
      tilt: number;
      tiltAxis: { x: number; y: number };
      delivered?: boolean;
    },
  ) => void;
  setPhase: (p: GameStore["phase"]) => void;
  setStatus: (s: GameStatus) => void;
  failSession: (type: EventType, reason: string) => void;
  succeedSession: () => void;
  tickTime: (dt: number) => void;
  pushEvent: (e: Omit<import("@/types/game").GameEvent, "id">) => void;
  pushSnapshot: (s: Omit<Snapshot, "frame" | "time">) => void;
  finalizeScore: () => void;
  loadBestScores: () => void;
  setReplayIndex: (i: number) => void;
  setReplayPlaying: (p: boolean) => void;
  ensureLevel: (id: string) => void;
}

const LS_KEY = "coil_game_best";

function loadBest(): Record<string, BestScore> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveBest(bs: Record<string, BestScore>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(bs));
  } catch {
    // ignore
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentLevelId: null,
  currentLevel: null,
  session: null,
  currentCoilId: null,
  targetZoneId: null,
  cranePositions: {},
  coilPositions: {},
  selectedCoilId: null,
  selectedZoneId: null,
  phase: "idle",
  status: "idle",
  timeRemaining: 0,
  bestScores: {},
  replayIndex: 0,
  replayPlaying: false,

  loadBestScores: () => set({ bestScores: loadBest() }),

  setLevel: (id) => {
    const level = getLevel(id);
    if (!level) return;
    set({
      currentLevelId: id,
      currentLevel: level,
      session: null,
      status: "idle",
      phase: "idle",
      timeRemaining: level.timeLimit,
    });
  },

  ensureLevel: (id) => {
    const s = get();
    if (s.currentLevelId === id && s.currentLevel) {
      return;
    }
    const level = getLevel(id);
    if (!level) return;
    set({
      currentLevelId: id,
      currentLevel: level,
      timeRemaining: level.timeLimit,
    });
  },

  startSession: () => {
    const level = get().currentLevel;
    if (!level) return;
    const session = createSession(level.id);
    const cranePositions: Record<string, { x: number; z: number; y: number }> = {};
    for (const c of level.cranes) {
      cranePositions[c.id] = {
        x: c.axis === "x" ? c.start : c.fixed,
        z: c.axis === "z" ? c.start : c.fixed,
        y: c.y,
      };
    }
    const coilPositions: GameStore["coilPositions"] = {};
    for (const coil of level.coils) {
      coilPositions[coil.id] = {
        x: coil.position.x,
        y: coil.position.y,
        z: coil.position.z,
        tilt: 0,
        tiltAxis: { x: 1, y: 0 },
        delivered: false,
      };
    }
    set({
      session,
      cranePositions,
      coilPositions,
      selectedCoilId: null,
      selectedZoneId: null,
      currentCoilId: null,
      targetZoneId: null,
      phase: "selecting",
      status: "planning",
      failureReason: undefined,
      failureType: undefined,
      timeRemaining: level.timeLimit,
      replayIndex: 0,
      replayPlaying: false,
    });
  },

  resetSession: () => {
    get().startSession();
  },

  selectCoil: (coilId) => {
    set({ selectedCoilId: coilId, phase: coilId ? "planning" : "selecting" });
  },

  selectZone: (zoneId) => {
    set({ selectedZoneId: zoneId });
  },

  setCranePosition: (id, pos) => {
    set((s) => ({ cranePositions: { ...s.cranePositions, [id]: pos } }));
  },

  setCoilPosition: (id, pos) => {
    set((s) => ({
      coilPositions: { ...s.coilPositions, [id]: { ...s.coilPositions[id], ...pos } },
    }));
  },

  setPhase: (p) => set({ phase: p }),
  setStatus: (s) => set({ status: s }),

  failSession: (type, reason) => {
    const s = get();
    if (!s.session || !s.currentLevel) return;
    const session = { ...s.session };
    session.status = "failed";
    session.failureReason = reason;
    session.failureType = type;
    session.score = computeScore(session, s.currentLevel);
    const best = { ...s.bestScores };
    const prev = best[session.levelId];
    if (!prev || prev.score < session.score) {
      best[session.levelId] = { score: session.score, status: "failed" };
      saveBest(best);
    }
    set({
      session,
      status: "failed",
      phase: "failed",
      failureReason: reason,
      failureType: type,
      bestScores: best,
    });
  },

  succeedSession: () => {
    const s = get();
    if (!s.session || !s.currentLevel) return;
    const session = { ...s.session };
    session.status = "success";
    session.score = computeScore(session, s.currentLevel);
    const best = { ...s.bestScores };
    const prev = best[session.levelId];
    if (!prev || prev.score < session.score) {
      best[session.levelId] = { score: session.score, status: "success" };
      saveBest(best);
    }
    set({
      session,
      status: "success",
      phase: "done",
      bestScores: best,
    });
  },

  tickTime: (dt) => {
    set((s) => ({ timeRemaining: Math.max(0, s.timeRemaining - dt) }));
  },

  pushEvent: (e) => {
    const s = get();
    if (!s.session) return;
    const session = { ...s.session };
    session.events = [
      ...session.events,
      {
        ...e,
        id: `e-${session.events.length}-${Math.random().toString(36).slice(2, 7)}`,
      },
    ];
    set({ session });
  },

  pushSnapshot: (snap) => {
    const s = get();
    if (!s.session) return;
    const session = { ...s.session };
    session.snapshots = [
      ...session.snapshots,
      { ...snap, frame: session.snapshots.length, time: performance.now() },
    ];
    session.totalFrames = session.snapshots.length;
    set({ session });
  },

  finalizeScore: () => {
    const s = get();
    if (!s.session || !s.currentLevel) return;
    const session = { ...s.session };
    session.score = computeScore(session, s.currentLevel);
    set({ session });
  },

  setReplayIndex: (i) => set({ replayIndex: i }),
  setReplayPlaying: (p) => set({ replayPlaying: p }),
}));

export type { CoilConfig, CraneConfig, ZoneConfig, Vec3 };
