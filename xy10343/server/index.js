const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { StatusEnum, routes, users, orders, addressChangeRequests } = require('./data');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const ordersData = JSON.parse(JSON.stringify(orders));
const addressRequestsData = JSON.parse(JSON.stringify(addressChangeRequests));
const routesData = JSON.parse(JSON.stringify(routes));
const usersData = JSON.parse(JSON.stringify(users));

const getStatusName = (status) => {
  const statusMap = {
    [StatusEnum.CREATED]: '待分配',
    [StatusEnum.ASSIGNED]: '待取件',
    [StatusEnum.PICKED_UP]: '已取件',
    [StatusEnum.IN_WASH]: '洗护中',
    [StatusEnum.WASHED]: '待派送',
    [StatusEnum.DISPATCHING]: '派送中',
    [StatusEnum.DELIVERED]: '已完成',
    [StatusEnum.CANCELLED]: '已取消',
    [StatusEnum.DISPUTE]: '瑕疵争议',
    [StatusEnum.RESOLVED]: '争议解决'
  };
  return statusMap[status] || status;
};

const calculateFee = (items, isUrgent) => {
  let baseFee = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  let urgentFee = isUrgent ? Math.floor(baseFee * 0.3) : 0;
  return {
    baseFee,
    urgentFee,
    totalFee: baseFee + urgentFee
  };
};

const calculateEstimatedDelivery = (isUrgent, baseDays = 2) => {
  const days = isUrgent ? Math.ceil(baseDays / 2) : baseDays;
  return new Date(Date.now() + days * 86400000).toISOString();
};

const findRouteForArea = (area) => {
  for (const route of routesData) {
    if (route.areas.includes(area)) {
      return route;
    }
  }
  return null;
};

const checkConflict = (customerName, phone, batchNo, excludeOrderId = null) => {
  const conflicts = {
    name: [],
    phone: [],
    batch: []
  };

  for (const order of ordersData) {
    if (excludeOrderId && order.id === excludeOrderId) continue;
    if (order.status === StatusEnum.CANCELLED) continue;

    if (customerName && order.customerName === customerName) {
      conflicts.name.push(order.id);
    }
    if (phone && order.phone === phone) {
      conflicts.phone.push(order.id);
    }
    if (batchNo && order.batchNo === batchNo) {
      conflicts.batch.push(order.id);
    }
  }

  return conflicts;
};

const getOrderSummary = (order) => {
  const route = routesData.find(r => r.id === order.routeId);
  return {
    ...order,
    routeName: route ? route.name : null,
    driver: route ? route.driver : null,
    vehicle: route ? route.vehicle : null,
    statusName: getStatusName(order.status),
    canCancel: [StatusEnum.CREATED, StatusEnum.ASSIGNED].includes(order.status),
    canChangeAddress: [StatusEnum.CREATED, StatusEnum.ASSIGNED, StatusEnum.PICKED_UP, StatusEnum.IN_WASH, StatusEnum.WASHED].includes(order.status)
  };
};

app.get('/api/orders', (req, res) => {
  const { status, search, routeId } = req.query;
  let filtered = ordersData.map(getOrderSummary);

  if (status) {
    filtered = filtered.filter(o => o.status === status);
  }
  if (routeId) {
    filtered = filtered.filter(o => o.routeId === routeId);
  }
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(o =>
      o.id.toLowerCase().includes(searchLower) ||
      o.customerName.toLowerCase().includes(searchLower) ||
      o.phone.includes(search) ||
      o.address.toLowerCase().includes(searchLower)
    );
  }

  res.json(filtered);
});

app.get('/api/orders/:id', (req, res) => {
  const order = ordersData.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  res.json(getOrderSummary(order));
});

