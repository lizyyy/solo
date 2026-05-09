const express = require('express');
const router = express.Router();
const { readFile, writeFile, generateId, FILES } = require('./storage');
const { 
  ORDER_STATUS, 
  canTransition, 
  calculatePrice, 
  calculateCancellationFee,
  getTimeSlotsForDate 
} = require('./billing');

router.get('/spots', (req, res) => {
  try {
    const spots = readFile(FILES.parkingSpots);
    res.json(spots);
  } catch (error) {
    res.status(500).json({ error: '获取车位列表失败', message: error.message });
  }
});

router.get('/spots/:id/availability', (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: '请指定日期参数' });
    }
    
    const spots = readFile(FILES.parkingSpots);
    const spot = spots.find(s => s.id === id);
    
    if (!spot) {
      return res.status(404).json({ error: '车位不存在' });
    }
    
    const orders = readFile(FILES.orders);
    const spotOrders = orders.filter(o => 
      o.spotId === id && 
      o.status !== ORDER_STATUS.CANCELLED && 
      o.status !== ORDER_STATUS.REFUNDED
    );
    
    const slots = getTimeSlotsForDate(date, spotOrders);
    
    res.json({
      spot,
      date,
      slots
    });
  } catch (error) {
    res.status(500).json({ error: '获取车位可用性失败', message: error.message });
  }
});

router.get('/spots/:id/calculate-price', (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({ error: '请指定开始和结束时间' });
    }
    
    const spots = readFile(FILES.parkingSpots);
    const spot = spots.find(s => s.id === id);
    
    if (!spot) {
      return res.status(404).json({ error: '车位不存在' });
    }
    
    const price = calculatePrice(spot, startTime, endTime);
    res.json(price);
  } catch (error) {
    res.status(500).json({ error: '计算价格失败', message: error.message });
  }
});

router.post('/orders', (req, res) => {
  try {
    const { spotId, customerName, phone, startTime, endTime } = req.body;
    
    if (!spotId || !customerName || !phone || !startTime || !endTime) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const spots = readFile(FILES.parkingSpots);
    const spot = spots.find(s => s.id === spotId);
    
    if (!spot) {
      return res.status(404).json({ error: '车位不存在' });
    }
    
    const orders = readFile(FILES.orders);
    const existingOrders = orders.filter(o => 
      o.spotId === spotId && 
      o.status !== ORDER_STATUS.CANCELLED && 
      o.status !== ORDER_STATUS.REFUNDED
    );
    
    const hasConflict = existingOrders.some(order => {
      const orderStart = new Date(order.startTime);
      const orderEnd = new Date(order.endTime);
      const newStart = new Date(startTime);
      const newEnd = new Date(endTime);
      return !(newEnd <= orderStart || newStart >= orderEnd);
    });
    
    if (hasConflict) {
      return res.status(400).json({ error: '该时间段车位已被预约' });
    }
    
    const priceInfo = calculatePrice(spot, startTime, endTime);
    
    const order = {
      id: generateId('ORD'),
      spotId,
      spotInfo: {
        id: spot.id,
        owner: spot.owner,
        area: spot.area,
        pricePerHour: spot.pricePerHour,
        overnightPrice: spot.overnightPrice
      },
      customerName,
      phone,
      startTime,
      endTime,
      priceInfo,
      totalPrice: priceInfo.total,
      status: ORDER_STATUS.PENDING,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      notes: ''
    };
    
    orders.push(order);
    writeFile(FILES.orders, orders);
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: '创建订单失败', message: error.message });
  }
});

