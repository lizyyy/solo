const Policy = require('./Policy');
const PaymentPlan = require('./PaymentPlan');
const AdvancePaymentRecord = require('./AdvancePaymentRecord');
const VisitRecord = require('./VisitRecord');
const ReminderRecord = require('./ReminderRecord');
const RenewalReport = require('./RenewalReport');

const INPUT_TYPES = {
  POLICY: 'policy',
  PAYMENT_PLAN: 'paymentPlan',
  ADVANCE_PAYMENT: 'advancePayment',
  VISIT_RECORD: 'visitRecord',
  RENEWAL_REPORT: 'renewalReport'
};

const INPUT_TYPE_NAMES = {
  [INPUT_TYPES.POLICY]: '保单信息',
  [INPUT_TYPES.PAYMENT_PLAN]: '缴费计划',
  [INPUT_TYPES.ADVANCE_PAYMENT]: '垫交记录',
  [INPUT_TYPES.VISIT_RECORD]: '客户回访',
  [INPUT_TYPES.RENEWAL_REPORT]: '续缴报告'
};

const identifyInputType = (data) => {
  const keys = Object.keys(data).map(k => k.toLowerCase());
  
  if (keys.includes('policyno') && (keys.includes('premium') || keys.includes('保费'))) {
    if (keys.includes('duedate') || keys.includes('period') || keys.includes('期次')) {
      return INPUT_TYPES.PAYMENT_PLAN;
    }
    if (keys.includes('advancedate') || keys.includes('advanceamount') || keys.includes('垫交')) {
      return INPUT_TYPES.ADVANCE_PAYMENT;
    }
    if (keys.includes('visitdate') || keys.includes('visittype') || keys.includes('回访')) {
      return INPUT_TYPES.VISIT_RECORD;
    }
    if (keys.includes('reportdate') || keys.includes('summary') || keys.includes('报告')) {
      return INPUT_TYPES.RENEWAL_REPORT;
    }
    return INPUT_TYPES.POLICY;
  }
  
  if (keys.includes('duedate') && keys.includes('premium')) {
    return INPUT_TYPES.PAYMENT_PLAN;
  }
  
  if (keys.includes('advancedate')) {
    return INPUT_TYPES.ADVANCE_PAYMENT;
  }
  
  if (keys.includes('visitdate') && keys.includes('contactresult')) {
    return INPUT_TYPES.VISIT_RECORD;
  }
  
  if (keys.includes('reportid') || keys.includes('reportdate')) {
    return INPUT_TYPES.RENEWAL_REPORT;
  }
  
  return null;
};

const createModelFromData = (data, type = null) => {
  const inputType = type || identifyInputType(data);
  
  switch (inputType) {
    case INPUT_TYPES.POLICY:
      return new Policy(data);
    case INPUT_TYPES.PAYMENT_PLAN:
      return new PaymentPlan(data);
    case INPUT_TYPES.ADVANCE_PAYMENT:
      return new AdvancePaymentRecord(data);
    case INPUT_TYPES.VISIT_RECORD:
      return new VisitRecord(data);
    case INPUT_TYPES.RENEWAL_REPORT:
      return new RenewalReport(data);
    default:
      return null;
  }
};

module.exports = {
  Policy,
  PaymentPlan,
  AdvancePaymentRecord,
  VisitRecord,
  ReminderRecord,
  RenewalReport,
  INPUT_TYPES,
  INPUT_TYPE_NAMES,
  identifyInputType,
  createModelFromData
};
