import { dataStore } from '../store/DataStore';
import {
  RecordStatus,
  OperationType,
  AppointmentRecord,
  ChildProfile,
  VaccineInventory
} from '../types';

export class BusinessService {
  validateVaccinationInterval(childId: string, vaccineCode: string, appointmentDate: string): { valid: boolean; reason?: string } {
    const child = dataStore.getChildProfileById(childId);
    if (!child) {
      return { valid: true };
    }

    const lastVaccination = child.vaccineHistory
      .filter(v => v.vaccineCode === vaccineCode)
      .sort((a, b) => new Date(b.vaccinationDate).getTime() - new Date(a.vaccinationDate).getTime())[0];

    if (lastVaccination) {
      const inventory = dataStore.getVaccineInventories().find(v => v.vaccineCode === vaccineCode);
      const intervalDays = inventory?.intervalDays || 30;
      const lastDate = new Date(lastVaccination.vaccinationDate);
      const apptDate = new Date(appointmentDate);
      const diffDays = Math.floor((apptDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < intervalDays) {
        return {
          valid: false,
          reason: `与上一次接种间隔不足 ${intervalDays} 天，当前间隔 ${diffDays} 天`
        };
      }
    }

    return { valid: true };
  }

  validateAge(childId: string, vaccineCode: string): { valid: boolean; reason?: string } {
    const child = dataStore.getChildProfileById(childId);
    if (!child) {
      return { valid: true };
    }

    const birthDate = new Date(child.birthDate);
    const now = new Date();
    const ageMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());

    const inventory = dataStore.getVaccineInventories().find(v => v.vaccineCode === vaccineCode);
    const minimumAgeMonths = inventory?.minimumAgeMonths || 0;

    if (ageMonths < minimumAgeMonths) {
      return {
        valid: false,
        reason: `年龄不足，最小接种月龄为 ${minimumAgeMonths} 个月，当前 ${ageMonths} 个月`
      };
    }

    return { valid: true };
  }

  checkContraindications(childId: string, vaccineCode: string): { blocked: boolean; reasons: string[] } {
    const child = dataStore.getChildProfileById(childId);
    const rules = dataStore.getContraindicationRulesByVaccineCode(vaccineCode);
    const reasons: string[] = [];

    if (!child) {
      return { blocked: false, reasons };
    }

    const childConditions = child.healthConditions.map(c => c.toLowerCase());

    for (const rule of rules) {
      const ruleCondition = rule.condition.toLowerCase();
      const ruleDesc = rule.description.toLowerCase();
      
      const conditionMatch = childConditions.some(c => 
        c.includes(ruleCondition) || 
        ruleCondition.includes(c) ||
        ruleDesc.includes(c) ||
        c.length > 0 && ruleDesc.split('').filter(ch => c.includes(ch)).length > c.length * 0.5
      );

      if (conditionMatch && rule.severity === 'high') {
        reasons.push(`禁忌匹配: ${rule.condition} - ${rule.description}`);
      } else if (conditionMatch && rule.severity === 'medium') {
        reasons.push(`注意事项: ${rule.condition} - ${rule.description}（需进一步确认）`);
      }
    }

    const blocked = reasons.some(r => r.startsWith('禁忌匹配'));

    return {
      blocked,
      reasons
    };
  }

  checkDuplicateAppointment(childId: string, vaccineCode: string, batchId: string, excludeRecordId?: string): { duplicate: boolean; reason?: string } {
    const existingRecords = dataStore.getAppointmentRecordsByChildId(childId);
    const duplicate = existingRecords.some(
      r => r.vaccineCode === vaccineCode &&
           r.batchId === batchId &&
           r.status !== RecordStatus.REJECTED &&
           r.id !== excludeRecordId
    );

    if (duplicate) {
      return {
        duplicate: true,
        reason: '该儿童在本批次中已有预约记录'
      };
    }

    return { duplicate: false };
  }