router.get('/orders', (req, res) => {
  try {
    const { status, spotId, customerName, page = 1, pageSize = 20 } = req.query;
    
    let orders = readFile(FILES.orders);
    
    if (status) {
      orders = orders.filter(o => o.status === status);
    }
    if (spotId) {
      orders = orders.filter(o => o.spotId === spotId);
    }
    if (customerName) {
      orders = orders.filter(o => o.customerName.includes(customerName));
    }
    
    orders.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
    
    const total = orders.length;
    const startIndex = (page - 1) * pageSize;
    const pagedOrders = orders.slice(startIndex, startIndex + parseInt(pageSize));
    
    res.json({
      orders: pagedOrders,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    res.status(500).json({ error: '获取订单列表失败', message: error.message });
  }
});

router.get('/orders/:id', (req, res) => {
  try {
    const { id } = req.params;
    const orders = readFile(FILES.orders);
    const order = orders.find(o => o.id === id);
    
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    const payments = readFile(FILES.payments);
    const orderPayments = payments.filter(p => p.orderId === id);
    
    const refunds = readFile(FILES.refunds);
    const orderRefunds = refunds.filter(r => r.orderId === id);
    
    res.json({
      order,
      payments: orderPayments,
      refunds: orderRefunds
    });
  } catch (error) {
    res.status(500).json({ error: '获取订单详情失败', message: error.message });
  }
});

router.post('/orders/:id/confirm', (req, res) => {
  try {
    const { id } = req.params;
    const orders = readFile(FILES.orders);
    const orderIndex = orders.findIndex(o => o.id === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    const order = orders[orderIndex];
    
    if (!canTransition(order.status, ORDER_STATUS.CONFIRMED)) {
      return res.status(400).json({ 
        error: '状态转换不合法', 
        currentStatus: order.status,
        expectedStatus: ORDER_STATUS.CONFIRMED
      });
    }
    
    order.status = ORDER_STATUS.CONFIRMED;
    order.updateTime = new Date().toISOString();
    
    orders[orderIndex] = order;
    writeFile(FILES.orders, orders);
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: '确认订单失败', message: error.message });
  }
});

router.post('/orders/:id/pay', (req, res) => {
  try {
    const { id } = req.params;
    const { method = 'wechat' } = req.body;
    
    const orders = readFile(FILES.orders);
    const orderIndex = orders.findIndex(o => o.id === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    const order = orders[orderIndex];
    
    if (!canTransition(order.status, ORDER_STATUS.PAID)) {
      return res.status(400).json({ 
        error: '状态转换不合法', 
        currentStatus: order.status,
        expectedStatus: ORDER_STATUS.PAID
      });
    }
    
    const payment = {
      id: generateId('PAY'),
      orderId: id,
      amount: order.totalPrice,
      method,
      status: 'success',
      createTime: new Date().toISOString(),
      transactionId: `TXN${Date.now()}`
    };
    
    const payments = readFile(FILES.payments);
    payments.push(payment);
    writeFile(FILES.payments, payments);
    
    order.status = ORDER_STATUS.PAID;
    order.updateTime = new Date().toISOString();
    
    orders[orderIndex] = order;
    writeFile(FILES.orders, orders);
    
    res.json({
      order,
      payment
    });
  } catch (error) {
    res.status(500).json({ error: '支付失败', message: error.message });
  }
});

router.post('/orders/:id/start', (req, res) => {
  try {
    const { id } = req.params;
    const orders = readFile(FILES.orders);
    const orderIndex = orders.findIndex(o => o.id === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    const order = orders[orderIndex];
    
    if (!canTransition(order.status, ORDER_STATUS.IN_PROGRESS)) {
      return res.status(400).json({ 
        error: '状态转换不合法', 
        currentStatus: order.status,
        expectedStatus: ORDER_STATUS.IN_PROGRESS
      });
    }
    
    const now = new Date();
    const startTime = new Date(order.startTime);
    
    if (now < startTime) {
      return res.status(400).json({ error: '未到预约开始时间，不能开始停车' });
    }
    
    order.actualStartTime = now.toISOString();
    order.status = ORDER_STATUS.IN_PROGRESS;
    order.updateTime = now.toISOString();
    
    orders[orderIndex] = order;
    writeFile(FILES.orders, orders);
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: '开始停车失败', message: error.message });
  }
});

router.post('/orders/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    const orders = readFile(FILES.orders);
    const orderIndex = orders.findIndex(o => o.id === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    const order = orders[orderIndex];
    
    if (!canTransition(order.status, ORDER_STATUS.COMPLETED)) {
      return res.status(400).json({ 
        error: '状态转换不合法', 
        currentStatus: order.status,
        expectedStatus: ORDER_STATUS.COMPLETED
      });
    }
    
    const now = new Date();
    order.actualEndTime = now.toISOString();
    order.status = ORDER_STATUS.COMPLETED;
    order.updateTime = now.toISOString();
    
    orders[orderIndex] = order;
    writeFile(FILES.orders, orders);
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: '完成订单失败', message: error.message });
  }
});

