export interface MeetingAttachment {
  id: string;
  fileName: string;
  fileType: string;
  uploadTime: string;
  uploader: string;
  contentHash: string;
  originalInput: Record<string, any>;
}

export interface EvidenceItem {
  id: string;
  type: 'attachment' | 'reference' | 'external' | 'manual';
  source: string;
  description: string;
  timestamp: string;
  verified: boolean;
  verificationMethod?: string;
}

export interface EvidenceChain {
  id: string;
  meetingId: string;
  items: EvidenceItem[];
  status: 'complete' | 'broken' | 'under_review';
  brokenAt?: number;
  brokenReason?: string;
}

export interface ManualCorrection {
  id: string;
  fieldName: string;
  originalValue: any;
  correctedValue: any;
  reason: string;
  corrector: string;
  timestamp: string;
  systemJudgment: any;
}

export interface SearchTermReport {
  searchTerm: string;
  occurrences: number;
  locations: string[];
  reviewSample: {
    context: string;
    verified: boolean;
    reviewer?: string;
    reviewTime?: string;
  };
}

export interface MeetingMinutes {
  id: string;
  meetingTitle: string;
  meetingDate: string;
  department: string;
  attendees: string[];
  topics: string[];
  decisions: string[];
  actionItems: ActionItem[];
  attachments: MeetingAttachment[];
  evidenceChain: EvidenceChain;
  corrections: ManualCorrection[];
  searchTermReports: SearchTermReport[];
  status: 'draft' | 'submitted' | 'reviewed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ActionItem {
  id: string;
  description: string;
  assignee: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ProcessingResult {
  success: boolean;
  meetingId: string;
  message: string;
  errors: string[];
  warnings: string[];
  evidenceChainStatus: string;
  correctionsApplied: number;
}

export interface ExportSummary {
  input: {
    meetingId: string;
    attachments: string[];
    fields: string[];
  };
  actions: {
    type: string;
    description: string;
    timestamp: string;
  }[];
  conclusion: {
    status: string;
    evidenceChainIntact: boolean;
    correctionsCount: number;
    finalReportGenerated: boolean;
  };
}

export interface QueryFilter {
  meetingId?: string;
  department?: string;
  status?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  hasBrokenChain?: boolean;
  hasCorrections?: boolean;
}
