export * from '../../api/shared/types.js';

export type ActiveTab = 'materials' | 'pending' | 'history' | 'reconciliation';

export interface AddMaterialPayload {
  material_name: string;
  specification: string;
  supplier: string;
  batch_no: string;
  quantity: number;
  unit: string;
  created_by?: string;
  collision_points?: Array<Omit<import('../../api/shared/types.js').CollisionPoint, 'collision_id' | 'detected_at' | 'historical_screenshots'>>;
}

/** UI 层调用 replaceScreenshot 的 payload（不含 operator，store 自动注入） */
export interface ReplaceScreenshotPayloadUI {
  image_url: string;
  /** true 表示把旧截图追加到历史，再用新图覆盖当前图 */
  append: boolean;
}

export interface ResolvePendingPayloadUI {
  keep_collision_id?: string;
  resolution: string;
}

export interface ReviseConclusionPayloadUI {
  new_conclusion: import('../../api/shared/types.js').Conclusion;
  revise_reason: string;
  confidence?: number;
  extra_remarks?: string;
}

export interface ExportResult {
  warnings: string[];
  render_source_id: string;
  scene_annotations: string;
  side_notes: string;
  api_response: Record<string, unknown>;
  reconciliation_text: string;
  exported_at: string;
  exported_by: string;
  history_count: number;
  audit_count: number;
}
