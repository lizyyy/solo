import RecordRepository from '../repositories/RecordRepository';
import AuditRepository from '../repositories/AuditRepository';
import ReviewRepository from '../repositories/ReviewRepository';
import ReconciliationService from './ReconciliationService';
import HolidayService from './HolidayService';
import { RecordStatus, ReviewCreate } from '../models';

class RecordService {
  getAllRecords() {
    return RecordRepository.findAll();
  }

  getRecordById(id: string) {
    return ReconciliationService.getRecordWithRelations(id);
  }

  getRecordsWithManualModifications() {
    return RecordRepository.findWithManualModifications();
  }

  getRecordsByFundCode(fundCode: string) {
    return RecordRepository.findByFundCode(fundCode);
  }

  markAsManualModification(
    id: string, 
    actualArrivalDate: string, 
    modifiedBy: string, 
    modificationReason: string
  ) {
    const record = RecordRepository.findById(id);
    if (!record) {
      throw new Error('记录不存在');
    }

    const oldValue = record.actualArrivalDate;
    
    RecordRepository.updateManualModification(id, actualArrivalDate, modifiedBy, modificationReason);
    ReconciliationService.autoGenerateReconciliationNote(id);

    AuditRepository.create({
      recordId: id,
      action: 'modify',
      fieldName: 'actual_arrival_date',
      oldValue,
      newValue: actualArrivalDate,
      reason: modificationReason,
      operator: modifiedBy,
      operatorRole: 'product_manager',
      affectedResults: '对账状态变为reviewing，触发基金经理复核，T+1→T+2修改标记，留待基金经理复核'
    });

    return this.getRecordById(id);
  }

  updateStatus(id: string, status: RecordStatus, operator: string) {
    const record = RecordRepository.findById(id);
    if (!record) {
      throw new Error('记录不存在');
    }

    const oldStatus = record.status;
    RecordRepository.updateStatus(id, status);

    AuditRepository.create({
      recordId: id,
      action: 'modify',
      fieldName: 'status',
      oldValue: oldStatus,
      newValue: status,
      reason: '更新记录状态',
      operator,
      operatorRole: 'product_manager',
      affectedResults: `记录状态从${oldStatus}变更为${status}`
    });

    return RecordRepository.findById(id);
  }

  reviewRecord(data: ReviewCreate) {
    const record = RecordRepository.findById(data.recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    const review = ReviewRepository.create(data);
    
    RecordRepository.updateStatus(data.recordId, data.status as RecordStatus);

    AuditRepository.create({
      recordId: data.recordId,
      action: 'review',
      reason: data.comment || '基金经理复核',
      operator: data.reviewer,
      operatorRole: 'fund_manager',
      affectedResults: `记录已${data.status === 'approved' ? '通过' : '驳回'}`
    });

    if (data.status === 'approved') {
      ReconciliationService.autoGenerateReconciliationNote(data.recordId);
    }

    return {
      review,
      record: this.getRecordById(data.recordId)
    };
  }

  getReviewHistory(recordId: string) {
    return ReviewRepository.findByRecordId(recordId);
  }

  importRecords(records: Array<{
    tradeDate: string;
    expectedArrivalDate?: string;
    actualArrivalDate: string;
    amount: number;
    fundCode: string;
    futuresCode: string;
  }>, operator: string) {
    const results = records.map(record => {
      const expectedDate = record.expectedArrivalDate || 
        HolidayService.calculateExpectedArrivalDate(record.tradeDate);
      
      return ReconciliationService.processImportRecord({
        ...record,
        expectedArrivalDate: expectedDate
      }, operator);
    });

    return {
      imported: results.length,
      hasManualModifications: results.filter(r => r.hasManualModification).length,
      records: results
    };
  }

  rerunReconciliation(id: string, operator: string) {
    return ReconciliationService.rerunReconciliation(id, operator);
  }
}

export default new RecordService();
