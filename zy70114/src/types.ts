export type OrderStatus = 
  | 'created'
  | 'merchant_accepted'
  | 'cooking'
  | 'meal_ready'
  | 'rider_picked_up'
  | 'delivered'
  | 'cancelled';

export type NodeType =
  | 'create_order'
  | 'merchant_accept'
  | 'start_cooking'
  | 'meal_ready'
  | 'rider_assign'
  | 'rider_pickup'
  | 'deliver'
  | 'cancel';

export type LiabilityParty = 
  | 'merchant'
  | 'rider'
  | 'platform'
  | 'user'
  | 'unknown'
  | 'none';

export type TargetParty = 'user' | 'rider' | 'merchant' | 'platform';

export type CompensationType = 
  | 'user_coupon'
  | 'user_refund'
  | 'rider_waiting_fee'
  | 'merchant_penalty'
  | 'platform_coverage';

export type CompensationStatus = 
  | 'pending'
  | 'approved'
  | 'executed'
  | 'appealed'
  | 'rolled_back'
  | 'rejected';

export type AppealStatus = 
  | 'pending'
  | 'reviewing'
  | 'approved'
  | 'rejected';

export type ReportPeriod = 'day' | 'week' | 'month';

export type MealTimerStatus = 'running' | 'stopped';

export type JudgmentType = 'auto' | 'manual';

export interface Order {
  id: string;
  order_no: string;
  merchant_id: string;
  merchant_name: string;
  rider_id: string | null;
  rider_name: string | null;
  user_id: string;
  user_name: string;
  order_amount: number;
  status: OrderStatus;
  expected_meal_minutes: number;
  created_at: number;
  updated_at: number;
}

export interface OrderNode {
  id: string;
  order_id: string;
  node_type: NodeType;
  node_status: string;
  operator_id: string | null;
  operator_role: string | null;
  remark: string | null;
  created_at: number;
}

export interface MealTimer {
  id: string;
  order_id: string;
  start_time: number;
  end_time: number | null;
  expected_meal_minutes: number;
  actual_meal_minutes: number | null;
  is_overtime: number;
  overtime_minutes: number;
  status: MealTimerStatus;
  created_at: number;
}

export interface LiabilityJudgment {
  id: string;
  order_id: string;
  meal_timer_id: string;
  liable_party: LiabilityParty;
  judgment_type: JudgmentType;
  reason: string;
  evidence: string | null;
  created_at: number;
}

export interface Compensation {
  id: string;
  order_id: string;
  liability_judgment_id: string;
  target_party: TargetParty;
  compensation_type: CompensationType;
  amount: number;
  status: CompensationStatus;
  remark: string | null;
  created_at: number;
  updated_at: number;
}

export interface Appeal {
  id: string;
  order_id: string;
  compensation_id: string;
  appellant_party: LiabilityParty;
  appellant_id: string;
  appeal_reason: string;
  appeal_evidence: string | null;
  status: AppealStatus;
  reviewer_id: string | null;
  review_result: string | null;
  created_at: number;
  reviewed_at: number | null;
}

export interface IdempotentRequest {
  id: string;
  request_key: string;
  request_type: string;
  response_data: string;
  created_at: number;
  expires_at: number;
}

export interface OperationLog {
  id: string;
  order_id: string;
  operator_id: string;
  operator_role: string;
  operation_type: string;
  operation_detail: string | null;
  old_data: string | null;
  new_data: string | null;
  created_at: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  business_message?: string;
  data?: T;
  timestamp: number;
}

export interface Report {
  period: ReportPeriod;
  start_date: string;
  end_date: string;
  total_orders: number;
  overtime_orders: number;
  overtime_rate: number;
  total_compensation: number;
  merchant_liability_count: number;
  rider_liability_count: number;
  platform_liability_count: number;
  appeal_count: number;
  appeal_approved_count: number;
  merchant_details: {
    merchant_id: string;
    merchant_name: string;
    order_count: number;
    overtime_count: number;
    overtime_rate: number;
    total_penalty: number;
  }[];
  rider_details: {
    rider_id: string;
    rider_name: string;
    order_count: number;
    overtime_count: number;
    total_waiting_fee: number;
  }[];
}
