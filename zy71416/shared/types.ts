export interface Employee {
  id: string;
  employeeNo: string;
  name: string;
  department: string;
}

export interface Budget {
  id: string;
  name: string;
  totalAmount: number;
  usedAmount: number;
  allowedMccs: string[];
}

export interface Transaction {
  id: string;
  cardNo: string;
  amount: number;
  merchantName: string;
  mcc: string;
  transactionTime: string;
  employeeId: string;
  budgetId: string;
  reimbursementNo: string;
  status: "pending" | "normal" | "warning" | "error";
  createdAt: string;
}

export interface RiskFlag {
  id: string;
  transactionId: string;
  type: "budget_overrun" | "mcc_mismatch" | "duplicate_reimbursement";
  severity: "warning" | "error";
  detail: string;
  humanReason: string;
  createdAt: string;
}

export interface ReviewResult {
  id: string;
  transactionId: string;
  reviewer: string;
  decision: "approved" | "rejected" | "pending_review";
  comment: string;
  createdAt: string;
}

export interface RiskCheckResult {
  transactionId: string;
  flags: RiskFlag[];
  autoJudgment: {
    decision: "pass" | "reject" | "review";
    reason: string;
  };
}

export interface TransactionWithDetails extends Transaction {
  employee?: Employee;
  budget?: Budget;
  riskFlags?: RiskFlag[];
  reviewResult?: ReviewResult;
}