app.post('/api/orders', (req, res) => {
  const { customerName, phone, address, area, items, isUrgent = false, batchNo } = req.body;

  if (!customerName || !phone || !address || !area || !items || items.length === 0) {
    return res.status(400).json({ error: '请填写完整的订单信息' });
  }

  const conflicts = checkConflict(customerName, phone, batchNo);
  const hasConflict = conflicts.name.length > 0 || conflicts.phone.length > 0 || conflicts.batch.length > 0;

  if (hasConflict) {
    const conflictDetails = [];
    if (conflicts.name.length > 0) {
      conflictDetails.push(`同名冲突：已存在客户"${customerName}"的订单 (${conflicts.name.join(', ')})`);
    }
    if (conflicts.phone.length > 0) {
      conflictDetails.push(`同号冲突：已存在手机号"${phone}"的订单 (${conflicts.phone.join(', ')})`);
    }
    if (conflicts.batch.length > 0) {
      conflictDetails.push(`批次冲突：已存在批次"${batchNo}"的订单 (${conflicts.batch.join(', ')})`);
    }
    return res.status(409).json({
      error: '检测到潜在冲突',
      conflicts: {
        name: conflicts.name,
        phone: conflicts.phone,
        batch: conflicts.batch
      },
      conflictDetails
    });
  }

  const feeInfo = calculateFee(items, isUrgent);
  const estimatedDelivery = calculateEstimatedDelivery(isUrgent);
  const route = findRouteForArea(area);

  const newOrder = {
    id: `ORD${String(ordersData.length + 1).padStart(3, '0')}`,
    customerName,
    phone,
    address,
    area,
    orderTime: new Date().toISOString(),
    estimatedDelivery,
    status: StatusEnum.CREATED,
    isUrgent,
    baseFee: feeInfo.baseFee,
    totalFee: feeInfo.totalFee,
    urgentFee: feeInfo.urgentFee,
    routeId: route ? route.id : null,
    items,
    changes: [],
    defects: [],
    batchNo: batchNo || `BATCH${String(ordersData.length + 1).padStart(3, '0')}`
  };

  if (route) {
    newOrder.status = StatusEnum.ASSIGNED;
    newOrder.changes.push({
      id: uuidv4(),
      type: 'route',
      operatorId: 'system',
      operatorName: '系统',
      timestamp: new Date().toISOString(),
      oldValue: { routeId: null, routeName: null },
      newValue: { routeId: route.id, routeName: route.name },
      reason: '自动分配路线'
    });
  }

  ordersData.push(newOrder);
  res.status(201).json(getOrderSummary(newOrder));
});

app.put('/api/orders/:id/cancel', (req, res) => {
  const order = ordersData.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  if (![StatusEnum.CREATED, StatusEnum.ASSIGNED].includes(order.status)) {
    return res.status(400).json({ error: '已取件的订单无法取消，请联系客服处理' });
  }

  const oldStatus = order.status;
  order.status = StatusEnum.CANCELLED;
  order.changes.push({
    id: uuidv4(),
    type: 'status',
    operatorId: 'dispatcher1',
    operatorName: '调度员小王',
    timestamp: new Date().toISOString(),
    oldValue: { status: oldStatus, statusName: getStatusName(oldStatus) },
    newValue: { status: StatusEnum.CANCELLED, statusName: getStatusName(StatusEnum.CANCELLED) },
    reason: req.body.reason || '客户取消'
  });

  res.json(getOrderSummary(order));
});

app.put('/api/orders/:id/assign-route', (req, res) => {
  const order = ordersData.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const { routeId, reason } = req.body;
  const route = routesData.find(r => r.id === routeId);

  if (!route) {
    return res.status(400).json({ error: '路线不存在' });
  }

  const oldRouteId = order.routeId;
  const oldRoute = routesData.find(r => r.id === oldRouteId);

  order.routeId = routeId;
  if (order.status === StatusEnum.CREATED) {
    order.status = StatusEnum.ASSIGNED;
  }

  order.changes.push({
    id: uuidv4(),
    type: 'route',
    operatorId: 'dispatcher1',
    operatorName: '调度员小王',
    timestamp: new Date().toISOString(),
    oldValue: { routeId: oldRouteId, routeName: oldRoute ? oldRoute.name : null },
    newValue: { routeId: route.id, routeName: route.name },
    reason: reason || '人工分配路线'
  });

  res.json(getOrderSummary(order));
});

