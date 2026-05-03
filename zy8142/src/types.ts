// 路由配置类型
export interface RouteConfig {
  path: string;
  scheme: string;
  targetScreen: string;
  requiredParams?: string[];
  optionalParams?: string[];
  requiresLogin: boolean;
  isDeprecated?: boolean;
  redirectTo?: string;
}

export interface RoutesFile {
  routes: RouteConfig[];
  defaultScheme: string;
}

// 屏幕配置类型
export interface ScreenConfig {
  id: string;
  name: string;
  requiredEvents: string[];
  deprecated?: boolean;
  minimumAppVersion?: string;
}

export interface ScreensFile {
  screens: ScreenConfig[];
}

// 埋点事件类型
export interface EventEntry {
  eventName: string;
  screenId: string;
  routePath: string;
  timestamp: string;
  userId?: string;
  properties?: Record<string, unknown>;
}

// 灰度规则类型
export interface GrayRule {
  id: string;
  name: string;
  type: 'user_segment' | 'version' | 'percentage' | 'region';
  value: string | number | string[];
  routes: string[];
}

export interface PolicyFile {
  rules: GrayRule[];
  defaultPolicy: 'allow' | 'deny';
}

// 检查结果类型
export interface Issue {
  id: string;
  type: 'parameter_missing' | 'login_required' | 'deprecated_route' | 'missing_event' | 'gray_policy_mismatch' | 'invalid_scheme' | 'old_shortlink';
  severity: 'critical' | 'high' | 'medium' | 'low';
  route: string;
  screen: string;
  message: string;
  details: string;
  suggestion: string;
}

export interface DeeplinkReport {
  summary: {
    totalRoutes: number;
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    checkTime: string;
  };
  issues: Issue[];
  routeAnalysis: RouteAnalysis[];
}

export interface RouteAnalysis {
  path: string;
  scheme: string;
  targetScreen: string;
  status: 'pass' | 'warning' | 'error';
  checks: {
    name: string;
    passed: boolean;
    message?: string;
  }[];
}

// 测试用例类型
export interface TestCase {
  deeplink: string;
  expectedScreen: string;
  expectLogin: boolean;
  testUserSegment?: string;
  testAppVersion?: string;
}
