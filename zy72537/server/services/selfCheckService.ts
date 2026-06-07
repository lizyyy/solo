import { v4 as uuidv4 } from 'uuid';
import { SelfCheckResult, SelfCheckType, SelfCheckStatus, CheckRecord, KnowledgeBaseReference } from '../../shared/types';
import { dataStore } from '../store/dataStore';

export class SelfCheckService {
  runAllChecks(
    sampleId: string,
    knowledgeRef?: KnowledgeBaseReference,
    previousVersion?: string
  ): SelfCheckResult[] {
    return [
      this.checkDuplicateImport(sampleId),
      this.checkModelVersionChange(sampleId, knowledgeRef, previousVersion),
      this.checkRecalcAfterSupplement(),
      this.checkExportConsistency(),
    ];
  }

  checkDuplicateImport(sampleId: string): SelfCheckResult {
    const isDuplicate = dataStore.isSampleImported(sampleId);
    return {
      type: 'duplicate_import',
      status: isDuplicate ? 'warning' : 'pass',
      message: isDuplicate ? `样本 ${sampleId} 已存在导入记录，可能是重复导入` : '无重复导入记录',
      details: { sampleId, isDuplicate },
      checkedAt: Date.now(),
    };
  }

  checkModelVersionChange(
    sampleId: string,
    knowledgeRef?: KnowledgeBaseReference,
    previousVersion?: string
  ): SelfCheckResult {
    if (!knowledgeRef) {
      return {
        type: 'model_version_changed',
        status: 'pending',
        message: '缺少知识库引用，无法检查模型版本',
        checkedAt: Date.now(),
      };
    }

    const currentVersion = knowledgeRef.modelVersion;
    const hasVersionChange = previousVersion && previousVersion !== currentVersion;

    if (hasVersionChange) {
      return {
        type: 'model_version_changed',
        status: 'warning',
        message: `模型版本从 ${previousVersion} 更新为 ${currentVersion}，但样本编号未变化`,
        details: {
          oldVersion: previousVersion,
          newVersion: currentVersion,
          sampleId,
          sampleIdUnchanged: true,
        },
        checkedAt: Date.now(),
      };
    }

    return {
      type: 'model_version_changed',
      status: 'pass',
      message: '模型版本与样本编号匹配',
      details: { currentVersion, sampleId },
      checkedAt: Date.now(),
    };
  }

  checkRecalcAfterSupplement(): SelfCheckResult {
    return {
      type: 'recalc_after_supplement',
      status: 'pending',
      message: '待补录后重算',
      checkedAt: Date.now(),
    };
  }

  markRecalcCompleted(): SelfCheckResult {
    return {
      type: 'recalc_after_supplement',
      status: 'pass',
      message: '补录后已重新计算',
      checkedAt: Date.now(),
    };
  }

  checkExportConsistency(): SelfCheckResult {
    return {
      type: 'export_consistency',
      status: 'pending',
      message: '导出一致性待检查',
      checkedAt: Date.now(),
    };
  }

  verifyExportConsistency(pageData: any[], exportData: any[]): SelfCheckResult {
    const isConsistent = JSON.stringify(pageData) === JSON.stringify(exportData);
    return {
      type: 'export_consistency',
      status: isConsistent ? 'pass' : 'error',
      message: isConsistent ? '导出数据与页面展示一致' : '导出数据与页面展示不一致，请检查',
      details: { pageDataLength: pageData.length, exportDataLength: exportData.length },
      checkedAt: Date.now(),
    };
  }

  getSelfCheckSummary(results: SelfCheckResult[]): {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
    pending: number;
  } {
    return {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      warnings: results.filter(r => r.status === 'warning').length,
      errors: results.filter(r => r.status === 'error').length,
      pending: results.filter(r => r.status === 'pending').length,
    };
  }

  hasModelVersionWarning(results: SelfCheckResult[]): boolean {
    return results.some(r => r.type === 'model_version_changed' && r.status === 'warning');
  }
}

export const selfCheckService = new SelfCheckService();
