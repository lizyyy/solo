export type Zone = "frozen" | "chilled" | "ambient";

export const ZONE_META: Record<Zone, { label: string; color: string; ring: string; bg: string; text: string }> = {
  frozen: {
    label: "冻品",
    color: "#0ea5e9",
    ring: "ring-sky-400/70",
    bg: "bg-sky-500/90",
    text: "text-sky-100",
  },
  chilled: {
    label: "冷藏",
    color: "#65a30d",
    ring: "ring-lime-400/70",
    bg: "bg-lime-600/90",
    text: "text-lime-50",
  },
  ambient: {
    label: "常温",
    color: "#f97316",
    ring: "ring-orange-400/70",
    bg: "bg-orange-500/90",
    text: "text-orange-50",
  },
};

export interface Cargo {
  id: string;
  name: string;
  zone: Zone;
  weight: number;
  destOrder: number;
  sku: string;
}

export interface PlacedCargo {
  cargoId: string;
  x: number;
  y: number;
  placeOrder: number;
}

export interface Level {
  id: string;
  name: string;
  description: string;
  gridW: number;
  gridH: number;
  timeLimitSec: number;
  zoneLayout: Zone[][];
  cargos: Cargo[];
  maxWeightPerRow?: number;
  doorSide: "right" | "left";
  difficulty: 1 | 2 | 3;
}

export type GameStatus = "idle" | "playing" | "paused" | "won" | "lost" | "replaying";

export interface Violation {
  id: string;
  type: "zone_mismatch" | "adjacent_zone" | "unload_blocked" | "temp_rise" | "over_weight" | "over_time";
  cargoId?: string;
  x?: number;
  y?: number;
  message: string;
  penalty: number;
  at: number;
}

export type ActionType = "place" | "unplace" | "pause" | "resume" | "submit" | "start" | "fail";

export interface ActionFrame {
  t: number;
  type: ActionType;
  payload?: any;
}

export interface ReportJSON {
  levelId: string;
  levelName: string;
  finishedAt: number;
  durationSec: number;
  score: number;
  baseScore: number;
  timeBonus: number;
  penaltyTotal: number;
  result: "won" | "lost";
  reason?: string;
  cargos: { id: string; name: string; zone: Zone; destOrder: number; placed: boolean; x?: number; y?: number }[];
  violations: Violation[];
  frames: ActionFrame[];
}

export interface HistoryRecord {
  id: string;
  levelId: string;
  finishedAt: number;
  score: number;
  result: "won" | "lost";
  reason?: string;
  frames: ActionFrame[];
  report: ReportJSON;
}
