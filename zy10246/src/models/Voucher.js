import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB } from '../config/database.js';

export const VOUCHER_TYPES = {
  BANK: 'bank',
  CORPORATE: 'corporate'
};

export const VOUCHER_STATUS = {
  ISSUED: 'issued',
  BOUND: 'bound',
  USED: 'used',
  REFUNDED: 'refunded',
  EXPIRED: 'expired'
};

export async function createVoucher({ type, sourceId, amount = 1, corporateId = null, expiryDate = null }) {
  const db = await getDB();
  
  const voucher = {
    id: uuidv4(),
    code: `VOUCH-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
    type,
    sourceId,
    corporateId,
    amount,
    status: VOUCHER_STATUS.ISSUED,
    passengerId: null,
    passengerName: null,
    boundAt: null,
    usedAt: null,
    refundedAt: null,
    expiryDate: expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString()
  };

  db.data.vouchers.push(voucher);
  await saveDB();
  
  return voucher;
}

export async function getVoucherById(id) {
  const db = await getDB();
  return db.data.vouchers.find(v => v.id === id);
}

export async function getVoucherByCode(code) {
  const db = await getDB();
  return db.data.vouchers.find(v => v.code === code);
}

export async function updateVoucher(id, updates) {
  const db = await getDB();
  const index = db.data.vouchers.findIndex(v => v.id === id);
  if (index !== -1) {
    db.data.vouchers[index] = { ...db.data.vouchers[index], ...updates };
    await saveDB();
    return db.data.vouchers[index];
  }
  return null;
}

export async function getVouchersBySource(sourceId, startDate = null, endDate = null) {
  const db = await getDB();
  let vouchers = db.data.vouchers.filter(v => v.sourceId === sourceId);
  
  if (startDate) {
    vouchers = vouchers.filter(v => new Date(v.createdAt) >= new Date(startDate));
  }
  if (endDate) {
    vouchers = vouchers.filter(v => new Date(v.createdAt) <= new Date(endDate));
  }
  
  return vouchers;
}