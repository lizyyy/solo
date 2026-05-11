const Deposit = require('../models/Deposit.model');
const Application = require('../models/Application.model');
const { generateOrderNo, getDateRangeDays } = require('../utils/helpers');

const calculateRentalFee = (booth, startDate, endDate) => {
  const days = getDateRangeDays(startDate, endDate);
  return booth.standardRental * days;
};

const calculateDepositAmount = (booth) => {
  return booth.standardDeposit;
};

const createDepositPayment = async (application, booth, operator = '系统管理员') => {
  const deposit = new Deposit({
    transactionNo: generateOrderNo('DP'),
    applicationId: application._id,
    merchantId: application.merchantId,
    type: 'deposit',
    amount: calculateDepositAmount(booth),
    status: 'pending',
    operator,
    notes: '入场押金'
  });
  
  return deposit.save();
};

const createRentPayment = async (application, booth, operator = '系统管理员') => {
  const rent = new Deposit({
    transactionNo: generateOrderNo('RT'),
    applicationId: application._id,
    merchantId: application.merchantId,
    type: 'rent',
    amount: calculateRentalFee(booth, application.startDate, application.endDate),
    status: 'pending',
    operator,
    notes: '摊位租金'
  });
  
  return rent.save();
};

const confirmPayment = async (transactionId, paymentMethod = 'bank_transfer') => {
  const transaction = await Deposit.findById(transactionId);
  if (!transaction) {
    throw new Error('交易记录不存在');
  }
  
  transaction.status = 'confirmed';
  transaction.paymentMethod = paymentMethod;
  await transaction.save();
  
  if (transaction.type === 'deposit') {
    await Application.findByIdAndUpdate(transaction.applicationId, {
      depositPaid: true
    });
  }
  
  return transaction;
};

const refundDeposit = async (applicationId, originalTransactionId, refundAmount, operator, reason = '') => {
  const originalTransaction = await Deposit.findById(originalTransactionId);
  if (!originalTransaction || originalTransaction.type !== 'deposit' || originalTransaction.status !== 'confirmed') {
    throw new Error('原始押金记录无效');
  }
  
  const refund = new Deposit({
    transactionNo: generateOrderNo('RF'),
    applicationId,
    merchantId: originalTransaction.merchantId,
    type: 'refund',
    amount: refundAmount,
    status: 'confirmed',
    relatedTransactionId: originalTransactionId,
    operator,
    notes: reason || '押金退还'
  });
  
  await refund.save();
  
  originalTransaction.status = 'refunded';
  await originalTransaction.save();
  
  return refund;
};

const createDeduction = async (applicationId, items, operator, reason = '') => {
  const totalDeduction = items.reduce((sum, item) => sum + item.amount, 0);
  
  const deduction = new Deposit({
    transactionNo: generateOrderNo('DD'),
    applicationId,
    type: 'deduction',
    amount: totalDeduction,
    status: 'confirmed',
    deductionDetails: items,
    operator,
    notes: reason || '押金扣款'
  });
  
  return deduction.save();
};

const getDepositTransactions = async (filters = {}) => {
  const query = {};
  
  if (filters.type) {
    query.type = filters.type;
  }
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.merchantId) {
    query.merchantId = filters.merchantId;
  }
  if (filters.applicationId) {
    query.applicationId = filters.applicationId;
  }
  if (filters.startDate || filters.endDate) {
    query.transactionDate = {};
    if (filters.startDate) {
      query.transactionDate.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.transactionDate.$lte = new Date(filters.endDate);
    }
  }
  
  return Deposit.find(query)
    .populate('merchantId', 'name')
    .populate('applicationId', 'applicationNo')
    .sort({ transactionDate: -1 });
};

const getDepositSummary = async () => {
  const transactions = await Deposit.find();
  
  const summary = {
    totalDeposits: 0,
    totalRefunds: 0,
    totalDeductions: 0,
    totalRent: 0,
    totalElectricity: 0,
    pendingPayments: 0,
    netRevenue: 0
  };
  
  transactions.forEach(t => {
    if (t.status === 'confirmed') {
      switch (t.type) {
        case 'deposit':
          summary.totalDeposits += t.amount;
          break;
        case 'refund':
          summary.totalRefunds += t.amount;
          break;
        case 'deduction':
          summary.totalDeductions += t.amount;
          break;
        case 'rent':
          summary.totalRent += t.amount;
          break;
        case 'electricity':
          summary.totalElectricity += t.amount;
          break;
      }
    }
    if (t.status === 'pending') {
      summary.pendingPayments += t.amount;
    }
  });
  
  summary.netRevenue = summary.totalRent + summary.totalDeductions + summary.totalElectricity;
  
  return summary;
};

module.exports = {
  calculateRentalFee,
  calculateDepositAmount,
  createDepositPayment,
  createRentPayment,
  confirmPayment,
  refundDeposit,
  createDeduction,
  getDepositTransactions,
  getDepositSummary
};