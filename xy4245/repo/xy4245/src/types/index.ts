export interface FocusableElement {
  tag: string;
  selector: string;
  xpath: string;
  textContent: string;
  tabindex: number | null;
  visible: boolean;
  ariaLabel: string | null;
  ariaLabelledBy: string | null;
  ariaHidden: boolean;
  ariaModal: boolean;
  role: string | null;
  id: string | null;
  className: string | null;
  attributes: Record<string, string>;
  clickable: boolean;
  innerHTML: string;
}

export interface TabTrajectoryItem {
  timestamp: number;
  selector: string;
  xpath: string;
  tagName: string;
  textContent: string;
  ariaLabel: string | null;
  visible: boolean;
  isFocused: boolean;
  isModal: boolean;
}

export interface TabTrajectory {
  pageUrl: string;
  snapshotId: string;
  timestamp: number;
  items: TabTrajectoryItem[];
  metadata: {
    browser: string;
    viewport: {
      width: number;
      height: number;
    };
  };
}

export interface CriticalOperation {
  id: string;
  description: string;
  selector: string;
  operationType: 'click' | 'input' | 'select' | 'modal' | 'navigation';
  expectedFlow: string[];
  required: boolean;
}

export interface Issue {
  id: string;
  type: IssueType;
  severity: Severity;
  title: string;
  description: string;
  element: ElementInfo;
  location: IssueLocation;
  suggestion: string;
  references: Reference[];
  trajectoryIndex?: number;
  status: IssueStatus;
  reviewNote?: string;
  createdAt: string;
}

export type IssueType = 
  | 'focus_to_hidden'
  | 'modal_not_trapped'
  | 'no_readable_name'
  | 'shortcut_conflict'
  | 'focus_order_violation'
  | 'tabindex_issue'
  | 'aria_role_mismatch';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type IssueStatus = 'new' | 'confirmed' | 'ignored' | 'fixed';

export interface ElementInfo {
  selector: string;
  xpath: string;
  tagName: string;
  textContent: string;
  ariaLabel: string | null;
}

export interface IssueLocation {
  line?: number;
  column?: number;
  htmlSnippet: string;
}

export interface Reference {
  standard: string;
  section: string;
  url: string;
}

export interface ScanResult {
  snapshotId: string;
  timestamp: string;
  pageTitle: string;
  pageUrl: string;
  focusableElements: FocusableElement[];
  trajectory: TabTrajectory | null;
  criticalOperations: CriticalOperation[];
}

export interface CheckResult {
  scanResult: ScanResult;
  issues: Issue[];
  summary: CheckSummary;
}

export interface CheckSummary {
  total: number;
  byType: Record<IssueType, number>;
  bySeverity: Record<Severity, number>;
  focusableCount: number;
  trajectoryLength: number;
  criticalOperationsCount: number;
}

export interface ReviewSession {
  id: string;
  snapshotId: string;
  createdAt: string;
  updatedAt: string;
  issues: ReviewItem[];
}

export interface ReviewItem {
  issueId: string;
  status: IssueStatus;
  reviewerNote?: string;
  reviewedAt: string;
}

export interface AuditPackage {
  version: string;
  generatedAt: string;
  snapshotId: string;
  checkResult: CheckResult;
  reviewSession: ReviewSession | null;
  summary: AuditSummary;
}

export interface AuditSummary {
  snapshotInfo: {
    title: string;
    url: string;
    timestamp: string;
  };
  issueOverview: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    confirmed: number;
    ignored: number;
    new: number;
  };
  focusOrder: {
    totalFocusable: number;
    tabTrajectoryItems: number;
    hiddenElements: number;
  };
  criticalOperations: {
    total: number;
    tested: number;
  };
}
