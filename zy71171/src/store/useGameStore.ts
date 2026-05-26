import { create } from "zustand";
import type { ActionFrame, Cargo, GameStatus, Level, PlacedCargo, ReportJSON, Violation } from "@/types";
import { getLevel } from "@/data/levels";
import { appendHistory } from "@/utils/storage";
import { uid } from "@/rules/engine";

interface GameData {
  levelId: string | null;
  level: Level | null;
  status: GameStatus;
  timeLeft: number;
  elapsedSec: number;
  doorOpen: boolean;
  placed: PlacedCargo[];
  unplaced: Cargo[];
  selectedCargoId: string | null;
  violations: Violation[];
  frames: ActionFrame[];
  score: number;
  report: ReportJSON | null;
  failReason: string | null;
  startAt: number | null;
  placeOrderSeq: number;
}

interface GameState extends GameData {
  startLevel: (levelId: string) => void;
  resetLevel: () => void;
  pause: () => void;
  resume: () => void;
  tick: (delta: number) => void;
  toggleDoor: (open?: boolean) => void;
  selectCargo: (cargoId: string | null) => void;
  placeCargo: (x: number, y: number) => boolean;
  unplaceCargo: (cargoId: string) => void;
  addViolation: (v: Violation) => void;
  submit: (
    won: boolean,
    reason?: string,
    finalScore?: number,
    violations?: Violation[],
    reportExtra?: Partial<ReportJSON>
  ) => void;
  clear: () => void;
}

function buildReport(
  s: GameData,
  won: boolean,
  reason?: string,
  finalScore?: number,
  violations?: Violation[],
  extra?: Partial<ReportJSON>
): ReportJSON {
  const level = s.level!;
  return {
    levelId: level.id,
    levelName: level.name,
    finishedAt: Date.now(),
    durationSec: s.elapsedSec,
    score: finalScore ?? s.score,
    baseScore: extra?.baseScore ?? 0,
    timeBonus: extra?.timeBonus ?? 0,
    penaltyTotal: extra?.penaltyTotal ?? 0,
    result: won ? "won" : "lost",
    reason,
    cargos: level.cargos.map((c) => {
      const p = s.placed.find((pp) => pp.cargoId === c.id);
      return {
        id: c.id,
        name: c.name,
        zone: c.zone,
        destOrder: c.destOrder,
        placed: !!p,
        x: p?.x,
        y: p?.y,
      };
    }),
    violations: violations ?? s.violations,
    frames: s.frames,
  };
}

const initialData: GameData = {
  levelId: null,
  level: null,
  status: "idle",
  timeLeft: 0,
  elapsedSec: 0,
  doorOpen: true,
  placed: [],
  unplaced: [],
  selectedCargoId: null,
  violations: [],
  frames: [],
  score: 0,
  report: null,
  failReason: null,
  startAt: null,
  placeOrderSeq: 0,
};

export const useGameStore = create<GameState>((set, get) => ({
  ...initialData,

  startLevel: (levelId: string) => {
    const lvl = getLevel(levelId);
    if (!lvl) return;
    set({
      ...initialData,
      levelId,
      level: lvl,
      status: "playing",
      timeLeft: lvl.timeLimitSec,
      elapsedSec: 0,
      doorOpen: true,
      placed: [],
      unplaced: [...lvl.cargos],
      violations: [],
      frames: [{ t: 0, type: "start", payload: { levelId } }],
      startAt: Date.now(),
      placeOrderSeq: 0,
    });
  },

  resetLevel: () => {
    const { levelId } = get();
    if (!levelId) return;
    get().startLevel(levelId);
  },

  pause: () => {
    const s = get();
    if (s.status !== "playing") return;
    set({ status: "paused", frames: [...s.frames, { t: s.elapsedSec, type: "pause" }] });
  },

  resume: () => {
    const s = get();
    if (s.status !== "paused") return;
    set({ status: "playing", frames: [...s.frames, { t: s.elapsedSec, type: "resume" }] });
  },

  tick: (delta) => {
    const s = get();
    if (s.status !== "playing") return;
    const newLeft = Math.max(0, s.timeLeft - delta);
    const newElapsed = s.elapsedSec + delta;
    set({ timeLeft: newLeft, elapsedSec: newElapsed });
  },

  toggleDoor: (open) => {
    const s = get();
    const next = typeof open === "boolean" ? open : !s.doorOpen;
    set({ doorOpen: next });
  },

  selectCargo: (cargoId) => set({ selectedCargoId: cargoId }),

  placeCargo: (x, y) => {
    const s = get();
    if (!s.level || !s.selectedCargoId) return false;
    const cargo = s.unplaced.find((c) => c.id === s.selectedCargoId);
    if (!cargo) return false;
    const occupied = s.placed.some((p) => p.x === x && p.y === y);
    if (occupied) return false;
    const nextPlaceOrder = s.placeOrderSeq + 1;
    const placed: PlacedCargo = { cargoId: cargo.id, x, y, placeOrder: nextPlaceOrder };
    set({
      placed: [...s.placed, placed],
      unplaced: s.unplaced.filter((c) => c.id !== cargo.id),
      selectedCargoId: null,
      placeOrderSeq: nextPlaceOrder,
      frames: [...s.frames, { t: s.elapsedSec, type: "place", payload: { cargoId: cargo.id, x, y } }],
    });
    return true;
  },

  unplaceCargo: (cargoId) => {
    const s = get();
    if (!s.level) return;
    const placed = s.placed.find((p) => p.cargoId === cargoId);
    if (!placed) return;
    const cargo = s.level.cargos.find((c) => c.id === cargoId);
    if (!cargo) return;
    set({
      placed: s.placed.filter((p) => p.cargoId !== cargoId),
      unplaced: [...s.unplaced, cargo],
      frames: [
        ...s.frames,
        { t: s.elapsedSec, type: "unplace", payload: { cargoId, x: placed.x, y: placed.y } },
      ],
    });
  },

  addViolation: (v) => {
    const s = get();
    set({ violations: [...s.violations, v] });
  },

  submit: (won, reason, finalScore, violations, reportExtra) => {
    const s = get();
    if (!s.level) return;
    const frames = [
      ...s.frames,
      { t: s.elapsedSec, type: "submit" as const, payload: { won, reason } },
    ];
    const report = buildReport({ ...s, frames }, won, reason, finalScore, violations, reportExtra);
    set({
      status: won ? "won" : "lost",
      report,
      failReason: reason ?? null,
      score: finalScore ?? s.score,
      frames,
    });
    appendHistory({
      id: uid(),
      levelId: s.level.id,
      finishedAt: report.finishedAt,
      score: report.score,
      result: won ? "won" : "lost",
      reason,
      frames,
      report,
    });
  },

  clear: () => set({ ...initialData }),
}));
