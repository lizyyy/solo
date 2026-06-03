import AdjustmentRepository from '../repositories/AdjustmentRepository';
import RecordRepository from '../repositories/RecordRepository';
import AuditRepository from '../repositories/AuditRepository';
import ReconciliationService from './ReconciliationService';
import { TailAdjustmentCreate } from '../models';

class AdjustmentService {
  createAdjustment(data: TailAdjustmentCreate) {
    const record = RecordRepository.findById(data.recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    const adjustment = AdjustmentRepository.create(data);

    AuditRepository.create({
      recordId: data.recordId,
      action: 'adjust',
      reason: data.reason,
      operator: data.adjustedBy,
      operatorRole: 'product_manager',
      affectedResults: '对账说明自动更新，增加尾差调整说明'
    });

    if (adjustment.affectsReconciliation) {
      ReconciliationService.autoGenerateReconciliationNote(data.recordId);
    }

    return adjustment;
  }

  getAdjustmentsByRecordId(recordId: string) {
    return AdjustmentRepository.findByRecordId(recordId);
  }

  getAllAdjustments() {
    return AdjustmentRepository.findAll();
  }

  getAdjustmentWithRecordImpact(adjustmentId: string) {
    const adjustment = AdjustmentRepository.findById(adjustmentId);
    if (!adjustment) {
      throw new Error('尾差调整不存在');
    }

    const record = RecordRepository.findById(adjustment.recordId);
    if (!record) {
      return adjustment;
    }

    return {
      ...adjustment,
      recordSummary: {
        id: record.id,
        fundCode: record.fundCode,
        futuresCode: record.futuresCode,
        amount: record.amount,
        status: record.status
      },
      impactAnalysis: {
        originalAmount: record.amount,
        adjustedAmount: record.amount + adjustment.amount,
        reconciliationNoteUpdated: adjustment.affectsReconciliation
      }
    };
  }

  recalculateAffectedRecords() {
    const adjustments = AdjustmentRepository.findAll();
    const affectedRecordIds = new Set(adjustments.map(a => a.recordId));
    
    const results: { recordId: string; updated: boolean }[] = [];
    
    affectedRecordIds.forEach(recordId => {
      const record = RecordRepository.findById(recordId);
      if (record) {
        ReconciliationService.autoGenerateReconciliationNote(recordId);
        results.push({ recordId, updated: true });
      }
    });

    return results;
  }
}

export default new AdjustmentService();
