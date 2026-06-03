export interface Settlement {
  id: string
  name: string
  source: "upload" | "cli" | "api"
  importedAt: string
  status: "imported" | "notes_supplemented" | "summary_updated"
}

export interface Entry {
  id: string
  settlementId: string
  tradeDate: string
  exDividendDate: string | null
  securityCode: string
  securityName: string
  amount: number
  note: string
  taxRate: number | null
  taxRateNote: string | null
  status: "normal" | "pending_review" | "reviewed" | "corrected"
  reviewedBy: string | null
  reviewedAt: string | null
  correctionReason: string | null
}

export interface Summary {
  id: string
  entryId: string
  reason: string
  missingMaterials: string[]
  nextStep: string
  responsibleRole: "fund_accountant" | "risk_control"
  generatedAt: string
}

export interface AuditLog {
  id: string
  settlementId: string
  entryId: string | null
  action: "import" | "supplement_note" | "manual_correction" | "rerun" | "review"
  operator: string
  detail: string
  command: string | null
  createdAt: string
}