app.put('/api/orders/:id/advance-status', (req, res) => {
  const order = ordersData.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const statusFlow = {
    [StatusEnum.CREATED]: StatusEnum.ASSIGNED,
    [StatusEnum.ASSIGNED]: StatusEnum.PICKED_UP,
    [StatusEnum.PICKED_UP]: StatusEnum.IN_WASH,
    [StatusEnum.IN_WASH]: StatusEnum.WASHED,
    [StatusEnum.WASHED]: StatusEnum.DISPATCHING,
    [StatusEnum.DISPATCHING]: StatusEnum.DELIVERED
  };

  const nextStatus = statusFlow[order.status];
  if (!nextStatus) {
    return res.status(400).json({ error: '当前状态无法推进' });
  }

  const oldStatus = order.status;
  order.status = nextStatus;
  order.changes.push({
    id: uuidv4(),
    type: 'status',
    operatorId: 'dispatcher1',
    operatorName: '调度员小王',
    timestamp: new Date().toISOString(),
    oldValue: { status: oldStatus, statusName: getStatusName(oldStatus) },
    newValue: { status: nextStatus, statusName: getStatusName(nextStatus) },
    reason: req.body.reason || '状态推进'
  });

  res.json(getOrderSummary(order));
});

app.put('/api/orders/:id/set-urgent', (req, res) => {
  const order = ordersData.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  if ([StatusEnum.WASHED, StatusEnum.DISPATCHING, StatusEnum.DELIVERED, StatusEnum.CANCELLED].includes(order.status)) {
    return res.status(400).json({ error: '当前状态无法设置加急' });
  }

  const { isUrgent, reason } = req.body;
  if (order.isUrgent === isUrgent) {
    return res.json(getOrderSummary(order));
  }

  const oldIsUrgent = order.isUrgent;
  const oldTotalFee = order.totalFee;
  const oldUrgentFee = order.urgentFee;
  const oldEstimatedDelivery = order.estimatedDelivery;

  const feeInfo = calculateFee(order.items, isUrgent);
  order.isUrgent = isUrgent;
  order.urgentFee = feeInfo.urgentFee;
  order.totalFee = feeInfo.totalFee;
  order.estimatedDelivery = calculateEstimatedDelivery(isUrgent);

  order.changes.push({
    id: uuidv4(),
    type: 'urgent',
    operatorId: 'dispatcher1',
    operatorName: '调度员小王',
    timestamp: new Date().toISOString(),
    oldValue: {
      isUrgent: oldIsUrgent,
      totalFee: oldTotalFee,
      urgentFee: oldUrgentFee,
      estimatedDelivery: oldEstimatedDelivery
    },
    newValue: {
      isUrgent: order.isUrgent,
      totalFee: order.totalFee,
      urgentFee: order.urgentFee,
      estimatedDelivery: order.estimatedDelivery
    },
    reason: reason || (isUrgent ? '设置加急' : '取消加急')
  });

  res.json(getOrderSummary(order));
});

app.post('/api/orders/:id/defect', (req, res) => {
  const order = ordersData.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const { description, reportedBy } = req.body;
  if (!description) {
    return res.status(400).json({ error: '请描述瑕疵情况' });
  }

  const defect = {
    id: uuidv4(),
    reportedBy: reportedBy || '调度员',
    reportTime: new Date().toISOString(),
    description,
    status: 'pending',
    images: []
  };

  order.defects.push(defect);
  order.status = StatusEnum.DISPUTE;

  order.changes.push({
    id: uuidv4(),
    type: 'defect',
    operatorId: 'dispatcher1',
    operatorName: '调度员小王',
    timestamp: new Date().toISOString(),
    oldValue: { status: getStatusName(StatusEnum.WASHED), defectCount: order.defects.length - 1 },
    newValue: { status: getStatusName(StatusEnum.DISPUTE), defectCount: order.defects.length },
    reason: '记录瑕疵争议'
  });

  res.json(getOrderSummary(order));
});

app.put('/api/orders/:id/resolve-defect', (req, res) => {
  const order = ordersData.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const { defectId, resolution } = req.body;
  const defect = order.defects.find(d => d.id === defectId);

  if (!defect) {
    return res.status(404).json({ error: '瑕疵记录不存在' });
  }

  defect.status = 'resolved';
  defect.resolution = resolution;
  defect.resolvedBy = '调度员小王';
  defect.resolvedTime = new Date().toISOString();

  const allResolved = order.defects.every(d => d.status === 'resolved');
  if (allResolved) {
    order.status = StatusEnum.RESOLVED;
  }

  order.changes.push({
    id: uuidv4(),
    type: 'defect_resolve',
    operatorId: 'dispatcher1',
    operatorName: '调度员小王',
    timestamp: new Date().toISOString(),
    oldValue: { defectStatus: 'pending' },
    newValue: { defectStatus: 'resolved', resolution },
    reason: '瑕疵争议解决'
  });

  res.json(getOrderSummary(order));
});

