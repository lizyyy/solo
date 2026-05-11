const {
  EXCHANGE_STATUS,
  addTimeline,
  checkDuplicateExchange,
  checkInventory,
  getInventory,
  updateInventory,
  createExchange,
  updateExchange,
  getExchange,
  getExchangesByOrder,
  getAllExchanges,
  getOrder,
  getAllOrders,
  getProduct,
  getAllProducts,
  getAllInventory,
  getTimelines,
  getInventoryLogs,
  getAllInventoryLogs
} = require('../models/dataStore');

function createExchangeRequest(req, res) {
  const { orderId, orderItemId, targetSize, targetColor, reason, operator } = req.body;

  if (!orderId || !orderItemId || !targetSize || !targetColor) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少必要参数：订单ID、订单项ID、目标尺码、目标颜色' 
    });
  }

  const order = getOrder(orderId);
  if (!order) {
    return res.status(404).json({ 
      success: false, 
      message: '订单不存在' 
    });
  }

  if (order.status !== 'completed') {
    return res.status(400).json({ 
      success: false, 
      message: '订单未完成，不能申请换货' 
    });
  }

  const orderItem = order.items.find(item => item.id === orderItemId);
  if (!orderItem) {
    return res.status(404).json({ 
      success: false, 
      message: '订单项不存在' 
    });
  }

  if (checkDuplicateExchange(orderId, orderItemId)) {
    return res.status(400).json({ 
      success: false, 
      message: '该商品已存在进行中的换货申请，请勿重复提交' 
    });
  }

  if (orderItem.size === targetSize && orderItem.color === targetColor) {
    return res.status(400).json({ 
      success: false, 
      message: '目标尺码和颜色与原商品相同' 
    });
  }

  const targetInventory = getInventory(orderItem.productId, targetSize, targetColor);
  if (!targetInventory) {
    return res.status(400).json({ 
      success: false, 
      message: `目标商品 ${orderItem.productName} ${targetSize} ${targetColor} 不存在` 
    });
  }

  const priceDifference = targetInventory.price - orderItem.price;

  const exchange = createExchange({
    orderId,
    orderItemId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    originalProduct: orderItem.productName,
    originalSize: orderItem.size,
    originalColor: orderItem.color,
    originalPrice: orderItem.price,
    targetProductId: orderItem.productId,
    targetProductName: orderItem.productName,
    targetSize,
    targetColor,
    targetPrice: targetInventory.price,
    priceDifference,
    reason: reason || '尺码不合适',
    operator: operator || '客服系统'
  });

  res.json({
    success: true,
    data: exchange,
    message: '换货申请创建成功'
  });
}

function registerReturn(req, res) {
  const { exchangeId, returnTrackingNumber, returnCarrier, operator } = req.body;

  if (!exchangeId || !returnTrackingNumber || !returnCarrier) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少必要参数：换货ID、退回物流单号、物流公司' 
    });
  }

  const exchange = getExchange(exchangeId);
  if (!exchange) {
    return res.status(404).json({ 
      success: false, 
      message: '换货申请不存在' 
    });
  }

  if (exchange.status !== EXCHANGE_STATUS.PENDING) {
    return res.status(400).json({ 
      success: false, 
      message: `当前状态(${exchange.status})不允许登记退回物流` 
    });
  }

  const updated = updateExchange(exchangeId, {
    returnTrackingNumber,
    returnCarrier,
    status: EXCHANGE_STATUS.RETURN_RECEIVED
  });

  addTimeline(
    exchangeId, 
    'register_return', 
    operator || '客服系统', 
    `登记退回物流：${returnCarrier} ${returnTrackingNumber}`
  );

  res.json({
    success: true,
    data: updated,
    message: '退回物流登记成功'
  });
}

