import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { RulesConfig } from '../types';

export function parseRulesYaml(filePath: string): RulesConfig {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = yaml.load(content) as any;
  
  return normalizeRulesConfig(data);
}

function normalizeRulesConfig(data: any): RulesConfig {
  const defaultConfig: RulesConfig = {
    requiredDocuments: [
      {
        caseType: '民事',
        documents: ['起诉状', '答辩状', '证据清单', '庭审笔录', '判决书']
      },
      {
        caseType: '刑事',
        documents: ['起诉书', '辩护词', '证据清单', '庭审笔录', '判决书']
      },
      {
        caseType: '行政',
        documents: ['起诉状', '答辩状', '证据清单', '庭审笔录', '判决书']
      }
    ],
    secretLevelRules: [
      {
        level: '公开',
        allowedDirectories: ['公开', 'public', '卷宗'],
        forbiddenDirectories: ['内部', '秘密', '机密']
      },
      {
        level: '内部',
        allowedDirectories: ['内部', '卷宗'],
        forbiddenDirectories: ['公开', 'public', '秘密', '机密']
      },
      {
        level: '秘密',
        allowedDirectories: ['秘密', '卷宗'],
        forbiddenDirectories: ['公开', 'public', '内部', '机密']
      },
      {
        level: '机密',
        allowedDirectories: ['机密', '卷宗'],
        forbiddenDirectories: ['公开', 'public', '内部', '秘密']
      }
    ],
    duplicateCheckRules: {
      enabled: true,
      ignoreDirectories: ['目录文件', '索引']
    },
    caseSensitivityCheck: true,
    batchAppendCheck: true
  };
  
  if (!data) return defaultConfig;
  
  return {
    requiredDocuments: data.requiredDocuments || data['必备文书规则'] || defaultConfig.requiredDocuments,
    secretLevelRules: data.secretLevelRules || data['密级规则'] || defaultConfig.secretLevelRules,
    duplicateCheckRules: {
      enabled: data.duplicateCheckRules?.enabled ?? data['重复检查规则']?.enabled ?? defaultConfig.duplicateCheckRules.enabled,
      ignoreDirectories: data.duplicateCheckRules?.ignoreDirectories || data['重复检查规则']?.ignoreDirectories || defaultConfig.duplicateCheckRules.ignoreDirectories
    },
    caseSensitivityCheck: data.caseSensitivityCheck ?? data['路径大小写检查'] ?? defaultConfig.caseSensitivityCheck,
    batchAppendCheck: data.batchAppendCheck ?? data['批次追加检查'] ?? defaultConfig.batchAppendCheck
  };
}

export function getRequiredDocumentsForCaseType(
  rules: RulesConfig,
  caseType: string
): string[] {
  const rule = rules.requiredDocuments.find(
    r => r.caseType === caseType || 
         r.caseType.toLowerCase() === caseType.toLowerCase()
  );
  return rule?.documents || [];
}

export function isSecretLevelAllowedInDirectory(
  rules: RulesConfig,
  secretLevel: string,
  directory: string
): boolean {
  const rule = rules.secretLevelRules.find(
    r => r.level === secretLevel || 
         r.level.toLowerCase() === secretLevel.toLowerCase()
  );
  
  if (!rule) return true;
  
  const normalizedDir = directory.toLowerCase();
  
  const isForbidden = rule.forbiddenDirectories.some(
    forbidden => normalizedDir.includes(forbidden.toLowerCase())
  );
  
  if (isForbidden) return false;
  
  const hasAllowedDirs = rule.allowedDirectories.length > 0;
  if (!hasAllowedDirs) return true;
  
  return rule.allowedDirectories.some(
    allowed => normalizedDir.includes(allowed.toLowerCase())
  );
}

export function shouldCheckDuplicateForDirectory(
  rules: RulesConfig,
  directory: string
): boolean {
  if (!rules.duplicateCheckRules.enabled) return false;
  
  const normalizedDir = directory.toLowerCase();
  return !rules.duplicateCheckRules.ignoreDirectories.some(
    ignore => normalizedDir.includes(ignore.toLowerCase())
  );
}
