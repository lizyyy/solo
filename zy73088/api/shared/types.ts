export type RecordStatus =
  | 'active'
  | 'suspended'
  | 'pending_confirm'
  | 'confirmed'
  | 'archived';

export const RecordStatusEnum = {
  ACTIVE: 'active' as RecordStatus,
  SUSPENDED: 'suspended' as RecordStatus,
  PENDING_CONFIRM: 'pending_confirm' as RecordStatus,
  CONFIRMED: 'confirmed' as RecordStatus,
  ARCHIVED: 'archived' as RecordStatus,
} as const;

export type Conclusion =
  | 'scheme_a'
  | 'scheme_b'
  | 'scheme_c'
  | 'needs_inspection'
  | 'rejected';

export const ConclusionEnum = {
  SCHEME_A: 'scheme_a' as Conclusion,
  SCHEME_B: 'scheme_b' as Conclusion,
  SCHEME_C: 'scheme_c' as Conclusion,
  NEEDS_INSPECTION: 'needs_inspection' as Conclusion,
  REJECTED: 'rejected' as Conclusion,
} as const;

export const ConclusionDisplay: Record<Conclusion, string> = {
  scheme_a: '方案A（粘钢加固）',
  scheme_b: '方案B（碳纤维布加固）',
  scheme_c: '方案C（增大截面）',
  needs_inspection: '需进一步检测',
  rejected: '不通过',
};

export type OperationType =
  | 'create'
  | 'update'
  | 'supplement'
  | 'suspend'
  | 'confirm'
  | 'revise_conclusion'
  | 'export';

export const OperationTypeEnum = {
  CREATE: 'create' as OperationType,
  UPDATE: 'update' as OperationType,
  SUPPLEMENT: 'supplement' as OperationType,
  SUSPEND: 'suspend' as OperationType,
  CONFIRM: 'confirm' as OperationType,
  REVISE_CONCLUSION: 'revise_conclusion' as OperationType,
  EXPORT: 'export' as OperationType,
} as const;

export type Severity = 'low' | 'medium' | 'high';

export const SeverityEnum = {
  LOW: 'low' as Severity,
  MEDIUM: 'medium' as Severity,
  HIGH: 'high' as Severity,
} as const;

export interface ViewPoint {
  camera_position: { x: number; y: number; z: number };
  camera_target: { x: number; y: number; z: number };
  camera_up?: { x: number; y: number; z: number };
  zoom: number;
  fov: number;
}

export interface HistoricalScreenshot {
  path: string;
  captured_at?: string;
  viewpoint_fingerprint?: string;
}

export interface CollisionPoint {
  collision_id: string;
  element_id: string;
  description: string;
  screenshot_path: string;
  viewpoint: ViewPoint;
  severity: Severity;
  detected_at: string;
  supplement_note?: string;
  historical_screenshots: HistoricalScreenshot[];
}

export interface Remark {
  content: string;
  operator: string;
  timestamp: string;
}

export interface MaterialReviewItem {
  item_id: string;
  material_name: string;
  specification: string;
  supplier: string;
  batch_no: string;
  quantity: number;
  unit: string;
  collision_points: CollisionPoint[];
  remarks: Remark[];
  created_at: string;
  created_by: string;
}

export interface HistoryVersion {
  version_id: string;
  version_no: number;
  parent_id?: string;
  snapshot_material?: Record<string, unknown>;
  new_remarks: Remark[];
  old_conclusion?: Conclusion;
  new_conclusion?: Conclusion;
  revise_reason: string;
  operator: string;
  operated_at: string;
  affected_conclusion_ids: string[];
}

export interface AuditLog {
  log_id: string;
  record_id: string;
  operator: string;
  operation_type: OperationType;
  operation_detail: string;
  timestamp: string;
  field_changes: Record<string, Record<string, unknown>>;
}

export interface PendingConfirmItem {
  pending_id: string;
  record_id: string;
  material_item_id: string;
  duplicate_collision_ids: string[];
  impact_analysis: string;
  affected_conclusions: string[];
  suspended_at: string;
  suspended_by: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution?: string;
}

export interface SchemeComparisonRecord {
  record_id: string;
  project_name: string;
  project_code: string;
  structural_element: string;
  status: RecordStatus;
  conclusion?: Conclusion;
  confidence: number;
  materials: MaterialReviewItem[];
  history_chain: HistoryVersion[];
  audit_logs: AuditLog[];
  pending_queue: PendingConfirmItem[];
  scene_annotations: string;
  side_notes: string;
  api_response: Record<string, unknown>;
  render_source_id: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  current_version: number;
}

export function _now(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '');
}

export function _new_id(prefix: string): string {
  const hex =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto as unknown as { randomUUID: () => string })
          .randomUUID()
          .replace(/-/g, '')
          .slice(0, 12)
      : Math.random().toString(16).slice(2, 14) +
        Math.random().toString(16).slice(2, 14).slice(0, 12);
  return `${prefix}-${hex.slice(0, 12)}`;
}

export function viewpointFingerprint(vp: ViewPoint): string {
  const keys = Object.keys(vp.camera_position).sort();
  const pos = keys
    .map((k) => `${k}:${Number(vp.camera_position[k as keyof typeof vp.camera_position]).toFixed(4)}`)
    .join('|');
  const tgt = keys
    .map((k) => `${k}:${Number(vp.camera_target[k as keyof typeof vp.camera_target]).toFixed(4)}`)
    .join('|');
  return `VP:${pos}||VT:${tgt}||Z:${vp.zoom}||F:${vp.fov}`;
}

export function collisionDedupKey(cp: CollisionPoint): string {
  return `${cp.element_id}|${viewpointFingerprint(cp.viewpoint)}|${cp.description.trim()}`;
}

export function defaultCameraUp(): { x: number; y: number; z: number } {
  return { x: 0, y: 0, z: 1 };
}