  processAppointmentRecord(recordId: string, operator: string): { success: boolean; record?: AppointmentRecord; reason?: string } {
    const record = dataStore.getAppointmentRecordById(recordId);
    if (!record) {
      return { success: false, reason: '记录不存在' };
    }

    if (record.status !== RecordStatus.PENDING && record.status !== RecordStatus.RETURNED) {
      return { success: false, reason: '当前状态不允许处理' };
    }

    const previousStatus = record.status;

    const contraindicationCheck = this.checkContraindications(record.childId, record.vaccineCode);
    if (contraindicationCheck.blocked) {
      const blockReasons = contraindicationCheck.reasons.filter(r => r.startsWith('禁忌匹配'));
      dataStore.updateAppointmentRecord(recordId, {
        status: RecordStatus.REJECTED,
        blockReason: blockReasons.join('; '),
        processedBy: operator,
        processedAt: new Date().toISOString()
      });
      dataStore.addOperationLog(recordId, {
        operationType: OperationType.CONTRAINDICATION_BLOCK,
        operator,
        reason: blockReasons.join('; '),
        previousStatus,
        newStatus: RecordStatus.REJECTED
      });
      return { success: true, record: dataStore.getAppointmentRecordById(recordId) };
    }

    const precautionNotes = contraindicationCheck.reasons.filter(r => r.startsWith('注意事项'));

    const duplicateCheck = this.checkDuplicateAppointment(record.childId, record.vaccineCode, record.batchId, record.id);
    if (duplicateCheck.duplicate) {
      dataStore.updateAppointmentRecord(recordId, {
        status: RecordStatus.REJECTED,
        blockReason: duplicateCheck.reason,
        processedBy: operator,
        processedAt: new Date().toISOString()
      });
      dataStore.addOperationLog(recordId, {
        operationType: OperationType.DUPLICATE_BLOCK,
        operator,
        reason: duplicateCheck.reason,
        previousStatus,
        newStatus: RecordStatus.REJECTED
      });
      return { success: true, record: dataStore.getAppointmentRecordById(recordId) };
    }

    const intervalCheck = this.validateVaccinationInterval(record.childId, record.vaccineCode, record.appointmentDate);
    if (!intervalCheck.valid) {
      dataStore.updateAppointmentRecord(recordId, {
        status: RecordStatus.RETURNED,
        blockReason: intervalCheck.reason,
        processedBy: operator,
        processedAt: new Date().toISOString()
      });
      dataStore.addOperationLog(recordId, {
        operationType: OperationType.RETURN,
        operator,
        reason: intervalCheck.reason,
        previousStatus,
        newStatus: RecordStatus.RETURNED
      });
      return { success: true, record: dataStore.getAppointmentRecordById(recordId) };
    }

    const ageCheck = this.validateAge(record.childId, record.vaccineCode);
    if (!ageCheck.valid) {
      dataStore.updateAppointmentRecord(recordId, {
        status: RecordStatus.RETURNED,
        blockReason: ageCheck.reason,
        processedBy: operator,
        processedAt: new Date().toISOString()
      });
      dataStore.addOperationLog(recordId, {
        operationType: OperationType.RETURN,
        operator,
        reason: ageCheck.reason,
        previousStatus,
        newStatus: RecordStatus.RETURNED
      });
      return { success: true, record: dataStore.getAppointmentRecordById(recordId) };
    }

    const inventory = dataStore.getVaccineInventoryByCode(record.vaccineCode);
    if (!inventory || inventory.availableQuantity <= 0) {
      const waitlistOrder = dataStore.getNextWaitlistOrder(record.batchId);
      const notes = precautionNotes.length > 0 ? precautionNotes.join('; ') : record.notes;
      dataStore.updateAppointmentRecord(recordId, {
        status: RecordStatus.WAITLISTED,
        waitlistOrder,
        waitlistSource: '疫苗库存不足',
        processedBy: operator,
        processedAt: new Date().toISOString(),
        notes
      });
      dataStore.addOperationLog(recordId, {
        operationType: OperationType.WAITLIST,
        operator,
        reason: `疫苗库存不足，候补顺序: ${waitlistOrder}${precautionNotes.length > 0 ? '; ' + precautionNotes.join('; ') : ''}`,
        previousStatus,
        newStatus: RecordStatus.WAITLISTED
      });
      return { success: true, record: dataStore.getAppointmentRecordById(recordId) };
    }

    dataStore.updateVaccineInventory(inventory.id, {
      availableQuantity: inventory.availableQuantity - 1
    });

    const approveNotes = precautionNotes.length > 0 ? precautionNotes.join('; ') : record.notes;
    dataStore.updateAppointmentRecord(recordId, {
      status: RecordStatus.APPROVED,
      processedBy: operator,
      processedAt: new Date().toISOString(),
      notes: approveNotes
    });
    dataStore.addOperationLog(recordId, {
      operationType: OperationType.APPROVE,
      operator,
      reason: `审核通过${precautionNotes.length > 0 ? '; ' + precautionNotes.join('; ') : ''}`,
      previousStatus,
      newStatus: RecordStatus.APPROVED
    });

    const batch = dataStore.getBatchById(record.batchId);
    if (batch) {
      dataStore.updateBatch(record.batchId, {
        processedCount: batch.processedCount + 1
      });
    }

    return { success: true, record: dataStore.getAppointmentRecordById(recordId) };
  }

