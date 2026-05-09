const express = require('express');
const DataStore = require('./models/data-store');
const LockService = require('./services/lock-service');
const RepairService = require('./services/repair-service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const idempotencyMiddleware = (req, res, next) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  
  if (!idempotencyKey) {
    return next();
  }
  
  const cached = DataStore.getIdempotencyKey(idempotencyKey);
  if (cached) {
    return res.status(200).json({
      idempotent: true,
      ...cached.response
    });
  }
  
  res.sendIdempotentResponse = (status, data) => {
    DataStore.saveIdempotencyKey(idempotencyKey, { status, data });
    res.status(status).json(data);
  };
  
  next();
};

app.use(idempotencyMiddleware);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: DataStore.getTimestamp() });
});

app.get('/summary', (req, res) => {
  res.json(DataStore.getSummary());
});

app.post('/properties', (req, res) => {
  const { name, address } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Property name is required' });
  }
  
  try {
    const property = DataStore.addProperty({ name, address });
    if (res.sendIdempotentResponse) {
      res.sendIdempotentResponse(201, property);
    } else {
      res.status(201).json(property);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/locks', (req, res) => {
  const { propertyId, name, model } = req.body;
  
  if (!propertyId) {
    return res.status(400).json({ error: 'Property ID is required' });
  }
  
  try {
    const lock = LockService.createLock(propertyId, { name, model });
    if (res.sendIdempotentResponse) {
      res.sendIdempotentResponse(201, lock);
    } else {
      res.status(201).json(lock);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/locks/:id/battery', (req, res) => {
  const { id } = req.params;
  const { batteryLevel } = req.body;
  
  if (batteryLevel === undefined) {
    return res.status(400).json({ error: 'Battery level is required' });
  }
  
  try {
    const lock = LockService.updateBatteryLevel(id, batteryLevel);
    res.json(lock);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/locks/:id', (req, res) => {
  const { id } = req.params;
  const lock = LockService.getLockWithDetails(id);
  
  if (!lock) {
    return res.status(404).json({ error: 'Lock not found' });
  }
  
  res.json(lock);
});

app.post('/bookings', (req, res) => {
  const { propertyId, guestName, checkIn, checkOut } = req.body;
  
  if (!propertyId || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Property ID, check-in, and check-out are required' });
  }
  
  try {
    const booking = DataStore.addBooking({
      propertyId,
      guestName,
      checkIn,
      checkOut
    });
    if (res.sendIdempotentResponse) {
      res.sendIdempotentResponse(201, booking);
    } else {
      res.status(201).json(booking);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/bookings/:id', (req, res) => {
  const { id } = req.params;
  const booking = DataStore.getBooking(id);
  
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  
  res.json(booking);
});

app.get('/alerts', (req, res) => {
  const { status } = req.query;
  
  if (status === 'active') {
    return res.json(DataStore.getActiveBatteryAlerts());
  }
  
  res.json(DataStore.batteryAlerts);
});

app.post('/alerts/:id/acknowledge', (req, res) => {
  const { id } = req.params;
  const { operator } = req.body;
  
  try {
    const alert = LockService.acknowledgeAlert(id, operator);
    res.json(alert);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/alerts/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { reason, operator } = req.body;
  
  if (!reason) {
    return res.status(400).json({ error: 'Resolution reason is required' });
  }
  
  try {
    const alert = LockService.resolveAlert(id, reason, operator);
    res.json(alert);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/alerts/:id/withdraw', (req, res) => {
  const { id } = req.params;
  const { reason, operator } = req.body;
  
  if (!reason) {
    return res.status(400).json({ error: 'Withdraw reason is required' });
  }
  
  try {
    const alert = LockService.withdrawAlert(id, reason, operator);
    res.json(alert);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/alerts/:id', (req, res) => {
  const { id } = req.params;
  const alert = DataStore.getBatteryAlert(id);
  
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  
  res.json(alert);
});

app.post('/repair-orders/from-alert', (req, res) => {
  const { alertId, operator } = req.body;
  
  if (!alertId) {
    return res.status(400).json({ error: 'Alert ID is required' });
  }
  
  try {
    const order = RepairService.createFromAlert(alertId, operator);
    if (res.sendIdempotentResponse) {
      res.sendIdempotentResponse(201, order);
    } else {
      res.status(201).json(order);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/repair-orders', (req, res) => {
  const { propertyId, lockId, description, priority, operator } = req.body;
  
  if (!propertyId || !lockId || !description) {
    return res.status(400).json({ error: 'Property ID, lock ID, and description are required' });
  }
  
  try {
    const order = RepairService.createManual(propertyId, lockId, description, priority, operator);
    if (res.sendIdempotentResponse) {
      res.sendIdempotentResponse(201, order);
    } else {
      res.status(201).json(order);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/repair-orders/:id/assign', (req, res) => {
  const { id } = req.params;
  const { technician, operator } = req.body;
  
  if (!technician) {
    return res.status(400).json({ error: 'Technician is required' });
  }
  
  try {
    const order = RepairService.assign(id, technician, operator);
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/repair-orders/:id/start', (req, res) => {
  const { id } = req.params;
  const { operator } = req.body;
  
  try {
    const order = RepairService.start(id, operator);
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/repair-orders/:id/complete', (req, res) => {
  const { id } = req.params;
  const { notes, operator } = req.body;
  
  if (!notes) {
    return res.status(400).json({ error: 'Completion notes are required' });
  }
  
  try {
    const order = RepairService.complete(id, notes, operator);
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/repair-orders/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { reason, operator } = req.body;
  
  if (!reason) {
    return res.status(400).json({ error: 'Cancel reason is required' });
  }
  
  try {
    const order = RepairService.cancel(id, reason, operator);
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/repair-orders/:id/revise', (req, res) => {
  const { id } = req.params;
  const { operator, ...updates } = req.body;
  
  try {
    const order = RepairService.revise(id, updates, operator);
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/repair-orders/:id', (req, res) => {
  const { id } = req.params;
  const order = RepairService.getOrderWithDetails(id);
  
  if (!order) {
    return res.status(404).json({ error: 'Repair order not found' });
  }
  
  res.json(order);
});

app.get('/repair-orders', (req, res) => {
  const { urgency } = req.query;
  
  if (urgency) {
    return res.json(RepairService.getOrdersByUrgency(urgency));
  }
  
  res.json(DataStore.repairOrders);
});

app.get('/history/:entityType/:entityId', (req, res) => {
  const { entityType, entityId } = req.params;
  const history = DataStore.getHistory(entityType, entityId);
  res.json(history);
});

app.listen(PORT, () => {
  console.log(`短租门锁电量巡检 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log('');
  console.log('可用接口:');
  console.log('  GET  /health                    - 健康检查');
  console.log('  GET  /summary                   - 汇总统计');
  console.log('  POST /properties                - 创建房源');
  console.log('  POST /locks                     - 创建门锁');
  console.log('  PATCH /locks/:id/battery        - 更新门锁电量');
  console.log('  GET  /locks/:id                 - 查询门锁详情');
  console.log('  POST /bookings                  - 创建订单');
  console.log('  GET  /alerts?status=active      - 查询活动告警');
  console.log('  POST /alerts/:id/acknowledge    - 确认告警');
  console.log('  POST /alerts/:id/resolve        - 解决告警');
  console.log('  POST /alerts/:id/withdraw       - 撤回告警');
  console.log('  POST /repair-orders/from-alert  - 从告警创建维修单');
  console.log('  POST /repair-orders             - 创建手动维修单');
  console.log('  POST /repair-orders/:id/assign  - 指派维修单');
  console.log('  POST /repair-orders/:id/start   - 开始维修');
  console.log('  POST /repair-orders/:id/complete- 完成维修');
  console.log('  POST /repair-orders/:id/cancel  - 取消维修单');
  console.log('  PATCH /repair-orders/:id/revise - 修改维修单');
  console.log('  GET  /repair-orders/:id         - 查询维修单详情');
  console.log('  GET  /history/:type/:id         - 查询历史记录');
  console.log('');
  console.log('演示命令:');
  console.log('  npm run demo                    - 最短演示路径');
  console.log('  npm run demo-error              - 异常触发路径');
});
