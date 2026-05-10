import { readFileSync, writeFileSync, existsSync } from 'fs';
import { SUPPLIERS_FILE, QUALIFICATIONS_FILE, PURCHASE_ORDERS_FILE } from './config.js';
import { ensureDataDir } from './utils.js';

let suppliers = [];
let qualifications = [];
let purchaseOrders = [];

function loadFromFile(file, defaultValue) {
  if (!existsSync(file)) return defaultValue;
  try {
    const content = readFileSync(file, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return defaultValue;
  }
}

function saveToFile(file, data) {
  ensureDataDir();
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

export function loadData() {
  suppliers = loadFromFile(SUPPLIERS_FILE, []);
  qualifications = loadFromFile(QUALIFICATIONS_FILE, []);
  purchaseOrders = loadFromFile(PURCHASE_ORDERS_FILE, []);
}

export function saveData() {
  saveToFile(SUPPLIERS_FILE, suppliers);
  saveToFile(QUALIFICATIONS_FILE, qualifications);
  saveToFile(PURCHASE_ORDERS_FILE, purchaseOrders);
}

export function getSuppliers() {
  return suppliers;
}

export function getQualifications() {
  return qualifications;
}

export function getPurchaseOrders() {
  return purchaseOrders;
}

export function findSupplierById(id) {
  return suppliers.find(s => s.id === id);
}

export function findSupplierByCode(code) {
  return suppliers.find(s => s.code === code);
}

export function findQualificationsBySupplier(supplierId) {
  return qualifications.filter(q => q.supplierId === supplierId);
}

export function findPurchaseOrdersBySupplier(supplierId) {
  return purchaseOrders.filter(po => po.supplierId === supplierId);
}

export function addSupplier(supplier) {
  const existing = findSupplierByCode(supplier.code);
  if (existing) {
    Object.assign(existing, supplier);
    return existing;
  }
  suppliers.push(supplier);
  return supplier;
}

export function addQualification(qualification) {
  const existing = qualifications.find(q => 
    q.supplierId === qualification.supplierId && 
    q.type === qualification.type
  );
  
  if (existing) {
    const newVersion = (existing.version || 1) + 1;
    const oldExpiry = existing.expiryDate;
    Object.assign(existing, qualification);
    existing.version = newVersion;
    existing.oldExpiryDate = oldExpiry;
    return existing;
  }
  
  qualification.version = 1;
  qualifications.push(qualification);
  return qualification;
}

export function addPurchaseOrder(po) {
  const existing = purchaseOrders.find(p => p.orderNumber === po.orderNumber);
  if (existing) {
    Object.assign(existing, po);
    return existing;
  }
  purchaseOrders.push(po);
  return po;
}
