import { 
  getQualifications, 
  getSuppliers,
  addQualification,
  findQualificationsBySupplier,
  saveData
} from './storage.js';
import { generateId, getCurrentDate, calculateExpiryStatus } from './utils.js';

export function registerRenewal(supplierCode, qualificationType, newExpiryDate, newCertificateNumber = null) {
  const supplier = getSuppliers().find(s => s.code === supplierCode);
  if (!supplier) {
    return { success: false, error: `未找到供应商: ${supplierCode}` };
  }
  
  const qualifications = findQualificationsBySupplier(supplier.id);
  const existing = qualifications.find(q => q.type === qualificationType);
  
  if (!existing) {
    return { success: false, error: `供应商 ${supplier.name} 没有 ${qualificationType} 记录` };
  }
  
  const updatedQualification = {
    ...existing,
    expiryDate: newExpiryDate,
    issueDate: getCurrentDate(),
    certificateNumber: newCertificateNumber || existing.certificateNumber,
    status: 'active',
    remarks: `${getCurrentDate()} 已更新，旧版本: v${existing.version}，旧到期日: ${existing.expiryDate}`
  };
  
  const result = addQualification(updatedQualification);
  saveData();
  
  const status = calculateExpiryStatus(newExpiryDate);
  
  return {
    success: true,
    message: `${qualificationType} 已更新到 v${result.version}`,
    qualification: result,
    status: status.status,
    daysLeft: status.daysLeft
  };
}

export function getPendingRenewals() {
  const allQualifications = getQualifications();
  const pending = [];
  
  for (const qual of allQualifications) {
    const status = calculateExpiryStatus(qual.expiryDate);
    if (status.status === 'expired' || status.status === 'warning') {
      const supplier = getSuppliers().find(s => s.id === qual.supplierId);
      pending.push({
        supplierName: supplier ? supplier.name : '未知',
        supplierCode: supplier ? supplier.code : '未知',
        qualificationType: qual.type,
        expiryDate: qual.expiryDate,
        status: status.status,
        daysLeft: status.daysLeft,
        version: qual.version
      });
    }
  }
  
  return pending.sort((a, b) => {
    if (a.status === 'expired' && b.status !== 'expired') return -1;
    if (b.status === 'expired' && a.status !== 'expired') return 1;
    return (a.daysLeft || 0) - (b.daysLeft || 0);
  });
}

export function getRenewalHistory() {
  const qualifications = getQualifications();
  const history = [];
  
  for (const qual of qualifications) {
    if (qual.oldExpiryDate || qual.version > 1) {
      const supplier = getSuppliers().find(s => s.id === qual.supplierId);
      history.push({
        supplierName: supplier ? supplier.name : '未知',
        supplierCode: supplier ? supplier.code : '未知',
        qualificationType: qual.type,
        currentVersion: qual.version,
        currentExpiry: qual.expiryDate,
        oldExpiry: qual.oldExpiryDate || '-',
        remarks: qual.remarks || '-'
      });
    }
  }
  
  return history;
}