app.post('/api/address-change-requests', (req, res) => {
  const { orderId, newAddress, newArea, reason } = req.body;
  const order = ordersData.find(o => o.id === orderId);

  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  if (![StatusEnum.CREATED, StatusEnum.ASSIGNED, StatusEnum.PICKED_UP, StatusEnum.IN_WASH, StatusEnum.WASHED].includes(order.status)) {
    return res.status(400).json({ error: '当前状态不允许改地址' });
  }

  const newRoute = findRouteForArea(newArea);
  const routeChanged = newRoute && newRoute.id !== order.routeId;

  const request = {
    id: uuidv4(),
    orderId,
    userId: 'customer',
    userName: order.customerName,
    oldAddress: order.address,
    oldArea: order.area,
    newAddress,
    newArea,
    requestTime: new Date().toISOString(),
    status: 'pending',
    routeChanged,
    reason: reason || '客户改地址'
  };

  addressRequestsData.push(request);
  res.status(201).json(request);
});

app.get('/api/address-change-requests', (req, res) => {
  const { status } = req.query;
  let filtered = addressRequestsData;

  if (status) {
    filtered = filtered.filter(r => r.status === status);
  }

  res.json(filtered);
});

app.put('/api/address-change-requests/:id/approve', (req, res) => {
  const request = addressRequestsData.find(r => r.id === req.params.id);
  if (!request) {
    return res.status(404).json({ error: '改址申请不存在' });
  }

  const order = ordersData.find(o => o.id === request.orderId);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const oldAddress = order.address;
  const oldArea = order.area;
  const oldRouteId = order.routeId;
  const oldRoute = routesData.find(r => r.id === oldRouteId);

  const newRoute = findRouteForArea(request.newArea);

  request.status = 'approved';
  request.approvedBy = 'dispatcher1';
  request.approvedByName = '调度员小王';
  request.approveTime = new Date().toISOString();

  order.address = request.newAddress;
  order.area = request.newArea;

  if (newRoute && newRoute.id !== order.routeId) {
    order.routeId = newRoute.id;
    order.changes.push({
      id: uuidv4(),
      type: 'address',
      operatorId: 'dispatcher1',
      operatorName: '调度员小王',
      timestamp: new Date().toISOString(),
      oldValue: {
        address: oldAddress,
        area: oldArea,
        routeId: oldRouteId,
        routeName: oldRoute ? oldRoute.name : null
      },
      newValue: {
        address: request.newAddress,
        area: request.newArea,
        routeId: newRoute.id,
        routeName: newRoute.name
      },
      reason: `改址审核通过，路线从"${oldRoute ? oldRoute.name : '未分配'}"变更为"${newRoute.name}"`
    });
  } else {
    order.changes.push({
      id: uuidv4(),
      type: 'address',
      operatorId: 'dispatcher1',
      operatorName: '调度员小王',
      timestamp: new Date().toISOString(),
      oldValue: { address: oldAddress, area: oldArea },
      newValue: { address: request.newAddress, area: request.newArea },
      reason: '改址审核通过，路线未变更'
    });
  }

  res.json({ request, order: getOrderSummary(order) });
});

app.put('/api/address-change-requests/:id/reject', (req, res) => {
  const request = addressRequestsData.find(r => r.id === req.params.id);
  if (!request) {
    return res.status(404).json({ error: '改址申请不存在' });
  }

  request.status = 'rejected';
  request.rejectedBy = 'dispatcher1';
  request.rejectedByName = '调度员小王';
  request.rejectTime = new Date().toISOString();
  request.rejectReason = req.body.reason || '审核不通过';

  res.json(request);
});

app.get('/api/routes', (req, res) => {
  const routesWithOrders = routesData.map(route => ({
    ...route,
    orders: ordersData
      .filter(o => o.routeId === route.id && o.status !== StatusEnum.CANCELLED)
      .map(o => ({
        id: o.id,
        customerName: o.customerName,
        address: o.address,
        status: o.status,
        statusName: getStatusName(o.status),
        isUrgent: o.isUrgent
      }))
  }));
  res.json(routesWithOrders);
});

