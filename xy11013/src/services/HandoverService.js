const { MedicationHandover, RecordType } = require('../models/MedicationHandover');
const seedData = require('../data/seedData');

class HandoverService {
  constructor() {
    this.records = [...seedData];
  }

  getAllRecords() {
    return this.records;
  }

  getNormalRecords() {
    return this.records.filter(r => r.recordType === RecordType.NORMAL);
  }

  getAbnormalRecords() {
    return this.records.filter(r => r.recordType === RecordType.ABNORMAL);
  }

  getRecordById(id) {
    return this.records.find(r => r.id === id);
  }

  createRecord(data) {
    const record = new MedicationHandover(data);
    const result = record.process();
    this.records.push(record);
    return {
      record,
      result
    };
  }

  processRecord(id) {
    const record = this.getRecordById(id);
    if (!record) {
      throw new Error('记录不存在');
    }
    const result = record.process();
    return {
      record,
      result
    };
  }

  confirmNurseConfirmation(id, nurseData) {
    const record = this.getRecordById(id);
    if (!record) {
      throw new Error('记录不存在');
    }

    record.nurseConfirmation = {
      hasConfirmed: true,
      confirmTime: new Date().toISOString(),
      nurseName: nurseData.nurseName || '',
      nurseSignature: nurseData.nurseSignature || ''
    };

    const result = record.process();
    return {
      record,
      result,
      message: '护士确认成功，已重新校验记录'
    };
  }

  updateMedicationRecords(id, medicationRecords) {
    const record = this.getRecordById(id);
    if (!record) {
      throw new Error('记录不存在');
    }

    record.medicationRecords = medicationRecords;
    const result = record.process();
    return {
      record,
      result,
      message: '服药记录已更新，已重新校验一致性'
    };
  }

  getStatistics() {
    const total = this.records.length;
    const normal = this.getNormalRecords().length;
    const abnormal = this.getAbnormalRecords().length;
    const pending = this.records.filter(r => r.status === 'pending').length;
    const rejected = this.records.filter(r => r.status === 'rejected').length;

    const abnormalReasons = this.getAbnormalRecords().map(r => ({
      id: r.id,
      elderlyName: r.elderlyInfo.name,
      reason: r.abnormalReason,
      suggestion: r.processingSuggestion
    }));

    return {
      total,
      normal,
      abnormal,
      pending,
      rejected,
      abnormalReasons
    };
  }
}

module.exports = HandoverService;
