import { CaseInfo, ManifestEntry, Issue, RulesConfig } from '../types';
import { createIssue, RULES } from './issue-factory';
import { isSecretLevelAllowedInDirectory } from '../parsers';

export function checkSecretLevelPlacement(
  caseInfo: CaseInfo,
  manifestEntries: ManifestEntry[],
  rules: RulesConfig
): Issue[] {
  const issues: Issue[] = [];
  
  for (const entry of manifestEntries) {
    const directory = extractDirectory(entry.filePath);
    
    if (!isSecretLevelAllowedInDirectory(rules, caseInfo.secretLevel, directory)) {
      const rule = rules.secretLevelRules.find(
        r => r.level === caseInfo.secretLevel || 
             r.level.toLowerCase() === caseInfo.secretLevel.toLowerCase()
      );
      
      issues.push(
        createIssue(
          caseInfo.caseNumber,
          RULES.SECRET_LEVEL_MISPLACED.id,
          RULES.SECRET_LEVEL_MISPLACED.name,
          RULES.SECRET_LEVEL_MISPLACED.severity,
          RULES.SECRET_LEVEL_MISPLACED.category,
          `密级文件误放目录: ${entry.fileName || entry.filePath}`,
          `案件密级: ${caseInfo.secretLevel}\n文件路径: ${entry.filePath}\n当前目录: ${directory}\n` +
          `允许目录: ${rule?.allowedDirectories.join(', ') || '无限制'}\n` +
          `禁止目录: ${rule?.forbiddenDirectories.join(', ') || '无'}`,
          [entry.filePath]
        )
      );
    }
  }
  
  return issues;
}

function extractDirectory(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  
  if (parts.length <= 1) {
    return '';
  }
  
  const lastDir = parts[parts.length - 2];
  return lastDir || '';
}

export function checkAllCasesSecretLevel(
  cases: CaseInfo[],
  manifestMap: Map<string, ManifestEntry[]>,
  rules: RulesConfig
): Issue[] {
  const issues: Issue[] = [];
  
  for (const caseInfo of cases) {
    const entries = manifestMap.get(caseInfo.caseNumber) || [];
    const caseIssues = checkSecretLevelPlacement(caseInfo, entries, rules);
    issues.push(...caseIssues);
  }
  
  return issues;
}
