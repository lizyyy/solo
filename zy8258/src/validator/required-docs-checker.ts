import { CaseInfo, ManifestEntry, Issue, RulesConfig } from '../types';
import { createIssue, RULES } from './issue-factory';
import { getRequiredDocumentsForCaseType } from '../parsers';

export function checkRequiredDocuments(
  caseInfo: CaseInfo,
  manifestEntries: ManifestEntry[],
  rules: RulesConfig
): Issue[] {
  const issues: Issue[] = [];
  
  let requiredDocs = caseInfo.requiredDocuments;
  if (requiredDocs.length === 0 && caseInfo.caseType) {
    requiredDocs = getRequiredDocumentsForCaseType(rules, caseInfo.caseType);
  }
  
  if (requiredDocs.length === 0) {
    return issues;
  }
  
  const existingFiles = manifestEntries.map(e => 
    normalizeFileName(e.fileName || e.filePath)
  );
  
  for (const requiredDoc of requiredDocs) {
    const normalizedRequired = normalizeFileName(requiredDoc);
    const found = existingFiles.some(file => 
      file.includes(normalizedRequired) || 
      normalizedRequired.includes(file)
    );
    
    if (!found) {
      const matchingEntries = findPartialMatches(normalizedRequired, manifestEntries);
      
      issues.push(
        createIssue(
          caseInfo.caseNumber,
          RULES.REQUIRED_DOCUMENT_MISSING.id,
          RULES.REQUIRED_DOCUMENT_MISSING.name,
          RULES.REQUIRED_DOCUMENT_MISSING.severity,
          RULES.REQUIRED_DOCUMENT_MISSING.category,
          `必备文书缺失: ${requiredDoc}`,
          matchingEntries.length > 0 
            ? `未找到完整匹配的 "${requiredDoc}"，发现类似文件: ${matchingEntries.map(e => e.fileName).join(', ')}`
            : `卷宗中未找到任何名称包含 "${requiredDoc}" 的文件`,
          matchingEntries.map(e => e.filePath)
        )
      );
    }
  }
  
  return issues;
}

function normalizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-\s]+/g, '')
    .replace(/[（(]\d+[)）]/g, '')
    .trim();
}

function findPartialMatches(
  searchTerm: string,
  entries: ManifestEntry[]
): ManifestEntry[] {
  const results: ManifestEntry[] = [];
  const normalizedSearch = searchTerm.toLowerCase();
  
  for (const entry of entries) {
    const fileName = (entry.fileName || entry.filePath).toLowerCase();
    const baseName = fileName.replace(/\.[^.]+$/, '');
    
    if (baseName.includes(normalizedSearch) || normalizedSearch.includes(baseName)) {
      const similarity = calculateSimilarity(normalizedSearch, baseName);
      if (similarity > 0.3) {
        results.push(entry);
      }
    }
  }
  
  return results;
}

function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  
  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);
  
  if (maxLen === 0) return 1.0;
  
  let matches = 0;
  for (let i = 0; i < Math.min(len1, len2); i++) {
    if (str1[i] === str2[i]) {
      matches++;
    }
  }
  
  return matches / maxLen;
}
