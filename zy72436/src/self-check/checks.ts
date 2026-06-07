import { dataStore } from '../store/data-store';
import { SelfCheckResult } from '../types';
import { getAllTicketRowViews, getExportRows } from '../unified-output/data-layer';

export function checkDuplicateImport(): SelfCheckResult {
  const batches = dataStore.getAllImportBatches();
  const seenHashes = new Set<string>();
  const duplicates: string[] = [];
  
  for (const batch of batches) {
    if (seenHashes.has(batch.fileHash)) {
      duplicates.push(batch.id);
    }
    seenHashes.add(batch.fileHash);
  }
  
  const allRows = dataStore.getAllTicketRows();
  const keySet = new Set<string>();
  const duplicateRows: string[] = [];
  
  for (const row of allRows) {
    const key = `${row.studentName}-${row.instrument}-${row.trackId}`;
    if (keySet.has(key)) {
      duplicateRows.push(row.id);
    }
    keySet.add(key);
  }
  
  const passed = duplicates.length === 0 && duplicateRows.length === 0;
  
  return {
    checkName: '重复导入检测',
    passed,
    message: passed 
      ? '无重复导入的批次和记录' 
      : `发现 ${duplicates.length} 个重复批次，${duplicateRows.length} 条重复记录`,
    details: { duplicateBatches: duplicates, duplicateRows },
  };
}

export function checkReworkReasonTracked(): SelfCheckResult {
  const allRows = dataStore.getAllTicketRows();
  const rowsWithRework: Array<{ rowId: string; trackId: string; studentName: string }> = [];
  const rowsMissingRetainReason: Array<{ rowId: string; remarkId: string }> = [];
  
  for (const row of allRows) {
    const reworkRemarks = row.trackRemarks.filter(r => r.isReworkReason);
    if (reworkRemarks.length > 0) {
      rowsWithRework.push({
        rowId: row.id,
        trackId: row.trackId,
        studentName: row.studentName,
      });
      
      for (const remark of reworkRemarks) {
        if (!remark.retainReason || !remark.retainedBy) {
          rowsMissingRetainReason.push({ rowId: row.id, remarkId: remark.id });
        }
      }
    }
  }
  
  const passed = rowsMissingRetainReason.length === 0;
  
  return {
    checkName: '返工原因记录完整性',
    passed,
    message: passed
      ? `共 ${rowsWithRework.length} 条含返工原因的记录，均保留了理由`
      : `发现 ${rowsMissingRetainReason.length} 条返工原因未保留理由`,
    details: { rowsWithRework, rowsMissingRetainReason },
  };
}

export function checkRecalculationConsistency(): SelfCheckResult {
  const allRows = dataStore.getAllTicketRows();
  const inconsistent: Array<{ rowId: string; storedClass?: string; expectedClass: string }> = [];
  
  for (const row of allRows) {
    const result = dataStore.getClassificationResult(row.trackId);
    if (result && row.currentClass !== result.className) {
      inconsistent.push({
        rowId: row.id,
        storedClass: row.currentClass,
        expectedClass: result.className,
      });
    }
  }
  
  const passed = inconsistent.length === 0;
  
  return {
    checkName: '补录重算一致性',
    passed,
    message: passed
      ? '所有记录分班结果与重算结果一致'
      : `发现 ${inconsistent.length} 条记录分班结果不一致`,
    details: { inconsistent },
  };
}

export function checkExportConsistency(): SelfCheckResult {
  const apiViews = getAllTicketRowViews();
  const exportRows = getExportRows();
  
  if (apiViews.length !== exportRows.length) {
    return {
      checkName: '导出一致性',
      passed: false,
      message: `接口返回 ${apiViews.length} 条，导出 ${exportRows.length} 条，数量不一致`,
      details: { apiCount: apiViews.length, exportCount: exportRows.length },
    };
  }
  
  const mismatches: Array<{ rowIndex: number; field: string; apiValue: string; exportValue: string }> = [];
  
  for (let i = 0; i < apiViews.length; i++) {
    const api = apiViews[i];
    const exp = exportRows[i];
    
    if (String(api.originalRowNumber) !== exp['原始行号']) {
      mismatches.push({ rowIndex: i, field: '原始行号', apiValue: String(api.originalRowNumber), exportValue: exp['原始行号'] });
    }
    if (api.studentName !== exp['学生姓名']) {
      mismatches.push({ rowIndex: i, field: '学生姓名', apiValue: api.studentName, exportValue: exp['学生姓名'] });
    }
    if (api.hasReworkReason !== (exp['含返工原因'] === '是')) {
      mismatches.push({ rowIndex: i, field: '含返工原因', apiValue: String(api.hasReworkReason), exportValue: exp['含返工原因'] });
    }
  }
  
  const passed = mismatches.length === 0;
  
  return {
    checkName: '导出一致性',
    passed,
    message: passed
      ? '页面展示、接口返回、导出数据完全一致'
      : `发现 ${mismatches.length} 处字段不一致`,
    details: { mismatches },
  };
}

export function runAllChecks(): SelfCheckResult[] {
  return [
    checkDuplicateImport(),
    checkReworkReasonTracked(),
    checkRecalculationConsistency(),
    checkExportConsistency(),
  ];
}

export function printCheckResults(results: SelfCheckResult[]): void {
  console.log('\n========== 音乐夏令营分班 自检报告 ==========\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const status = result.passed ? '✅ 通过' : '❌ 失败';
    console.log(`${status} - ${result.checkName}`);
    console.log(`   ${result.message}`);
    if (!result.passed && result.details) {
      console.log(`   详情: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log('');
    
    if (result.passed) passed++;
    else failed++;
  }
  
  console.log(`总计: ${passed + failed} 项检查，通过 ${passed} 项，失败 ${failed} 项`);
  console.log('==============================================\n');
}
