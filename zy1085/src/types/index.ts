// 提交记录
export interface Commit {
  id: string;
  hash: string;
  message: string;
  author: string;
  date: string;
  module: string;
  relatedIssues: string[];
  isBreaking: boolean;
  breakingDescription?: string;
}

// Issue
export interface Issue {
  id: string;
  title: string;
  description: string;
  status: string;
  author: string;
  assignee: string;
  module: string;
  priority: 'high' | 'medium' | 'low';
  affectedCustomers: string[];
  relatedCommits: string[];
  hasRollbackPlan: boolean;
  rollbackPlan?: string;
  labels: string[];
}

// 部署计划
export interface DeployPlan {
  version: string;
  date: string;
  environment: string;
  description: string;
  moduleOwners: Record<string, string>;
  configChanges: ConfigChange[];
  dependencies: string[];
  preDeploySteps: string[];
  postDeploySteps: string[];
  rollbackStrategy: string;
}

// 配置变更
export interface ConfigChange {
  key: string;
  oldValue: string;
  newValue: string;
  environment: string;
  description: string;
  isRequired: boolean;
  rollbackAction: string;
}

// 数据库迁移
export interface Migration {
  id: string;
  filename: string;
  content: string;
  description: string;
  module: string;
  isBreaking: boolean;
  rollbackScript?: string;
  dependencies: string[];
}

// 校验结果
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info: ValidationInfo[];
}

// 校验错误
export interface ValidationError {
  type: string;
  field: string;
  message: string;
  severity: 'critical' | 'error';
}

// 校验警告
export interface ValidationWarning {
  type: string;
  field: string;
  message: string;
  severity: 'warning' | 'info';
}

// 校验信息
export interface ValidationInfo {
  type: string;
  field: string;
  message: string;
}

// 计划汇总
export interface ReleasePlan {
  version: string;
  date: string;
  summary: string;
  commits: Commit[];
  issues: Issue[];
  migrations: Migration[];
  configChanges: ConfigChange[];
  analysis: {
    breakingChanges: BreakingChange[];
    riskAssessment: RiskAssessment;
    impactAnalysis: ImpactAnalysis;
    ownerResponsibility: OwnerResponsibility[];
    rollbackReadiness: RollbackReadiness;
  };
}

// 破坏性变更
export interface BreakingChange {
  id: string;
  type: 'commit' | 'migration' | 'config';
  description: string;
  affectedAreas: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  mitigation: string;
}

// 风险评估
export interface RiskAssessment {
  overallRisk: 'critical' | 'high' | 'medium' | 'low';
  riskFactors: RiskFactor[];
  mitigationPlan: string[];
}

// 风险因素
export interface RiskFactor {
  category: string;
  description: string;
  likelihood: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  score: number;
}

// 影响分析
export interface ImpactAnalysis {
  affectedCustomers: string[];
  affectedModules: string[];
  dependentServices: string[];
  downtimeRequired: boolean;
  downtimeEstimate?: string;
}

// 负责人责任
export interface OwnerResponsibility {
  owner: string;
  modules: string[];
  issues: string[];
  commits: string[];
  migrations: string[];
}

// 回滚准备状态
export interface RollbackReadiness {
  isReady: boolean;
  missingRollbackPlans: MissingRollbackPlan[];
  rollbackChecklist: RollbackChecklistItem[];
}

// 缺失回滚计划
export interface MissingRollbackPlan {
  id: string;
  type: 'issue' | 'migration' | 'config';
  description: string;
  suggestedAction: string;
}

// 回滚核对清单
export interface RollbackChecklistItem {
  id: string;
  category: string;
  task: string;
  status: 'required' | 'optional' | 'not_applicable';
  completed: boolean;
  notes?: string;
}

// 配置
export interface CLIConfig {
  dataDirectory: string;
  outputDirectory: string;
  defaultEnvironment: string;
  moduleOwners: Record<string, string>;
  customerList: string[];
}

// 历史记录
export interface HistoryRecord {
  id: string;
  timestamp: string;
  command: string;
  version: string;
  status: 'success' | 'failed' | 'warning';
  summary: string;
}
