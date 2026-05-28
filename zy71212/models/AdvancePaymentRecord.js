const moment = require('moment');

class AdvancePaymentRecord {
  constructor(data = {}) {
    this.recordId = data.recordId || '';
    this.policyNo = data.policyNo || '';
    this.period = data.period || '';
    this.advanceDate = data.advanceDate ? moment(data.advanceDate).format('YYYY-MM-DD') : '';
    this.advanceAmount = Number(data.advanceAmount) || 0;
    this.advanceType = data.advanceType || '自动垫交';
    this.interestRate = Number(data.interestRate) || 0;
    this.repaid = data.repaid || false;
    this.repaidDate = data.repaidDate ? moment(data.repaidDate).format('YYYY-MM-DD') : null;
    this.repaidAmount = Number(data.repaidAmount) || 0;
    this.remainingPrincipal = Number(data.remainingPrincipal) || this.advanceAmount;
    this.remainingInterest = Number(data.remainingInterest) || 0;
    this.remark = data.remark || '';
    this.createdAt = data.createdAt || moment().format('YYYY-MM-DD HH:mm:ss');
    this.updatedAt = data.updatedAt || moment().format('YYYY-MM-DD HH:mm:ss');
    this.missingFields = [];
  }

  validate() {
    this.missingFields = [];
    if (!this.policyNo) this.missingFields.push('保单号');
    if (!this.period) this.missingFields.push('缴费期次');
    if (!this.advanceDate) this.missingFields.push('垫交日期');
    if (!this.advanceAmount) this.missingFields.push('垫交金额');
    return this.missingFields.length === 0;
  }

  calculateCurrentInterest(asOfDate = null) {
    if (this.repaid) return 0;
    const checkDate = asOfDate ? moment(asOfDate) : moment();
    const days = checkDate.diff(moment(this.advanceDate), 'days');
    return Number((this.remainingPrincipal * this.interestRate * days / 365).toFixed(2));
  }

  getTotalAmountOwed(asOfDate = null) {
    return Number((this.remainingPrincipal + this.calculateCurrentInterest(asOfDate)).toFixed(2));
  }

  toJSON() {
    return {
      recordId: this.recordId,
      policyNo: this.policyNo,
      period: this.period,
      advanceDate: this.advanceDate,
      advanceAmount: this.advanceAmount,
      advanceType: this.advanceType,
      interestRate: this.interestRate,
      repaid: this.repaid,
      repaidDate: this.repaidDate,
      repaidAmount: this.repaidAmount,
      remainingPrincipal: this.remainingPrincipal,
      remainingInterest: this.remainingInterest,
      remark: this.remark,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      missingFields: this.missingFields,
      currentInterest: this.calculateCurrentInterest(),
      totalAmountOwed: this.getTotalAmountOwed()
    };
  }

  static fromJSON(json) {
    return new AdvancePaymentRecord(json);
  }
}

module.exports = AdvancePaymentRecord;
