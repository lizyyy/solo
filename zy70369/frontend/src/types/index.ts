export type ExceptionType = 'INVENTORY_FAILURE' | 'LOGISTICS_CANCEL' | 'DISCOUNT_EXCEPTION';

export type ExceptionStatus = 'PENDING' | 'RESOLVED';

export type ActionType = 'REFUND' | 'RESEND' | 'CLOSE' | 'CONTINUE_FULFILLMENT' | 'ROLLBACK_FAILED';

export type ActionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface Operator {
  id: string;
  name: string;
  role: string;
  created_at: string;
}

export interface OrderException {
  id: string;
  order_id: string;
  exception_type: ExceptionType;
  status: ExceptionStatus;
  locked_by: string | null;
  locked_at: string | null;
  resolution: string | null;
  resolution_reason: string | null;
  resolved_at: string | null;
  evidence_gap: string | null;
  created_at: string;
  updated_at: string;
  order_no: string;
  user_id: string;
  total_amount: number;
  order_status: string;
  operator_name: string | null;
}

export interface Evidence {
  id: string;
  order_exception_id: string;
  evidence_type: string;
  evidence_data: Record<string, any>;
  is_valid: number;
  created_at: string;
}

export interface ArbitrationAction {
  id: string;
  order_exception_id: string;
  action_type: ActionType;
  action_data: Record<string, any> | null;
  status: ActionStatus;
  executed_by: string;
  executed_by_name: string | null;
  executed_at: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  order_id: string;
  event_type: string;
  event_data: Record<string, any> | null;
  operator: string;
  operator_name: string | null;
  created_at: string;
}

export interface ExceptionDetail {
  exception: OrderException;
  evidences: Evidence[];
  actions: ArbitrationAction[];
  timeline: TimelineEvent[];
  evidence_gaps: string[] | null;
}

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  INVENTORY_FAILURE: '库存扣减失败',
  LOGISTICS_CANCEL: '物流取消',
  DISCOUNT_EXCEPTION: '优惠异常'
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  REFUND: '退款',
  RESEND: '补发',
  CLOSE: '关闭',
  CONTINUE_FULFILLMENT: '继续履约',
  ROLLBACK_FAILED: '回滚失败'
};

export const STATUS_LABELS: Record<ExceptionStatus, string> = {
  PENDING: '待处理',
  RESOLVED: '已完成'
};

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  PENDING: '处理中',
  SUCCESS: '成功',
  FAILED: '失败'
};

export const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  PAYMENT: '支付凭证',
  INVENTORY: '库存记录',
  LOGISTICS: '物流记录',
  DISCOUNT: '优惠记录'
};
