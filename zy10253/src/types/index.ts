export interface Contract {
  id: string;
  contract_no: string;
  student_id: string;
  student_name: string;
  campus_id: string;
  campus_name: string;
  course_name: string;
  total_lessons: number;
  paid_lessons: number;
  gifted_lessons: number;
  total_amount: number;
  material_fee: number;
  installment_fee: number;
  unit_price: number;
  status: string;
  signed_date: string;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: string;
  contract_id: string;
  lesson_date: string;
  lesson_time: string;
  teacher_id: string;
  teacher_name: string;
  status: string;
  is_gifted: number;
  created_at: string;
}

export interface Attendance {
  id: string;
  schedule_id: string;
  contract_id: string;
  attended_date: string;
  is_gifted: number;
  created_at: string;
}

export interface Installment {
  id: string;
  contract_id: string;
  installment_no: number;
  due_date: string;
  amount: number;
  principal: number;
  fee: number;
  status: string;
  paid_date?: string;
  created_at: string;
}

export interface RefundApplication {
  id: string;
  contract_id: string;
  application_no: string;
  reason: string;
  requested_date: string;
  total_refund_amount: number;
  actual_refund_amount: number;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RefundItem {
  id: string;
  refund_id: string;
  item_type: string;
  item_name: string;
  amount: number;
  quantity: number;
  unit_price?: number;
  remark?: string;
  created_at: string;
}

export interface ApprovalHistory {
  id: string;
  refund_id: string;
  action: string;
  status: string;
  approver_id: string;
  approver_name: string;
  comment?: string;
  previous_status?: string;
  new_status?: string;
  created_at: string;
}

export interface BusinessHistory {
  id: string;
  business_type: string;
  business_id: string;
  action: string;
  operator_id: string;
  operator_name: string;
  before_data?: string;
  after_data?: string;
  remark?: string;
  created_at: string;
}

export interface RefundCalculation {
  contract: Contract;
  attended_paid_lessons: number;
  attended_gifted_lessons: number;
  remaining_paid_lessons: number;
  remaining_gifted_lessons: number;
  total_paid: number;
  paid_installments_count: number;
  unpaid_installments_count: number;
  unpaid_installment_fees: number;
  material_fee_deduction: number;
  material_fee_refunded: number;
  items: RefundItemDetail[];
  total_refund_amount: number;
  actual_refund_amount: number;
  warnings: string[];
}

export interface RefundItemDetail {
  type: string;
  name: string;
  amount: number;
  quantity: number;
  unit_price?: number;
  remark: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