router.post('/orders/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const orders = readFile(FILES.orders);
    const orderIndex = orders.findIndex(o => o.id === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    const order = orders[orderIndex];
    
    const canCancel = canTransition(order.status, ORDER_STATUS.CANCELLED) || 
                      canTransition(order.status, ORDER_STATUS.REFUNDED);
    
    if (!canCancel) {
      return res.status(400).json({ 
        error: '当前状态不能取消订单', 
        currentStatus: order.status
      });
    }
    
    const now = new Date().toISOString();
    let result = { order };
    
    if (order.status === ORDER_STATUS.PAID) {
      const cancellation = calculateCancellationFee(order, now);
      
      if (cancellation.refundAmount > 0) {
        const refund = {
          id: generateId('REF'),
          orderId: id,
          amount: cancellation.refundAmount,
          fee: cancellation.fee,
          reason: cancellation.reason,
          status: 'success',
          createTime: now
        };
        
        const refunds = readFile(FILES.refunds);
        refunds.push(refund);
        writeFile(FILES.refunds, refunds);
        
        order.status = ORDER_STATUS.REFUNDED;
        result.refund = refund;
      } else {
        order.status = ORDER_STATUS.CANCELLED;
        order.notes = reason || '订单已取消';
      }
    } else {
      order.status = ORDER_STATUS.CANCELLED;
      order.notes = reason || '订单已取消';
    }
    
    order.updateTime = now;
    
    orders[orderIndex] = order;
    writeFile(FILES.orders, orders);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '取消订单失败', message: error.message });
  }
});

router.get('/reports/summary', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let orders = readFile(FILES.orders);
    let payments = readFile(FILES.payments);
    let refunds = readFile(FILES.refunds);
    
    if (startDate) {
      const start = new Date(startDate);
      orders = orders.filter(o => new Date(o.createTime) >= start);
      payments = payments.filter(p => new Date(p.createTime) >= start);
      refunds = refunds.filter(r => new Date(r.createTime) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      orders = orders.filter(o => new Date(o.createTime) <= end);
      payments = payments.filter(p => new Date(p.createTime) <= end);
      refunds = refunds.filter(r => new Date(r.createTime) <= end);
    }
    
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === ORDER_STATUS.COMPLETED).length;
    const cancelledOrders = orders.filter(o => 
      o.status === ORDER_STATUS.CANCELLED || o.status === ORDER_STATUS.REFUNDED
    ).length;
    
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalRefunds = refunds.reduce((sum, r) => sum + r.amount, 0);
    const netRevenue = totalRevenue - totalRefunds;
    
    const spotStats = {};
    orders.forEach(order => {
      if (!spotStats[order.spotId]) {
        spotStats[order.spotId] = {
          spotId: order.spotId,
          owner: order.spotInfo?.owner || '未知',
          area: order.spotInfo?.area || '未知',
          orderCount: 0,
          revenue: 0
        };
      }
      spotStats[order.spotId].orderCount++;
      if (order.status === ORDER_STATUS.COMPLETED || order.status === ORDER_STATUS.PAID) {
        spotStats[order.spotId].revenue += order.totalPrice;
      }
    });
    
    const statusDistribution = {};
    Object.values(ORDER_STATUS).forEach(status => {
      statusDistribution[status] = orders.filter(o => o.status === status).length;
    });
    
    res.json({
      summary: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue,
        totalRefunds,
        netRevenue
      },
      spotStats: Object.values(spotStats),
      statusDistribution,
      orderCount: totalOrders,
      startDate,
      endDate
    });
  } catch (error) {
    res.status(500).json({ error: '获取报表失败', message: error.message });
  }
});

