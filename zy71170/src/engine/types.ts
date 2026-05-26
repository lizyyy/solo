export type SlotType = "lamp" | "roof" | "green";

export interface Building {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  population: number;
}

export interface Slot {
  id: string;
  x: number;
  y: number;
  type: SlotType;
}

export interface Broadcast {
  id: string;
  slotId: string;
  x: number;
  y: number;
  radius: number;
}

export interface NoisyZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  threshold: number;
  label: string;
}

export interface Level {
  id: string;
  name: string;
  description: string;
  budget: number;
  unitCost: number;
  radiusCostPerPx: number;
  maxComplaints: number;
  minCoverage: number;
  buildings: Building[];
  slots: Slot[];
  noisyZones: NoisyZone[];
  width: number;
  height: number;
  background?: "park" | "dense" | "hybrid";
}

export type Phase = "menu" | "playing" | "paused" | "finished";

export interface Failure {
  type: "coverage" | "complaints" | "budget";
  reason: string;
}

export interface CoverageReport {
  totalPopulation: number;
  coveredPopulation: number;
  coverageRatio: number;
  uncoveredBuildings: string[];
}

export interface ComplaintReport {
  count: number;
  perZone: { zoneId: string; noise: number; overThreshold: boolean }[];
}

export interface ScoreReport {
  score: number;
  stars: number;
  coverageScore: number;
  complaintPenalty: number;
  budgetPenalty: number;
  success: boolean;
  failure?: Failure;
}

export interface ActionRecord {
  id: string;
  at: number;
  kind: "place" | "remove" | "adjust";
  payload: any;
}

export interface GameRun {
  runId: string;
  levelId: string;
  startedAt: number;
  finishedAt: number;
  actions: ActionRecord[];
  finalBroadcasts: Broadcast[];
  score: ScoreReport;
  coverage: CoverageReport;
  complaints: ComplaintReport;
}

export interface GameState {
  levelId: string | null;
  phase: Phase;
  broadcasts: Broadcast[];
  selectedSlotId: string | null;
  hoveredSlotId: string | null;
  previewRadius: number;
  actions: ActionRecord[];
  result: {
    score: ScoreReport | null;
    coverage: CoverageReport | null;
    complaints: ComplaintReport | null;
  } | null;
}
