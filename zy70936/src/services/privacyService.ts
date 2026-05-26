import { getDb } from '../database';
import { generateId } from '../utils/id';

export interface PrivacyAuditLog {
  id: string;
  customerId: string;
  fieldName: string;
  originalValue: string;
  maskedValue: string;
  reason: string;
  operator: string;
  timestamp: number;
}

export function maskIdCard(idCard: string): string {
  if (!idCard || idCard.length < 8) return idCard;
  return idCard.substring(0, 6) + '********' + idCard.substring(14);
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return phone.substring(0, 3) + '****' + phone.substring(7);
}

export function maskAddress(address: string): string {
  if (!address || address.length < 6) return address;
  return address.substring(0, 3) + '***' + address.substring(address.length - 3);
}

function createPrivacyAuditLog(
  customerId: string,
  fieldName: string,
  originalValue: string,
  maskedValue: string,
  reason: string,
  operator: string
): void {
  const db = getDb();
  const logId = generateId('privacy_log');

  db.prepare(`
    INSERT OR IGNORE INTO privacy_audit_logs (id, customer_id, field_name, original_value, masked_value, reason, operator, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(logId, customerId, fieldName, originalValue, maskedValue, reason, operator, Date.now());
}

export function maskCustomerData(
  customer: any,
  reason: string = '数据展示隐私保护',
  operator: string = 'system'
): any {
  const originalIdCard = customer.idCard || customer.id_card || '';
  const originalPhone = customer.phone || '';
  const originalAddress = customer.address || '';
  const customerId = customer.id;

  const maskedIdCard = maskIdCard(originalIdCard);
  const maskedPhone = maskPhone(originalPhone);
  const maskedAddress = maskAddress(originalAddress);

  if (customerId) {
    if (originalIdCard && originalIdCard !== maskedIdCard) {
      createPrivacyAuditLog(customerId, 'idCard', originalIdCard, maskedIdCard, reason, operator);
    }
    if (originalPhone && originalPhone !== maskedPhone) {
      createPrivacyAuditLog(customerId, 'phone', originalPhone, maskedPhone, reason, operator);
    }
    if (originalAddress && originalAddress !== maskedAddress) {
      createPrivacyAuditLog(customerId, 'address', originalAddress, maskedAddress, reason, operator);
    }
  }

  return {
    ...customer,
    idCard: maskedIdCard,
    phone: maskedPhone,
    address: maskedAddress
  };
}

export function getPrivacyAuditLogs(customerId?: string, limit: number = 100): PrivacyAuditLog[] {
  const db = getDb();
  let query = 'SELECT * FROM privacy_audit_logs';
  const params: any[] = [];

  if (customerId) {
    query += ' WHERE customer_id = ?';
    params.push(customerId);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map(row => ({
    id: row.id,
    customerId: row.customer_id,
    fieldName: row.field_name,
    originalValue: row.original_value,
    maskedValue: row.masked_value,
    reason: row.reason,
    operator: row.operator,
    timestamp: row.timestamp
  }));
}
