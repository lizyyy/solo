export interface AuditLogEntry {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  note?: string;
  source: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'operation' | 'note' | 'conflict' | 'status_change' | 'judgement';
  title: string;
  description: string;
  operator: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface HandoverReport {
  generatedAt: string;
  generatedBy: string;
  roundId: string;
  playerName: string;
  levelName: string;
  startTime: string;
  endTime?: string;
  finalScore: number;
  finalResources: number;
  finalRisk: number;
  timeline: TimelineEvent[];
  conflicts: {
    total: number;
    resolved: number;
    pending: number;
    details: Array<{
      id: string;
      field: string;
      classroomValue: number | string;
      importedValue: number | string;
      resolution: string;
      resolvedBy?: string;
    }>;
  };
  notes: Array<{
    content: string;
    author: string;
    timestamp: string;
    source: string;
  }>;
  summary: string;
  recommendations: string[];
}

export interface EvidenceItem {
  label: string;
  value: number | string;
  source: string;
  timestamp: string;
  note: string;
}

export interface ConflictEvidence {
  conflictId: string;
  field: string;
  classroom: EvidenceItem;
  imported: EvidenceItem;
  suggestedAction: string;
  suggestedReason: string;
}
