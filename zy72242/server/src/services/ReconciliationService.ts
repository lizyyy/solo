import RecordRepository from '../repositories/RecordRepository';
import AdjustmentRepository from '../repositories/AdjustmentRepository';
import AuditRepository from '../repositories/AuditRepository';
import ReviewRepository from '../repositories/ReviewRepository';
import HolidayService from './HolidayService';
import { ReconciliationNoteUpdate, ReconciliationRecordWithRelations, ImportRecord } from '../models';
import { parseISO, differenceInDays, format } from 'date-fns';

class ReconciliationService {
  generateReconciliationNote(
    record: {
      id: string;
      tradeDate: string;
      expectedArrivalDate: string;
      actualArrivalDate: string;
      amount: number;
      fundCode: string;
      futuresCode: string;
      hasManualModification: boolean;
      modificationType?: string;
      modifiedBy?: string;
      modificationReason?: string;
    },
    hasAdjustments: boolean
  ): { whyKept: string; missingMaterials: string; nextAction: string } {
    const whyKeptParts: string[] = [];
    const missingMaterials: string[] = [];
    const nextActionParts: string[] = [];

    const expected = parseISO(record.expectedArrivalDate);
    const actual = parseISO(record.actualArrivalDate);
    const delayDays = differenceInDays(actual, expected);

    const holidayExplanation = HolidayService.getHolidayExplanation(
      record.expectedArrivalDate,
      record.actualArrivalDate
    );

    if (record.hasManualModification) {
      if (record.modificationType === 't1_to_t2') {
        whyKeptParts.push(`T+1到账（${record.expectedArrivalDate}）被手工修改为T+2（${record.actualArrivalDate}），延迟${delayDays}天`);
        if (holidayExplanation) {
          whyKeptParts.push(holidayExplanation);
        }
        if (record.modificationReason) {
          whyKeptParts.push(`修改原因：${record.modificationReason}`);
        }
        if (record.modifiedBy) {
          whyKeptParts.push(`修改人：${record.modifiedBy}`);
        }
        missingMaterials.push('银行交割凭证');
        missingMaterials.push('支付平台流水单');
        missingMaterials.push('修改授权确认书');
        nextActionParts.push('请基金经理复核T+1→T+2修改原因，不急着归正常');
        nextActionParts.push('确认后联系支付平台产品阿南');
      } else {
        whyKeptParts.push(`存在人工修改记录，${record.modificationReason || '原因待查'}`);
        if (record.modifiedBy) {
          whyKeptParts.push(`修改人：${record.modifiedBy}`);
        }
        nextActionParts.push('请联系支付平台产品阿南核实修改原因');
      }
    } else {
      if (delayDays > 0) {
        whyKeptParts.push(`到账延迟${delayDays}天`);
        if (holidayExplanation) {
          whyKeptParts.push(holidayExplanation);
          whyKeptParts.push('延迟属于正常节假日顺延');
          nextActionParts.push('无需处理，自动标记为正常');
        } else {
          whyKeptParts.push('延迟原因待查');
          missingMaterials.push('到账延迟说明');
          nextActionParts.push('请联系支付平台产品阿南核实延迟原因');
        }
      } else {
        whyKeptParts.push('正常到账，无需特殊处理');
        nextActionParts.push('无需处理');
      }
    }

    if (hasAdjustments) {
      whyKeptParts.push('已补录尾差调整条');
    }

    return {
      whyKept: whyKeptParts.join('；'),
      missingMaterials: missingMaterials.join('、'),
      nextAction: nextActionParts.join('；')
    };
  }

