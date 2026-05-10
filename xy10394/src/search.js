import { 
  getSuppliers, 
  getQualifications, 
  getPurchaseOrders 
} from './storage.js';
import { QUALIFICATION_TYPES, RISK_LEVELS } from './config.js';

export function searchSuppliers(query) {
  const suppliers = getSuppliers();
  if (!query) return suppliers;
  
  const q = query.toLowerCase();
  
  return suppliers.filter(s => 
    s.name.toLowerCase().includes(q) ||
    s.code.toLowerCase().includes(q) ||
    (s.contact && s.contact.toLowerCase().includes(q)) ||
    (s.phone && s.phone.includes(q))
  );
}

export function searchQualifications(query, filters = {}) {
  let qualifications = getQualifications();
  
  if (query) {
    const q = query.toLowerCase();
    qualifications = qualifications.filter(qual => 
      qual.type.toLowerCase().includes(q) ||
      (qual.certificateNumber && qual.certificateNumber.includes(q))
    );
  }
  
  if (filters.supplierId) {
    qualifications = qualifications.filter(qual => qual.supplierId === filters.supplierId);
  }
  
  if (filters.type) {
    qualifications = qualifications.filter(qual => qual.type === filters.type);
  }
  
  if (filters.expiryDateRange) {
    const { start, end } = filters.expiryDateRange;
    qualifications = qualifications.filter(qual => {
      if (start && qual.expiryDate < start) return false;
      if (end && qual.expiryDate > end) return false;
      return true;
    });
  }
  
  return qualifications;
}

export function searchPurchaseOrders(query) {
  const orders = getPurchaseOrders();
  if (!query) return orders;
  
  const q = query.toLowerCase();
  
  return orders.filter(po => 
    po.orderNumber.toLowerCase().includes(q) ||
    (po.description && po.description.toLowerCase().includes(q))
  );
}

export function filterByRiskLevel(items, getRiskFn) {
  return items.filter(item => {
    const risk = getRiskFn(item);
    return risk !== undefined;
  });
}

export function getQualificationTypes() {
  return QUALIFICATION_TYPES;
}

export function getRiskLevels() {
  return RISK_LEVELS;
}
