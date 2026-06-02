import selfCheckRepository from '../repositories/SelfCheckRepository.js';
import detailRepository from '../repositories/DetailRepository.js';
import snapshotRepository from '../repositories/SnapshotRepository.js';
import batchRepository from '../repositories/BatchRepository.js';
import fingerprintService from './FingerprintService.js';
import singleSourceService from './SingleSourceService.js';
import type { SelfCheckResult, CheckType, CheckStatus, DuplicateCheckResult } from '../../shared/types.js';
import db from '../db/index.js';

export class SelfCheckService {
  async runAllChecks(batchId: string, checkTypes?: CheckType[]): Promise<SelfCheckResult[]> {
    const types = checkTypes || ['DUPLICATE_IMPORT', 'MIXED_CURRENCY', 'RECALC_AFTER_SUPPLEMENT', 'EXPORT_CONSISTENCY'];
    
    selfCheckRepository.deleteByBatchId(batchId);
    
    const results: SelfCheckResult[] = [];
    
    for (const type of types) {
      let result: SelfCheckResult;
      switch (type) {
        case 'DUPLICATE_IMPORT':
          result = await this.checkDuplicateImport(batchId);
          break;
        case 'MIXED_CURRENCY':
          result = await this.checkMixedCurrency(batchId);
          break;
        case 'RECALC_AFTER_SUPPLEMENT':
          result = await this.checkRecalcAfterSupplement(batchId);
          break;
        case 'EXPORT_CONSISTENCY':
          result = await this.checkExportConsistency(batchId);
          break;
        default:
          continue;
      }
      results.push(result);
    }
    
    return results;
  }

  async checkDuplicateImport(batchId: string): Promise<SelfCheckResult> {
    const batch = batchRepository.findById(batchId);
    if (!batch) {
      return selfCheckRepository.create({
        batchId,
        checkType: 'DUPLICATE_IMPORT',
        status: 'FAIL',
        message: '批次不存在',
        affectedDetailIds: [],
        checkMetadata: {}
      });
    }

    const snapshots = snapshotRepository.findByBatchId(batchId);
    const affectedDetailIds: string[] = [];
    const duplicates: { batchNo: string; lineNo: number }[] = [];

    const fileHash = snapshots[0]?.fileHash;
    if (fileHash) {
      const existing = snapshotRepository.findByFileHash(fileHash);
      if (existing && existing.batchId !== batchId) {
        const existingBatch = batchRepository.findById(existing.batchId);
        if (existingBatch) {
          duplicates.push({ batchNo: existingBatch.batchNo, lineNo: -1 });
        }
      }
    }

    const details = detailRepository.findByBatchId(batchId);
    const fingerprints = details.map(d => d.dataFingerprint);
    
    if (fingerprints.length > 0) {
      const existingRecords = detailRepository.findByFingerprints(fingerprints);
      for (const record of existingRecords) {
        if (record.detail.batchId !== batchId) {
          if (!affectedDetailIds.includes(record.detail.id)) {
            affectedDetailIds.push(record.detail.id);
          }
          duplicates.push({ batchNo: record.batchNo, lineNo: record.detail.originalLineNo });
        }
      }
    }

    const isDuplicate = duplicates.length > 0;
    return selfCheckRepository.create({
      batchId,
      checkType: 'DUPLICATE_IMPORT',
      status: isDuplicate ? 'WARNING' : 'PASS',
      message: isDuplicate ? `检测到 ${duplicates.length} 条重复记录` : '未检测到重复导入',
      affectedDetailIds,
      checkMetadata: { duplicates, fileHash }
    });
  }

  async checkMixedCurrency(batchId: string): Promise<SelfCheckResult> {
    const details = detailRepository.findByBatchId(batchId);
    const mixedDetails = details.filter(d => d.hasMixedCurrency);
    const affectedDetailIds = mixedDetails.map(d => d.id);
    
    const mixedInfo = mixedDetails.map(d => ({
      detailId: d.id,
      originalLineNo: d.originalLineNo,
      policyNo: d.policyNo,
      currencyRaw: d.currencyRaw
    }));

    return selfCheckRepository.create({
      batchId,
      checkType: 'MIXED_CURRENCY',
      status: mixedDetails.length > 0 ? 'WARNING' : 'PASS',
      message: mixedDetails.length > 0 
        ? `检测到 ${mixedDetails.length} 条港币人民币同列记录，需托管对接人复核` 
        : '未检测到币种混列',
      affectedDetailIds,
      checkMetadata: { mixedRecords: mixedInfo }
    });
  }

  async checkRecalcAfterSupplement(batchId: string): Promise<SelfCheckResult> {
    const details = detailRepository.findByBatchId(batchId);
    const recalculationErrors: any[] = [];

    for (const detail of details) {
      if (detail.taxRate !== undefined) {
        const expectedNet = detail.commissionAmount * (1 - detail.taxRate) * detail.tierRate;
        const diff = Math.abs(detail.netAmount - expectedNet);
        if (diff > 0.01) {
          recalculationErrors.push({
            detailId: detail.id,
            originalLineNo: detail.originalLineNo,
            policyNo: detail.policyNo,
            storedNet: detail.netAmount,
            expectedNet,
            diff
          });
        }
      }
      if (detail.tierRate === 0 || detail.tierLevel === 0) {
        recalculationErrors.push({
          detailId: detail.id,
          originalLineNo: detail.originalLineNo,
          policyNo: detail.policyNo,
          issue: '阶梯费率或等级为0'
        });
      }
    }

    return selfCheckRepository.create({
      batchId,
      checkType: 'RECALC_AFTER_SUPPLEMENT',
      status: recalculationErrors.length > 0 ? 'FAIL' : 'PASS',
      message: recalculationErrors.length > 0 
        ? `补录后重算发现 ${recalculationErrors.length} 条计算异常` 
        : '补录后重算校验通过',
      affectedDetailIds: recalculationErrors.map(e => e.detailId),
      checkMetadata: { errors: recalculationErrors }
    });
  }

  async checkExportConsistency(batchId: string): Promise<SelfCheckResult> {
    const consistency = await singleSourceService.checkConsistency(batchId);
    
    return selfCheckRepository.create({
      batchId,
      checkType: 'EXPORT_CONSISTENCY',
      status: consistency.consistent ? 'PASS' : 'FAIL',
      message: consistency.consistent 
        ? '页面展示、API返回、导出文件三者一致' 
        : '检测到数据不一致，请检查',
      affectedDetailIds: [],
      checkMetadata: consistency
    });
  }

  getCheckResults(batchId: string): Promise<SelfCheckResult[]> {
    return Promise.resolve(selfCheckRepository.findByBatchId(batchId));
  }

  getLatestCheck(batchId: string, checkType: CheckType): Promise<SelfCheckResult | null> {
    return Promise.resolve(selfCheckRepository.findLatestByType(batchId, checkType));
  }
}

export default new SelfCheckService();