function submitQualityCheck(req, res) {
  const { exchangeId, qualityResult, qualityNotes, operator } = req.body;

  if (!exchangeId || qualityResult === undefined) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少必要参数：换货ID、质检结果' 
    });
  }

  const exchange = getExchange(exchangeId);
  if (!exchange) {
    return res.status(404).json({ 
      success: false, 
      message: '换货申请不存在' 
    });
  }

  if (exchange.status !== EXCHANGE_STATUS.RETURN_RECEIVED) {
    return res.status(400).json({ 
      success: false, 
      message: `当前状态(${exchange.status})不允许提交质检` 
    });
  }

  const status = qualityResult ? EXCHANGE_STATUS.QUALITY_PASSED : EXCHANGE_STATUS.QUALITY_FAILED;
  const resultText = qualityResult ? '通过' : '不通过';

  const updated = updateExchange(exchangeId, {
    qualityResult,
    qualityNotes: qualityNotes || '',
    status
  });

  if (qualityResult) {
    updateInventory(
      exchange.targetProductId,
      exchange.targetSize,
      exchange.targetColor,
      -1,
      operator || '客服系统',
      `换货预占库存 - ${exchangeId}`
    );
  }

  addTimeline(
    exchangeId, 
    'quality_check', 
    operator || '客服系统', 
    `质检${resultText}${qualityNotes ? '：' + qualityNotes : ''}`
  );

  res.json({
    success: true,
    data: updated,
    message: `质检${resultText}`
  });
}

function handlePriceDifference(req, res) {
  const { exchangeId, operator } = req.body;

  if (!exchangeId) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少必要参数：换货ID' 
    });
  }

  const exchange = getExchange(exchangeId);
  if (!exchange) {
    return res.status(404).json({ 
      success: false, 
      message: '换货申请不存在' 
    });
  }

  if (exchange.status !== EXCHANGE_STATUS.QUALITY_PASSED) {
    return res.status(400).json({ 
      success: false, 
      message: `当前状态(${exchange.status})不允许处理差价` 
    });
  }

  const isDifference = exchange.priceDifference !== 0;
  let status, action, message;

  if (isDifference) {
    if (exchange.priceDifference > 0) {
      status = EXCHANGE_STATUS.DIFFERENCE_PAID;
      action = 'difference_paid';
      message = `客户补差价 ¥${exchange.priceDifference.toFixed(2)}`;
    } else {
      status = EXCHANGE_STATUS.DIFFERENCE_REFUNDED;
      action = 'difference_refunded';
      message = `退还差价 ¥${Math.abs(exchange.priceDifference).toFixed(2)}`;
    }
  } else {
    status = EXCHANGE_STATUS.DIFFERENCE_PAID;
    action = 'difference_waived';
    message = '无差价，直接跳过';
  }

  const updated = updateExchange(exchangeId, {
    differenceHandled: true,
    status
  });

  addTimeline(exchangeId, action, operator || '客服系统', message);

  res.json({
    success: true,
    data: updated,
    message: '差价处理完成'
  });
}

function shipNewOrder(req, res) {
  const { exchangeId, newOrderTrackingNumber, newOrderCarrier, operator } = req.body;

  if (!exchangeId || !newOrderTrackingNumber || !newOrderCarrier) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少必要参数：换货ID、新物流单号、物流公司' 
    });
  }

  const exchange = getExchange(exchangeId);
  if (!exchange) {
    return res.status(404).json({ 
      success: false, 
      message: '换货申请不存在' 
    });
  }

  if (exchange.status === EXCHANGE_STATUS.QUALITY_FAILED) {
    return res.status(400).json({ 
      success: false, 
      message: '质检不通过，不允许发出新货' 
    });
  }

  const validStatuses = [EXCHANGE_STATUS.DIFFERENCE_PAID, EXCHANGE_STATUS.DIFFERENCE_REFUNDED];
  if (!validStatuses.includes(exchange.status)) {
    return res.status(400).json({ 
      success: false, 
      message: `当前状态(${exchange.status})不允许发出新货，请先处理差价` 
    });
  }

  if (!checkInventory(exchange.targetProductId, exchange.targetSize, exchange.targetColor)) {
    return res.status(400).json({ 
      success: false, 
      message: `目标尺码库存不足：${exchange.targetProductName} ${exchange.targetSize} ${exchange.targetColor}` 
    });
  }

  const updated = updateExchange(exchangeId, {
    newOrderTrackingNumber,
    newOrderCarrier,
    status: EXCHANGE_STATUS.SHIPPED
  });

  addTimeline(
    exchangeId, 
    'ship_new', 
    operator || '客服系统', 
    `发出新货：${newOrderCarrier} ${newOrderTrackingNumber}`
  );

  res.json({
    success: true,
    data: updated,
    message: '新货发出成功'
  });
}

