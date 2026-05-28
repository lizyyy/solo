const moment = require('moment');

class VisitRecord {
  constructor(data = {}) {
    this.visitId = data.visitId || '';
    this.policyNo = data.policyNo || '';
    this.visitDate = data.visitDate ? moment(data.visitDate).format('YYYY-MM-DD HH:mm:ss') : '';
    this.visitType = data.visitType || '电话回访';
    this.visitor = data.visitor || '';
    this.contactResult = data.contactResult || '';
    this.customerIntent = data.customerIntent || '';
    this.intentConfirmed = data.intentConfirmed || false;
    this.promisedPaymentDate = data.promisedPaymentDate ? moment(data.promisedPaymentDate).format('YYYY-MM-DD') : null;
    this.remark = data.remark || '';
    this.nextFollowUpDate = data.nextFollowUpDate ? moment(data.nextFollowUpDate).format('YYYY-MM-DD') : null;
    this.followUpStatus = data.followUpStatus || '待跟进';
    this.issues = data.issues || [];
    this.createdAt = data.createdAt || moment().format('YYYY-MM-DD HH:mm:ss');
    this.updatedAt = data.updatedAt || moment().format('YYYY-MM-DD HH:mm:ss');
    this.missingFields = [];
  }

  validate() {
    this.missingFields = [];
    if (!this.policyNo) this.missingFields.push('保单号');
    if (!this.visitDate) this.missingFields.push('回访日期');
    if (!this.visitType) this.missingFields.push('回访类型');
    if (!this.contactResult) this.missingFields.push('联系结果');
    return this.missingFields.length === 0;
  }

  isIntentLocked() {
    return this.intentConfirmed && ['续保', '停保', '缓交'].includes(this.customerIntent);
  }

  isStopIntent() {
    return this.intentConfirmed && this.customerIntent === '停保';
  }

  isRenewIntent() {
    return this.intentConfirmed && this.customerIntent === '续保';
  }

  isDeferIntent() {
    return this.intentConfirmed && this.customerIntent === '缓交';
  }

  needsFollowUp(asOfDate = null) {
    if (this.followUpStatus !== '待跟进') return false;
    if (!this.nextFollowUpDate) return true;
    const checkDate = asOfDate ? moment(asOfDate) : moment();
    return checkDate.isSameOrAfter(moment(this.nextFollowUpDate), 'day');
  }

  toJSON() {
    return {
      visitId: this.visitId,
      policyNo: this.policyNo,
      visitDate: this.visitDate,
      visitType: this.visitType,
      visitor: this.visitor,
      contactResult: this.contactResult,
      customerIntent: this.customerIntent,
      intentConfirmed: this.intentConfirmed,
      promisedPaymentDate: this.promisedPaymentDate,
      remark: this.remark,
      nextFollowUpDate: this.nextFollowUpDate,
      followUpStatus: this.followUpStatus,
      issues: this.issues,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      missingFields: this.missingFields,
      isIntentLocked: this.isIntentLocked(),
      isStopIntent: this.isStopIntent(),
      isRenewIntent: this.isRenewIntent(),
      isDeferIntent: this.isDeferIntent(),
      needsFollowUp: this.needsFollowUp()
    };
  }

  static fromJSON(json) {
    return new VisitRecord(json);
  }
}

module.exports = VisitRecord;
