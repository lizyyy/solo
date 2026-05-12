const db = require('../config/database');
const { calculatePrice, ORDER_STATUS, isGroupBuyActive } = require('./priceService');
const { generateId, generateOrderNo, generatePaymentNo, generateRefundNo, now, formatPrice, addMinutes, isExpired, BusinessError } = require('../utils/helpers');

function promisifyDb(method, ...args) {
  return new Promise((resolve, reject) => {
    db[method](...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function createOrder(userId, courseId, options = {}) {
  const { couponId, groupBuyId, operatorId, operatorName } = options;
  
  const user = await getUserById(userId);
  if (!user) {
    throw new BusinessError('用户不存在', 'USER_NOT_FOUND');
  }
  
  const course = await getCourseById(courseId);
  if (!course || !course.is_active) {
    throw new BusinessError('课程不存在或已下架', 'COURSE_NOT_FOUND');
  }
  
  let coupon = null;
  if (couponId) {
    coupon = await getCouponById(couponId);
    if (!coupon) {
      throw new BusinessError('优惠券不存在', 'COUPON_NOT_FOUND');
    }
  }
  
  let groupBuy = null;
  if (groupBuyId) {
    groupBuy = await getGroupBuyById(groupBuyId);
    if (!groupBuy) {
      throw new BusinessError('团购活动不存在', 'GROUP_BUY_NOT_FOUND');
    }
    if (groupBuy.course_id !== courseId) {
      throw new BusinessError('团购活动不适用于该课程', 'GROUP_BUY_INVALID_COURSE');
    }
  }
  
  const priceResult = calculatePrice(course, user, { coupon, groupBuy });
  
  const orderId = generateId();
  const orderNo = generateOrderNo();
  const statusHistory = [
    { status: ORDER_STATUS.CREATED, timestamp: now(), reason: '订单创建' }
  ];
  
  const order = {
    id: orderId,
    order_no: orderNo,
    user_id: userId,
    course_id: courseId,
    original_price: priceResult.originalPrice,
    final_price: priceResult.finalPrice,
    discount_details: JSON.stringify(priceResult),
    coupon_id: coupon?.id || null,
    group_buy_id: groupBuy?.id || null,
    is_old_student: user.is_old_student ? 1 : 0,
    old_student_discount_applied: priceResult.oldStudentDiscountApplied,
    status: ORDER_STATUS.CREATED,
    status_history: JSON.stringify(statusHistory),
    price_lock_expires_at: null,
    is_price_locked: 0,
    created_at: now(),
    updated_at: now(),
  };
  
  await promisifyDb('run', `INSERT INTO orders (
    id, order_no, user_id, course_id, original_price, final_price, 
    discount_details, coupon_id, group_buy_id, is_old_student, 
    old_student_discount_applied, status, status_history, 
    price_lock_expires_at, is_price_locked, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    order.id, order.order_no, order.user_id, order.course_id, order.original_price, order.final_price,
    order.discount_details, order.coupon_id, order.group_buy_id, order.is_old_student,
    order.old_student_discount_applied, order.status, order.status_history,
    order.price_lock_expires_at, order.is_price_locked, order.created_at, order.updated_at,
  ]);
  
  await recordOrderOperation(orderId, 'create', operatorId, operatorName, null, order, '创建订单');
  
  return {
    order: await enrichOrder(order),
    priceResult,
  };
}

async function calculateOrderPrice(userId, courseId, options = {}) {
  const { couponId, groupBuyId } = options;
  
  const user = await getUserById(userId);
  if (!user) {
    throw new BusinessError('用户不存在', 'USER_NOT_FOUND');
  }
  
  const course = await getCourseById(courseId);
  if (!course || !course.is_active) {
    throw new BusinessError('课程不存在或已下架', 'COURSE_NOT_FOUND');
  }
  
  let coupon = null;
  if (couponId) {
    coupon = await getCouponById(couponId);
    if (!coupon) {
      throw new BusinessError('优惠券不存在', 'COUPON_NOT_FOUND');
    }
  }
  
  let groupBuy = null;
  if (groupBuyId) {
    groupBuy = await getGroupBuyById(groupBuyId);
    if (!groupBuy) {
      throw new BusinessError('团购活动不存在', 'GROUP_BUY_NOT_FOUND');
    }
    if (groupBuy.course_id !== courseId) {
      throw new BusinessError('团购活动不适用于该课程', 'GROUP_BUY_INVALID_COURSE');
    }
  }
  
  return calculatePrice(course, user, { coupon, groupBuy });
}

async function lockOrderPrice(orderId, options = {}) {
  const { lockDurationMinutes = 30, operatorId, operatorName } = options;
  
  const order = await getOrderById(orderId);
  if (!order) {
    throw new BusinessError('订单不存在', 'ORDER_NOT_FOUND');
  }
  
  const validStatuses = [ORDER_STATUS.CREATED, ORDER_STATUS.PRICE_CALCULATED, ORDER_STATUS.PRICE_LOCKED];
  if (!validStatuses.includes(order.status)) {
    throw new BusinessError('当前订单状态不支持锁价', 'INVALID_ORDER_STATUS');
  }
  
  if (order.group_buy_id) {
    const groupBuy = await getGroupBuyById(order.group_buy_id);
    if (!isGroupBuyActive(groupBuy)) {
      throw new BusinessError('团购活动已结束，无法锁价', 'GROUP_BUY_EXPIRED');
    }
  }
  
  const beforeData = { ...order };
  const priceLockExpiresAt = addMinutes(lockDurationMinutes);
  
  order.status = ORDER_STATUS.PRICE_LOCKED;
  order.is_price_locked = 1;
  order.price_lock_expires_at = priceLockExpiresAt;
  order.updated_at = now();
  
  const statusHistory = JSON.parse(order.status_history);
  statusHistory.push({ status: ORDER_STATUS.PRICE_LOCKED, timestamp: now(), reason: `价格已锁定，有效期至${priceLockExpiresAt}` });
  order.status_history = JSON.stringify(statusHistory);
  
  await promisifyDb('run', `UPDATE orders SET 
    status = ?, is_price_locked = ?, price_lock_expires_at = ?, status_history = ?, updated_at = ?
    WHERE id = ?`, [
    order.status, order.is_price_locked, order.price_lock_expires_at, order.status_history, order.updated_at, orderId
  ]);
  
  await recordOrderOperation(orderId, 'lock_price', operatorId, operatorName, beforeData, order, `锁定价格${lockDurationMinutes}分钟`);
  
  return {
    order: await enrichOrder(order),
    lockExpiresAt: priceLockExpiresAt,
  };
}

async function processPayment(orderId, paymentData = {}) {
  const { amount, paymentMethod = 'online', callbackId, callbackData, operatorId, operatorName } = paymentData;
  
  const order = await getOrderById(orderId);
  if (!order) {
    throw new BusinessError('订单不存在', 'ORDER_NOT_FOUND');
  }
  
  if (order.status === ORDER_STATUS.PAID || order.status === ORDER_STATUS.COMPLETED) {
    const existingPayment = await getSuccessfulPaymentByOrderId(orderId);
    return {
      order: await enrichOrder(order),
      payment: existingPayment,
      isIdempotent: true,
      message: '订单已支付，返回历史支付记录',
    };
  }
  
  if (callbackId) {
    const existingPayment = await getPaymentByCallbackId(callbackId);
    if (existingPayment) {
      const order = await getOrderById(existingPayment.order_id);
      return {
        order: await enrichOrder(order),
        payment: existingPayment,
        isIdempotent: true,
        message: '回调已处理，返回历史支付记录',
      };
    }
  }
  
  const validStatuses = [ORDER_STATUS.CREATED, ORDER_STATUS.PRICE_CALCULATED, ORDER_STATUS.PRICE_LOCKED, ORDER_STATUS.PENDING_PAYMENT];
  if (!validStatuses.includes(order.status)) {
    throw new BusinessError('当前订单状态不支持支付', 'INVALID_ORDER_STATUS');
  }
  
  if (order.is_price_locked && isExpired(order.price_lock_expires_at)) {
    throw new BusinessError('价格锁定已过期，请重新计算价格', 'PRICE_LOCK_EXPIRED');
  }
  
  const paymentAmount = amount || order.final_price;
  if (paymentAmount < order.final_price) {
    throw new BusinessError('支付金额不足', 'INSUFFICIENT_PAYMENT', {
      required: order.final_price,
      provided: paymentAmount,
    });
  }
  
  const beforeData = { ...order };
  const paymentId = generateId();
  const paymentNo = generatePaymentNo();
  
  const payment = {
    id: paymentId,
    payment_no: paymentNo,
    order_id: orderId,
    amount: paymentAmount,
    payment_method: paymentMethod,
    status: 'success',
    callback_id: callbackId || null,
    callback_data: callbackData ? JSON.stringify(callbackData) : null,
    paid_at: now(),
    created_at: now(),
    updated_at: now(),
  };
  
  await promisifyDb('run', `INSERT INTO payments (
    id, payment_no, order_id, amount, payment_method, status, 
    callback_id, callback_data, paid_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    payment.id, payment.payment_no, payment.order_id, payment.amount, payment.payment_method, payment.status,
    payment.callback_id, payment.callback_data, payment.paid_at, payment.created_at, payment.updated_at,
  ]);
  
  if (order.coupon_id) {
    await incrementCouponUsage(order.coupon_id);
  }
  
  if (order.group_buy_id) {
    await incrementGroupBuyPeople(order.group_buy_id);
  }
  
  order.status = ORDER_STATUS.PAID;
  order.updated_at = now();
  
  const statusHistory = JSON.parse(order.status_history);
  statusHistory.push({ status: ORDER_STATUS.PAID, timestamp: now(), reason: '支付成功' });
  order.status_history = JSON.stringify(statusHistory);
  
  await promisifyDb('run', `UPDATE orders SET status = ?, status_history = ?, updated_at = ? WHERE id = ?`, [
    order.status, order.status_history, order.updated_at, orderId
  ]);
  
  await recordOrderOperation(orderId, 'payment', operatorId, operatorName, beforeData, order, `支付成功，金额：${paymentAmount}元`);
  
  return {
    order: await enrichOrder(order),
    payment,
    isIdempotent: false,
  };
}

async function processRefund(orderId, refundData = {}) {
  const { refundAmount, refundReason, refundType = 'full', returnCoupon = false, operatorId, operatorName } = refundData;
  
  const order = await getOrderById(orderId);
  if (!order) {
    throw new BusinessError('订单不存在', 'ORDER_NOT_FOUND');
  }
  
  const payment = await getSuccessfulPaymentByOrderId(orderId);
  if (!payment) {
    throw new BusinessError('订单未支付，无法退款', 'ORDER_NOT_PAID');
  }
  
  const existingRefunds = await getRefundsByOrderId(orderId);
  const totalRefunded = existingRefunds.reduce((sum, r) => sum + r.refund_amount, 0);
  const remainingAmount = payment.amount - totalRefunded;
  
  let actualRefundAmount = refundAmount;
  
  if (refundType === 'full') {
    actualRefundAmount = remainingAmount;
  } else if (refundType === 'partial') {
    if (!refundAmount || refundAmount <= 0) {
      throw new BusinessError('退款金额不能为空', 'INVALID_REFUND_AMOUNT');
    }
    if (refundAmount > remainingAmount) {
      throw new BusinessError('退款金额超过可退金额', 'REFUND_AMOUNT_EXCEEDED', {
        maxRefundable: remainingAmount,
        requested: refundAmount,
      });
    }
    actualRefundAmount = refundAmount;
  }
  
  const discountDetails = JSON.parse(order.discount_details);
  const refundBreakdown = calculateRefundBreakdown(order, discountDetails, actualRefundAmount);
  
  let returnCouponId = null;
  if (returnCoupon && order.coupon_id && refundType === 'full') {
    returnCouponId = order.coupon_id;
    await decrementCouponUsage(order.coupon_id);
  }
  
  const refundId = generateId();
  const refundNo = generateRefundNo();
  
  const refund = {
    id: refundId,
    refund_no: refundNo,
    order_id: orderId,
    payment_id: payment.id,
    refund_amount: actualRefundAmount,
    refund_type: refundType,
    refund_reason: refundReason || null,
    return_coupon_id: returnCouponId,
    status: 'success',
    operator_id: operatorId || null,
    operator_name: operatorName || null,
    refunded_at: now(),
    created_at: now(),
    updated_at: now(),
  };
  
  await promisifyDb('run', `INSERT INTO refunds (
    id, refund_no, order_id, payment_id, refund_amount, refund_type, 
    refund_reason, return_coupon_id, status, operator_id, operator_name, 
    refunded_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    refund.id, refund.refund_no, refund.order_id, refund.payment_id, refund.refund_amount, refund.refund_type,
    refund.refund_reason, refund.return_coupon_id, refund.status, refund.operator_id, refund.operator_name,
    refund.refunded_at, refund.created_at, refund.updated_at,
  ]);
  
  const beforeData = { ...order };
  const newTotalRefunded = totalRefunded + actualRefundAmount;
  
  if (newTotalRefunded >= payment.amount) {
    order.status = ORDER_STATUS.REFUNDED;
  } else {
    order.status = ORDER_STATUS.PARTIALLY_REFUNDED;
  }
  order.updated_at = now();
  
  const statusHistory = JSON.parse(order.status_history);
  statusHistory.push({ 
    status: order.status, 
    timestamp: now(), 
    reason: `${refundType === 'full' ? '全额' : '部分'}退款成功，退款金额：${actualRefundAmount}元` 
  });
  order.status_history = JSON.stringify(statusHistory);
  
  await promisifyDb('run', `UPDATE orders SET status = ?, status_history = ?, updated_at = ? WHERE id = ?`, [
    order.status, order.status_history, order.updated_at, orderId
  ]);
  
  await recordOrderOperation(orderId, 'refund', operatorId, operatorName, beforeData, order, 
    `${refundType === 'full' ? '全额' : '部分'}退款${actualRefundAmount}元，原因：${refundReason || '未填写'}`);
  
  return {
    order: await enrichOrder(order),
    refund,
    refundBreakdown,
    customerExplanation: generateRefundExplanation(order, refund, refundBreakdown, returnCouponId),
  };
}

function calculateRefundBreakdown(order, discountDetails, refundAmount) {
  const originalPrice = order.original_price;
  const finalPrice = order.final_price;
  const totalDiscount = originalPrice - finalPrice;
  
  const breakdown = [];
  
  breakdown.push({
    type: 'original_payment',
    description: '实付金额',
    amount: finalPrice,
  });
  
  let remainingRefund = refundAmount;
  const paidDiscounts = discountDetails.discountDetails || [];
  
  for (const discount of paidDiscounts.reverse()) {
    if (remainingRefund <= 0) break;
    
    const refundFromDiscount = Math.min(discount.discountAmount, remainingRefund);
    if (refundFromDiscount > 0) {
      breakdown.push({
        type: `refund_${discount.type}`,
        description: `退还${getDiscountTypeName(discount.type)}优惠部分`,
        amount: refundFromDiscount,
        source: discount.name,
      });
      remainingRefund -= refundFromDiscount;
    }
  }
  
  if (remainingRefund > 0) {
    breakdown.push({
      type: 'refund_base',
      description: '退还实付金额',
      amount: remainingRefund,
    });
  }
  
  breakdown.push({
    type: 'total_refund',
    description: '本次退款总额',
    amount: refundAmount,
    isTotal: true,
  });
  
  return breakdown;
}

function getDiscountTypeName(type) {
  const names = {
    'group_buy': '团购',
    'old_student': '老学员折扣',
    'coupon': '优惠券',
  };
  return names[type] || type;
}

function generateRefundExplanation(order, refund, breakdown, returnCouponId) {
  const parts = [];
  
  parts.push(`您的订单「${order.order_no}」已办理${refund.refund_type === 'full' ? '全额' : '部分'}退款`);
  parts.push(`退款金额：${refund.refund_amount}元`);
  
  if (returnCouponId) {
    parts.push('使用的优惠券已退还至您的账户');
  }
  
  if (refund.refund_reason) {
    parts.push(`退款原因：${refund.refund_reason}`);
  }
  
  parts.push('退款将原路返回，预计1-7个工作日到账');
  
  return parts.join('，') + '。';
}

async function manuallyAdjustOrder(orderId, adjustmentData = {}) {
  const { newFinalPrice, changeReason, operatorId, operatorName } = adjustmentData;
  
  if (!operatorId || !operatorName) {
    throw new BusinessError('人工修正必须提供操作者信息', 'OPERATOR_REQUIRED');
  }
  
  if (!changeReason) {
    throw new BusinessError('人工修正必须填写变更原因', 'REASON_REQUIRED');
  }
  
  const order = await getOrderById(orderId);
  if (!order) {
    throw new BusinessError('订单不存在', 'ORDER_NOT_FOUND');
  }
  
  const paidStatuses = [ORDER_STATUS.PAID, ORDER_STATUS.COMPLETED, ORDER_STATUS.PARTIALLY_REFUNDED];
  if (paidStatuses.includes(order.status)) {
    throw new BusinessError('已支付订单不允许直接修改价格', 'ORDER_ALREADY_PAID');
  }
  
  if (newFinalPrice === undefined || newFinalPrice === null || newFinalPrice < 0) {
    throw new BusinessError('无效的价格', 'INVALID_PRICE');
  }
  
  const beforeData = { ...order };
  const oldFinalPrice = order.final_price;
  const priceDifference = newFinalPrice - oldFinalPrice;
  
  order.final_price = newFinalPrice;
  order.updated_at = now();
  
  const discountDetails = JSON.parse(order.discount_details);
  discountDetails.manualAdjustment = {
    originalFinalPrice: oldFinalPrice,
    newFinalPrice,
    priceDifference,
    reason: changeReason,
    operatorId,
    operatorName,
    adjustedAt: now(),
  };
  order.discount_details = JSON.stringify(discountDetails);
  
  const statusHistory = JSON.parse(order.status_history);
  statusHistory.push({ 
    status: order.status, 
    timestamp: now(), 
    reason: `人工调整价格：${oldFinalPrice}元 → ${newFinalPrice}元，原因：${changeReason}` 
  });
  order.status_history = JSON.stringify(statusHistory);
  
  await promisifyDb('run', `UPDATE orders SET 
    final_price = ?, discount_details = ?, status_history = ?, updated_at = ? 
    WHERE id = ?`, [
    order.final_price, order.discount_details, order.status_history, order.updated_at, orderId
  ]);
  
  await recordOrderOperation(orderId, 'manual_adjust', operatorId, operatorName, beforeData, order, changeReason);
  
  return {
    order: await enrichOrder(order),
    adjustment: {
      oldPrice: oldFinalPrice,
      newPrice: newFinalPrice,
      difference: priceDifference,
      reason: changeReason,
    },
  };
}

async function getOrderById(orderId) {
  return promisifyDb('get', 'SELECT * FROM orders WHERE id = ?', orderId);
}

async function getOrderByNo(orderNo) {
  return promisifyDb('get', 'SELECT * FROM orders WHERE order_no = ?', orderNo);
}

async function getOrdersByUserId(userId) {
  const orders = await promisifyDb('all', 'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', userId);
  return Promise.all(orders.map(enrichOrder));
}

async function getAllOrders(filters = {}) {
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.userId) {
    sql += ' AND user_id = ?';
    params.push(filters.userId);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  const orders = await promisifyDb('all', sql, params);
  return Promise.all(orders.map(enrichOrder));
}

async function enrichOrder(order) {
  if (!order) return null;
  
  const enriched = { ...order };
  
  if (enriched.discount_details) {
    enriched.discount_details = JSON.parse(enriched.discount_details);
  }
  if (enriched.status_history) {
    enriched.status_history = JSON.parse(enriched.status_history);
  }
  
  if (order.user_id) {
    enriched.user = await getUserById(order.user_id);
  }
  if (order.course_id) {
    enriched.course = await getCourseById(order.course_id);
  }
  if (order.coupon_id) {
    enriched.coupon = await getCouponById(order.coupon_id);
  }
  if (order.group_buy_id) {
    enriched.group_buy = await getGroupBuyById(order.group_buy_id);
  }
  
  enriched.payments = await getPaymentsByOrderId(order.id);
  enriched.refunds = await getRefundsByOrderId(order.id);
  enriched.operations = await getOrderOperations(order.id);
  
  return enriched;
}

async function getUserById(userId) {
  return promisifyDb('get', 'SELECT * FROM users WHERE id = ?', userId);
}

async function getCourseById(courseId) {
  return promisifyDb('get', 'SELECT * FROM courses WHERE id = ?', courseId);
}

async function getCouponById(couponId) {
  return promisifyDb('get', 'SELECT * FROM coupons WHERE id = ?', couponId);
}

async function getCouponByCode(code) {
  return promisifyDb('get', 'SELECT * FROM coupons WHERE code = ?', code);
}

async function getGroupBuyById(groupBuyId) {
  return promisifyDb('get', 'SELECT * FROM group_buys WHERE id = ?', groupBuyId);
}

async function getActiveGroupBuysByCourseId(courseId) {
  return promisifyDb('all', `SELECT * FROM group_buys WHERE course_id = ? AND status = 'active'`, courseId);
}

async function getPaymentByCallbackId(callbackId) {
  return promisifyDb('get', 'SELECT * FROM payments WHERE callback_id = ?', callbackId);
}

async function getSuccessfulPaymentByOrderId(orderId) {
  return promisifyDb('get', `SELECT * FROM payments WHERE order_id = ? AND status = 'success' ORDER BY paid_at DESC LIMIT 1`, orderId);
}

async function getPaymentsByOrderId(orderId) {
  return promisifyDb('all', 'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC', orderId);
}

async function getRefundsByOrderId(orderId) {
  return promisifyDb('all', 'SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at DESC', orderId);
}

async function getOrderOperations(orderId) {
  return promisifyDb('all', `SELECT * FROM order_operations WHERE order_id = ? ORDER BY created_at ASC`, orderId);
}

async function incrementCouponUsage(couponId) {
  return promisifyDb('run', 'UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', couponId);
}

async function decrementCouponUsage(couponId) {
  return promisifyDb('run', 'UPDATE coupons SET used_count = MAX(0, used_count - 1) WHERE id = ?', couponId);
}

async function incrementGroupBuyPeople(groupBuyId) {
  return promisifyDb('run', 'UPDATE group_buys SET current_people = current_people + 1 WHERE id = ?', groupBuyId);
}

async function recordOrderOperation(orderId, operationType, operatorId, operatorName, beforeData, afterData, reason) {
  const id = generateId();
  
  await promisifyDb('run', `INSERT INTO order_operations (
    id, order_id, operation_type, operator_id, operator_name, 
    before_data, after_data, change_reason, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, orderId, operationType, 
    operatorId || null, operatorName || null,
    beforeData ? JSON.stringify(beforeData) : null,
    afterData ? JSON.stringify(afterData) : null,
    reason || null,
    now(),
  ]);
  
  await promisifyDb('run', `INSERT INTO operation_logs (
    id, user_id, action, target_type, target_id, 
    before_data, after_data, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    generateId(), operatorId || null, `order_${operationType}`, 'order', orderId,
    beforeData ? JSON.stringify(beforeData) : null,
    afterData ? JSON.stringify(afterData) : null,
    now(),
  ]);
}

async function getAllUsers() {
  return promisifyDb('all', 'SELECT * FROM users');
}

async function getAllCourses() {
  return promisifyDb('all', 'SELECT * FROM courses WHERE is_active = 1');
}

async function getAllCoupons() {
  return promisifyDb('all', 'SELECT * FROM coupons');
}

async function getAllGroupBuys() {
  return promisifyDb('all', 'SELECT * FROM group_buys');
}

async function getStatistics() {
  const totalOrders = await promisifyDb('get', 'SELECT COUNT(*) as count FROM orders');
  const paidOrders = await promisifyDb('get', `SELECT COUNT(*) as count FROM orders WHERE status = 'paid' OR status = 'completed'`);
  const refundedOrders = await promisifyDb('get', `SELECT COUNT(*) as count FROM orders WHERE status = 'refunded' OR status = 'partially_refunded'`);
  
  const totalRevenue = await promisifyDb('get', `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'success'`);
  const totalRefunded = await promisifyDb('get', `SELECT COALESCE(SUM(refund_amount), 0) as total FROM refunds WHERE status = 'success'`);
  
  return {
    totalOrders: totalOrders.count,
    paidOrders: paidOrders.count,
    refundedOrders: refundedOrders.count,
    totalRevenue: formatPrice(totalRevenue.total),
    totalRefunded: formatPrice(totalRefunded.total),
    netRevenue: formatPrice(totalRevenue.total - totalRefunded.total),
  };
}

module.exports = {
  createOrder,
  calculateOrderPrice,
  lockOrderPrice,
  processPayment,
  processRefund,
  manuallyAdjustOrder,
  getOrderById,
  getOrderByNo,
  getOrdersByUserId,
  getAllOrders,
  getUserById,
  getCourseById,
  getCouponById,
  getCouponByCode,
  getGroupBuyById,
  getActiveGroupBuysByCourseId,
  getAllUsers,
  getAllCourses,
  getAllCoupons,
  getAllGroupBuys,
  getStatistics,
  ORDER_STATUS,
};
