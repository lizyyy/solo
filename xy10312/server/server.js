const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const utils = require('./utils');
const checks = require('./checks');
const { readData, writeData, DATA_DIR } = require('./data');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

function ensureInitialized() {
  if (!fs.existsSync(path.join(DATA_DIR, 'orders.json'))) {
    console.log('检测到数据未初始化，正在初始化...');
    require('./initData');
  }
}

app.get('/api/config', (req, res) => {
  ensureInitialized();
  res.json({
    flavors: config.FLAVORS,
    sizes: config.SIZES,
    pickupTimes: config.PICKUP_TIMES,
    dailyCapacity: config.DAILY_CAPACITY,
    maxCapacityWithoutDeposit: config.DAILY_CAPACITY * config.MAX_CAPACITY_WITH_DEPOSIT,
    cutoffDays: config.CUTOFF_DAYS_BEFORE,
    depositThreshold: config.DEPOSIT_THRESHOLD
  });
});

app.get('/api/materials', (req, res) => {
  ensureInitialized();
  const materials = readData('materials.json', {});
  res.json(materials);
});

app.put('/api/materials/:id', (req, res) => {
  const materials = readData('materials.json', {});
  const { id } = req.params;
  const { stock, minStock } = req.body;
  
  if (!materials[id]) {
    return res.status(404).json({ error: '材料不存在' });
  }
  
  if (typeof stock === 'number') {
    materials[id].stock = stock;
  }
  if (typeof minStock === 'number') {
    materials[id].minStock = minStock;
  }
  
  writeData('materials.json', materials);
  res.json(materials[id]);
});

