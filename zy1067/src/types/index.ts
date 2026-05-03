export interface RouteConfig {
  id: string;
  name: string;
  url: string;
  type: 'html' | 'url';
  description?: string;
  group?: string;
  keyControls?: KeyControlConfig[];
  disabled?: boolean;
  settings?: {
    viewport?: Viewport;
    userAgent?: string;
    locale?: string;
  };
}

export interface KeyControlConfig {
  selector: string;
  name: string;
  expectedRole?: string;
  expectedActions?: ('tab' | 'enter' | 'escape' | 'click')[];
}

export interface Viewport {
  width: number;
  height: number;
}

export interface RoutesConfig {
  version: '1.0';
  name?: string;
  description?: string;
  defaultSettings?: {
    viewport?: Viewport;
    checkers?: string[];
    timeout?: number;
  };
  groups?: RouteGroup[];
  routes: RouteConfig[];
}

export interface RouteGroup {
  id: string;
  name: string;
  description?: string;
}

export interface FocusPathItem {
  index: number;
  selector: string;
  elementInfo: ElementInfo;
  isVisible: boolean;
  focusVisible: boolean;
  hasVisibleOutline: boolean;
  tabIndexValue: number | null;
}

export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  accessibleName?: string;
  role?: string;
  type?: string;
  ariaLabel?: string;
  ariaLabelledby?: string;
  placeholder?: string;
  title?: string;
}

export interface ScanResult {
  id: string;
  timestamp: string;
  version: '1.0';
  summary: ScanSummary;
  routes: RouteResult[];
  errors: ConfigurationError[];
}

export interface ScanSummary {
  totalPages: number;
  scannedPages: number;
  failedPages: number;
  totalIssues: number;
  issuesBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  issuesByType: Record<string, number>;
  duration: number;
}

export interface RouteResult {
  routeId: string;
  routeName: string;
  url: string;
  status: 'success' | 'failed' | 'skipped';
  error?: PageError;
  focusPath: FocusPathItem[];
  issues: AccessibilityIssue[];
  screenshot?: string;
  duration: number;
  timestamp: string;
}

export interface AccessibilityIssue {
  id: string;
  type: IssueType;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  element: ElementInfo & {
    selector: string;
    domSnippet?: string;
  };
  context?: {
    focusIndex?: number;
    previousFocus?: string;
    nextFocus?: string;
  };
  evidence?: {
    screenshot?: string;
    consoleLogs?: string[];
    networkLogs?: string[];
  };
}

export type IssueType =
  | 'focus-order'
  | 'focus-visibility'
  | 'focus-trap'
  | 'focus-loop'
  | 'skip-link'
  | 'form-label'
  | 'button-name'
  | 'link-name'
  | 'aria-label'
  | 'tabindex'
  | 'modal-trap'
  | 'modal-return'
  | 'page-load'
  | 'element-not-found';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface ConfigurationError {
  type: 'config-error' | 'validation-error' | 'page-error';
  message: string;
  details?: string;
  routeId?: string;
  field?: string;
}

export interface PageError {
  type: 'navigation' | 'timeout' | 'element-not-found' | 'other';
  message: string;
  details?: string;
}

export interface CheckerConfig {
  name: string;
  enabled: boolean;
  options?: Record<string, unknown>;
}

export interface ReporterOptions {
  format: 'json' | 'markdown' | 'html';
  outputPath?: string;
  includeScreenshots?: boolean;
  includeDomSnippets?: boolean;
}

export interface InitOptions {
  outputPath?: string;
  includeDemo?: boolean;
}
