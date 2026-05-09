const db = require('../data/db');

function createOrder({ userId, deviceId, amount, washType = 'standard', duration = 45 }) {
  if (!userId || !deviceId || !amount) {
    return { error: 'MISSING_PARAMS', message: '缺少必要参数' };
  }
  
  const order = db.createOrder(userId, deviceId, amount, washType, duration);
  return { order };
}

function advanceOrder(orderNo, toStatus, extra = {}) {
  const order = db.getOrder(orderNo);
  if (!order) {
    return { error: 'ORDER_NOT_FOUND', message: '订单不存在' };
  }
  
  const validTransitions = {
    [db.ORDER_STATUS.CREATED]: [db.ORDER_STATUS.PAID],
    [db.ORDER_STATUS.PAID]: [db.ORDER_STATUS.WASHING],
    [db.ORDER_STATUS.WASHING]: [db.ORDER_STATUS.INTERRUPTED, db.ORDER_STATUS.COMPLETED],
    [db.ORDER_STATUS.INTERRUPTED]: [db.ORDER_STATUS.REFUNDED, db.ORDER_STATUS.WASHING],
    [db.ORDER_STATUS.REFUNDED]: [],
    [db.ORDER_STATUS.COMPLETED]: []
  };
  
  if (!validTransitions[order.status].includes(toStatus)) {
    return { 
      error: 'INVALID_TRANSITION', 
      message: `不允许从 ${order.status} 转换到 ${toStatus}` 
    };
  }
  
  if (toStatus === db.ORDER_STATUS.WASHING && order.status === db.ORDER_STATUS.INTERRUPTED) {
    db.addDeviceLog(order.deviceId, db.DEVICE_EVENT.RESTART, orderNo, { 
      previousErrorCode: order.errorCode,
      progress: order.progress
    });
  }
  
  const updatedOrder = db.updateOrderStatus(orderNo, toStatus, extra);
  
  if (toStatus === db.ORDER_STATUS.WASHING) {
    db.addDeviceLog(order.deviceId, db.DEVICE_EVENT.START, orderNo, { 
      washType: order.washType,
      duration: order.duration
    });
  }
  
  if (toStatus === db.ORDER_STATUS.INTERRUPTED) {
    const errorCode = extra.errorCode || 'E999';
    db.addDeviceLog(order.deviceId, db.DEVICE_EVENT.ERROR, orderNo, { 
      errorCode,
      errorMessage: db.ERROR_CODES[errorCode] || '未知故障',
      progress: order.progress
    });
    db.addDeviceLog(order.deviceId, db.DEVICE_EVENT.STOP, orderNo, { 
      reason: 'error_interrupted'
    });
  }
  
  return { order: updatedOrder };
}

function simulateWashProgress(orderNo, progressSteps) {
  const order = db.getOrder(orderNo);
  if (!order || order.status !== db.ORDER_STATUS.WASHING) {
    return { error: 'INVALID_STATE', message: '订单状态无效' };
  }
  
  const events = {
    10: db.DEVICE_EVENT.WATER_FILL,
    25: db.DEVICE_EVENT.HEATING,
    40: db.DEVICE_EVENT.WASH_CYCLE,
    60: db.DEVICE_EVENT.RINSE,
    80: db.DEVICE_EVENT.SPIN
  };
  
  progressSteps.forEach(progress => {
    if (events[progress]) {
      db.addDeviceLog(order.deviceId, events[progress], orderNo, { progress });
    }
  });
  
  const lastProgress = Math.max(...progressSteps);
  db.updateOrderStatus(orderNo, order.status, { progress: lastProgress });
  
  return { progress: lastProgress };
}

function getOrderDetails(orderNo) {
  const order = db.getOrder(orderNo);
  if (!order) {
    return { error: 'ORDER_NOT_FOUND', message: '订单不存在' };
  }
  
  const deviceLogs = db.getDeviceLogs(order.deviceId, orderNo);
  const claims = db.getClaimByOrder(orderNo);
  const coupons = [];
  
  claims.forEach(claim => {
    const claimCoupons = db.getCouponsByClaim(claim.claimNo);
    coupons.push(...claimCoupons);
  });
  
  return {
    order,
    deviceLogs,
    claims,
    coupons
  };
}

function getAllOrders(userId = null) {
  let orders = [...db.db.orders];
  if (userId) {
    orders = orders.filter(o => o.userId === userId);
  }
  return { orders };
}

module.exports = {
  createOrder,
  advanceOrder,
  simulateWashProgress,
  getOrderDetails,
  getAllOrders
};
