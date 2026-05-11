"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.updateOrder = updateOrder;
exports.changeOrderStatus = changeOrderStatus;
exports.deleteOrder = deleteOrder;
exports.getOrderById = getOrderById;
exports.getOrderByOrderNo = getOrderByOrderNo;
exports.listOrders = listOrders;
exports.getOrderHistory = getOrderHistory;
const uuid_1 = require("uuid");
const types_1 = require("../../shared/types");
const constants_1 = require("../../shared/constants");
const database_1 = require("../database");
const auditService_1 = require("./auditService");
function createOrder(data, operator) {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
    const orderNo = generateOrderNo();
    try {
        const existingOrder = db.prepare('SELECT id FROM reissue_orders WHERE order_no = ?').get(orderNo);
        if (existingOrder) {
            throw new Error('订单号已存在');
        }
        const stmt = db.prepare(`
      INSERT INTO reissue_orders (
        id, order_no, customer_name, customer_phone, customer_address,
        product_name, product_sku, quantity, reason, description,
        status, assignee_id, assignee_name, tracking_no, shipping_company,
        retry_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, orderNo, data.customerName, data.customerPhone, data.customerAddress || null, data.productName, data.productSku || null, data.quantity || 1, data.reason, data.description || null, types_1.ReissueStatus.PENDING, data.assigneeId || null, data.assigneeName || null, null, null, 0, now, now);
        const order = getOrderById(id);
        createHistoryRecord({
            orderId: id,
            beforeStatus: null,
            afterStatus: types_1.ReissueStatus.PENDING,
            changeReason: '创建订单',
            operatorId: operator.id,
            operatorName: operator.name
        });
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.CREATE,
            targetType: 'order',
            targetId: id,
            userId: operator.id,
            userName: operator.name,
            detail: `创建补发订单: ${orderNo}`,
            success: true
        });
        return order;
    }
    catch (error) {
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.CREATE,
            targetType: 'order',
            targetId: null,
            userId: operator.id,
            userName: operator.name,
            detail: `创建补发订单失败`,
            success: false,
            errorMessage: error.message
        });
        throw error;
    }
}
function updateOrder(id, data, operator) {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const existingOrder = getOrderById(id);
    if (!existingOrder) {
        throw new Error('订单不存在');
    }
    const updates = [];
    const values = [];
    const updatableFields = [
        'customerName', 'customerPhone', 'customerAddress',
        'productName', 'productSku', 'quantity', 'reason', 'description',
        'assigneeId', 'assigneeName', 'trackingNo', 'shippingCompany'
    ];
    updatableFields.forEach(field => {
        const dbField = camelToSnake(field);
        if (data[field] !== undefined) {
            updates.push(`${dbField} = ?`);
            values.push(data[field]);
        }
    });
    if (updates.length === 0) {
        return existingOrder;
    }
    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);
    try {
        const stmt = db.prepare(`UPDATE reissue_orders SET ${updates.join(', ')} WHERE id = ?`);
        stmt.run(...values);
        const updatedOrder = getOrderById(id);
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.UPDATE,
            targetType: 'order',
            targetId: id,
            userId: operator.id,
            userName: operator.name,
            detail: `更新订单: ${existingOrder.orderNo}`,
            success: true
        });
        return updatedOrder;
    }
    catch (error) {
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.UPDATE,
            targetType: 'order',
            targetId: id,
            userId: operator.id,
            userName: operator.name,
            detail: `更新订单失败: ${existingOrder.orderNo}`,
            success: false,
            errorMessage: error.message
        });
        throw error;
    }
}
function changeOrderStatus(id, newStatus, changeReason, operator) {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const existingOrder = getOrderById(id);
    if (!existingOrder) {
        throw new Error('订单不存在');
    }
    const validTransitions = constants_1.STATUS_TRANSITIONS[existingOrder.status] || [];
    if (!validTransitions.includes(newStatus)) {
        throw new Error(`状态流转不合法: ${existingOrder.status} -> ${newStatus}`);
    }
    try {
        const stmt = db.prepare(`
      UPDATE reissue_orders 
      SET status = ?, updated_at = ?, completed_at = ?
      WHERE id = ?
    `);
        const completedAt = newStatus === types_1.ReissueStatus.COMPLETED ? now : existingOrder.completedAt;
        stmt.run(newStatus, now, completedAt, id);
        createHistoryRecord({
            orderId: id,
            beforeStatus: existingOrder.status,
            afterStatus: newStatus,
            changeReason,
            operatorId: operator.id,
            operatorName: operator.name
        });
        const updatedOrder = getOrderById(id);
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.STATUS_CHANGE,
            targetType: 'order',
            targetId: id,
            userId: operator.id,
            userName: operator.name,
            detail: `订单状态变更: ${existingOrder.orderNo} (${existingOrder.status} -> ${newStatus})`,
            success: true
        });
        return updatedOrder;
    }
    catch (error) {
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.STATUS_CHANGE,
            targetType: 'order',
            targetId: id,
            userId: operator.id,
            userName: operator.name,
            detail: `订单状态变更失败: ${existingOrder.orderNo}`,
            success: false,
            errorMessage: error.message
        });
        throw error;
    }
}
function deleteOrder(id, operator) {
    const db = (0, database_1.getDatabase)();
    const order = getOrderById(id);
    if (!order) {
        throw new Error('订单不存在');
    }
    try {
        db.prepare('DELETE FROM reissue_orders WHERE id = ?').run(id);
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.DELETE,
            targetType: 'order',
            targetId: id,
            userId: operator.id,
            userName: operator.name,
            detail: `删除订单: ${order.orderNo}`,
            success: true
        });
    }
    catch (error) {
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.DELETE,
            targetType: 'order',
            targetId: id,
            userId: operator.id,
            userName: operator.name,
            detail: `删除订单失败: ${order.orderNo}`,
            success: false,
            errorMessage: error.message
        });
        throw error;
    }
}
function getOrderById(id) {
    const db = (0, database_1.getDatabase)();
    const row = db.prepare(`
    SELECT 
      id, order_no as orderNo, customer_name as customerName,
      customer_phone as customerPhone, customer_address as customerAddress,
      product_name as productName, product_sku as productSku,
      quantity, reason, description, status, assignee_id as assigneeId,
      assignee_name as assigneeName, tracking_no as trackingNo,
      shipping_company as shippingCompany, retry_count as retryCount,
      created_at as createdAt, updated_at as updatedAt, completed_at as completedAt
    FROM reissue_orders WHERE id = ?
  `).get(id);
    if (!row)
        return undefined;
    return {
        ...row,
        status: row.status,
        quantity: Number(row.quantity),
        retryCount: Number(row.retryCount)
    };
}
function getOrderByOrderNo(orderNo) {
    const db = (0, database_1.getDatabase)();
    const row = db.prepare(`
    SELECT 
      id, order_no as orderNo, customer_name as customerName,
      customer_phone as customerPhone, customer_address as customerAddress,
      product_name as productName, product_sku as productSku,
      quantity, reason, description, status, assignee_id as assigneeId,
      assignee_name as assigneeName, tracking_no as trackingNo,
      shipping_company as shippingCompany, retry_count as retryCount,
      created_at as createdAt, updated_at as updatedAt, completed_at as completedAt
    FROM reissue_orders WHERE order_no = ?
  `).get(orderNo);
    if (!row)
        return undefined;
    return {
        ...row,
        status: row.status,
        quantity: Number(row.quantity),
        retryCount: Number(row.retryCount)
    };
}
function listOrders(params) {
    const db = (0, database_1.getDatabase)();
    const { page, pageSize, status, orderNo, customerName, customerPhone, assigneeId, startDate, endDate } = params;
    const conditions = [];
    const values = [];
    if (status) {
        conditions.push('status = ?');
        values.push(status);
    }
    if (orderNo) {
        conditions.push('order_no LIKE ?');
        values.push(`%${orderNo}%`);
    }
    if (customerName) {
        conditions.push('customer_name LIKE ?');
        values.push(`%${customerName}%`);
    }
    if (customerPhone) {
        conditions.push('customer_phone LIKE ?');
        values.push(`%${customerPhone}%`);
    }
    if (assigneeId) {
        conditions.push('assignee_id = ?');
        values.push(assigneeId);
    }
    if (startDate) {
        conditions.push('created_at >= ?');
        values.push(startDate);
    }
    if (endDate) {
        conditions.push('created_at <= ?');
        values.push(endDate);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countStmt = db.prepare(`
    SELECT COUNT(*) as count FROM reissue_orders ${whereClause}
  `);
    const countResult = countStmt.get(...values);
    const total = countResult.count;
    const offset = (page - 1) * pageSize;
    const dataStmt = db.prepare(`
    SELECT 
      id, order_no as orderNo, customer_name as customerName,
      customer_phone as customerPhone, customer_address as customerAddress,
      product_name as productName, product_sku as productSku,
      quantity, reason, description, status, assignee_id as assigneeId,
      assignee_name as assigneeName, tracking_no as trackingNo,
      shipping_company as shippingCompany, retry_count as retryCount,
      created_at as createdAt, updated_at as updatedAt, completed_at as completedAt
    FROM reissue_orders ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
    const rows = dataStmt.all(...values, pageSize, offset);
    const data = rows.map(row => ({
        ...row,
        status: row.status,
        quantity: Number(row.quantity),
        retryCount: Number(row.retryCount)
    }));
    return {
        data,
        total,
        page,
        pageSize
    };
}
function getOrderHistory(orderId) {
    const db = (0, database_1.getDatabase)();
    const rows = db.prepare(`
    SELECT 
      id, order_id as orderId, before_status as beforeStatus,
      after_status as afterStatus, change_reason as changeReason,
      operator_id as operatorId, operator_name as operatorName,
      created_at as createdAt
    FROM reissue_history 
    WHERE order_id = ?
    ORDER BY created_at ASC
  `).all(orderId);
    return rows.map(row => ({
        ...row,
        beforeStatus: row.beforeStatus,
        afterStatus: row.afterStatus
    }));
}
function createHistoryRecord(params) {
    const db = (0, database_1.getDatabase)();
    const id = (0, uuid_1.v4)();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
    INSERT INTO reissue_history (
      id, order_id, before_status, after_status, change_reason,
      operator_id, operator_name, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(id, params.orderId, params.beforeStatus, params.afterStatus, params.changeReason, params.operatorId, params.operatorName, now);
}
function generateOrderNo() {
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RS${dateStr}${random}`;
}
function camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
