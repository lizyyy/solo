export type HandoverStatus = 'draft' | 'processing' | 'pending_confirm' | 'completed' | 'archived';

export type MaterialType = 'wall_image' | 'insurance_policy' | 'installation_list' | 'light_record' | 'attachment' | 'remark';

export type MaterialStatus = 'normal' | 'missing' | 'duplicate' | 'late' | 'corrected';

export type ExceptionType = 'missing_insurance' | 'duplicate_record' | 'late_attachment' | 'incomplete_remark' | 'data_conflict' | 'missing_material';

export type ExceptionSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ExceptionStatus = 'open' | 'resolved' | 'ignored';

export interface Handover {
  id: string;
  title: string;
  status: HandoverStatus;
  description?: string;
  operator: string;
  createdAt: string;
  updatedAt: string;
}

export interface Material {
  id: string;
  handoverId: string;
  type: MaterialType;
  name: string;
  fileName?: string;
  fileSize?: number;
  fileData?: string;
  status: MaterialStatus;
  isDuplicate?: boolean;
  duplicateOf?: string;
  isLate?: boolean;
  correctedFrom?: string;
  relatedIds: string[];
  metadata: Record<string, any>;
  createdAt: string;
}

export interface StatusLog {
  id: string;
  handoverId: string;
  fromStatus?: HandoverStatus;
  toStatus: HandoverStatus;
  operator: string;
  remark?: string;
  createdAt: string;
}

export interface Exception {
  id: string;
  handoverId: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  relatedMaterialId?: string;
  description: string;
  explanation?: string;
  resolution?: string;
  status: ExceptionStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface Confirmation {
  id: string;
  handoverId: string;
  operator: string;
  remark?: string;
  relatedMaterialIds: string[];
  confirmedAt: string;
}

export interface ExportRecord {
  id: string;
  handoverId: string;
  format: 'json' | 'csv' | 'html';
  checksum: string;
  exportedAt: string;
  exportedBy: string;
}

export interface MaterialUploadResult {
  material: Material;
  exceptions: Exception[];
  isDuplicate: boolean;
  duplicateOf?: string;
}

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  wall_image: '展墙图',
  insurance_policy: '保险单',
  installation_list: '布展清单',
  light_record: '灯光记录',
  attachment: '附件',
  remark: '备注',
};

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  normal: '正常',
  missing: '缺失',
  duplicate: '重复',
  late: '晚到',
  corrected: '已更正',
};

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  missing_insurance: '缺少保险单',
  duplicate_record: '重复记录',
  late_attachment: '晚到附件',
  incomplete_remark: '不完整备注',
  data_conflict: '数据冲突',
  missing_material: '材料缺失',
};

export const EXCEPTION_SEVERITY_LABELS: Record<ExceptionSeverity, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

export const HANDOVER_STATUS_LABELS: Record<HandoverStatus, string> = {
  draft: '草稿',
  processing: '处理中',
  pending_confirm: '待确认',
  completed: '已完成',
  archived: '已归档',
};
