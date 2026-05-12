const { storage, save, TRANSACTION_TYPE, ORDER_STATUS, FEE_TYPE } = require('../utils/storage');

function getLedger(orderId) {
  if (!storage.depositLedgers[orderId]) {
    storage.depositLedgers[orderId] = {
      orderId,
      transactions: [],
      balance: 0,
      totalFrozen: 0,
      totalDeducted: 0,
      totalRefunded: 0,
      totalManualAdjust: 0,
      updatedAt: new Date().toISOString()
    };
  }
  return storage.depositLedgers[orderId];
}

function getFeeDetails(orderId) {
  if (!storage.feeDetails[orderId]) {
    storage.feeDetails[orderId] = {
      orderId,
      fees: [],
      totalFees: 0,
      totalRentalFee: 0,
      totalOverdueFee: 0,
      totalDamageFee: 0,
      updatedAt: new Date().toISOString()
    };
  }
  return storage.feeDetails[orderId];
}

async function addDepositTransaction(orderId, params) {
  const ledger = getLedger(orderId);
  
  const transaction = {
    transactionId: `TXN_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: params.type,
    amount: params.amount,
    description: params.description,
    operator: params.operator || 'system',
    referenceId: params.referenceId,
    timestamp: new Date().toISOString()
  };
  
  ledger.transactions.push(transaction);
  
  switch (params.type) {
    case TRANSACTION_TYPE.FROZEN:
      ledger.balance += params.amount;
      ledger.totalFrozen += params.amount;
      break;
    case TRANSACTION_TYPE.UNFROZEN:
      ledger.balance -= params.amount;
      break;
    case TRANSACTION_TYPE.DEDUCT_OVERDUE:
    case TRANSACTION_TYPE.DEDUCT_DAMAGE:
      ledger.balance -= params.amount;
      ledger.totalDeducted += params.amount;
      break;
    case TRANSACTION_TYPE.REFUND:
      ledger.totalRefunded += params.amount;
      break;
    case TRANSACTION_TYPE.MANUAL_ADJUST:
      ledger.balance += params.amount;
      ledger.totalManualAdjust += params.amount;
      break;
  }
  
  ledger.updatedAt = new Date().toISOString();
  await save();
  
  return transaction;
}

async function addFee(orderId, params) {
  const feeDetails = getFeeDetails(orderId);
  
  const fee = {
    feeId: `FEE_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: params.type,
    amount: params.amount,
    description: params.description,
    calculation: params.calculation,
    operator: params.operator || 'system',
    timestamp: new Date().toISOString()
  };
  
  feeDetails.fees.push(fee);
  feeDetails.totalFees += params.amount;
  
  switch (params.type) {
    case FEE_TYPE.RENTAL:
      feeDetails.totalRentalFee += params.amount;
      break;
    case FEE_TYPE.OVERDUE:
      feeDetails.totalOverdueFee += params.amount;
      break;
    case FEE_TYPE.DAMAGE:
      feeDetails.totalDamageFee += params.amount;
      break;
  }
  
  feeDetails.updatedAt = new Date().toISOString();
  await save();
  
  return fee;
}

function calculateDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

function calculateOverdueFee(order, returnTime) {
  const dueTime = new Date(order.dueTime);
  const actualReturn = new Date(returnTime);
  
  if (actualReturn <= dueTime) {
    return { overdueDays: 0, overdueFee: 0, calculation: '按时归还，无逾期费用' };
  }
  
  const overdueDays = Math.ceil((actualReturn - dueTime) / (1000 * 60 * 60 * 24));
  const equipment = storage.equipment[order.equipmentId];
  const baseDailyRate = equipment?.dailyRentalFee || order.dailyRentalFee;
  const overdueRate = equipment?.overdueDailyRate || 1.5;
  const overdueDailyFee = baseDailyRate * overdueRate;
  const overdueFee = overdueDays * overdueDailyFee;
  
  return {
    overdueDays,
    overdueFee,
    calculation: `逾期 ${overdueDays} 天 × 日租金 ${baseDailyRate} 元 × 倍率 ${overdueRate} = ${overdueFee} 元`
  };
}

function calculateRefundAmount(orderId) {
  const ledger = getLedger(orderId);
  const feeDetails = getFeeDetails(orderId);
  
  const totalDeductable = feeDetails.totalOverdueFee + feeDetails.totalDamageFee;
  const availableBalance = ledger.totalFrozen + ledger.totalManualAdjust;
  const refundAmount = Math.max(0, availableBalance - totalDeductable);
  const damageExceedsDeposit = totalDeductable > availableBalance;
  
  return {
    totalFrozen: ledger.totalFrozen,
    totalManualAdjust: ledger.totalManualAdjust,
    totalOverdueFee: feeDetails.totalOverdueFee,
    totalDamageFee: feeDetails.totalDamageFee,
    totalDeductable,
    availableBalance,
    refundAmount,
    damageExceedsDeposit
  };
}

async function getDepositLedger(orderId) {
  return getLedger(orderId);
}

async function getFeeDetailsByOrder(orderId) {
  return getFeeDetails(orderId);
}

module.exports = {
  getLedger,
  getFeeDetails,
  addDepositTransaction,
  addFee,
  calculateDays,
  calculateOverdueFee,
  calculateRefundAmount,
  getDepositLedger,
  getFeeDetailsByOrder
};