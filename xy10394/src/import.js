import { readFileSync, existsSync } from 'fs';
import { QUALIFICATION_TYPES } from './config.js';
import { 
  addSupplier, 
  addQualification, 
  addPurchaseOrder,
  findSupplierByCode
} from './storage.js';
import { generateId, getCurrentDate } from './utils.js';

export function importSuppliers(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  const content = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const results = [];
  
  for (const item of data) {
    const supplier = {
      id: item.id || generateId(),
      code: item.code,
      name: item.name,
      contact: item.contact || '',
      phone: item.phone || '',
      address: item.address || '',
      status: item.status || 'active',
      createdAt: item.createdAt || getCurrentDate()
    };
    
    const result = addSupplier(supplier);
    results.push(result);
  }
  
  return { imported: results.length, results };
}

export function importQualifications(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  const content = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const results = [];
  const errors = [];
  
  for (const item of data) {
    if (!item.supplierCode) {
      errors.push({ item, error: '缺少供应商编码' });
      continue;
    }
    
    const supplier = findSupplierByCode(item.supplierCode);
    if (!supplier) {
      errors.push({ item, error: `未找到供应商: ${item.supplierCode}` });
      continue;
    }
    
    const qualification = {
      id: item.id || generateId(),
      supplierId: supplier.id,
      type: item.type,
      certificateNumber: item.certificateNumber || '',
      issueDate: item.issueDate || '',
      expiryDate: item.expiryDate || '',
      status: item.status || 'active',
      createdAt: item.createdAt || getCurrentDate(),
      remarks: item.remarks || ''
    };
    
    const result = addQualification(qualification);
    results.push(result);
  }
  
  return { imported: results.length, errors, results };
}

export function importPurchaseOrders(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  const content = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const results = [];
  const errors = [];
  
  for (const item of data) {
    if (!item.supplierCode) {
      errors.push({ item, error: '缺少供应商编码' });
      continue;
    }
    
    const supplier = findSupplierByCode(item.supplierCode);
    if (!supplier) {
      errors.push({ item, error: `未找到供应商: ${item.supplierCode}` });
      continue;
    }
    
    const po = {
      id: item.id || generateId(),
      supplierId: supplier.id,
      orderNumber: item.orderNumber,
      orderDate: item.orderDate || getCurrentDate(),
      description: item.description || '',
      amount: item.amount || 0,
      status: item.status || 'pending',
      createdAt: item.createdAt || getCurrentDate()
    };
    
    const result = addPurchaseOrder(po);
    results.push(result);
  }
  
  return { imported: results.length, errors, results };
}
