import { createVoucher, getVoucherById, getVoucherByCode, updateVoucher, VOUCHER_STATUS, VOUCHER_TYPES } from '../models/Voucher.js';
import { createPassenger, getPassengerById, getPassengerByIdCard } from '../models/Passenger.js';
import { getCorporateAccountById, useCorporateQuota, restoreCorporateQuota } from '../models/CorporateAccount.js';
import { createTransaction, TRANSACTION_TYPES, getTransactionByRequestId } from '../models/Transaction.js';

export async function issueVoucher({ type, sourceId, corporateId = null, amount = 1, requestId = null, expiryDate = null }) {
  if (requestId) {
    const existingTx = await getTransactionByRequestId(requestId);
    if (existingTx) {
      const voucher = await getVoucherById(existingTx.voucherId);
      return { success: true, voucher, transaction: existingTx, duplicated: true };
    }
  }

  if (type === VOUCHER_TYPES.CORPORATE && !corporateId) {
    return { success: false, error: '企业券必须指定企业ID' };
  }

  if (type === VOUCHER_TYPES.CORPORATE) {
    try {
      await useCorporateQuota(corporateId, amount);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  const voucher = await createVoucher({ type, sourceId, amount, corporateId, expiryDate });

  const transaction = await createTransaction({
    type: TRANSACTION_TYPES.ISSUE,
    voucherId: voucher.id,
    sourceId,
    corporateId,
    amount,
    requestId,
    notes: '发券成功'
  });

  return { success: true, voucher, transaction };
}

export async function bindPassenger({ voucherCode, passengerName, idCard, phone = null, requestId = null }) {
  if (requestId) {
    const existingTx = await getTransactionByRequestId(requestId);
    if (existingTx) {
      const voucher = await getVoucherById(existingTx.voucherId);
      return { success: true, voucher, transaction: existingTx, duplicated: true };
    }
  }

  const voucher = await getVoucherByCode(voucherCode);
  if (!voucher) {
    return { success: false, error: '券不存在' };
  }

  if (voucher.status !== VOUCHER_STATUS.ISSUED) {
    return { success: false, error: '券状态不正确，当前状态: ' + voucher.status };
  }

  if (new Date(voucher.expiryDate) < new Date()) {
    return { success: false, error: '券已过期' };
  }

  const passenger = await createPassenger({ name: passengerName, idCard, phone });

  const updatedVoucher = await updateVoucher(voucher.id, {
    status: VOUCHER_STATUS.BOUND,
    passengerId: passenger.id,
    passengerName: passenger.name,
    boundAt: new Date().toISOString()
  });

  const transaction = await createTransaction({
    type: TRANSACTION_TYPES.BIND,
    voucherId: voucher.id,
    sourceId: voucher.sourceId,
    corporateId: voucher.corporateId,
    passengerId: passenger.id,
    passengerName: passenger.name,
    requestId,
    notes: '绑定旅客成功'
  });

  return { success: true, voucher: updatedVoucher, passenger, transaction };
}

export async function redeemVoucher({ voucherCode, passengerName, requestId = null }) {
  if (requestId) {
    const existingTx = await getTransactionByRequestId(requestId);
    if (existingTx) {
      const voucher = await getVoucherById(existingTx.voucherId);
      return { success: true, voucher, transaction: existingTx, duplicated: true };
    }
  }

  const voucher = await getVoucherByCode(voucherCode);
  if (!voucher) {
    return { success: false, error: '券不存在' };
  }

  if (voucher.status === VOUCHER_STATUS.USED) {
    return { success: false, error: '券已被使用，请勿重复核销' };
  }

  if (voucher.status === VOUCHER_STATUS.REFUNDED) {
    return { success: false, error: '券已退款' };
  }

  if (voucher.status !== VOUCHER_STATUS.BOUND) {
    return { success: false, error: '券未绑定旅客，请先绑定' };
  }

  if (new Date(voucher.expiryDate) < new Date()) {
    return { success: false, error: '券已过期' };
  }

  if (voucher.passengerName !== passengerName) {
    return { 
      success: false, 
      error: '旅客姓名不匹配',
      expectedName: voucher.passengerName,
      providedName: passengerName
    };
  }

  const updatedVoucher = await updateVoucher(voucher.id, {
    status: VOUCHER_STATUS.USED,
    usedAt: new Date().toISOString()
  });

  const transaction = await createTransaction({
    type: TRANSACTION_TYPES.USE,
    voucherId: voucher.id,
    sourceId: voucher.sourceId,
    corporateId: voucher.corporateId,
    passengerId: voucher.passengerId,
    passengerName: voucher.passengerName,
    requestId,
    notes: '核销成功'
  });

  return { success: true, voucher: updatedVoucher, transaction };
}

export async function refundVoucher({ voucherCode, reason = null, requestId = null }) {
  if (requestId) {
    const existingTx = await getTransactionByRequestId(requestId);
    if (existingTx) {
      const voucher = await getVoucherById(existingTx.voucherId);
      return { success: true, voucher, transaction: existingTx, duplicated: true };
    }
  }

  const voucher = await getVoucherByCode(voucherCode);
  if (!voucher) {
    return { success: false, error: '券不存在' };
  }

  if (voucher.status === VOUCHER_STATUS.REFUNDED) {
    return { success: false, error: '券已退款' };
  }

  if (voucher.status === VOUCHER_STATUS.ISSUED) {
    return { success: false, error: '券未使用，无需退款' };
  }

  if (voucher.type === VOUCHER_TYPES.CORPORATE && voucher.corporateId) {
    try {
      await restoreCorporateQuota(voucher.corporateId, voucher.amount);
    } catch (error) {
      return { success: false, error: '恢复企业额度失败: ' + error.message };
    }
  }

  const updatedVoucher = await updateVoucher(voucher.id, {
    status: VOUCHER_STATUS.REFUNDED,
    refundedAt: new Date().toISOString()
  });

  const transaction = await createTransaction({
    type: TRANSACTION_TYPES.REFUND,
    voucherId: voucher.id,
    sourceId: voucher.sourceId,
    corporateId: voucher.corporateId,
    passengerId: voucher.passengerId,
    passengerName: voucher.passengerName,
    requestId,
    notes: reason || '退款成功'
  });

  return { success: true, voucher: updatedVoucher, transaction };
}

export async function getQuota(corporateId) {
  const account = await getCorporateAccountById(corporateId);
  if (!account) {
    return { success: false, error: '企业账户不存在' };
  }

  return {
    success: true,
    corporateId: account.id,
    corporateName: account.name,
    totalQuota: account.totalQuota,
    usedQuota: account.usedQuota,
    remainingQuota: account.totalQuota - account.usedQuota
  };
}