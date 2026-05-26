import type { GameRun } from "./types";

const KEY = "broadcast-game-runs";

export function loadRuns(): GameRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GameRun[];
  } catch {
    return [];
  }
}

export function saveRun(run: GameRun): void {
  const list = loadRuns();
  list.unshift(run);
  const trimmed = list.slice(0, 30);
  localStorage.setItem(KEY, JSON.stringify(trimmed));
}

export function deleteRun(runId: string): void {
  const list = loadRuns().filter((r) => r.runId !== runId);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function getRun(runId: string): GameRun | undefined {
  return loadRuns().find((r) => r.runId === runId);
}

export function generateRunId(): string {
  return "run_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}
