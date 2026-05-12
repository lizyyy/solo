import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB } from '../config/database.js';

export const TRANSACTION_TYPES = {
  ISSUE: 'issue',
  BIND: 'bind',
  USE: 'use',
  REFUND: 'refund'
};

export async function createTransaction({ type, voucherId, sourceId, corporateId = null, passengerId = null, passengerName = null, amount = 1, requestId = null, notes = null }) {
  const db = await getDB();
  
  if (requestId) {
    const existing = db.data.transactions.find(t => t.requestId === requestId);
    if (existing) {
      return existing;
    }
  }
  
  const transaction = {
    id: uuidv4(),
    requestId,
    type,
    voucherId,
    sourceId,
    corporateId,
    passengerId,
    passengerName,
    amount,
    notes,
    createdAt: new Date().toISOString()
  };

  db.data.transactions.push(transaction);
  await saveDB();
  
  return transaction;
}

export async function getTransactionById(id) {
  const db = await getDB();
  return db.data.transactions.find(t => t.id === id);
}

export async function getTransactionByRequestId(requestId) {
  const db = await getDB();
  return db.data.transactions.find(t => t.requestId === requestId);
}

export async function getTransactionsBySource(sourceId, startDate = null, endDate = null) {
  const db = await getDB();
  let transactions = db.data.transactions.filter(t => t.sourceId === sourceId);
  
  if (startDate) {
    transactions = transactions.filter(t => new Date(t.createdAt) >= new Date(startDate));
  }
  if (endDate) {
    transactions = transactions.filter(t => new Date(t.createdAt) <= new Date(endDate));
  }
  
  return transactions;
}

export async function getTransactionsByVoucher(voucherId) {
  const db = await getDB();
  return db.data.transactions.filter(t => t.voucherId === voucherId);
}

export async function getAllTransactions(startDate = null, endDate = null) {
  const db = await getDB();
  let transactions = db.data.transactions;
  
  if (startDate) {
    transactions = transactions.filter(t => new Date(t.createdAt) >= new Date(startDate));
  }
  if (endDate) {
    transactions = transactions.filter(t => new Date(t.createdAt) <= new Date(endDate));
  }
  
  return transactions;
}