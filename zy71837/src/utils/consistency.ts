import type { BattleRecord, ConsistencyCheckResult, FilterConditions } from '@/types';
import { generateDataFingerprint, generateFilterFingerprint } from './fingerprint';

export function checkConsistency(
  screenData: BattleRecord[],
  exportData: BattleRecord[],
  expectedFilterFingerprint: string,
  actualFilterConditions: FilterConditions
): ConsistencyCheckResult {
  const screenFingerprint = generateDataFingerprint(screenData);
  const exportFingerprint = generateDataFingerprint(exportData);
  const actualFilterFingerprint = generateFilterFingerprint(actualFilterConditions);
  
  const mismatchedRecords: string[] = [];
  
  if (screenData.length !== exportData.length) {
    screenData.forEach(s => {
      const match = exportData.find(e => e.id === s.id);
      if (!match) mismatchedRecords.push(`导出缺失: ${s.id} - ${s.playerName}`);
    });
    exportData.forEach(e => {
      const match = screenData.find(s => s.id === e.id);
      if (!match) mismatchedRecords.push(`导出多余: ${e.id} - ${e.playerName}`);
    });
  } else {
    const screenMap = new Map(screenData.map(r => [r.id, r]));
    exportData.forEach(e => {
      const s = screenMap.get(e.id);
      if (!s) {
        mismatchedRecords.push(`ID不匹配: ${e.id}`);
      } else {
        const sFp = generateDataFingerprint({ ...s, dataFingerprint: undefined, updatedAt: undefined });
        const eFp = generateDataFingerprint({ ...e, dataFingerprint: undefined, updatedAt: undefined });
        if (sFp !== eFp) {
          mismatchedRecords.push(`内容不匹配: ${e.id} - ${e.playerName}`);
        }
      }
    });
  }
  
  const filterFingerprintMatch = expectedFilterFingerprint === actualFilterFingerprint;
  
  return {
    passed: screenFingerprint === exportFingerprint && 
            screenData.length === exportData.length && 
            filterFingerprintMatch,
    details: {
      recordCountMatch: screenData.length === exportData.length,
      screenCount: screenData.length,
      exportCount: exportData.length,
      filterFingerprintMatch,
      mismatchedRecords
    }
  };
}

export function generateConsistencyReport(checkResult: ConsistencyCheckResult): string {
  const { passed, details } = checkResult;
  const lines: string[] = [];
  
  lines.push('=== 一致性校验报告 ===');
  lines.push(`校验结果: ${passed ? '通过' : '失败'}`);
  lines.push(`记录数量匹配: ${details.recordCountMatch ? '是' : '否'}`);
  lines.push(`屏幕显示数量: ${details.screenCount}`);
  lines.push(`导出数据数量: ${details.exportCount}`);
  lines.push(`筛选条件匹配: ${details.filterFingerprintMatch ? '是' : '否'}`);
  
  if (details.mismatchedRecords.length > 0) {
    lines.push('\n不匹配记录详情:');
    details.mismatchedRecords.forEach(r => lines.push(`  ${r}`));
  }
  
  lines.push(`\n生成时间: ${new Date().toISOString()}`);
  
  return lines.join('\n');
}
