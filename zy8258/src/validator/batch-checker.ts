import { CaseInfo, ManifestEntry, Issue, RulesConfig } from '../types';
import { createIssue, RULES } from './issue-factory';

export interface BatchAppendCase {
  caseNumber: string;
  batchNumbers: string[];
  fileCounts: { batch: string; count: number }[];
}

export function checkBatchAppend(
  cases: CaseInfo[],
  manifestEntries: ManifestEntry[],
  rules: RulesConfig
): { issues: Issue[]; batchAppendCases: BatchAppendCase[] } {
  const issues: Issue[] = [];
  const batchAppendCases: BatchAppendCase[] = [];
  
  if (!rules.batchAppendCheck) {
    return { issues, batchAppendCases };
  }
  
  const caseToBatches = new Map<string, Set<string>>();
  const caseToBatchFiles = new Map<string, Map<string, ManifestEntry[]>>();
  
  for (const entry of manifestEntries) {
    const caseNumber = entry.caseNumber;
    const batchNumber = entry.batchNumber || 'B001';
    
    if (!caseToBatches.has(caseNumber)) {
      caseToBatches.set(caseNumber, new Set());
      caseToBatchFiles.set(caseNumber, new Map());
    }
    
    caseToBatches.get(caseNumber)!.add(batchNumber);
    
    const batchMap = caseToBatchFiles.get(caseNumber)!;
    if (!batchMap.has(batchNumber)) {
      batchMap.set(batchNumber, []);
    }
    batchMap.get(batchNumber)!.push(entry);
  }
  
  for (const caseInfo of cases) {
    const batches = caseToBatches.get(caseInfo.caseNumber);
    if (!batches) continue;
    
    const batchList = Array.from(batches).sort();
    
    if (batchList.length > 1) {
      const batchFiles = caseToBatchFiles.get(caseInfo.caseNumber)!;
      const fileCounts: BatchAppendCase['fileCounts'] = [];
      
      for (const batch of batchList) {
        fileCounts.push({
          batch,
          count: batchFiles.get(batch)?.length || 0
        });
      }
      
      batchAppendCases.push({
        caseNumber: caseInfo.caseNumber,
        batchNumbers: batchList,
        fileCounts
      });
      
      const totalFiles = fileCounts.reduce((sum, f) => sum + f.count, 0);
      
      issues.push(
        createIssue(
          caseInfo.caseNumber,
          RULES.BATCH_APPEND.id,
          RULES.BATCH_APPEND.name,
          RULES.BATCH_APPEND.severity,
          RULES.BATCH_APPEND.category,
          `同案号多批次追加: ${caseInfo.caseNumber}`,
          `该案件涉及 ${batchList.length} 个批次:\n` +
          fileCounts.map(f => `- 批次 ${f.batch}: ${f.count} 个文件`).join('\n') +
          `\n\n总计: ${totalFiles} 个文件\n` +
          `提示: 这是正常的批次追加操作，请确认所有批次文件完整`,
          []
        )
      );
    }
  }
  
  return { issues, batchAppendCases };
}

export function checkCaseBatchConsistency(
  cases: CaseInfo[],
  manifestEntries: ManifestEntry[]
): Issue[] {
  const issues: Issue[] = [];
  
  const caseBatchFromCases = new Map<string, string>();
  for (const caseInfo of cases) {
    if (caseInfo.batchNumber) {
      caseBatchFromCases.set(caseInfo.caseNumber, caseInfo.batchNumber);
    }
  }
  
  const caseBatchesFromManifest = new Map<string, Set<string>>();
  for (const entry of manifestEntries) {
    if (!caseBatchesFromManifest.has(entry.caseNumber)) {
      caseBatchesFromManifest.set(entry.caseNumber, new Set());
    }
    caseBatchesFromManifest.get(entry.caseNumber)!.add(entry.batchNumber || 'B001');
  }
  
  for (const [caseNumber, caseBatch] of caseBatchFromCases) {
    const manifestBatches = caseBatchesFromManifest.get(caseNumber);
    if (manifestBatches && !manifestBatches.has(caseBatch)) {
      issues.push(
        createIssue(
          caseNumber,
          RULES.BATCH_APPEND.id,
          RULES.BATCH_APPEND.name,
          'warning',
          RULES.BATCH_APPEND.category,
          `批次信息不一致: ${caseNumber}`,
          `cases.csv 中记录批次: ${caseBatch}\n` +
          `manifest.jsonl 中实际批次: ${Array.from(manifestBatches).join(', ')}`,
          []
        )
      );
    }
  }
  
  return issues;
}
