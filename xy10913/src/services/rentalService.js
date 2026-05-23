const moment = require('moment');
const { Rental, Equipment, DepositTransaction, Damage, Renewal, Settlement, ExceptionLog } = require('../models/dal');

const OVERDUE_DAILY_RATE_MULTIPLIER = 1.5;

async function createRental(data) {
  const equipment = await Equipment.getById(data.equipment_id);
  if (!equipment) {
    throw new Error('设备不存在');
  }
  if (equipment.status !== 'available') {
    throw new Error('设备不可租赁');
  }

  const totalDeposit = equipment.deposit_amount;
  
  const result = await Rental.create({
    ...data,
    total_deposit: totalDeposit
  });

  await Equipment.updateStatus(data.equipment_id, 'rented');

  return result;
}

async function freezeDeposit(rentalId, requestId, operator) {
  const rental = await Rental.getById(rentalId);
  if (!rental) {
    throw new Error('租赁单不存在');
  }

  const existingTx = await DepositTransaction.getByRequestId(requestId);
  if (existingTx) {
    return { success: true, message: '押金已冻结（幂等）', transaction: existingTx };
  }

  await DepositTransaction.create({
    rental_id: rentalId,
    transaction_type: 'freeze',
    amount: rental.total_deposit,
    request_id: requestId,
    operator: operator,
    remark: '押金冻结'
  });

  await Rental.updateStatus(rentalId, 'deposit_frozen');

  return { success: true, message: '押金冻结成功' };
}

async function applyRenewal(rentalId, requestId, extensionDays, operator) {
  const rental = await Rental.getById(rentalId);
  if (!rental) {
    throw new Error('租赁单不存在');
  }

  const existingRenewal = await Renewal.getByRequestId(requestId);
  if (existingRenewal) {
    return { success: true, message: '续租已处理（幂等）', renewal: existingRenewal };
  }

  const equipment = await Equipment.getById(rental.equipment_id);
  const extensionFee = extensionDays * equipment.daily_rate;

  const originalEndDate = rental.end_date;
  const newEndDate = moment(originalEndDate).add(extensionDays, 'days').format('YYYY-MM-DD HH:mm:ss');

  await Renewal.create({
    rental_id: rentalId,
    request_id: requestId,
    original_end_date: originalEndDate,
    new_end_date: newEndDate,
    extension_days: extensionDays,
    extension_fee: extensionFee,
    operator: operator
  });

  await Rental.updateEndDate(rentalId, newEndDate);
  
  const newRemaining = rental.remaining_deposit - extensionFee;
  await Rental.updateRemainingDeposit(rentalId, Math.max(0, newRemaining));

  await DepositTransaction.create({
    rental_id: rentalId,
    transaction_type: 'renewal_fee',
    amount: extensionFee,
    request_id: requestId + '_tx',
    operator: operator,
    remark: `续租${extensionDays}天费用`
  });

  return { success: true, message: '续租成功', extensionFee, newEndDate };
}

function calculateOverdueFee(rental, equipment, actualEndDate) {
  const scheduledEnd = moment(rental.end_date);
  const actualEnd = moment(actualEndDate);
  
  if (actualEnd.isSameOrBefore(scheduledEnd)) {
    return 0;
  }

  const overdueDays = actualEnd.diff(scheduledEnd, 'days');
  return overdueDays * equipment.daily_rate * OVERDUE_DAILY_RATE_MULTIPLIER;
}

async function reportDamage(rentalId, damageType, description, deductionAmount, reportedBy) {
  const rental = await Rental.getById(rentalId);
  if (!rental) {
    throw new Error('租赁单不存在');
  }

  const damageId = await Damage.create({
    rental_id: rentalId,
    damage_type: damageType,
    description: description,
    deduction_amount: deductionAmount,
    reported_by: reportedBy
  });

  return { success: true, damageId };
}

async function settleRental(rentalId, actualEndDate, generatedBy) {
  const rental = await Rental.getById(rentalId);
  if (!rental) {
    throw new Error('租赁单不存在');
  }

  const existingSettlement = await Settlement.getByRentalId(rentalId);
  if (existingSettlement) {
    return { success: true, message: '结算已完成', settlement: existingSettlement };
  }

  const equipment = await Equipment.getById(rental.equipment_id);
  const damages = await Damage.getByRentalId(rentalId);
  const renewals = await Renewal.getByRentalId(rentalId);

  const damageDeduction = damages.reduce((sum, d) => sum + d.deduction_amount, 0);
  const renewalFee = renewals.reduce((sum, r) => sum + r.extension_fee, 0);
  const overdueFee = calculateOverdueFee(rental, equipment, actualEndDate);

  const totalDeductions = damageDeduction + renewalFee + overdueFee;
  const refundAmount = Math.max(0, rental.total_deposit - totalDeductions);

  const settlementResult = await Settlement.create({
    rental_id: rentalId,
    total_deposit: rental.total_deposit,
    damage_deduction: damageDeduction,
    overdue_fee: overdueFee,
    renewal_fee: renewalFee,
    refund_amount: refundAmount,
    generated_by: generatedBy
  });

  if (refundAmount > 0) {
    await DepositTransaction.create({
      rental_id: rentalId,
      transaction_type: 'refund',
      amount: refundAmount,
      request_id: 'refund_' + rentalId,
      operator: generatedBy,
      remark: '押金退款'
    });
  }

  await Rental.complete(rentalId, actualEndDate);
  await Equipment.updateStatus(rental.equipment_id, 'available');

  return {
    success: true,
    settlement: {
      ...settlementResult,
      total_deposit: rental.total_deposit,
      damage_deduction: damageDeduction,
      overdue_fee: overdueFee,
      renewal_fee: renewalFee,
      refund_amount: refundAmount
    }
  };
}

async function manualCorrection(rentalId, adjustmentAmount, reason, operator) {
  const rental = await Rental.getById(rentalId);
  if (!rental) {
    throw new Error('租赁单不存在');
  }

  const newRemaining = Math.max(0, rental.remaining_deposit + adjustmentAmount);
  await Rental.updateRemainingDeposit(rentalId, newRemaining);

  await DepositTransaction.create({
    rental_id: rentalId,
    transaction_type: adjustmentAmount > 0 ? 'manual_add' : 'manual_deduct',
    amount: Math.abs(adjustmentAmount),
    request_id: 'manual_' + Date.now(),
    operator: operator,
    remark: reason
  });

  return { success: true, newRemaining };
}

async function logException(apiPath, method, rawInput, errorMessage, processingResult, operator) {
  await ExceptionLog.create({
    api_path: apiPath,
    request_method: method,
    raw_input: JSON.stringify(rawInput),
    error_message: errorMessage,
    processing_result: processingResult,
    operator: operator
  });
}

async function getRentalDetails(rentalId) {
  const rental = await Rental.getById(rentalId);
  if (!rental) {
    return null;
  }

  const equipment = await Equipment.getById(rental.equipment_id);
  const transactions = await DepositTransaction.getByRentalId(rentalId);
  const damages = await Damage.getByRentalId(rentalId);
  const renewals = await Renewal.getByRentalId(rentalId);
  const settlement = await Settlement.getByRentalId(rentalId);

  return {
    rental,
    equipment,
    transactions,
    damages,
    renewals,
    settlement
  };
}

module.exports = {
  createRental,
  freezeDeposit,
  applyRenewal,
  reportDamage,
  settleRental,
  manualCorrection,
  logException,
  getRentalDetails,
  calculateOverdueFee
};