app.get('/api/orders', (req, res) => {
  ensureInitialized();
  const orders = readData('orders.json', []);
  res.json(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.get('/api/orders/:id', (req, res) => {
  const orders = readData('orders.json', []);
  const order = orders.find(o => o.id === req.params.id);
  
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  res.json(order);
});

app.post('/api/orders/check', (req, res) => {
  const result = checks.checkCanCreateOrder(req.body);
  res.json(result);
});

app.post('/api/orders', (req, res) => {
  const checkResult = checks.checkCanCreateOrder(req.body);
  if (!checkResult.canCreate) {
    return res.status(400).json(checkResult);
  }
  
  const orders = readData('orders.json', []);
  const dailyCapacity = readData('dailyCapacity.json', {});
  const materialUsage = readData('materialUsage.json', {});
  
  const { flavor, size, pickupDate, pickupTime } = req.body;
  const capacityUsed = utils.calculateCapacityUsage(size);
  const totalPrice = utils.calculateTotalPrice(flavor, size);
  const ingredients = utils.calculateIngredients(flavor, size);
  
  const order = {
    id: utils.generateOrderId(),
    ...req.body,
    totalPrice,
    capacityUsed,
    ingredients,
    depositPaid: req.body.deposit >= config.DEPOSIT_THRESHOLD,
    status: req.body.deposit >= config.DEPOSIT_THRESHOLD ? 'confirmed' : 'pending',
    createdAt: new Date().toISOString(),
    history: [{
      action: 'create',
      date: pickupDate,
      time: pickupTime,
      timestamp: new Date().toISOString()
    }]
  };
  
  orders.push(order);
  writeData('orders.json', orders);
  
  if (!dailyCapacity[pickupDate]) {
    dailyCapacity[pickupDate] = { total: config.DAILY_CAPACITY, used: 0 };
  }
  dailyCapacity[pickupDate].used += capacityUsed;
  writeData('dailyCapacity.json', dailyCapacity);
  
  if (!materialUsage[pickupDate]) {
    materialUsage[pickupDate] = {};
  }
  for (const [key, amount] of Object.entries(ingredients)) {
    materialUsage[pickupDate][key] = (materialUsage[pickupDate][key] || 0) + amount;
  }
  writeData('materialUsage.json', materialUsage);
  
  res.json(order);
});

app.post('/api/orders/:id/reschedule', (req, res) => {
  const orders = readData('orders.json', []);
  const order = orders.find(o => o.id === req.params.id);
  
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  const { newDate, newTime, reason } = req.body;
  
  const checkResult = checks.checkCanReschedule(order.id, newDate);
  
  if (checkResult.needsReview) {
    order.status = 'reschedule_pending';
    order.rescheduleRequested = {
      fromDate: order.pickupDate,
      fromTime: order.pickupTime,
      toDate: newDate,
      toTime: newTime,
      reason,
      requestTime: new Date().toISOString()
    };
    order.history.push({
      action: 'reschedule_request',
      fromDate: order.pickupDate,
      toDate: newDate,
      reason,
      timestamp: new Date().toISOString()
    });
    writeData('orders.json', orders);
    
    return res.json({
      order,
      message: '已提交改期申请，等待审核',
      needsReview: true
    });
  }
  
  if (!checkResult.canReschedule) {
    return res.status(400).json(checkResult);
  }
  
  const dailyCapacity = readData('dailyCapacity.json', {});
  const materialUsage = readData('materialUsage.json', {});
  
  const oldDate = order.pickupDate;
  const ingredients = utils.calculateIngredients(order.flavor, order.size);
  
  if (dailyCapacity[oldDate]) {
    dailyCapacity[oldDate].used -= order.capacityUsed;
  }
  if (!dailyCapacity[newDate]) {
    dailyCapacity[newDate] = { total: config.DAILY_CAPACITY, used: 0 };
  }
  dailyCapacity[newDate].used += order.capacityUsed;
  writeData('dailyCapacity.json', dailyCapacity);
  
  if (materialUsage[oldDate]) {
    for (const [key, amount] of Object.entries(ingredients)) {
      if (materialUsage[oldDate][key]) {
        materialUsage[oldDate][key] -= amount;
      }
    }
  }
  if (!materialUsage[newDate]) {
    materialUsage[newDate] = {};
  }
  for (const [key, amount] of Object.entries(ingredients)) {
    materialUsage[newDate][key] = (materialUsage[newDate][key] || 0) + amount;
  }
  writeData('materialUsage.json', materialUsage);
  
  const oldPickupDate = order.pickupDate;
  const oldPickupTime = order.pickupTime;
  order.pickupDate = newDate;
  order.pickupTime = newTime;
  order.history.push({
    action: 'reschedule',
    fromDate: oldPickupDate,
    toDate: newDate,
    fromTime: oldPickupTime,
    toTime: newTime,
    reason,
    timestamp: new Date().toISOString()
  });
  writeData('orders.json', orders);
  
  res.json({
    order,
    message: '改期成功',
    needsReview: false
  });
});

app.post('/api/orders/:id/reschedule/approve', (req, res) => {
  const orders = readData('orders.json', []);
  const order = orders.find(o => o.id === req.params.id);
  
  if (!order || order.status !== 'reschedule_pending') {
    return res.status(400).json({ error: '订单状态不正确' });
  }
  
  const dailyCapacity = readData('dailyCapacity.json', {});
  const materialUsage = readData('materialUsage.json', {});
  
  const oldDate = order.pickupDate;
  const newDate = order.rescheduleRequested.toDate;
  const newTime = order.rescheduleRequested.toTime;
  const ingredients = utils.calculateIngredients(order.flavor, order.size);
  
  if (dailyCapacity[oldDate]) {
    dailyCapacity[oldDate].used -= order.capacityUsed;
  }
  if (!dailyCapacity[newDate]) {
    dailyCapacity[newDate] = { total: config.DAILY_CAPACITY, used: 0 };
  }
  dailyCapacity[newDate].used += order.capacityUsed;
  writeData('dailyCapacity.json', dailyCapacity);
  
  if (materialUsage[oldDate]) {
    for (const [key, amount] of Object.entries(ingredients)) {
      if (materialUsage[oldDate][key]) {
        materialUsage[oldDate][key] -= amount;
      }
    }
  }
  if (!materialUsage[newDate]) {
    materialUsage[newDate] = {};
  }
  for (const [key, amount] of Object.entries(ingredients)) {
    materialUsage[newDate][key] = (materialUsage[newDate][key] || 0) + amount;
  }
  writeData('materialUsage.json', materialUsage);
  
  order.originalPickupDate = oldDate;
  order.pickupDate = newDate;
  order.pickupTime = newTime;
  order.status = 'confirmed';
  order.history.push({
    action: 'reschedule_approved',
    fromDate: oldDate,
    toDate: newDate,
    timestamp: new Date().toISOString()
  });
  delete order.rescheduleRequested;
  
  writeData('orders.json', orders);
  res.json(order);
});

app.post('/api/orders/:id/reschedule/reject', (req, res) => {
  const orders = readData('orders.json', []);
  const order = orders.find(o => o.id === req.params.id);
  
  if (!order || order.status !== 'reschedule_pending') {
    return res.status(400).json({ error: '订单状态不正确' });
  }
  
  order.status = 'confirmed';
  order.history.push({
    action: 'reschedule_rejected',
    reason: req.body.reason || '产能/材料不足',
    timestamp: new Date().toISOString()
  });
  delete order.rescheduleRequested;
  
  writeData('orders.json', orders);
  res.json(order);
});

app.post('/api/orders/:id/pay-deposit', (req, res) => {
  const orders = readData('orders.json', []);
  const order = orders.find(o => o.id === req.params.id);
  
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  const { amount } = req.body;
  order.deposit = (order.deposit || 0) + amount;
  
  if (order.deposit >= config.DEPOSIT_THRESHOLD) {
    order.depositPaid = true;
    order.status = 'confirmed';
  }
  
  order.history.push({
    action: 'deposit_payment',
    amount,
    totalDeposit: order.deposit,
    timestamp: new Date().toISOString()
  });
  
  writeData('orders.json', orders);
  res.json(order);
});

app.post('/api/orders/:id/cancel-deposit', (req, res) => {
  const orders = readData('orders.json', []);
  const order = orders.find(o => o.id === req.params.id);
  
  if (!order || order.status === 'completed') {
    return res.status(400).json({ error: '订单状态不正确' });
  }
  
  const dailyCapacity = readData('dailyCapacity.json', {});
  const materialUsage = readData('materialUsage.json', {});
  
  const ingredients = utils.calculateIngredients(order.flavor, order.size);
  
  if (dailyCapacity[order.pickupDate]) {
    dailyCapacity[order.pickupDate].used -= order.capacityUsed;
  }
  writeData('dailyCapacity.json', dailyCapacity);
  
  if (materialUsage[order.pickupDate]) {
    for (const [key, amount] of Object.entries(ingredients)) {
      if (materialUsage[order.pickupDate][key]) {
        materialUsage[order.pickupDate][key] -= amount;
      }
    }
  }
  writeData('materialUsage.json', materialUsage);
  
  order.status = 'cancelled';
  order.cancelledAt = new Date().toISOString();
  order.cancellationReason = req.body.reason || '定金取消';
  order.history.push({
    action: 'cancel_deposit',
    reason: req.body.reason || '定金取消',
    refundAmount: order.deposit,
    timestamp: new Date().toISOString()
  });
  order.deposit = 0;
  order.depositPaid = false;
  
  writeData('orders.json', orders);
  res.json(order);
});

app.post('/api/orders/:id/complete', (req, res) => {
  const orders = readData('orders.json', []);
  const order = orders.find(o => o.id === req.params.id);
  
  if (!order || order.status !== 'confirmed') {
    return res.status(400).json({ error: '订单状态不正确' });
  }
  
  order.status = 'completed';
  order.completedAt = new Date().toISOString();
  order.history.push({
    action: 'complete',
    timestamp: new Date().toISOString()
  });
  
  writeData('orders.json', orders);
  res.json(order);
});

app.get('/api/capacity', (req, res) => {
  const dailyCapacity = readData('dailyCapacity.json', {});
  const orders = readData('orders.json', []);
  
  const today = new Date().toISOString().split('T')[0];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14);
  
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 60);
  
  const result = {};
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const cap = dailyCapacity[dateStr] || { total: config.DAILY_CAPACITY, used: 0 };
      const dayOrders = orders.filter(o => 
        o.pickupDate === dateStr && 
        o.status !== 'cancelled' && 
        o.status !== 'completed'
      );
      
      result[dateStr] = {
        ...cap,
        orders: dayOrders.length,
        orderIds: dayOrders.map(o => o.id),
        isWeekend: true,
        isPast: dateStr < today,
        cutoffPassed: utils.isCutoffPassed(dateStr),
        remaining: Math.max(0, cap.total - cap.used),
        remainingWithDeposit: Math.max(0, cap.total * config.MAX_CAPACITY_WITH_DEPOSIT - cap.used)
      };
    }
  }
  
  res.json(result);
});

