export interface PurchaseInquiryItem {
  id: string
  itemCode: string
  itemName: string
  specification: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  supplierId: string
  supplierName: string
}

export interface PurchaseInquiry {
  id: string
  batchId: string
  inquiryNo: string
  title: string
  department: string
  applicantId: string
  applicantName: string
  applyDate: string
  items: PurchaseInquiryItem[]
  totalAmount: number
  status: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected'
  currentReviewerId?: string
  currentReviewerName?: string
  createdAt: string
  updatedAt: string
  submittedAt?: string
  ruleVersion: string
}

export interface ReviewRule {
  version: string
  effectiveDate: string
  description: string
  conditions: {
    type: 'amount_threshold' | 'department' | 'item_count' | 'duplicate_check'
    operator: '>' | '<' | '>=' | '<=' | '==' | 'contains'
    value: number | string
  }[]
  approvalFlow: {
    level: number
    role: string
    condition?: string
  }[]
  isActive: boolean
}

export interface AuditLog {
  id: string
  batchId: string
  inquiryId: string
  action: string
  operatorId: string
  operatorName: string
  timestamp: string
  details: Record<string, unknown>
  ruleVersion?: string
}

export interface ReviewResult {
  inquiryId: string
  batchId: string
  status: 'success' | 'warning' | 'error'
  ruleVersion: string
  checks: {
    name: string
    passed: boolean
    message: string
    details?: Record<string, unknown>
  }[]
  issues: {
    type: 'duplicate' | 'missing_info' | 'amount_exceed' | 'other'
    severity: 'low' | 'medium' | 'high'
    message: string
    data?: Record<string, unknown>
  }[]
  originalData: PurchaseInquiry
  reviewedAt: string
  reviewerId?: string
  reviewerName?: string
}

export interface PermissionTicket {
  id: string
  batchId: string
  inquiryId: string
  type: 'temp_approval' | 'exception' | 'override'
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  grantedBy?: string
  grantedByName?: string
  grantedAt?: string
  reason: string
  originalValue: Record<string, unknown>
  modifiedValue: Record<string, unknown>
  conclusion: string
  createdAt: string
  expiresAt: string
}

export interface BatchOperation {
  id: string
  name: string
  type: 'review' | 'export' | 'archive'
  status: 'preview' | 'executing' | 'completed' | 'cancelled'
  targetIds: string[]
  previewResult?: {
    affectedCount: number
    affectedItems: {
      id: string
      title: string
      impact: string
    }[]
    warnings?: string[]
  }
  createdAt: string
  executedAt?: string
  createdBy: string
}

export interface QueryResult<T> {
  success: boolean
  data?: T
  error?: string
  metadata: {
    total: number
    page: number
    pageSize: number
    filters: Record<string, string>
  }
}
