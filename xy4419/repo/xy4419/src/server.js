const express = require('express');
const { initDatabase, closeDatabase } = require('./database');
const { 
  getAllOrders, 
  getFullOrderInfo, 
  getOrdersBySerial,
  getUnresolvedAnomalies,
  runAllChecks,
  markNotified,
  updateOrderStatus,
  resolveAnomaly
} = require('./service');
const { 
  scanRepairOrders, 
  scanShutterTests, 
  scanAccessories, 
  scanPhotosDirectory,
  clearScanResults
} = require('./scanner');
const { 
  generateHandoverMarkdown, 
  generateAuditJSON 
} = require('./exporter');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: 'Camera Repair API',
    version: '1.0.0',
    description: '二手相机维修铺本地管理工具 API',
    endpoints: {
      orders: '/api/orders - 获取所有订单',
      orderDetail: '/api/orders/:orderNo - 获取订单详情',
      ordersBySerial: '/api/orders/serial/:serial - 按机身编号查询订单',
      anomalies: '/api/anomalies - 获取未解决的异常',
      stats: '/api/stats - 获取统计信息',
      recheck: 'POST /api/recheck - 重新运行异常检测',
      notify: 'POST /api/orders/:orderNo/notify - 标记客户已通知',
      status: 'PUT /api/orders/:orderNo/status - 更新订单状态',
      handover: '/api/orders/:orderNo/handover - 获取交接单 Markdown',
      audit: '/api/audit - 获取审计包 JSON'
    }
  });
});

app.get('/api/orders', (req, res) => {
  const { status } = req.query;
  const orders = getAllOrders(status);
  res.json({
    success: true,
    count: orders.length,
    data: orders
  });
});

app.get('/api/orders/:orderNo', (req, res) => {
  const { orderNo } = req.params;
  const info = getFullOrderInfo(orderNo);
  
  if (!info) {
    return res.status(404).json({
      success: false,
      error: '订单不存在'
    });
  }
  
  res.json({
    success: true,
    data: info
  });
});

app.get('/api/orders/serial/:serial', (req, res) => {
  const { serial } = req.params;
  const orders = getOrdersBySerial(serial);
  
  res.json({
    success: true,
    count: orders.length,
    data: orders
  });
});

app.get('/api/anomalies', (req, res) => {
  const anomalies = getUnresolvedAnomalies();
  
  res.json({
    success: true,
    count: anomalies.length,
    data: anomalies
  });
});

app.get('/api/stats', (req, res) => {
  const orders = getAllOrders();
  const anomalies = getUnresolvedAnomalies();
  
  const statusCount = {
    pending: 0,
    in_progress: 0,
    waiting_parts: 0,
    completed: 0,
    cancelled: 0
  };
  
  let notifiedCount = 0;
  
  orders.forEach(o => {
    if (statusCount[o.status] !== undefined) {
      statusCount[o.status]++;
    }
    if (o.notified) notifiedCount++;
  });
  
  const anomalyByType = {
    shutter_abnormal: 0,
    accessory_missing: 0,
    photo_missing: 0,
    duplicate_repair: 0
  };
  
  anomalies.forEach(a => {
    if (anomalyByType[a.anomaly_type] !== undefined) {
      anomalyByType[a.anomaly_type]++;
    }
  });
  
  res.json({
    success: true,
    data: {
      totalOrders: orders.length,
      byStatus: statusCount,
      customersNotified: notifiedCount,
      unresolvedAnomalies: anomalies.length,
      anomaliesByType: anomalyByType
    }
  });
});

app.post('/api/recheck', (req, res) => {
  const result = runAllChecks();
  
  res.json({
    success: true,
    data: result
  });
});

app.post('/api/orders/:orderNo/notify', (req, res) => {
  const { orderNo } = req.params;
  const { status = true } = req.body;
  
  const result = markNotified(orderNo, status);
  
  if (!result.success) {
    return res.status(404).json({
      success: false,
      error: '订单不存在'
    });
  }
  
  res.json({
    success: true,
    message: `订单 ${orderNo} 已标记为${status ? '已通知' : '未通知'}`
  });
});

app.put('/api/orders/:orderNo/status', (req, res) => {
  const { orderNo } = req.params;
  const { status } = req.body;
  
  if (!status) {
    return res.status(400).json({
      success: false,
      error: '请提供 status 参数'
    });
  }
  
  const result = updateOrderStatus(orderNo, status);
  
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error || '更新失败'
    });
  }
  
  res.json({
    success: true,
    message: `订单 ${orderNo} 状态已更新为 ${status}`
  });
});

app.post('/api/anomalies/:id/resolve', (req, res) => {
  const { id } = req.params;
  
  const result = resolveAnomaly(parseInt(id));
  
  if (!result.success) {
    return res.status(404).json({
      success: false,
      error: '异常不存在'
    });
  }
  
  res.json({
    success: true,
    message: `异常 #${id} 已标记为已解决`
  });
});

app.get('/api/orders/:orderNo/handover', (req, res) => {
  const { orderNo } = req.params;
  const { format = 'json' } = req.query;
  
  const markdown = generateHandoverMarkdown(orderNo);
  
  if (!markdown) {
    return res.status(404).json({
      success: false,
      error: '订单不存在'
    });
  }
  
  if (format === 'markdown' || format === 'md') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(markdown);
  } else {
    res.json({
      success: true,
      data: markdown
    });
  }
});

app.get('/api/audit', (req, res) => {
  const auditData = generateAuditJSON();
  res.json(auditData);
});

app.post('/api/scan', async (req, res) => {
  const { orders, shutter, accessories, photos } = req.body;
  
  clearScanResults();
  const results = {};
  
  try {
    if (orders) {
      results.orders = await scanRepairOrders(orders);
    }
    
    if (shutter) {
      results.shutter = await scanShutterTests(shutter);
    }
    
    if (accessories) {
      results.accessories = scanAccessories(accessories);
    }
    
    if (photos) {
      results.photos = scanPhotosDirectory(photos);
    }
    
    const checkResult = runAllChecks();
    results.anomalyCheck = checkResult;
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function startServer() {
  initDatabase();
  
  const server = app.listen(PORT, () => {
    console.log(`Camera Repair API 服务已启动`);
    console.log(`本地访问地址: http://localhost:${PORT}`);
    console.log(`按 Ctrl+C 停止服务`);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n正在关闭服务...');
    server.close(() => {
      closeDatabase();
      console.log('服务已关闭');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('\n正在关闭服务...');
    server.close(() => {
      closeDatabase();
      console.log('服务已关闭');
      process.exit(0);
    });
  });
  
  return server;
}

module.exports = { app, startServer, PORT };