app.get('/api/material-gap', (req, res) => {
  const result = checks.calculateMaterialGap();
  res.json(result);
});

app.get('/api/production-list', (req, res) => {
  const orders = readData('orders.json', []);
  const materials = readData('materials.json', {});
  const dailyCapacity = readData('dailyCapacity.json', {});
  
  const { date } = req.query;
  
  let targetOrders;
  if (date) {
    targetOrders = orders.filter(o => 
      o.pickupDate === date && 
      (o.status === 'confirmed' || o.status === 'reschedule_pending')
    );
  } else {
    const today = new Date().toISOString().split('T')[0];
    targetOrders = orders.filter(o => 
      o.pickupDate >= today && 
      (o.status === 'confirmed' || o.status === 'reschedule_pending')
    );
  }
  
  targetOrders.sort((a, b) => {
    if (a.pickupDate !== b.pickupDate) return a.pickupDate.localeCompare(b.pickupDate);
    return a.pickupTime.localeCompare(b.pickupTime);
  });
  
  const grouped = {};
  const flavorSummary = {};
  const sizeSummary = {};
  const materialSummary = {};
  let totalRevenue = 0;
  let totalDeposit = 0;
  let pendingDeposit = 0;
  
  for (const order of targetOrders) {
    if (!grouped[order.pickupDate]) {
      grouped[order.pickupDate] = [];
    }
    grouped[order.pickupDate].push(order);
    
    const flavor = utils.getFlavorInfo(order.flavor);
    const size = utils.getSizeInfo(order.size);
    
    const key = `${order.flavor}-${order.size}`;
    if (!flavorSummary[key]) {
      flavorSummary[key] = {
        flavor: flavor?.name || order.flavor,
        size: size?.name || order.size,
        count: 0,
        totalCapacity: 0
      };
    }
    flavorSummary[key].count++;
    flavorSummary[key].totalCapacity += order.capacityUsed;
    
    const sizeKey = order.size;
    if (!sizeSummary[sizeKey]) {
      sizeSummary[sizeKey] = {
        size: size?.name || order.size,
        count: 0,
        capacity: size?.multiplier || 1
      };
    }
    sizeSummary[sizeKey].count++;
    
    if (order.ingredients) {
      for (const [key, amount] of Object.entries(order.ingredients)) {
        if (!materialSummary[key]) {
          const mat = materials[key];
          materialSummary[key] = {
            name: mat?.name || key,
            unit: mat?.unit || '',
            required: 0,
            stock: mat?.stock || 0
          };
        }
        materialSummary[key].required += amount;
      }
    }
    
    totalRevenue += order.totalPrice;
    totalDeposit += order.deposit;
    if (!order.depositPaid) {
      pendingDeposit += (config.DEPOSIT_THRESHOLD - (order.deposit || 0));
    }
  }
  
  res.json({
    date,
    orders: targetOrders,
    grouped,
    flavorSummary: Object.values(flavorSummary),
    sizeSummary: Object.values(sizeSummary),
    materialSummary: Object.values(materialSummary),
    summary: {
      orderCount: targetOrders.length,
      totalCapacity: targetOrders.reduce((sum, o) => sum + o.capacityUsed, 0),
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalDeposit: Math.round(totalDeposit * 100) / 100,
      pendingDeposit: Math.round(pendingDeposit * 100) / 100
    },
    config: {
      dailyCapacity: config.DAILY_CAPACITY,
      depositThreshold: config.DEPOSIT_THRESHOLD
    }
  });
});

