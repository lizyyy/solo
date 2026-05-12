import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB } from '../config/database.js';

export async function createCorporateAccount({ name, totalQuota, usedQuota = 0, contact = null }) {
  const db = await getDB();
  
  const account = {
    id: uuidv4(),
    name,
    totalQuota,
    usedQuota,
    contact,
    createdAt: new Date().toISOString()
  };

  db.data.corporateAccounts.push(account);
  await saveDB();
  
  return account;
}

export async function getCorporateAccountById(id) {
  const db = await getDB();
  return db.data.corporateAccounts.find(a => a.id === id);
}

export async function getCorporateAccountByName(name) {
  const db = await getDB();
  return db.data.corporateAccounts.find(a => a.name === name);
}

export async function updateCorporateAccount(id, updates) {
  const db = await getDB();
  const index = db.data.corporateAccounts.findIndex(a => a.id === id);
  if (index !== -1) {
    db.data.corporateAccounts[index] = { ...db.data.corporateAccounts[index], ...updates };
    await saveDB();
    return db.data.corporateAccounts[index];
  }
  return null;
}

export async function useCorporateQuota(corporateId, amount = 1) {
  const account = await getCorporateAccountById(corporateId);
  if (!account) {
    throw new Error('企业账户不存在');
  }
  
  const remainingQuota = account.totalQuota - account.usedQuota;
  if (remainingQuota < amount) {
    throw new Error('企业额度不足');
  }
  
  return await updateCorporateAccount(corporateId, {
    usedQuota: account.usedQuota + amount
  });
}

export async function restoreCorporateQuota(corporateId, amount = 1) {
  const account = await getCorporateAccountById(corporateId);
  if (!account) {
    throw new Error('企业账户不存在');
  }
  
  const newUsedQuota = Math.max(0, account.usedQuota - amount);
  return await updateCorporateAccount(corporateId, {
    usedQuota: newUsedQuota
  });
}

export async function getAllCorporateAccounts() {
  const db = await getDB();
  return db.data.corporateAccounts;
}