import { dataStore } from '../store/DataStore';
import { ConflictEvidence, ConflictType, PensionFundSwapRecord } from '../types';

export interface BatchEmailExtractionResult {
  businessNo: string;
  amount: number;
  tradeDate: string;
  fundCode: string;
}

export class ConflictDetectionService {
  extractFromEmailContent(emailContent: string): BatchEmailExtractionResult | null {
    const businessNoMatch = emailContent.match(/业务号[：:]\s*(\w+)/);
    const amountMatch = emailContent.match(/金额[：:]\s*([\d.]+)/);
    const dateMatch = emailContent.match(/交易日期[：:]\s*(\d{4}-\d{2}-\d{2})/);
    const fundMatch = emailContent.match(/基金代码[：:]\s*(\w+)/);

    if (!businessNoMatch) return null;

    return {
      businessNo: businessNoMatch[1],
      amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
      tradeDate: dateMatch ? dateMatch[1] : '',
      fundCode: fundMatch ? fundMatch[1] : ''
    };
  }

  extractFromBatchNo(batchNo: string): BatchEmailExtractionResult | null {
    const match = batchNo.match(/^(\w+)-(\d{8})-(\w+)-([\d.]+)/);
    if (!match) return null;

    return {
      businessNo: match[1],
      amount: parseFloat(match[4]),
      tradeDate: match[2].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
      fundCode: match[3]
    };
  }

  detectBatchEmailMismatch(
    record: PensionFundSwapRecord
  ): ConflictEvidence | null {
    if (!record.settlementBatchNo) return null;

    const emailData = this.extractFromEmailContent(record.managerEmailContent);
    const batchData = this.extractFromBatchNo(record.settlementBatchNo);

    if (!emailData || !batchData) return null;

    const mismatches: string[] = [];

    if (emailData.businessNo !== batchData.businessNo) {
      mismatches.push(`业务号不一致：邮件=${emailData.businessNo}, 清算批次=${batchData.businessNo}`);
    }

    if (Math.abs(emailData.amount - batchData.amount) > 0.01) {
      mismatches.push(`金额不一致：邮件=${emailData.amount}, 清算批次=${batchData.amount}`);
    }

    if (emailData.tradeDate !== batchData.tradeDate) {
      mismatches.push(`交易日期不一致：邮件=${emailData.tradeDate}, 清算批次=${batchData.tradeDate}`);
    }

    if (emailData.fundCode !== batchData.fundCode) {
      mismatches.push(`基金代码不一致：邮件=${emailData.fundCode}, 清算批次=${batchData.fundCode}`);
    }

    if (mismatches.length === 0) return null;

    return {
      id: '',
      conflictType: 'BATCH_EMAIL_MISMATCH',
      description: `清算批次号与邮件内容冲突：${mismatches.join('; ')}`,
      emailSource: record.managerEmailSource,
      batchSource: record.settlementBatchNo,
      emailValue: JSON.stringify(emailData),
      batchValue: JSON.stringify(batchData),
      detectedAt: ''
    };
  }

  detectDuplicateImport(
    emailSource: string,
    businessNo: string,
    excludeRecordId?: string
  ): ConflictEvidence | null {
    const existingRecords = dataStore.getRecordsByEmailSource(emailSource);
    const sameBusinessNo = existingRecords.filter(r =>
      r.businessNo === businessNo && r.id !== excludeRecordId
    );

    if (sameBusinessNo.length === 0) return null;

    return {
      id: '',
      conflictType: 'DUPLICATE_IMPORT',
      description: `检测到重复导入：邮件来源 ${emailSource}，业务号 ${businessNo} 已有 ${sameBusinessNo.length} 条其他记录`,
      emailSource,
      batchSource: null,
      emailValue: businessNo,
      batchValue: null,
      detectedAt: ''
    };
  }

  detectSplitLineMismatch(
    record: PensionFundSwapRecord
  ): ConflictEvidence | null {
    const principalLines = record.lines.filter(l => l.lineType === 'PRINCIPAL');
    const feeLines = record.lines.filter(l => l.lineType === 'FEE');

    if (principalLines.length === 0 || feeLines.length === 0) return null;

    if (principalLines.length !== feeLines.length) {
      return {
        id: '',
        conflictType: 'SPLIT_LINE_AMOUNT_MISMATCH',
        description: `拆分行数量不匹配：本金行 ${principalLines.length} 条，手续费行 ${feeLines.length} 条`,
        emailSource: record.managerEmailSource,
        batchSource: record.settlementBatchNo || null,
        emailValue: `principalCount=${principalLines.length}, feeCount=${feeLines.length}`,
        batchValue: null,
        detectedAt: ''
      };
    }

    return null;
  }

  detectAllConflicts(recordId: string): ConflictEvidence[] {
    const record = dataStore.getRecord(recordId);
    if (!record) return [];

    const conflicts: ConflictEvidence[] = [];

    const batchMismatch = this.detectBatchEmailMismatch(record);
    if (batchMismatch) {
      const saved = dataStore.addConflict(recordId, batchMismatch);
      conflicts.push(saved);
    }

    const splitMismatch = this.detectSplitLineMismatch(record);
    if (splitMismatch) {
      const saved = dataStore.addConflict(recordId, splitMismatch);
      conflicts.push(saved);
    }

    const duplicateConflict = this.detectDuplicateImport(
      record.managerEmailSource,
      record.businessNo,
      record.id
    );
    if (duplicateConflict) {
      const saved = dataStore.addConflict(recordId, duplicateConflict);
      conflicts.push(saved);
    }

    if (conflicts.length > 0) {
      dataStore.updateRecord(recordId, { status: 'CONFLICT_DETECTED' });
    }

    return conflicts;
  }

  resolveConflict(
    recordId: string,
    conflictId: string,
    resolution: 'CONFIRM_EMAIL' | 'CONFIRM_BATCH' | 'REJECT_BOTH',
    resolvedBy: string
  ): ConflictEvidence | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    const conflict = record.conflicts.find(c => c.id === conflictId);
    if (!conflict || conflict.resolvedAt) return null;

    const resolvedConflict: ConflictEvidence = {
      ...conflict,
      resolvedAt: new Date().toISOString(),
      resolution,
      resolvedBy
    };

    const updatedConflicts = record.conflicts.map(c =>
      c.id === conflictId ? resolvedConflict : c
    );

    const allResolved = updatedConflicts.every(c => c.resolvedAt);

    dataStore.updateRecord(recordId, {
      conflicts: updatedConflicts,
      status: allResolved ? 'CONFLICT_RESOLVED' : record.status
    });

    return resolvedConflict;
  }

  getUnresolvedConflicts(recordId: string): ConflictEvidence[] {
    const record = dataStore.getRecord(recordId);
    if (!record) return [];
    return record.conflicts.filter(c => !c.resolvedAt);
  }
}

export const conflictDetectionService = new ConflictDetectionService();
