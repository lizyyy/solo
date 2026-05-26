import type {
  GameEvent,
  GameSession,
  LevelConfig,
  Snapshot,
} from "@/types/game";

export function createSession(levelId: string): GameSession {
  return {
    id: `${levelId}-${Date.now()}`,
    levelId,
    startedAt: Date.now(),
    status: "planning",
    score: 0,
    movesUsed: 0,
    events: [],
    snapshots: [],
    totalFrames: 0,
  };
}

export function pushEvent(
  session: GameSession,
  event: Omit<GameEvent, "id">,
): void {
  session.events.push({
    ...event,
    id: `e-${session.events.length}-${Math.random().toString(36).slice(2, 7)}`,
  });
}

export function pushSnapshot(
  session: GameSession,
  snapshot: Omit<Snapshot, "frame" | "time">,
): void {
  session.snapshots.push({
    ...snapshot,
    frame: session.totalFrames,
    time: performance.now(),
  });
  session.totalFrames = session.snapshots.length;
}

export function computeScore(
  session: GameSession,
  level: LevelConfig,
): number {
  let score = 1000;
  const criticals = session.events.filter((e) => e.severity === "critical").length;
  const warnings = session.events.filter((e) => e.severity === "warning").length;
  score -= criticals * 200;
  score -= warnings * 40;
  score -= session.movesUsed * 5;
  return Math.max(0, score);
}
