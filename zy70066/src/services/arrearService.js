const storage = require('../storage');
const deductionService = require('./deductionService');

function createFeeItem(params) {
  const item = {
    code: params.code,
    name: params.name,
    defaultAmount: params.defaultAmount,
    description: params.description || '',
    status: params.status || 'active'
  };
  return storage.insert('feeItems', item);
}

function createArrearRecord(params) {
  const record = {
    studentId: params.studentId,
    feeTypeId: params.feeTypeId,
    feeTypeName: params.feeTypeName,
    originalAmount: params.originalAmount,
    deductionAmount: params.deductionAmount || 0,
    totalAmount: params.totalAmount || params.originalAmount,
    paidAmount: params.paidAmount || 0,
    remainingAmount: params.remainingAmount || params.totalAmount,
    status: params.status || 'unpaid',
    academicYear: params.academicYear,
    semester: params.semester,
    remark: params.remark || ''
  };
  return storage.insert('arrearRecords', record);
}

function getStudentArrears(studentId, status) {
  const predicate = r => r.studentId === studentId;
  if (status) {
    return storage.findMany('arrearRecords', r => 
      predicate(r) && r.status === status
    );
  }
  return storage.findMany('arrearRecords', predicate);
}

function getArrearSummary(studentId) {
  const records = getStudentArrears(studentId);
  const summary = {
    totalOriginal: 0,
    totalDeduction: 0,
    totalPayable: 0,
    totalPaid: 0,
    totalRemaining: 0,
    byStatus: {},
    records: records
  };

  for (const record of records) {
    summary.totalOriginal += record.originalAmount;
    summary.totalDeduction += record.deductionAmount;
    summary.totalPayable += record.totalAmount;
    summary.totalPaid += record.paidAmount;
    summary.totalRemaining += record.remainingAmount;
    if (!summary.byStatus[record.status]) {
      summary.byStatus[record.status] = 0;
    }
    summary.byStatus[record.status] += record.remainingAmount;
  }

  return summary;
}

function updateArrearPayment(arrearId, paidAmount) {
  const arrear = storage.findById('arrearRecords', arrearId);
  if (!arrear) throw new Error('欠费记录不存在');

  const newPaidAmount = arrear.paidAmount + paidAmount;
  const newRemaining = Math.max(0, arrear.totalAmount - newPaidAmount);
  const newStatus = newRemaining === 0 ? 'paid' : 
    (newPaidAmount > 0 ? 'partial' : 'unpaid');

  return storage.update('arrearRecords', arrearId, {
    paidAmount: newPaidAmount,
    remainingAmount: newRemaining,
    status: newStatus
  });
}

function calculateAndApplyDeductions(arrearId, deductions) {
  const arrear = storage.findById('arrearRecords', arrearId);
  if (!arrear) throw new Error('欠费记录不存在');

  const result = deductionService.applyDeductions(
    arrear.studentId,
    arrear.feeTypeId,
    arrear.originalAmount,
    deductions
  );

  return storage.update('arrearRecords', arrearId, {
    deductionAmount: result.totalDeduction,
    totalAmount: result.payableAmount,
    remainingAmount: result.payableAmount
  });
}

function freezeArrear(arrearId, reason) {
  const arrear = storage.findById('arrearRecords', arrearId);
  if (!arrear) throw new Error('欠费记录不存在');

  return storage.update('arrearRecords', arrearId, {
    status: 'frozen',
    freezeReason: reason,
    frozenAt: new Date().toISOString()
  });
}

function unfreezeArrear(arrearId) {
  const arrear = storage.findById('arrearRecords', arrearId);
  if (!arrear) throw new Error('欠费记录不存在');

  const newStatus = arrear.paidAmount > 0 ? 
    (arrear.paidAmount >= arrear.totalAmount ? 'paid' : 'partial') : 'unpaid';

  return storage.update('arrearRecords', arrearId, {
    status: newStatus,
    unfreezeReason: null,
    frozenAt: null
  });
}

module.exports = {
  createFeeItem,
  createArrearRecord,
  getStudentArrears,
  getArrearSummary,
  updateArrearPayment,
  calculateAndApplyDeductions,
  freezeArrear,
  unfreezeArrear
};
