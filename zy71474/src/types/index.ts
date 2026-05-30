export interface Ball {
  id: string;
  mass: number;
  velocity: number;
  positionX: number;
  positionY: number;
  radius: number;
  color: string;
}

export interface TrajectoryFrame {
  timestamp: number;
  balls: { id: string; x: number; y: number; vx: number; vy: number }[];
}

export interface CollisionResult {
  momentumBefore: number;
  momentumAfter: number;
  energyBefore: number;
  energyAfter: number;
  momentumConserved: boolean;
  energyConserved: boolean;
  momentumDeviation: number;
  energyDeviation: number;
  trajectoryFrames: TrajectoryFrame[];
}

export interface AuditEntry {
  id: string;
  experimentId: string;
  type: "zero_mass" | "energy_increase" | "sequence_overwrite" | "import" | "reupload" | "parameter_change";
  severity: "info" | "warning" | "critical";
  message: string;
  snapshot: Record<string, unknown>;
  timestamp: number;
}

export interface Experiment {
  id: string;
  name: string;
  collisionType: "elastic" | "inelastic" | "perfectly_inelastic";
  groupId: string;
  balls: Ball[];
  result: CollisionResult | null;
  auditLog: AuditEntry[];
  createdAt: number;
  updatedAt: number;
  version: number;
  importBatchId?: string;
  previousVersionId?: string;
}

export interface SampleGroup {
  id: string;
  massRange: string;
  velocityRange: string;
  collisionType: string;
  experimentIds: string[];
}

export interface ImportBatch {
  id: string;
  timestamp: number;
  items: ImportItem[];
}

export interface ImportItem {
  experimentId: string;
  status: "new" | "updated" | "duplicate";
  changedFields?: string[];
  previousVersionId?: string;
}

export type CollisionType = "elastic" | "inelastic" | "perfectly_inelastic";
export type SimulationStatus = "idle" | "running" | "paused" | "finished";
