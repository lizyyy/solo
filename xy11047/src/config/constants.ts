import { DepositDeductionStatus, StateTransition } from '../types';

export const STATE_TRANSITIONS: StateTransition[] = [
  {
    from: DepositDeductionStatus.DRAFT,
    to: DepositDeductionStatus.SUBMITTED,
    action: 'SUBMIT',
    allowedRoles: ['FRONT_DESK', 'MANAGER'],
    description: '提交押金扣项申请'
  },
  {
    from: DepositDeductionStatus.DRAFT,
    to: DepositDeductionStatus.CANCELLED,
    action: 'CANCEL',
    allowedRoles: ['FRONT_DESK', 'MANAGER'],
    description: '取消草稿'
  },
  {
    from: DepositDeductionStatus.SUBMITTED,
    to: DepositDeductionStatus.REVIEWING,
    action: 'START_REVIEW',
    allowedRoles: ['SUPERVISOR', 'MANAGER'],
    description: '开始审核'
  },
  {
    from: DepositDeductionStatus.SUBMITTED,
    to: DepositDeductionStatus.CANCELLED,
    action: 'CANCEL',
    allowedRoles: ['FRONT_DESK', 'MANAGER'],
    description: '撤回申请'
  },
  {
    from: DepositDeductionStatus.REVIEWING,
    to: DepositDeductionStatus.APPROVED,
    action: 'APPROVE',
    allowedRoles: ['SUPERVISOR', 'MANAGER'],
    description: '审核通过'
  },
  {
    from: DepositDeductionStatus.REVIEWING,
    to: DepositDeductionStatus.REJECTED,
    action: 'REJECT',
    allowedRoles: ['SUPERVISOR', 'MANAGER'],
    description: '审核驳回'
  },
  {
    from: DepositDeductionStatus.REJECTED,
    to: DepositDeductionStatus.DRAFT,
    action: 'RESUBMIT',
    allowedRoles: ['FRONT_DESK', 'MANAGER'],
    description: '修改后重新提交'
  },
  {
    from: DepositDeductionStatus.APPROVED,
    to: DepositDeductionStatus.EXECUTED,
    action: 'EXECUTE',
    allowedRoles: ['CASHIER', 'MANAGER'],
    description: '执行扣款'
  },
  {
    from: DepositDeductionStatus.APPROVED,
    to: DepositDeductionStatus.CANCELLED,
    action: 'CANCEL',
    allowedRoles: ['MANAGER'],
    description: '取消已审批申请'
  }
];

export const DEDUCTION_ITEM_CODES = {
  ROOM_DAMAGE: 'DAMAGE_001',
  FURNITURE_DAMAGE: 'DAMAGE_002',
  KEY_LOST: 'DAMAGE_003',
  DEEP_CLEANING: 'CLEAN_001',
  SMOKING_FINE: 'FINE_001',
  MINI_BAR: 'OTHER_001',
  EXTEND_DEPOSIT: 'EXTEND_001'
};

export const DEDUCTION_ITEM_NAMES: Record<string, string> = {
  [DEDUCTION_ITEM_CODES.ROOM_DAMAGE]: '房间墙面/地面损坏',
  [DEDUCTION_ITEM_CODES.FURNITURE_DAMAGE]: '家具设施损坏',
  [DEDUCTION_ITEM_CODES.KEY_LOST]: '房卡/钥匙遗失',
  [DEDUCTION_ITEM_CODES.DEEP_CLEANING]: '深度清洁费',
  [DEDUCTION_ITEM_CODES.SMOKING_FINE]: '室内吸烟罚款',
  [DEDUCTION_ITEM_CODES.MINI_BAR]: '迷你吧消费',
  [DEDUCTION_ITEM_CODES.EXTEND_DEPOSIT]: '续住押金补扣'
};

export const SUBMIT_SOURCES = {
  FRONT_DESK_PC: 'FRONT_DESK_PC',
  MOBILE_APP: 'MOBILE_APP',
  WECHAT_MINIAPP: 'WECHAT_MINIAPP',
  BACKOFFICE: 'BACKOFFICE'
};

export const ROLES = {
  FRONT_DESK: 'FRONT_DESK',
  SUPERVISOR: 'SUPERVISOR',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER'
};