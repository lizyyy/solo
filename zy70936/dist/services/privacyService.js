"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskIdCard = maskIdCard;
exports.maskPhone = maskPhone;
exports.maskAddress = maskAddress;
exports.maskCustomerData = maskCustomerData;
exports.getPrivacyAuditLogs = getPrivacyAuditLogs;
const database_1 = require("../database");
const id_1 = require("../utils/id");
function maskIdCard(idCard) {
    if (!idCard || idCard.length < 8)
        return idCard;
    return idCard.substring(0, 6) + '********' + idCard.substring(14);
}
function maskPhone(phone) {
    if (!phone || phone.length < 7)
        return phone;
    return phone.substring(0, 3) + '****' + phone.substring(7);
}
function maskAddress(address) {
    if (!address || address.length < 6)
        return address;
    return address.substring(0, 3) + '***' + address.substring(address.length - 3);
}
function createPrivacyAuditLog(customerId, fieldName, originalValue, maskedValue, reason, operator) {
    const db = (0, database_1.getDb)();
    const logId = (0, id_1.generateId)('privacy_log');
    db.prepare(`
    INSERT OR IGNORE INTO privacy_audit_logs (id, customer_id, field_name, original_value, masked_value, reason, operator, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(logId, customerId, fieldName, originalValue, maskedValue, reason, operator, Date.now());
}
function maskCustomerData(customer, reason = '数据展示隐私保护', operator = 'system') {
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
function getPrivacyAuditLogs(customerId, limit = 100) {
    const db = (0, database_1.getDb)();
    let query = 'SELECT * FROM privacy_audit_logs';
    const params = [];
    if (customerId) {
        query += ' WHERE customer_id = ?';
        params.push(customerId);
    }
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);
    const rows = db.prepare(query).all(...params);
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
