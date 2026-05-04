import { ManifestEntry, Issue, RulesConfig, CaseInfo } from '../types';
import { createIssue, RULES } from './issue-factory';

export interface PathCaseIssue {
  caseNumber: string;
  actualPath: string;
  expectedPath: string;
  manifestPath: string;
}

export function checkPathCaseSensitivity(
  manifestEntries: ManifestEntry[],
  dossierRoot: string,
  rules: RulesConfig
): { issues: Issue[]; pathCaseIssues: PathCaseIssue[] } {
  const issues: Issue[] = [];
  const pathCaseIssues: PathCaseIssue[] = [];
  
  if (!rules.caseSensitivityCheck) {
    return { issues, pathCaseIssues };
  }
  
  const path = require('path');
  const fs = require('fs');
  
  for (const entry of manifestEntries) {
    const manifestPath = entry.filePath;
    const normalizedManifestPath = normalizePath(manifestPath);
    
    const expectedFullPath = path.join(dossierRoot, normalizedManifestPath);
    
    if (fs.existsSync(expectedFullPath)) {
      const actualPath = getActualPathCase(dossierRoot, normalizedManifestPath);
      
      if (actualPath && actualPath !== normalizedManifestPath) {
        pathCaseIssues.push({
          caseNumber: entry.caseNumber,
          actualPath: actualPath,
          expectedPath: normalizedManifestPath,
          manifestPath: manifestPath
        });
        
        issues.push(
          createIssue(
            entry.caseNumber,
            RULES.PATH_CASE_SENSITIVITY.id,
            RULES.PATH_CASE_SENSITIVITY.name,
            RULES.PATH_CASE_SENSITIVITY.severity,
            RULES.PATH_CASE_SENSITIVITY.category,
            `路径大小写差异: ${entry.fileName || entry.filePath}`,
            `清单中路径: ${manifestPath}\n` +
            `期望路径: ${normalizedManifestPath}\n` +
            `实际路径: ${actualPath}\n` +
            `建议: 统一使用一致的大小写格式以避免跨平台兼容性问题`,
            [manifestPath, actualPath]
          )
        );
      }
    }
  }
  
  return { issues, pathCaseIssues };
}

function normalizePath(filePath: string): string {
  return filePath.replace(/[\\/]+/g, '/').replace(/^[.\\/]+/, '');
}

function getActualPathCase(root: string, relativePath: string): string | null {
  const path = require('path');
  const fs = require('fs');
  
  const parts = relativePath.split('/');
  let currentPath = root;
  const actualParts: string[] = [];
  
  for (const part of parts) {
    if (!fs.existsSync(currentPath)) {
      return null;
    }
    
    const entries = fs.readdirSync(currentPath);
    const matchingEntry = entries.find((e: string) => e.toLowerCase() === part.toLowerCase());
    
    if (!matchingEntry) {
      return null;
    }
    
    actualParts.push(matchingEntry);
    currentPath = path.join(currentPath, matchingEntry);
  }
  
  return actualParts.join('/');
}

export function checkCaseConsistency(
  cases: CaseInfo[],
  manifestMap: Map<string, ManifestEntry[]>
): Issue[] {
  const issues: Issue[] = [];
  
  const caseNumbersFromCases = new Set(cases.map(c => c.caseNumber));
  const caseNumbersFromManifest = new Set(manifestMap.keys());
  
  for (const caseNum of caseNumbersFromCases) {
    if (!caseNumbersFromManifest.has(caseNum)) {
      const similar = findSimilarCaseNumber(caseNum, caseNumbersFromManifest);
      
      issues.push(
        createIssue(
          caseNum,
          RULES.CASE_NOT_IN_MANIFEST.id,
          RULES.CASE_NOT_IN_MANIFEST.name,
          RULES.CASE_NOT_IN_MANIFEST.severity,
          RULES.CASE_NOT_IN_MANIFEST.category,
          `案件未在清单中: ${caseNum}`,
          similar 
            ? `在清单中发现类似案号: ${similar}，可能是大小写或格式差异`
            : `清单中未找到该案件的任何文件记录`,
          []
        )
      );
    }
  }
  
  for (const caseNum of caseNumbersFromManifest) {
    if (!caseNumbersFromCases.has(caseNum)) {
      const similar = findSimilarCaseNumber(caseNum, caseNumbersFromCases);
      
      issues.push(
        createIssue(
          caseNum,
          RULES.MANIFEST_CASE_NOT_IN_CASES.id,
          RULES.MANIFEST_CASE_NOT_IN_CASES.name,
          RULES.MANIFEST_CASE_NOT_IN_CASES.severity,
          RULES.MANIFEST_CASE_NOT_IN_CASES.category,
          `清单案件未备案: ${caseNum}`,
          similar 
            ? `在 cases.csv 中发现类似案号: ${similar}，可能是大小写或格式差异`
            : `该案件在清单中有文件记录，但未在 cases.csv 中备案`,
          []
        )
      );
    }
  }
  
  return issues;
}

function findSimilarCaseNumber(
  target: string,
  candidates: Set<string>
): string | null {
  const targetLower = target.toLowerCase();
  
  for (const candidate of candidates) {
    if (candidate.toLowerCase() === targetLower) {
      return candidate;
    }
  }
  
  for (const candidate of candidates) {
    const similarity = calculateCaseNumberSimilarity(target, candidate);
    if (similarity > 0.7) {
      return candidate;
    }
  }
  
  return null;
}

function calculateCaseNumberSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[_\-\s]+/g, '');
  const s2 = str2.toLowerCase().replace(/[_\-\s]+/g, '');
  
  if (s1 === s2) return 1.0;
  
  let matches = 0;
  const maxLen = Math.max(s1.length, s2.length);
  
  for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) matches++;
  }
  
  return matches / maxLen;
}
