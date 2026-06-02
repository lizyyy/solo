export interface CrossPeriodData {
  period: string;
  periodLabel: string;
  pointCount: number;
  feedbackCount: number;
  completedRate: number;
}

export interface ReportStatistics {
  totalPoints: number;
  completedPoints: number;
  pendingPoints: number;
  reviewPoints: number;
  totalFeedbacks: number;
  resolvedFeedbacks: number;
  conflictFeedbacks: number;
}

export interface ReportItem {
  id: string;
  pointName: string;
  address: string;
  status: string;
  latestFeedback: string;
  latestPlan: string;
}

export interface ReportSection {
  title: string;
  status: 'completed' | 'pending' | 'review';
  count: number;
  items: ReportItem[];
}

export interface Report {
  id: string;
  title: string;
  generatedAt: string;
  generatedBy: string;
  timeRange: { start: string; end: string };
  statistics: ReportStatistics;
  sections: {
    completed: ReportSection;
    pending: ReportSection;
    review: ReportSection;
  };
}

export type ExportFormat = 'pdf' | 'excel' | 'print';
