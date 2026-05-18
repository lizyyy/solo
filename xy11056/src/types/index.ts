export interface RepairFundInvoice {
  id?: number;
  invoiceNo: string;
  communityName: string;
  ownerName: string;
  houseNumber: string;
  repairItem: string;
  paymentAmount: number;
  invoiceAmount: number;
  invoiceDate: string;
  handler: string;
  reviewer: string;
  status: 'pending' | 'approved' | 'rejected';
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  rule: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
  message?: string;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; errors: ValidationError[] }>;
}
