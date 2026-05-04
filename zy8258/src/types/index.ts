export interface CaseInfo {
  caseNumber: string;
  caseType: string;
  parties: string;
  judge: string;
  filingDate: string;
  secretLevel: '公开' | '内部' | '秘密' | '机密';
  requiredDocuments: string[];
  batchNumber: string;
}

export interface ManifestEntry {
  caseNumber: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  lastModified: string;
  diskLabel: string;
  batchNumber: string;
}

export interface HashEntry {
  filePath: string;
  hash: string;
  algorithm: string;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
}

export interface RulesConfig {
  requiredDocuments: {
    caseType: string;
    documents: string[];
  }[];
  secretLevelRules: {
    level: string;
    allowedDirectories: string[];
    forbiddenDirectories: string[];
  }[];
  duplicateCheckRules: {
    enabled: boolean;
    ignoreDirectories: string[];
  };
  caseSensitivityCheck: boolean;
  batchAppendCheck: boolean;
}

export interface Issue {
  id: string;
  caseNumber: string;
  ruleId: string;
  ruleName: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  details: string;
  affectedFiles: string[];
  timestamp: string;
}

export interface ValidationResult {
  totalCases: number;
  validatedCases: number;
  totalIssues: number;
  errors: number;
  warnings: number;
  infos: number;
  issues: Issue[];
  caseStats: {
    caseNumber: string;
    batchNumbers: string[];
    fileCount: number;
    issues: Issue[];
  }[];
  duplicateFiles: {
    hash: string;
    files: {
      path: string;
      diskLabel: string;
      caseNumber: string;
      batchNumber?: string;
    }[];
  }[];
  pathCaseIssues: {
    caseNumber: string;
    actualPath: string;
    expectedPath: string;
  }[];
  batchAppendCases: {
    caseNumber: string;
    batchNumbers: string[];
  }[];
  validationTime: string;
}

export interface ConfigPaths {
  casesCsv: string;
  manifestJsonl: string;
  hashesTxt: string;
  rulesYaml: string;
  dossierRoot: string;
}
