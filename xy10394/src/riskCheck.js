import { QUALIFICATION_TYPES } from './config.js';
import { 
  getSuppliers, 
  getQualifications, 
  getPurchaseOrders,
  findQualificationsBySupplier,
  findSupplierById
} from './storage.js';
import { parseDate, isValidDate, calculateExpiryStatus } from './utils.js';

export function checkAllRisks() {
  const risks = [];
  const suppliers = getSuppliers();
  
  for (const supplier of suppliers) {
    const supplierQualifications = findQualificationsBySupplier(supplier.id);
    
    risks.push(...checkMissingQualifications(supplier, supplierQualifications));
    risks.push(...checkInvalidDates(supplierQualifications, supplier));
    risks.push(...checkExpiredQualifications(supplierQualifications, supplier));
    risks.push(...checkExpiredInUse(supplier));
  }
  
  return risks.flat().filter(r => r);
}

function checkMissingQualifications(supplier, qualifications) {
  const risks = [];
  const hasAllTypes = QUALIFICATION_TYPES.slice(0, 4);
  
  const existingTypes = new Set(qualifications.map(q => q.type));
  
  for (const type of hasAllTypes) {
    if (!existingTypes.has(type)) {
      risks.push({
        id: `${supplier.id}-missing-${type}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierCode: supplier.code,
        type: 'missing_qualification',
        qualificationType: type,
        level: 'MEDIUM',
        message: `供应商 ${supplier.name} 缺少 ${type}`,
        suggestion: '尽快联系供应商补交',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  return risks;
}

function checkInvalidDates(qualifications, supplier) {
  return qualifications
    .filter(q => !isValidDate(q.expiryDate))
    .map(q => ({
      id: `${q.id}-invalid-date`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierCode: supplier.code,
      type: 'invalid_date',
      qualificationType: q.type,
      qualificationId: q.id,
      level: 'HIGH',
      message: `${supplier.name} 的 ${q.type} 日期格式错误: ${q.expiryDate || '(空值)'}`,
      suggestion: '修正日期格式',
      timestamp: new Date().toISOString()
    }));
}

function checkExpiredQualifications(qualifications, supplier) {
  return qualifications
    .map(q => {
      const status = calculateExpiryStatus(q.expiryDate);
      
      if (status.status === 'expired') {
        return {
          id: `${q.id}-expired`,
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierCode: supplier.code,
          type: 'expired',
          qualificationType: q.type,
          qualificationId: q.id,
          expiryDate: q.expiryDate,
          daysLeft: status.daysLeft,
          level: 'CRITICAL',
          message: `${supplier.name} 的 ${q.type} 已过期 ${Math.abs(status.daysLeft)} 天`,
          suggestion: '暂停采购，要求立即补交新资质',
          timestamp: new Date().toISOString()
        };
      } else if (status.status === 'warning') {
        return {
          id: `${q.id}-warning`,
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierCode: supplier.code,
          type: 'warning',
          qualificationType: q.type,
          qualificationId: q.id,
          expiryDate: q.expiryDate,
          daysLeft: status.daysLeft,
          level: 'MEDIUM',
          message: `${supplier.name} 的 ${q.type} 将在 ${status.daysLeft} 天后到期`,
          suggestion: '提前提醒供应商准备续期',
          timestamp: new Date().toISOString()
        };
      }
      return null;
    })
    .filter(Boolean);
}

function checkExpiredInUse(supplier) {
  const purchaseOrders = getPurchaseOrders().filter(po => po.supplierId === supplier.id);
  const qualifications = findQualificationsBySupplier(supplier.id);
  const risks = [];
  
  for (const po of purchaseOrders) {
    const poDate = parseDate(po.orderDate);
    
    for (const q of qualifications) {
      const expiry = parseDate(q.expiryDate);
      
      if (expiry && poDate && poDate > expiry) {
        risks.push({
          id: `${po.id}-expired-use-${q.id}`,
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierCode: supplier.code,
          type: 'expired_in_use',
          qualificationType: q.type,
          qualificationId: q.id,
          purchaseOrderId: po.id,
          purchaseOrderNumber: po.orderNumber,
          expiryDate: q.expiryDate,
          orderDate: po.orderDate,
          level: 'CRITICAL',
          message: `采购单 ${po.orderNumber} (${po.orderDate}) 在 ${q.type} (${q.expiryDate}) 过期后仍在使用`,
          suggestion: '立即暂停该采购单，要求供应商更新资质',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  return risks;
}

export function getRiskSummary(risks) {
  const summary = {
    total: risks.length,
    byLevel: {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    },
    byType: {},
    bySupplier: {}
  };
  
  for (const risk of risks) {
    summary.byLevel[risk.level] = (summary.byLevel[risk.level] || 0);
    summary.byLevel[risk.level]++;
    
    summary.byType[risk.type] = (summary.byType[risk.type] || 0);
    summary.byType[risk.type]++;
    
    summary.bySupplier[risk.supplierName] = (summary.bySupplier[risk.supplierName] || 0) + 1;
  }
  
  return summary;
}

export function filterRisksByLevel(risks, level) {
  return risks.filter(r => r.level === level);
}

export function filterRisksByType(risks, type) {
  return risks.filter(r => r.type === type);
}
