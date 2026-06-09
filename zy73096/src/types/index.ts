export type CollisionLevel = "critical" | "warning" | "info";
export type SourceType = "cad_layer" | "disclosure_doc" | "attachment";
export type Conclusion = "pass" | "doubt" | "fail";

export interface SourceRow {
  id: string;
  versionId: string;
  sourceType: SourceType;
  raw_source_name: string;
  raw_fire_zone_a: string;
  raw_fire_zone_b: string;
  raw_position: string;
  raw_level: string;
  raw_note?: string;
  importedAt: number;
  normalized?: {
    zoneA?: string;
    zoneB?: string;
    level?: CollisionLevel;
    positionHash?: string;
  };
}

export interface CollisionPoint {
  id: string;
  positionHash: string;
  zoneA: string;
  zoneB: string;
  level: CollisionLevel;
  position3D: [number, number, number];
  impactZone: string;
  sourceRows: string[];
  firstSeenVersionId: string;
  lastUpdatedVersionId: string;
  duplicateCount: number;
}

export interface FireZone {
  id: string;
  name: string;
  color: string;
  position: [number, number, number];
  size: [number, number, number];
  floor: number;
}

export interface ConclusionSnapshot {
  id: string;
  versionId: string;
  conclusion: Conclusion;
  previousConclusion?: Conclusion;
  operatorName: string;
  reason: string;
  note: string;
  previousMaterialsSnapshot: SourceRow[];
  newMaterialsAdded: SourceRow[];
  createdAt: number;
}

export interface VersionNode {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  sourceRowIds: string[];
  conclusion: Conclusion;
}

export interface Filters {
  zones: string[];
  levels: CollisionLevel[];
  sourceTypes: SourceType[];
  keyword: string;
}

export interface UISelection {
  selectedCollisionId: string | null;
  selectedZoneIds: string[];
  expandedSourceRows: string[];
  rightTab: "collisions" | "history" | "append";
}

export const LEVEL_LABEL: Record<CollisionLevel, string> = {
  critical: "严重",
  warning: "警告",
  info: "提示",
};

export const SOURCE_LABEL: Record<SourceType, string> = {
  cad_layer: "CAD图层",
  disclosure_doc: "交底清单",
  attachment: "补录附件",
};

export const CONCLUSION_LABEL: Record<Conclusion, string> = {
  pass: "通过",
  doubt: "有疑点",
  fail: "不通过",
};
