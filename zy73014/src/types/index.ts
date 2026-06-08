export type PetType = 'dog' | 'cat' | 'other';

export interface FosterRegistration {
  id: string;
  petName: string;
  ownerName: string;
  ownerPhone: string;
  petType: PetType;
  breed: string;
  weightRaw: string;
  checkInDate: string;
  checkOutDate: string;
  notes: string;
  createdAt: string;
}

export type AbnormalType =
  | 'weight_mismatch'
  | 'phone_mismatch'
  | 'date_mismatch'
  | 'breed_mismatch'
  | 'weight_unit_mixed'
  | 'supplement_mismatch';

export type FollowUpStatus =
  | 'normal'
  | 'abnormal'
  | 'pending'
  | 'released'
  | 'need_material';

export interface FollowUpRecord {
  id: string;
  fosterId: string;
  status: FollowUpStatus;
  abnormalTypes: AbnormalType[];
  oldSnapshot: Partial<FosterRegistration>;
  newSnapshot: Partial<FosterRegistration>;
  diffFields: string[];
  weightUnitMixed: boolean;
  calcRuleVersion: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export type Operator = '复核人' | '算法值班人' | '前台';
export type AuditAction =
  | 'create'
  | 'update_status'
  | 'confirm_pending'
  | 'reverse'
  | 'add_note';

export interface AuditLog {
  id: string;
  recordId: string;
  operator: Operator;
  operatorName: string;
  action: AuditAction;
  oldSnapshot?: Partial<FollowUpRecord>;
  newSnapshot?: Partial<FollowUpRecord>;
  remark?: string;
  reason?: string;
  timestamp: string;
}

export const ABNORMAL_LABEL: Record<AbnormalType, string> = {
  weight_mismatch: '体重不符',
  phone_mismatch: '联系电话不符',
  date_mismatch: '寄养日期不符',
  breed_mismatch: '品种不一致',
  weight_unit_mixed: '体重单位混写',
  supplement_mismatch: '补录信息对不上',
};

export const STATUS_LABEL: Record<FollowUpStatus, string> = {
  normal: '正常',
  abnormal: '异常',
  pending: '挂起待确认',
  released: '已放行',
  need_material: '待补材料',
};

export const STATUS_COLOR: Record<FollowUpStatus, string> = {
  normal: 'bg-brand-teal/10 text-brand-teal border-brand-teal/30',
  abnormal: 'bg-status-hold/10 text-status-hold border-status-hold/30',
  pending: 'bg-status-hold/15 text-status-hold border-status-hold/40',
  released: 'bg-status-release/12 text-status-release border-status-release/35',
  need_material: 'bg-status-wait/15 text-status-wait border-status-wait/45',
};

export const FIELD_LABEL: Record<keyof FosterRegistration, string> = {
  id: '登记单号',
  petName: '宠物名',
  ownerName: '主人姓名',
  ownerPhone: '联系电话',
  petType: '宠物类型',
  breed: '品种',
  weightRaw: '体重（现场）',
  checkInDate: '入住日期',
  checkOutDate: '预计出院',
  notes: '前台备注',
  createdAt: '登记时间',
};