router.get('/reports/details', (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    let orders = readFile(FILES.orders);
    const payments = readFile(FILES.payments);
    const refunds = readFile(FILES.refunds);
    
    if (startDate) {
      const start = new Date(startDate);
      orders = orders.filter(o => new Date(o.createTime) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      orders = orders.filter(o => new Date(o.createTime) <= end);
    }
    
    if (status) {
      orders = orders.filter(o => o.status === status);
    }
    
    const details = orders.map(order => {
      const orderPayments = payments.filter(p => p.orderId === order.id);
      const orderRefunds = refunds.filter(r => r.orderId === order.id);
      
      const totalPaid = orderPayments.reduce((sum, p) => sum + p.amount, 0);
      const totalRefunded = orderRefunds.reduce((sum, r) => sum + r.amount, 0);
      
      return {
        orderId: order.id,
        spotId: order.spotId,
        owner: order.spotInfo?.owner,
        area: order.spotInfo?.area,
        customerName: order.customerName,
        phone: order.phone,
        startTime: order.startTime,
        endTime: order.endTime,
        priceInfo: order.priceInfo,
        totalPrice: order.totalPrice,
        status: order.status,
        totalPaid,
        totalRefunded,
        netAmount: totalPaid - totalRefunded,
        createTime: order.createTime
      };
    });
    
    details.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
    
    const totalRevenue = details.reduce((sum, d) => sum + d.totalPaid, 0);
    const totalRefunds = details.reduce((sum, d) => sum + d.totalRefunded, 0);
    
    res.json({
      details,
      summary: {
        totalOrders: details.length,
        totalRevenue,
        totalRefunds,
        netRevenue: totalRevenue - totalRefunds
      }
    });
  } catch (error) {
    res.status(500).json({ error: '获取明细失败', message: error.message });
  }
});

router.get('/dashboard/stats', (req, res) => {
  try {
    const orders = readFile(FILES.orders);
    const payments = readFile(FILES.payments);
    const refunds = readFile(FILES.refunds);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = orders.filter(o => new Date(o.createTime) >= today);
    const todayPayments = payments.filter(p => new Date(p.createTime) >= today);
    const todayRefunds = refunds.filter(r => new Date(r.createTime) >= today);
    
    const todayRevenue = todayPayments.reduce((sum, p) => sum + p.amount, 0);
    const todayRefundAmount = todayRefunds.reduce((sum, r) => sum + r.amount, 0);
    
    const pendingOrders = orders.filter(o => 
      o.status === ORDER_STATUS.PENDING || o.status === ORDER_STATUS.CONFIRMED
    ).length;
    
    const activeOrders = orders.filter(o => o.status === ORDER_STATUS.IN_PROGRESS).length;
    
    const statusDistribution = {};
    Object.values(ORDER_STATUS).forEach(status => {
      statusDistribution[status] = orders.filter(o => o.status === status).length;
    });
    
    res.json({
      today: {
        orders: todayOrders.length,
        revenue: todayRevenue,
        refunds: todayRefundAmount
      },
      pendingOrders,
      activeOrders,
      statusDistribution,
      totalOrders: orders.length
    });
  } catch (error) {
    res.status(500).json({ error: '获取统计失败', message: error.message });
  }
});

module.exports = router;