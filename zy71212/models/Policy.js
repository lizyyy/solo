const moment = require('moment');

class Policy {
  constructor(data = {}) {
    this.policyNo = data.policyNo || '';
    this.policyholder = data.policyholder || '';
    this.idCard = data.idCard || '';
    this.phone = data.phone || '';
    this.productName = data.productName || '';
    this.premium = Number(data.premium) || 0;
    this.paymentFrequency = data.paymentFrequency || '年缴';
    this.policyEffectiveDate = data.policyEffectiveDate ? moment(data.policyEffectiveDate).format('YYYY-MM-DD') : '';
    this.gracePeriodDays = Number(data.gracePeriodDays) || 60;
    this.autoAdvanceEnabled = data.autoAdvanceEnabled || false;
    this.cashValue = Number(data.cashValue) || 0;
    this.status = data.status || '有效';
    this.agent = data.agent || '';
    this.createdAt = data.createdAt || moment().format('YYYY-MM-DD HH:mm:ss');
    this.updatedAt = data.updatedAt || moment().format('YYYY-MM-DD HH:mm:ss');
    this.missingFields = [];
  }

  validate() {
    this.missingFields = [];
    if (!this.policyNo) this.missingFields.push('保单号');
    if (!this.policyholder) this.missingFields.push('投保人');
    if (!this.premium) this.missingFields.push('保费金额');
    if (!this.policyEffectiveDate) this.missingFields.push('保单生效日');
    return this.missingFields.length === 0;
  }

  toJSON() {
    return {
      policyNo: this.policyNo,
      policyholder: this.policyholder,
      idCard: this.idCard,
      phone: this.phone,
      productName: this.productName,
      premium: this.premium,
      paymentFrequency: this.paymentFrequency,
      policyEffectiveDate: this.policyEffectiveDate,
      gracePeriodDays: this.gracePeriodDays,
      autoAdvanceEnabled: this.autoAdvanceEnabled,
      cashValue: this.cashValue,
      status: this.status,
      agent: this.agent,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      missingFields: this.missingFields
    };
  }

  static fromJSON(json) {
    return new Policy(json);
  }
}

module.exports = Policy;
