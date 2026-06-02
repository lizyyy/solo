import type { SelfCheckResult, SelfCheckType, SelfCheckDetail, CreditRecord } from '../../shared/types';
import { unifiedResultRepository } from '../repositories/unifiedResultRepository';
import crypto from 'crypto';

class SelfCheckService {
  private checkNames: Record<SelfCheckType, string> = {
    duplicate_import: '重复导入检测',
    name_inconsistency: '机构简称一致性检测',
    recalculation: '补录后重算验证',
    export_consistency: '导出一致性校验'
  };

  async runAllChecks(): Promise<SelfCheckResult[]> {
    const checks: SelfCheckType[] = ['duplicate_import', 'name_inconsistency', 'recalculation', 'export_consistency'];
    return Promise.all(checks.map(check => this.runCheck(check)));
  }

  async runCheck(checkType: SelfCheckType): Promise<SelfCheckResult> {
    const runTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    switch (checkType) {
      case 'duplicate_import':
        return this.checkDuplicateImport(runTime);
      case 'name_inconsistency':
        return this.checkNameInconsistency(runTime);
      case 'recalculation':
        return this.checkRecalculation(runTime);
      case 'export_consistency':
        return this.checkExportConsistency(runTime);
    }
  }

  private checkDuplicateImport(runTime: string): SelfCheckResult {
    const { records } = unifiedResultRepository.getAllRecords();
    const details: SelfCheckDetail[] = [];
    
    const seenKeys = new Map<string, string[]>();
    
    records.forEach(record => {
      const key = `${record.institutionCode}-${record.custodianData.confirmDate}`;
      const existing = seenKeys.get(key) || [];
      existing.push(record.id);
      seenKeys.set(key, existing);
    });

    seenKeys.forEach((recordIds, key) => {
      if (recordIds.length > 1) {
        const record = records.find(r => r.id === recordIds[0]);
        details.push({
          recordId: recordIds[0],
          institutionCode: record?.institutionCode,
          message: `检测到重复导入记录 ${recordIds.length} 条，机构代码+确认日期: ${key}`,
          severity: 'high'
        });
      }
    });

    return {
      checkType: 'duplicate_import',
      checkName: this.checkNames.duplicate_import,
      status: details.length > 0 ? 'error' : 'pass',
      total: records.length,
      abnormal: details.length,
      details,
      runTime
    };
  }

  private checkNameInconsistency(runTime: string): SelfCheckResult {
    const { records } = unifiedResultRepository.getAllRecords();
    const details: SelfCheckDetail[] = [];

    records.forEach(record => {
      if (!record.nameConsistent) {
        details.push({
          recordId: record.id,
          institutionCode: record.institutionCode,
          message: `机构简称前后不一致: "${record.institutionNamePrev}" → "${record.institutionNameCurrent}"`,
          severity: 'medium'
        });
      }
    });

    return {
      checkType: 'name_inconsistency',
      checkName: this.checkNames.name_inconsistency,
      status: details.length > 0 ? 'warning' : 'pass',
      total: records.length,
      abnormal: details.length,
      details,
      runTime
    };
  }

  private checkRecalculation(runTime: string): SelfCheckResult {
    const { records } = unifiedResultRepository.getAllRecords();
    const details: SelfCheckDetail[] = [];

    records.forEach(record => {
      const expectedAvailable = record.creditLine - record.occupiedAmount;
      
      if (Math.abs(expectedAvailable - record.availableAmount) > 0.01) {
        details.push({
          recordId: record.id,
          institutionCode: record.institutionCode,
          message: `额度计算不一致: 授信(${this.formatAmount(record.creditLine)}) - 已占用(${this.formatAmount(record.occupiedAmount)}) = ${this.formatAmount(expectedAvailable)}，但实际可用为${this.formatAmount(record.availableAmount)}`,
          severity: 'high'
        });
      }
    });

    return {
      checkType: 'recalculation',
      checkName: this.checkNames.recalculation,
      status: details.length > 0 ? 'error' : 'pass',
      total: records.length,
      abnormal: details.length,
      details,
      runTime
    };
  }

  private checkExportConsistency(runTime: string): SelfCheckResult {
    const { records, dataHash } = unifiedResultRepository.getAllRecords();
    const details: SelfCheckDetail[] = [];

    const exportData = this.prepareExportData(records);
    const exportHash = crypto
      .createHash('md5')
      .update(JSON.stringify(exportData))
      .digest('hex');
    
    const pageData = records.map(r => ({
      id: r.id,
      institutionCode: r.institutionCode,
      creditLine: r.creditLine,
      occupiedAmount: r.occupiedAmount,
      availableAmount: r.availableAmount,
      status: r.status
    }));
    const pageHash = crypto
      .createHash('md5')
      .update(JSON.stringify(pageData))
      .digest('hex');

    const currentHash = unifiedResultRepository.getDataHash();
    
    if (dataHash !== currentHash) {
      details.push({
        message: `数据源哈希不一致: 记录列表哈希=${dataHash}，当前数据哈希=${currentHash}`,
        severity: 'high'
      });
    }

    if (exportHash !== pageHash) {
      details.push({
        message: `导出数据与页面展示哈希不一致: 导出哈希=${exportHash}，页面哈希=${pageHash}`,
        severity: 'high'
      });
    }

    return {
      checkType: 'export_consistency',
      checkName: this.checkNames.export_consistency,
      status: details.length > 0 ? 'error' : 'pass',
      total: 2,
      abnormal: details.length,
      details,
      runTime
    };
  }

  private formatAmount(amount: number): string {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(2)}亿`;
    } else if (amount >= 10000) {
      return `${(amount / 10000).toFixed(2)}万`;
    }
    return amount.toFixed(2);
  }

  private prepareExportData(records: CreditRecord[]) {
    return records.map(r => ({
      id: r.id,
      institutionCode: r.institutionCode,
      creditLine: r.creditLine,
      occupiedAmount: r.occupiedAmount,
      availableAmount: r.availableAmount,
      status: r.status
    }));
  }
}

export const selfCheckService = new SelfCheckService();