  returnToPending(recordId: string, operator: string, reason: string): { success: boolean; record?: AppointmentRecord } {
    const record = dataStore.getAppointmentRecordById(recordId);
    if (!record) {
      return { success: false };
    }

    const previousStatus = record.status;
    dataStore.updateAppointmentRecord(recordId, {
      status: RecordStatus.PENDING,
      notes: reason
    });
    dataStore.addOperationLog(recordId, {
      operationType: OperationType.RETURN,
      operator,
      reason: `退回待处理: ${reason}`,
      previousStatus,
      newStatus: RecordStatus.PENDING
    });

    return { success: true, record: dataStore.getAppointmentRecordById(recordId) };
  }

  markAsProcessed(recordId: string, operator: string): { success: boolean; record?: AppointmentRecord } {
    const record = dataStore.getAppointmentRecordById(recordId);
    if (!record) {
      return { success: false };
    }

    if (record.status !== RecordStatus.APPROVED) {
      return { success: false };
    }

    const previousStatus = record.status;
    dataStore.updateAppointmentRecord(recordId, {
      status: RecordStatus.PROCESSED,
      processedBy: operator,
      processedAt: new Date().toISOString()
    });
    dataStore.addOperationLog(recordId, {
      operationType: OperationType.MARK_PROCESSED,
      operator,
      reason: '完成接种',
      previousStatus,
      newStatus: RecordStatus.PROCESSED
    });

    return { success: true, record: dataStore.getAppointmentRecordById(recordId) };
  }

  processBatchRecords(batchId: string, operator: string): { total: number; processed: number; failed: number } {
    const records = dataStore.getAppointmentRecordsByBatchId(batchId);
    let processed = 0;
    let failed = 0;

    for (const record of records) {
      if (record.status === RecordStatus.PENDING || record.status === RecordStatus.RETURNED) {
        const result = this.processAppointmentRecord(record.id, operator);
        if (result.success) {
          processed++;
        } else {
          failed++;
        }
      }
    }

    return {
      total: records.length,
      processed,
      failed
    };
  }

  getWaitlistTraceability(batchId: string): Array<{
    recordId: string;
    childName: string;
    waitlistOrder: number;
    waitlistSource: string | undefined;
    operationLogs: Array<{
      timestamp: string;
      operator: string;
      reason: string | undefined;
    }>;
  }> {
    const records = dataStore.getAppointmentRecordsByBatchId(batchId)
      .filter(r => r.status === RecordStatus.WAITLISTED)
      .sort((a, b) => (a.waitlistOrder || 0) - (b.waitlistOrder || 0));

    return records.map(r => ({
      recordId: r.id,
      childName: r.childName,
      waitlistOrder: r.waitlistOrder || 0,
      waitlistSource: r.waitlistSource,
      operationLogs: r.operationLogs.map(log => ({
        timestamp: log.timestamp,
        operator: log.operator,
        reason: log.reason
      }))
    }));
  }
}

export const businessService = new BusinessService();
