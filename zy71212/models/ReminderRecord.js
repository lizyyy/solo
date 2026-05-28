const moment = require('moment');

class ReminderRecord {
  constructor(data = {}) {
    this.reminderId = data.reminderId || '';
    this.policyNo = data.policyNo || '';
    this.period = data.period || '';
    this.reminderDate = data.reminderDate ? moment(data.reminderDate).format('YYYY-MM-DD HH:mm:ss') : '';
    this.reminderType = data.reminderType || '短信';
    this.reminderLevel = data.reminderLevel || '常规';
    this.reminderContent = data.reminderContent || '';
    this.channel = data.channel || '';
    this.operator = data.operator || '';
    this.deduplicationKey = data.deduplicationKey || '';
    this.status = data.status || '已发送';
    this.customerResponse = data.customerResponse || '';
    this.responseDate = data.responseDate ? moment(data.responseDate).format('YYYY-MM-DD HH:mm:ss') : null;
    this.createdAt = data.createdAt || moment().format('YYYY-MM-DD HH:mm:ss');
    this.updatedAt = data.updatedAt || moment().format('YYYY-MM-DD HH:mm:ss');
    this.missingFields = [];
  }

  validate() {
    this.missingFields = [];
    if (!this.policyNo) this.missingFields.push('保单号');
    if (!this.reminderDate) this.missingFields.push('催缴日期');
    if (!this.reminderType) this.missingFields.push('催缴类型');
    return this.missingFields.length === 0;
  }

  static generateDeduplicationKey(policyNo, period, reminderType, reminderDate) {
    const dateStr = moment(reminderDate).format('YYYY-MM-DD');
    return `${policyNo}_${period}_${reminderType}_${dateStr}`;
  }

  toJSON() {
    return {
      reminderId: this.reminderId,
      policyNo: this.policyNo,
      period: this.period,
      reminderDate: this.reminderDate,
      reminderType: this.reminderType,
      reminderLevel: this.reminderLevel,
      reminderContent: this.reminderContent,
      channel: this.channel,
      operator: this.operator,
      deduplicationKey: this.deduplicationKey,
      status: this.status,
      customerResponse: this.customerResponse,
      responseDate: this.responseDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      missingFields: this.missingFields
    };
  }

  static fromJSON(json) {
    return new ReminderRecord(json);
  }
}

module.exports = ReminderRecord;