function completeExchange(req, res) {
  const { exchangeId, operator } = req.body;

  if (!exchangeId) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少必要参数：换货ID' 
    });
  }

  const exchange = getExchange(exchangeId);
  if (!exchange) {
    return res.status(404).json({ 
      success: false, 
      message: '换货申请不存在' 
    });
  }

  if (exchange.status !== EXCHANGE_STATUS.SHIPPED) {
    return res.status(400).json({ 
      success: false, 
      message: `当前状态(${exchange.status})不允许完成换货` 
    });
  }

  if (exchange.qualityResult && exchange.originalProduct) {
    updateInventory(
      exchange.targetProductId,
      exchange.originalSize,
      exchange.originalColor,
      1,
      operator || '客服系统',
      `退回商品入库 - ${exchangeId}`
    );
  }

  const updated = updateExchange(exchangeId, {
    status: EXCHANGE_STATUS.COMPLETED
  });

  addTimeline(exchangeId, 'complete', operator || '客服系统', '换货完成');

  res.json({
    success: true,
    data: updated,
    message: '换货完成'
  });
}

function cancelExchange(req, res) {
  const { exchangeId, reason, operator } = req.body;

  if (!exchangeId) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少必要参数：换货ID' 
    });
  }

  const exchange = getExchange(exchangeId);
  if (!exchange) {
    return res.status(404).json({ 
      success: false, 
      message: '换货申请不存在' 
    });
  }

  const terminalStatuses = [EXCHANGE_STATUS.COMPLETED, EXCHANGE_STATUS.CANCELLED];
  if (terminalStatuses.includes(exchange.status)) {
    return res.status(400).json({ 
      success: false, 
      message: `当前状态(${exchange.status})不允许取消` 
    });
  }

  if (exchange.status === EXCHANGE_STATUS.QUALITY_PASSED) {
    updateInventory(
      exchange.targetProductId,
      exchange.targetSize,
      exchange.targetColor,
      1,
      operator || '客服系统',
      `取消换货释放库存 - ${exchangeId}`
    );
  }

  const updated = updateExchange(exchangeId, {
    status: EXCHANGE_STATUS.CANCELLED
  });

  addTimeline(exchangeId, 'cancel', operator || '客服系统', `取消换货${reason ? '：' + reason : ''}`);

  res.json({
    success: true,
    data: updated,
    message: '换货已取消'
  });
}

function getExchangeDetail(req, res) {
  const { exchangeId } = req.params;
  
  const exchange = getExchange(exchangeId);
  if (!exchange) {
    return res.status(404).json({ 
      success: false, 
      message: '换货申请不存在' 
    });
  }

  const timelines = getTimelines(exchangeId);
  const order = getOrder(exchange.orderId);
  const targetInventory = getInventory(exchange.targetProductId, exchange.targetSize, exchange.targetColor);

  res.json({
    success: true,
    data: {
      exchange,
      timelines,
      order,
      targetInventory
    }
  });
}

function listExchanges(req, res) {
  const { status, orderId } = req.query;
  let exchanges = getAllExchanges();

  if (status) {
    exchanges = exchanges.filter(e => e.status === status);
  }
  if (orderId) {
    exchanges = exchanges.filter(e => e.orderId === orderId);
  }

  res.json({
    success: true,
    data: exchanges
  });
}

function listOrders(req, res) {
  res.json({
    success: true,
    data: getAllOrders()
  });
}

