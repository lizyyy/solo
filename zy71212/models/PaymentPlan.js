const moment = require('moment');

class PaymentPlan {
  constructor(data = {}) {
    this.planId = data.planId || '';
    this.policyNo = data.policyNo || '';
    this.period = data.period || '';
    this.dueDate = data.dueDate ? moment(data.dueDate).format('YYYY-MM-DD') : '';
    this.premium = Number(data.premium) || 0;
    this.status = data.status || '待缴费';
    this.paidDate = data.paidDate ? moment(data.paidDate).format('YYYY-MM-DD') : null;
    this.paidAmount = Number(data.paidAmount) || 0;
    this.paymentMethod = data.paymentMethod || '';
    this.graceEndDate = data.graceEndDate ? moment(data.graceEndDate).format('YYYY-MM-DD') : '';
    this.createdAt = data.createdAt || moment().format('YYYY-MM-DD HH:mm:ss');
    this.updatedAt = data.updatedAt || moment().format('YYYY-MM-DD HH:mm:ss');
    this.missingFields = [];
  }

  validate() {
    this.missingFields = [];
    if (!this.policyNo) this.missingFields.push('保单号');
    if (!this.period) this.missingFields.push('缴费期次');
    if (!this.dueDate) this.missingFields.push('应缴日期');
    if (!this.premium) this.missingFields.push('应缴保费');
    return this.missingFields.length === 0;
  }

  isOverdue(asOfDate = null) {
    const checkDate = asOfDate ? moment(asOfDate) : moment();
    return checkDate.isAfter(moment(this.dueDate), 'day');
  }

  isInGracePeriod(asOfDate = null) {
    if (!this.graceEndDate) return false;
    const checkDate = asOfDate ? moment(asOfDate) : moment();
    return checkDate.isSameOrBefore(moment(this.graceEndDate), 'day') && this.isOverdue(asOfDate);
  }

  isGraceExpired(asOfDate = null) {
    if (!this.graceEndDate) return false;
    const checkDate = asOfDate ? moment(asOfDate) : moment();
    return checkDate.isAfter(moment(this.graceEndDate), 'day');
  }

  getDaysOverdue(asOfDate = null) {
    const checkDate = asOfDate ? moment(asOfDate) : moment();
    if (!this.isOverdue(asOfDate)) return 0;
    return checkDate.diff(moment(this.dueDate), 'days');
  }

  getDaysRemainingInGrace(asOfDate = null) {
    if (!this.graceEndDate) return 0;
    const checkDate = asOfDate ? moment(asOfDate) : moment();
    if (!this.isInGracePeriod(asOfDate)) return 0;
    return moment(this.graceEndDate).diff(checkDate, 'days') + 1;
  }

  toJSON() {
    return {
      planId: this.planId,
      policyNo: this.policyNo,
      period: this.period,
      dueDate: this.dueDate,
      premium: this.premium,
      status: this.status,
      paidDate: this.paidDate,
      paidAmount: this.paidAmount,
      paymentMethod: this.paymentMethod,
      graceEndDate: this.graceEndDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      missingFields: this.missingFields,
      isOverdue: this.isOverdue(),
      isInGracePeriod: this.isInGracePeriod(),
      isGraceExpired: this.isGraceExpired(),
      daysOverdue: this.getDaysOverdue(),
      daysRemainingInGrace: this.getDaysRemainingInGrace()
    };
  }

  static fromJSON(json) {
    return new PaymentPlan(json);
  }
}

module.exports = PaymentPlan;