app.get('/api/export/daily', (req, res) => {
  const { date, routeId } = req.query;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let ordersToExport = ordersData.filter(o => {
    const orderDate = new Date(o.orderTime);
    orderDate.setHours(0, 0, 0, 0);
    const isToday = orderDate.getTime() === today.getTime();
    const matchesRoute = !routeId || o.routeId === routeId;
    return isToday && matchesRoute && o.status !== StatusEnum.CANCELLED;
  });

  const rows = ordersToExport.map(o => {
    const route = routesData.find(r => r.id === o.routeId);
    const defects = o.defects.map(d => `${d.reportedBy}: ${d.description} (${d.status})`).join('; ');
    const changes = o.changes.map(c => `${c.type}[${c.operatorName}]: ${c.reason}`).join('; ');

    return {
      orderId: o.id,
      batchNo: o.batchNo,
      customerName: o.customerName,
      phone: o.phone,
      address: o.address,
      area: o.area,
      routeName: route ? route.name : '未分配',
      driver: route ? route.driver : '',
      vehicle: route ? route.vehicle : '',
      status: getStatusName(o.status),
      isUrgent: o.isUrgent ? '是' : '否',
      totalFee: o.totalFee,
      urgentFee: o.urgentFee,
      items: o.items.map(i => `${i.name}x${i.quantity}`).join(', '),
      defects: defects || '无',
      changes: changes || '无',
      orderTime: new Date(o.orderTime).toLocaleString('zh-CN'),
      estimatedDelivery: new Date(o.estimatedDelivery).toLocaleString('zh-CN')
    };
  });

  const abnormalOrders = ordersToExport.filter(o =>
    o.status === StatusEnum.DISPUTE || o.defects.length > 0
  );

  res.json({
    date: new Date().toLocaleDateString('zh-CN'),
    totalOrders: rows.length,
    abnormalCount: abnormalOrders.length,
    orders: rows,
    abnormalOrders: abnormalOrders.map(o => o.id)
  });
});

app.post('/api/orders/check-conflicts', (req, res) => {
  const { customerName, phone, batchNo, excludeOrderId } = req.body;
  const conflicts = checkConflict(customerName, phone, batchNo, excludeOrderId);

  const hasConflict = conflicts.name.length > 0 || conflicts.phone.length > 0 || conflicts.batch.length > 0;

  const details = [];
  if (conflicts.name.length > 0) {
    details.push({
      type: 'name',
      message: `已存在客户"${customerName}"的订单：${conflicts.name.join(', ')}`,
      orders: conflicts.name.map(id => ordersData.find(o => o.id === id)).filter(Boolean)
    });
  }
  if (conflicts.phone.length > 0) {
    details.push({
      type: 'phone',
      message: `已存在手机号"${phone}"的订单：${conflicts.phone.join(', ')}`,
      orders: conflicts.phone.map(id => ordersData.find(o => o.id === id)).filter(Boolean)
    });
  }
  if (conflicts.batch.length > 0) {
    details.push({
      type: 'batch',
      message: `已存在批次"${batchNo}"的订单：${conflicts.batch.join(', ')}`,
      orders: conflicts.batch.map(id => ordersData.find(o => o.id === id)).filter(Boolean)
    });
  }

  res.json({
    hasConflict,
    conflicts,
    details
  });
});

app.get('/api/stats', (req, res) => {
  const statusCounts = {};
  for (const status of Object.values(StatusEnum)) {
    statusCounts[status] = ordersData.filter(o => o.status === status).length;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = ordersData.filter(o => {
    const orderDate = new Date(o.orderTime);
    orderDate.setHours(0, 0, 0, 0);
    return orderDate.getTime() === today.getTime();
  });

  const urgentCount = ordersData.filter(o => o.isUrgent && o.status !== StatusEnum.CANCELLED).length;
  const disputeCount = ordersData.filter(o => o.status === StatusEnum.DISPUTE).length;

  res.json({
    totalOrders: ordersData.length,
    todayOrders: todayOrders.length,
    urgentCount,
    disputeCount,
    statusCounts
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`洗衣取送派单台系统运行在 http://localhost:${PORT}`);
});
