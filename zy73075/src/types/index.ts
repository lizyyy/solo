export type WorkType = '例行检修' | '故障维修' | '专项改造' | '补录记录';
export type WorkStatus = '待处理' | '处理中' | '异常撤回' | '缺材料' | '可放行' | '已完成';
export type HandoverStatus = '待交接' | '可放行' | '缺材料待补' | '异常待核';
export type Unit = '个' | '套' | '米' | '公斤' | '箱' | '卷';
export type MaterialStatus = '正常' | '缺料' | '待核' | '单位异常' | '阈值异常' | '公式异常';
export type RecallTag = '正常' | '公式问题' | '单位问题' | '阈值问题';
export type ExceptionCategory = '公式问题' | '单位问题' | '阈值问题' | '数据缺失';
export type ProcessStatus = '待处理' | '处理中' | '已修正' | '需人工确认';

export interface Workorder {
  id: string;
  device_no: string;
  cutter_model: string;
  work_type: WorkType;
  location: string;
  work_date: string;
  team: string;
  work_status: WorkStatus;
  handover_status: HandoverStatus;
  handover_note: string;
  import_batch: string;
  is_duplicate: boolean;
  created_at: string;
  updated_at: string;
}

export interface SparePart {
  id: string;
  workorder_id: string;
  part_name: string;
  part_code: string;
  spec: string;
  unit: Unit | string;
  req_qty: number;
  act_qty: number;
  price: number;
  is_temp: boolean;
  material_status: MaterialStatus;
  recall_tag: RecallTag;
  remark: string;
}

export interface RecallRecord {
  id: string;
  workorder_id: string;
  recall_time: string;
  category: ExceptionCategory;
  fields_involved: string;
  detail: string;
  original_value: string;
  correct_example: string;
  process_status: ProcessStatus;
  process_remark: string;
  safety_confirmed: boolean;
}

export interface ExceptionCheckResult {
  formula: string | null;
  unit: string | null;
  threshold: string | null;
}

export interface FullDataset {
  workorders: Workorder[];
  spare_parts: SparePart[];
  recall_records: RecallRecord[];
}

export type ImportPreviewItem = {
  workorder: Workorder;
  parts: SparePart[];
  recalls: RecallRecord[];
  is_duplicate: boolean;
  existing_note: string | null;
  exceptions: { partId: string; result: ExceptionCheckResult }[];
};
