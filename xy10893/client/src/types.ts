export interface Dispute {
  id: string;
  orderId: string;
  customerName: string;
  status: 'pending' | 'processing' | 'ready' | 'expired' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  disputeId: string;
  type: 'order_screenshot' | 'chat_history' | 'operation_log' | 'contract' | 'other';
  name: string;
  source: string;
  hash: string;
  fileSize: number;
  createdAt: string;
}

export interface ExportBatch {
  id: string;
  disputeId: string;
  evidenceIds: string[];
  status: 'pending' | 'packing' | 'ready' | 'expired';
  createdAt: string;
  expiresAt: string;
  downloadUrl?: string;
}

export interface AccessRecord {
  id: string;
  batchId: string;
  operator: string;
  accessedAt: string;
  action: 'download' | 'view' | 'reauthorize';
}

export interface ValidationResult {
  isValid: boolean;
  missingEvidence: string[];
  hashMismatch: string[];
}
