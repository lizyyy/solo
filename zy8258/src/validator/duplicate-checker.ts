import { ManifestEntry, Issue, RulesConfig } from '../types';
import { createIssue, RULES } from './issue-factory';
import { shouldCheckDuplicateForDirectory } from '../parsers';

export interface DuplicateCheckResult {
  issues: Issue[];
  duplicateGroups: {
    hash: string;
    files: {
      path: string;
      diskLabel: string;
      caseNumber: string;
      batchNumber: string;
    }[];
  }[];
}

export function checkDuplicateFiles(
  manifestEntries: ManifestEntry[],
  hashMap: Map<string, { hash: string; algorithm: string }>,
  rules: RulesConfig
): DuplicateCheckResult {
  const issues: Issue[] = [];
  const hashToFiles: Map<string, {
    path: string;
    diskLabel: string;
    caseNumber: string;
    batchNumber: string;
    filePath: string;
  }[]> = new Map();
  
  for (const entry of manifestEntries) {
    if (!shouldCheckDuplicateForDirectory(rules, entry.filePath)) {
      continue;
    }
    
    const hashEntry = findHashForFile(entry, hashMap);
    
    if (hashEntry) {
      const existing = hashToFiles.get(hashEntry.hash) || [];
      existing.push({
        path: entry.filePath,
        diskLabel: entry.diskLabel,
        caseNumber: entry.caseNumber,
        batchNumber: entry.batchNumber,
        filePath: entry.filePath
      });
      hashToFiles.set(hashEntry.hash, existing);
    }
  }
  
  const duplicateGroups: DuplicateCheckResult['duplicateGroups'] = [];
  
  for (const [hash, files] of hashToFiles.entries()) {
    if (files.length <= 1) continue;
    
    const uniqueDisks = new Set(files.map(f => f.diskLabel).filter(d => d));
    const uniqueCases = new Set(files.map(f => f.caseNumber));
    
    const isCrossDisk = uniqueDisks.size > 1;
    const isCrossCase = uniqueCases.size > 1;
    
    if (isCrossDisk || isCrossCase) {
      duplicateGroups.push({
        hash,
        files: files.map(f => ({
          path: f.path,
          diskLabel: f.diskLabel,
          caseNumber: f.caseNumber,
          batchNumber: f.batchNumber
        }))
      });
      
      const diskInfo = uniqueDisks.size > 1 
        ? `涉及光盘: ${Array.from(uniqueDisks).join(', ')}` 
        : '';
      const caseInfo = uniqueCases.size > 1 
        ? `涉及案号: ${Array.from(uniqueCases).join(', ')}` 
        : '';
      
      issues.push(
        createIssue(
          files[0].caseNumber,
          RULES.DUPLICATE_FILE_ACROSS_DISKS.id,
          RULES.DUPLICATE_FILE_ACROSS_DISKS.name,
          RULES.DUPLICATE_FILE_ACROSS_DISKS.severity,
          RULES.DUPLICATE_FILE_ACROSS_DISKS.category,
          `发现重复文件 (${files.length}份): ${files[0].path.split(/[\\/]/).pop()}`,
          `哈希值: ${hash}\n${diskInfo}\n${caseInfo}\n重复文件列表:\n${files.map(f => `- ${f.diskLabel || '未知'}: ${f.path}`).join('\n')}`,
          files.map(f => f.path)
        )
      );
    }
  }
  
  return {
    issues,
    duplicateGroups
  };
}

function findHashForFile(
  entry: ManifestEntry,
  hashMap: Map<string, { hash: string; algorithm: string }>
): { hash: string; algorithm: string } | undefined {
  const possiblePaths = [
    entry.filePath,
    normalizePath(entry.filePath),
    entry.filePath.toLowerCase(),
    normalizePathForComparison(entry.filePath)
  ];
  
  for (const path of possiblePaths) {
    const hashEntry = hashMap.get(path);
    if (hashEntry) {
      return hashEntry;
    }
  }
  
  return undefined;
}

function normalizePath(path: string): string {
  return path.replace(/[\\/]+/g, '/').replace(/^[.\\/]+/, '');
}

function normalizePathForComparison(path: string): string {
  return normalizePath(path).toLowerCase();
}
