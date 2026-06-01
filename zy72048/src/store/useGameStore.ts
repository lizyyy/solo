import { create } from "zustand";
import type {
  RunStatus,
  JudgementResult,
  SettlementSummary,
  LevelConfig,
  StudentRecord,
} from "@/types";
import { validateConfig, judgeRecord } from "@/engine/judge";
import { LEVEL_CONFIGS, STUDENT_RECORDS } from "@/data/mockData";

interface GameStore {
  status: RunStatus;
  currentRound: number;
  totalRounds: number;
  results: JudgementResult[];
  configErrors: string[];
  configs: LevelConfig[];
  records: StudentRecord[];
  settlement: SettlementSummary | null;
  runStartTime: number | null;

  startRun: () => void;
  pauseRun: () => void;
  continueRun: () => void;
  restartRun: () => void;
  settleRun: () => void;
  replayRun: () => void;
  processNextRecord: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  const initialConfigs = LEVEL_CONFIGS;
  const initialRecords = STUDENT_RECORDS;
  const configErrors = validateConfig(initialConfigs);

  return {
    status: "idle",
    currentRound: 0,
    totalRounds: initialRecords.length,
    results: [],
    configErrors,
    configs: initialConfigs,
    records: initialRecords,
    settlement: null,
    runStartTime: null,

    startRun: () => {
      const state = get();
      if (state.status !== "idle") return;
      set({
        status: "running",
        currentRound: 0,
        results: [],
        settlement: null,
        runStartTime: Date.now(),
      });
      setTimeout(() => get().processNextRecord(), 600);
    },

    pauseRun: () => {
      const state = get();
      if (state.status !== "running") return;
      set({ status: "paused" });
    },

    continueRun: () => {
      const state = get();
      if (state.status !== "paused") return;
      set({ status: "running" });
      setTimeout(() => get().processNextRecord(), 600);
    },

    restartRun: () => {
      set({
        status: "idle",
        currentRound: 0,
        results: [],
        settlement: null,
        runStartTime: null,
      });
    },

    settleRun: () => {
      const state = get();
      if (state.results.length === 0) return;
      const smoothCount = state.results.filter(
        (r) => r.status === "顺利"
      ).length;
      const confirmCount = state.results.filter(
        (r) => r.status === "待人工确认"
      ).length;
      const oldCaliberCount = state.results.filter(
        (r) => r.status === "旧口径补录"
      ).length;
      const runDurationMs = state.runStartTime
        ? Date.now() - state.runStartTime
        : 0;
      set({
        status: "settled",
        settlement: {
          smoothCount,
          confirmCount,
          oldCaliberCount,
          totalRecords: state.results.length,
          settledAt: new Date().toISOString(),
          runDurationMs,
        },
      });
    },

    replayRun: () => {
      const state = get();
      if (state.status !== "settled") return;
      set({
        status: "running",
        currentRound: 0,
        results: [],
        settlement: null,
        runStartTime: Date.now(),
      });
      setTimeout(() => get().processNextRecord(), 600);
    },

    processNextRecord: () => {
      const state = get();
      if (state.status !== "running") return;
      if (state.currentRound >= state.totalRounds) return;

      const record = state.records[state.currentRound];
      const result = judgeRecord(record, state.configs, state.currentRound + 1);
      const newResults = [...state.results, result];
      const newRound = state.currentRound + 1;

      set({
        currentRound: newRound,
        results: newResults,
      });

      if (newRound < state.totalRounds) {
        setTimeout(() => get().processNextRecord(), 800);
      }
    },
  };
});