app.get('/api/stats', (req, res) => {
  const orders = readData('orders.json', []);
  const materials = readData('materials.json', {});
  const dailyCapacity = readData('dailyCapacity.json', {});
  
  const today = new Date().toISOString().split('T')[0];
  
  const activeOrders = orders.filter(o => 
    o.pickupDate >= today && 
    (o.status === 'confirmed' || o.status === 'reschedule_pending')
  );
  
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const rescheduleOrders = orders.filter(o => o.status === 'reschedule_pending');
  
  const totalRevenue = activeOrders.reduce((sum, o) => sum + o.totalPrice, 0);
  const totalDeposit = activeOrders.reduce((sum, o) => sum + (o.deposit || 0), 0);
  
  const gap = checks.calculateMaterialGap();
  
  let capacityAlert = false;
  let maxCapacityUsage = 0;
  for (const [date, cap] of Object.entries(dailyCapacity)) {
    if (date >= today) {
      const usage = cap.used / cap.total;
      maxCapacityUsage = Math.max(maxCapacityUsage, usage);
      if (usage >= 0.8) {
        capacityAlert = true;
      }
    }
  }
  
  res.json({
    activeOrders: activeOrders.length,
    pendingOrders: pendingOrders.length,
    rescheduleOrders: rescheduleOrders.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalDeposit: Math.round(totalDeposit * 100) / 100,
    materialGapCount: Object.keys(gap.gap).length,
    materialWarningCount: Object.keys(gap.warnings).length,
    capacityAlert,
    maxCapacityUsage: Math.round(maxCapacityUsage * 100)
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  ensureInitialized();
  console.log(`\n🍰 烘焙私房订单截单台已启动！`);
  console.log(`📍 访问地址: http://localhost:${PORT}`);
  console.log(`\n📋 内置示例：`);
  console.log(`   1. 正常下单 - 在首页点击"新增订单"`);
  console.log(`   2. 库存不足 - 尝试下单需要大量芒果的订单`);
  console.log(`   3. 截单后改期 - 对 ORD2024005 执行改期审核`);
  console.log(`   4. 定金取消 - 对未付定金订单执行取消操作`);
  console.log(`\n💡 详细操作说明请查看页面右上角"使用说明"`);
});
