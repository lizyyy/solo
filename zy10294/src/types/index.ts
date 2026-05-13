export type InvoiceStatus = 
  | 'pending'        // 待复核
  | 'approved'       // 已通过
  | 'rejected'       // 已驳回
  | 'invoiced'       // 已开票
  | 'red_flush'      // 已红冲
  | 'reopened'       // 已重开
  | 'blocked';       // 已拦截

export type BlockReason = 
  | 'tax_id_invalid'         // 税号格式异常
  | 'already_invoiced'       // 已开票申请继续改抬头
  | 'red_flush_not_reopened' // 红冲后未重开
  | 'duplicate_project';     // 同一项目重复申请

export interface Customer {
  id: string;
  name: string;
  taxId: string;
  address?: string;
  phone?: string;
  bankName?: string;
  bankAccount?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description?: string;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  invoiceId: string;
  operator: string;
  operation: string;
  timestamp: string;
  remark?: string;
  oldValue?: string;
  newValue?: string;
}

export interface InvoiceApplication {
  id: string;
  customerId: string;
  customerName: string;
  taxId: string;
  address?: string;
  phone?: string;
  bankName?: string;
  bankAccount?: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  amount: number;
  invoiceType: 'special' | 'normal';
  status: InvoiceStatus;
  blockReason?: BlockReason;
  blockMessage?: string;
  applicant: string;
  applyTime: string;
  reviewer?: string;
  reviewTime?: string;
  invoiceNumber?: string;
  invoiceTime?: string;
  redFlushTime?: string;
  reopenTime?: string;
  originalInvoiceId?: string;
  isRedFlush: boolean;
  isReopened: boolean;
  operationLogs: OperationLog[];
}

export interface DashboardStats {
  pending: number;
  completed: number;
  blocked: number;
  total: number;
}
