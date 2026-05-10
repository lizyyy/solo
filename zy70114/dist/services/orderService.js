"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignRider = exports.getOrderNodes = exports.addOrderNode = exports.updateOrderStatus = exports.getOrderByNo = exports.getOrderById = exports.createOrder = exports.canTransition = exports.getNodeTypeName = exports.getStatusName = void 0;
const database_1 = require("../database");
const response_1 = require("../utils/response");
const idempotentService_1 = require("./idempotentService");
const getStatusName = (status) => {
    const names = {
        created: '订单创建',
        merchant_accepted: '商家已接单',
        cooking: '制作中',
        meal_ready: '已出餐',
        rider_picked_up: '骑手已取餐',
        delivered: '已送达',
        cancelled: '已取消',
    };
    return names[status] || status;
};
exports.getStatusName = getStatusName;
const getNodeTypeName = (nodeType) => {
    const names = {
        create_order: '创建订单',
        merchant_accept: '商家接单',
        start_cooking: '开始制作',
        meal_ready: '出餐',
        rider_assign: '分配骑手',
        rider_pickup: '骑手取餐',
        deliver: '送达',
        cancel: '取消',
    };
    return names[nodeType] || nodeType;
};
exports.getNodeTypeName = getNodeTypeName;
const canTransition = (from, to) => {
    const transitions = {
        created: ['merchant_accepted', 'cancelled'],
        merchant_accepted: ['cooking', 'cancelled'],
        cooking: ['meal_ready', 'cancelled'],
        meal_ready: ['rider_picked_up', 'cancelled'],
        rider_picked_up: ['delivered', 'cancelled'],
        delivered: [],
        cancelled: [],
    };
    return transitions[from]?.includes(to) || false;
};
exports.canTransition = canTransition;
const createOrder = (orderNo, merchantId, merchantName, userId, userName, orderAmount, expectedMealMinutes, operatorId, operatorRole) => {
    if (!orderNo || !orderNo.trim()) {
        throw new response_1.BusinessError('订单号不能为空', '请提供订单号', 'INVALID_ORDER_NO');
    }
    if (!merchantId || !merchantId.trim()) {
        throw new response_1.BusinessError('商家ID不能为空', '请提供商家ID', 'INVALID_MERCHANT');
    }
    if (!userId || !userId.trim()) {
        throw new response_1.BusinessError('用户ID不能为空', '请提供用户ID', 'INVALID_USER');
    }
    if (!orderAmount || orderAmount <= 0) {
        throw new response_1.BusinessError('订单金额无效', '订单金额必须大于0', 'INVALID_AMOUNT');
    }
    if (!expectedMealMinutes || expectedMealMinutes <= 0) {
        throw new response_1.BusinessError('预期出餐时间无效', '预期出餐时间必须大于0分钟', 'INVALID_MEAL_TIME');
    }
    const db = (0, database_1.getDb)();
    const existingOrder = (0, database_1.executeGet)('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
    if (existingOrder) {
        throw new response_1.BusinessError('订单号已存在', `订单号「${orderNo}」已存在，请勿重复创建`, 'DUPLICATE_ORDER_NO');
    }
    const order = {
        id: (0, database_1.generateId)(),
        order_no: orderNo,
        merchant_id: merchantId,
        merchant_name: merchantName,
        user_id: userId,
        user_name: userName,
        rider_id: null,
        rider_name: null,
        order_amount: orderAmount,
        status: 'created',
        expected_meal_minutes: expectedMealMinutes,
        created_at: (0, database_1.now)(),
        updated_at: (0, database_1.now)(),
    };
    db.run(`
    INSERT INTO orders (
      id, order_no, merchant_id, merchant_name, user_id, user_name,
      rider_id, rider_name, order_amount, status, expected_meal_minutes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        order.id,
        order.order_no,
        order.merchant_id,
        order.merchant_name,
        order.user_id,
        order.user_name,
        order.rider_id,
        order.rider_name,
        order.order_amount,
        order.status,
        order.expected_meal_minutes,
        order.created_at,
        order.updated_at,
    ]);
    const orderNode = {
        id: (0, database_1.generateId)(),
        order_id: order.id,
        node_type: 'create_order',
        node_status: 'success',
        operator_id: operatorId,
        operator_role: operatorRole,
        remark: `订单金额: ¥${orderAmount}`,
        created_at: (0, database_1.now)(),
    };
    db.run(`
    INSERT INTO order_nodes (
      id, order_id, node_type, node_status, operator_id,
      operator_role, remark, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        orderNode.id,
        orderNode.order_id,
        orderNode.node_type,
        orderNode.node_status,
        orderNode.operator_id,
        orderNode.operator_role,
        orderNode.remark,
        orderNode.created_at,
    ]);
    (0, idempotentService_1.logOperation)(order.id, operatorId, operatorRole, 'create_order', `创建订单 ${orderNo}`, null, { order });
    (0, database_1.saveDatabase)();
    return order;
};
exports.createOrder = createOrder;
const getOrderById = (orderId) => {
    const order = (0, database_1.executeGet)('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
        throw new response_1.BusinessError('订单不存在', `找不到ID为「${orderId}」的订单`, 'ORDER_NOT_FOUND');
    }
    return order;
};
exports.getOrderById = getOrderById;
const getOrderByNo = (orderNo) => {
    const order = (0, database_1.executeGet)('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
    if (!order) {
        throw new response_1.BusinessError('订单不存在', `找不到订单号为「${orderNo}」的订单`, 'ORDER_NOT_FOUND');
    }
    return order;
};
exports.getOrderByNo = getOrderByNo;
const updateOrderStatus = (orderId, newStatus, operatorId, operatorRole) => {
    const db = (0, database_1.getDb)();
    const order = (0, exports.getOrderById)(orderId);
    if (order.status === newStatus) {
        return order;
    }
    if (!(0, exports.canTransition)(order.status, newStatus)) {
        throw new response_1.BusinessError('状态流转无效', `不能从「${(0, exports.getStatusName)(order.status)}」流转到「${(0, exports.getStatusName)(newStatus)}」`, 'INVALID_STATUS_TRANSITION');
    }
    db.run(`
    UPDATE orders SET status = ?, updated_at = ? WHERE id = ?
  `, [newStatus, (0, database_1.now)(), orderId]);
    (0, idempotentService_1.logOperation)(orderId, operatorId, operatorRole, 'update_status', `订单状态变更: ${(0, exports.getStatusName)(order.status)} -> ${(0, exports.getStatusName)(newStatus)}`, { status: order.status }, { status: newStatus });
    (0, database_1.saveDatabase)();
    return (0, exports.getOrderById)(orderId);
};
exports.updateOrderStatus = updateOrderStatus;
const addOrderNode = (orderId, nodeType, nodeStatus, operatorId, operatorRole, remark) => {
    const db = (0, database_1.getDb)();
    (0, exports.getOrderById)(orderId);
    const orderNode = {
        id: (0, database_1.generateId)(),
        order_id: orderId,
        node_type: nodeType,
        node_status: nodeStatus,
        operator_id: operatorId,
        operator_role: operatorRole,
        remark: remark || null,
        created_at: (0, database_1.now)(),
    };
    db.run(`
    INSERT INTO order_nodes (
      id, order_id, node_type, node_status, operator_id,
      operator_role, remark, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        orderNode.id,
        orderNode.order_id,
        orderNode.node_type,
        orderNode.node_status,
        orderNode.operator_id,
        orderNode.operator_role,
        orderNode.remark,
        orderNode.created_at,
    ]);
    (0, database_1.saveDatabase)();
    return orderNode;
};
exports.addOrderNode = addOrderNode;
const getOrderNodes = (orderId) => {
    return (0, database_1.executeAll)(`SELECT * FROM order_nodes WHERE order_id = ? ORDER BY created_at ASC`, [orderId]);
};
exports.getOrderNodes = getOrderNodes;
const assignRider = (orderId, riderId, riderName, operatorId, operatorRole) => {
    const db = (0, database_1.getDb)();
    const order = (0, exports.getOrderById)(orderId);
    if (order.rider_id) {
        throw new response_1.BusinessError('骑手已分配', `该订单已分配骑手「${order.rider_name}」`, 'RIDER_ALREADY_ASSIGNED');
    }
    const validStatuses = ['created', 'merchant_accepted', 'cooking', 'meal_ready'];
    if (!validStatuses.includes(order.status)) {
        throw new response_1.BusinessError('状态不允许', `当前状态「${(0, exports.getStatusName)(order.status)}」不能分配骑手`, 'INVALID_STATUS');
    }
    db.run(`
    UPDATE orders 
    SET rider_id = ?, rider_name = ?, updated_at = ? 
    WHERE id = ?
  `, [riderId, riderName, (0, database_1.now)(), orderId]);
    (0, exports.addOrderNode)(orderId, 'rider_assign', 'success', operatorId, operatorRole, `分配骑手: ${riderName} (${riderId})`);
    (0, database_1.saveDatabase)();
    return (0, exports.getOrderById)(orderId);
};
exports.assignRider = assignRider;
//# sourceMappingURL=orderService.js.map