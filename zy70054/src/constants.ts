import { ReplacementStep } from './types';

export const STEP_ORDER: ReplacementStep[] = [
  'APPLICATION',
  'OLD_CARD_FREEZE',
  'LOGISTICS',
  'ACTIVATION'
];

export const STEP_NAMES: { [key in ReplacementStep]: string } = {
  APPLICATION: '换卡申请',
  OLD_CARD_FREEZE: '旧卡冻结',
  LOGISTICS: '新卡寄送',
  ACTIVATION: '新卡激活'
};

export const LOGISTICS_STEP_ORDER: Array<{
  step: 'PICKED_UP' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'SIGNED';
  name: string;
}> = [
  { step: 'PICKED_UP', name: '已揽收' },
  { step: 'IN_TRANSIT', name: '运输中' },
  { step: 'ARRIVED', name: '已到达' },
  { step: 'DELIVERED', name: '派送中' },
  { step: 'SIGNED', name: '已签收' }
];

export const FAILURE_REASON_NAMES: { [key: string]: string } = {
  OLD_CARD_UNFREEZABLE: '旧卡无法冻结',
  ADDRESS_INVALID: '地址无效',
  LOGISTICS_LOST: '物流丢失',
  ACTIVATION_FAILED: '激活失败',
  CUSTOMER_REJECT: '客户拒绝',
  TIMEOUT: '超时',
  SYSTEM_ERROR: '系统错误'
};

export const STEP_DEPENDENCIES: {
  [key in ReplacementStep]: ReplacementStep[];
} = {
  APPLICATION: [],
  OLD_CARD_FREEZE: ['APPLICATION'],
  LOGISTICS: ['OLD_CARD_FREEZE'],
  ACTIVATION: ['LOGISTICS']
};

export const COMPENSATION_METHOD_NAMES: { [key: string]: string } = {
  REFUND: '退款',
  NEW_CARD_REISSUE: '重新制卡寄送',
  MANUAL_HANDLING: '人工处理',
  OTHER: '其他'
};
