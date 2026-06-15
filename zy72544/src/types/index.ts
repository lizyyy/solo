export interface Record {
  id: string
  title: string
  chapterType: string
  status: 'normal' | 'warning' | 'danger'
  createdAt: string
}

export interface PhoneExposure {
  id: string
  recordId: string
  originalPhone: string
  maskedPhone: string
  isLeaked: boolean
  retainReason: string
  missingMaterials: string
  nextStep: string
  assignee: string
  paramVersion: string
  tradeoffReason: string
  reviewStatus: 'pending' | 'confirmed' | 'rejected'
}

export interface KnowledgeLink {
  id: string
  recordId: string
  url: string
  title: string
  note: string
  addedBy: string
  addedAt: string
}

export interface FeedbackTicket {
  id: string
  recordId: string
  ticketNo: string
  title: string
  status: 'open' | 'closed' | 'in_progress'
}

export interface ExportSnapshot {
  id: string
  recordId: string
  generatedAt: string
  content: ExportContent[]
  version: string
}

export interface ExportContent {
  phoneExposureId: string
  originalPhone: string
  maskedPhone: string
  isLeaked: boolean
  retainReason: string
  missingMaterials: string
  nextStep: string
  assignee: string
  knowledgeLinks: string[]
  ticketNos: string[]
  paramVersion: string
  tradeoffReason: string
}

export interface HistoryEntry {
  id: string
  recordId: string
  action: 'link_added' | 'link_note_edited' | 'export_regenerated' | 'review_status_changed' | 'link_removed'
  field: string
  oldValue: string
  newValue: string
  operator: string
  timestamp: string
  paramVersion: string
  tradeoffReason: string
}