function getOrderDetail(req, res) {
  const { orderId } = req.params;
  const order = getOrder(orderId);
  
  if (!order) {
    return res.status(404).json({ 
      success: false, 
      message: '订单不存在' 
    });
  }

  const exchanges = getExchangesByOrder(orderId);
  
  res.json({
    success: true,
    data: {
      order,
      exchanges
    }
  });
}

function listProducts(req, res) {
  res.json({
    success: true,
    data: getAllProducts()
  });
}

function checkInventoryAvailability(req, res) {
  const { productId, size, color } = req.query;
  
  if (!productId || !size || !color) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少必要参数：商品ID、尺码、颜色' 
    });
  }

  const inventory = getInventory(productId, size, color);
  const available = inventory && inventory.quantity > 0;

  res.json({
    success: true,
    data: {
      available,
      quantity: inventory ? inventory.quantity : 0,
      price: inventory ? inventory.price : 0
    }
  });
}

function listInventory(req, res) {
  const { productId } = req.query;
  let inventory = getAllInventory();
  
  if (productId) {
    inventory = inventory.filter(i => i.productId === productId);
  }

  res.json({
    success: true,
    data: inventory
  });
}

function getReport(req, res) {
  const exchanges = getAllExchanges();
  const inventoryLogs = getAllInventoryLogs();

  const stats = {
    total: exchanges.length,
    pending: exchanges.filter(e => e.status === EXCHANGE_STATUS.PENDING).length,
    returnReceived: exchanges.filter(e => e.status === EXCHANGE_STATUS.RETURN_RECEIVED).length,
    qualityPassed: exchanges.filter(e => e.status === EXCHANGE_STATUS.QUALITY_PASSED).length,
    qualityFailed: exchanges.filter(e => e.status === EXCHANGE_STATUS.QUALITY_FAILED).length,
    shipped: exchanges.filter(e => e.status === EXCHANGE_STATUS.SHIPPED).length,
    completed: exchanges.filter(e => e.status === EXCHANGE_STATUS.COMPLETED).length,
    cancelled: exchanges.filter(e => e.status === EXCHANGE_STATUS.CANCELLED).length,
    totalDifference: exchanges
      .filter(e => e.differenceHandled)
      .reduce((sum, e) => sum + e.priceDifference, 0),
    avgProcessTime: 0
  };

  const completedExchanges = exchanges.filter(e => 
    e.status === EXCHANGE_STATUS.COMPLETED
  );
  
  if (completedExchanges.length > 0) {
    const totalTime = completedExchanges.reduce((sum, e) => {
      return sum + (new Date(e.updatedAt) - new Date(e.createdAt));
    }, 0);
    stats.avgProcessTime = Math.round(totalTime / completedExchanges.length / (1000 * 60 * 60));
  }

  const categoryStats = {};
  const product = getAllProducts();
  product.forEach(p => {
    categoryStats[p.category] = {
      total: 0,
      completed: 0,
      successRate: 0
    };
  });

  exchanges.forEach(e => {
    const prod = product.find(p => p.id === e.targetProductId);
    if (prod && categoryStats[prod.category]) {
      categoryStats[prod.category].total++;
      if (e.status === EXCHANGE_STATUS.COMPLETED) {
        categoryStats[prod.category].completed++;
      }
    }
  });

  Object.keys(categoryStats).forEach(cat => {
    const s = categoryStats[cat];
    s.successRate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
  });

  res.json({
    success: true,
    data: {
      stats,
      categoryStats,
      recentExchanges: exchanges.slice(-10).reverse(),
      recentInventoryLogs: inventoryLogs.slice(-10).reverse()
    }
  });
}

module.exports = {
  createExchangeRequest,
  registerReturn,
  submitQualityCheck,
  handlePriceDifference,
  shipNewOrder,
  completeExchange,
  cancelExchange,
  getExchangeDetail,
  listExchanges,
  listOrders,
  getOrderDetail,
  listProducts,
  checkInventoryAvailability,
  listInventory,
  getReport
};
