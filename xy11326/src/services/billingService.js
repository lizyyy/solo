const config = require('../config');
const BillingRecord = require('../models/BillingRecord');
const OperationLog = require('../models/OperationLog');

const calculateFees = (hours, acres, fuelConsumption, customRates = {}) => {
  const rates = {
    hourlyRate: customRates.hourlyRate || config.billing.hourlyRate,
    acreRate: customRates.acreRate || config.billing.acreRate,
    fuelRate: customRates.fuelRate || config.billing.fuelRate,
    baseServiceFee: customRates.baseServiceFee || config.billing.baseServiceFee
  };
  
  const hoursFee = (hours || 0) * rates.hourlyRate;
  const acresFee = (acres || 0) * rates.acreRate;
  const fuelFee = (fuelConsumption || 0) * rates.fuelRate;
  const serviceFee = rates.baseServiceFee;
  
  const totalAmount = hoursFee + acresFee + fuelFee + serviceFee;
  
  return {
    hoursFee: Math.round(hoursFee * 100) / 100,
    acresFee: Math.round(acresFee * 100) / 100,
    fuelFee: Math.round(fuelFee * 100) / 100,
    serviceFee: Math.round(serviceFee * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    rates
  };
};

const createBillingRecord = async (workRecordId, billingData, operator = 'system') => {
  const existingBilling = await BillingRecord.findByWorkRecordId(workRecordId);
  if (existingBilling) {
    throw new Error('该作业记录已生成账单');
  }
  
  const fees = calculateFees(
    billingData.hours,
    billingData.acres,
    billingData.fuelConsumption,
    billingData.rates
  );
  
  const billingRecord = await BillingRecord.create({
    workRecordId,
    ...fees,
    billingDate: billingData.billingDate,
    remarks: billingData.remarks
  });
  
  await OperationLog.create({
    operation: 'generate_bill',
    operator,
    targetType: 'billing_record',
    targetId: billingRecord.id,
    details: { workRecordId, totalAmount: fees.totalAmount }
  });
  
  return billingRecord;
};

const calculateWorkRecordFee = async (workRecord) => {
  return calculateFees(
    workRecord.hours,
    workRecord.acres,
    workRecord.fuelConsumption
  );
};

const getBillingSummary = async (filters = {}) => {
  const summary = await BillingRecord.getSummary(filters);
  const records = await BillingRecord.findAll(filters);
  
  return {
    summary: {
      totalCount: summary.totalCount || 0,
      totalAmount: summary.totalAmount || 0,
      paidAmount: summary.paidAmount || 0,
      unpaidAmount: summary.unpaidAmount || 0
    },
    records
  };
};

const updatePaymentStatus = async (billingId, status, operator = 'system') => {
  if (!['paid', 'unpaid', 'partial'].includes(status)) {
    throw new Error('无效的支付状态');
  }
  
  const billingRecord = await BillingRecord.update(billingId, { status });
  
  await OperationLog.create({
    operation: 'update_payment_status',
    operator,
    targetType: 'billing_record',
    targetId: billingId,
    details: { status }
  });
  
  return billingRecord;
};

module.exports = {
  calculateFees,
  createBillingRecord,
  calculateWorkRecordFee,
  getBillingSummary,
  updatePaymentStatus
};