  autoGenerateReconciliationNote(recordId: string): { whyKept: string; missingMaterials: string; nextAction: string } {
    const record = RecordRepository.findById(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    const adjustments = AdjustmentRepository.findByRecordId(recordId);
    const hasAdjustments = adjustments.length > 0;

    const note = this.generateReconciliationNote(record, hasAdjustments);

    RecordRepository.updateReconciliationNote(recordId, {
      whyKept: note.whyKept,
      missingMaterials: note.missingMaterials,
      nextAction: note.nextAction,
      updatedBy: '系统'
    });

    AuditRepository.create({
      recordId,
      action: 'modify',
      fieldName: 'reconciliation_note',
      oldValue: record.whyKept,
      newValue: note.whyKept,
      reason: '自动更新对账说明',
      operator: '系统',
      operatorRole: 'system',
      affectedResults: '对账说明同步更新'
    });

    return note;
  }

  updateReconciliationNote(recordId: string, note: ReconciliationNoteUpdate) {
    const record = RecordRepository.findById(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    RecordRepository.updateReconciliationNote(recordId, note);

    AuditRepository.create({
      recordId,
      action: 'modify',
      fieldName: 'reconciliation_note',
      oldValue: record.whyKept,
      newValue: note.whyKept,
      reason: '人工更新对账说明',
      operator: note.updatedBy,
      operatorRole: 'product_manager',
      affectedResults: '对账说明已更新，等待基金经理复核'
    });
  }

  processImportRecord(importRecord: ImportRecord, operator: string) {
    const expectedDate = HolidayService.calculateExpectedArrivalDate(importRecord.tradeDate);
    const hasManualModification = HolidayService.isDateManualModified(expectedDate, importRecord.actualArrivalDate);
    const isT1ToT2 = HolidayService.detectT1ToT2Modification(expectedDate, importRecord.actualArrivalDate);

    const adjustments = AdjustmentRepository.findByRecordId('temp');
    const tempRecord = {
      ...importRecord,
      id: 'temp',
      hasManualModification,
      modificationType: isT1ToT2 ? 't1_to_t2' as const : undefined,
      modifiedBy: operator,
      modificationReason: hasManualModification ? '导入时检测到人工修改' : undefined
    };

    const note = this.generateReconciliationNote(tempRecord, adjustments.length > 0);

    const record = RecordRepository.create({
      ...importRecord,
      expectedArrivalDate: expectedDate,
      hasManualModification,
      modificationType: isT1ToT2 ? 't1_to_t2' : undefined,
      modifiedBy: hasManualModification ? operator : undefined,
      modificationReason: hasManualModification ? '导入时检测到人工修改' : undefined,
      whyKept: note.whyKept,
      missingMaterials: note.missingMaterials,
      nextAction: note.nextAction
    });

    AuditRepository.create({
      recordId: record.id,
      action: 'import',
      reason: '导入交割数据',
      operator,
      operatorRole: 'product_manager',
      affectedResults: '预期到账日、金额、基金代码、对账说明已生成'
    });

    if (hasManualModification) {
      AuditRepository.create({
        recordId: record.id,
        action: 'modify',
        fieldName: 'actual_arrival_date',
        oldValue: expectedDate,
        newValue: importRecord.actualArrivalDate,
        reason: '导入时检测到人工修改到账日',
        operator,
        operatorRole: 'product_manager',
        affectedResults: '对账状态变为reviewing，触发基金经理复核'
      });
    }

    return record;
  }

  getRecordWithRelations(recordId: string): ReconciliationRecordWithRelations | null {
    const record = RecordRepository.findById(recordId);
    if (!record) return null;

    const adjustments = AdjustmentRepository.findByRecordId(recordId);
    const auditLogs = AuditRepository.findByRecordId(recordId);
    const reviews = ReviewRepository.findByRecordId(recordId);

    return {
      ...record,
      adjustments,
      auditLogs,
      reviews
    };
  }

  rerunReconciliation(recordId: string, operator: string) {
    const record = RecordRepository.findById(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    const newExpectedDate = HolidayService.calculateExpectedArrivalDate(record.tradeDate);
    const hasManualModification = HolidayService.isDateManualModified(newExpectedDate, record.actualArrivalDate);
    const isT1ToT2 = HolidayService.detectT1ToT2Modification(newExpectedDate, record.actualArrivalDate);

    const adjustments = AdjustmentRepository.findByRecordId(recordId);
    const note = this.generateReconciliationNote(
      {
        ...record,
        expectedArrivalDate: newExpectedDate,
        hasManualModification,
        modificationType: isT1ToT2 ? 't1_to_t2' : undefined,
      },
      adjustments.length > 0
    );

    RecordRepository.updateReconciliationNote(recordId, {
      whyKept: note.whyKept,
      missingMaterials: note.missingMaterials,
      nextAction: note.nextAction,
      updatedBy: operator
    });

    AuditRepository.create({
      recordId,
      action: 'rerun',
      fieldName: 'reconciliation',
      oldValue: record.whyKept,
      newValue: note.whyKept,
      reason: '重跑对账逻辑',
      operator,
      operatorRole: 'product_manager',
      affectedResults: '对账说明已重新生成'
    });

    return this.getRecordWithRelations(recordId);
  }
}

export default new ReconciliationService();
