const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readData(file, defaultValue) {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error(`读取文件失败: ${file}`, e);
  }
  return defaultValue;
}

function writeData(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error(`写入文件失败: ${file}`, e);
    return false;
  }
}

let orders = readData(ORDERS_FILE, []);
let history = readData(HISTORY_FILE, []);
let nextOrderId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1;
let nextHistoryId = history.length > 0 ? Math.max(...history.map(h => h.id)) + 1 : 1;

function saveOrders() {
  writeData(ORDERS_FILE, orders);
}

function saveHistory() {
  writeData(HISTORY_FILE, history);
}

const validatePhone = (phone) => {
  return /^1[3-9]\d{9}$/.test(phone);
};

const validatePickupTime = (pickupTime) => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(pickupTime);
};

const checkDuplicateOrder = (phone, pickupTime, excludeId = null) => {
  const today = new Date().toISOString().split('T')[0];
  return orders.some(order => {
    if (excludeId && order.id === excludeId) return false;
    const orderDate = new Date(order.created_at).toISOString().split('T')[0];
    return order.phone === phone && 
           orderDate === today && 
           order.pickup_time === pickupTime && 
           order.status !== '已取消';
  });
};

const recordStatusChange = (orderId, fromStatus, toStatus, reason = null, staffNote = null) => {
  const record = {
    id: nextHistoryId++,
    order_id: orderId,
    from_status: fromStatus,
    to_status: toStatus,
    reason: reason,
    staff_note: staffNote,
    created_at: new Date().toISOString()
  };
  history.push(record);
  saveHistory();
};

app.get('/api/orders', (req, res) => {
  try {
    const { date, status, pickupTimeStart, pickupTimeEnd } = req.query;
    
    let filtered = [...orders];

    if (date) {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        return orderDate === date;
      });
    }

    if (status) {
      filtered = filtered.filter(order => order.status === status);
    }

    if (pickupTimeStart) {
      filtered = filtered.filter(order => order.pickup_time >= pickupTimeStart);
    }

    if (pickupTimeEnd) {
      filtered = filtered.filter(order => order.pickup_time <= pickupTimeEnd);
    }

    filtered.sort((a, b) => {
      if (a.pickup_time !== b.pickup_time) {
        return a.pickup_time.localeCompare(b.pickup_time);
      }
      return new Date(a.created_at) - new Date(b.created_at);
    });

    res.json({ success: true, data: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/orders/:id', (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }

    const orderHistory = history.filter(h => h.order_id === orderId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    res.json({ success: true, data: { ...order, history: orderHistory } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const { customer_name, phone, pickup_time, drink, quantity, temperature, sweetness, notes } = req.body;

    if (!customer_name || !phone || !pickup_time || !drink || !temperature || !sweetness) {
      return res.status(400).json({ success: false, message: '请填写所有必填字段' });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ success: false, message: '请输入有效的11位手机号' });
    }

    if (!validatePickupTime(pickup_time)) {
      return res.status(400).json({ success: false, message: '请输入有效的取杯时间（格式：HH:MM）' });
    }

    if (checkDuplicateOrder(phone, pickup_time)) {
      return res.status(400).json({ success: false, message: '该手机号同一取杯时间已有订单' });
    }

    const newOrder = {
      id: nextOrderId++,
      customer_name,
      phone,
      pickup_time,
      drink,
      quantity: quantity || 1,
      temperature,
      sweetness,
      notes: notes || null,
      status: '待确认',
      cancel_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    orders.push(newOrder);
    saveOrders();

    recordStatusChange(newOrder.id, null, '待确认', null, '订单创建');

    res.json({ success: true, data: newOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/orders/:id/status', (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status, reason, staff_note } = req.body;
    const validStatuses = ['待确认', '已确认', '制作中', '已完成', '已取消'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: '无效的订单状态' });
    }

    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }

    const order = orders[orderIndex];

    if (status === '已取消' && !reason) {
      return res.status(400).json({ success: false, message: '取消订单必须填写原因' });
    }

    if (order.status === status) {
      return res.json({ success: true, data: order, message: '状态未变化' });
    }

    orders[orderIndex].status = status;
    if (status === '已取消') {
      orders[orderIndex].cancel_reason = reason;
    }
    orders[orderIndex].updated_at = new Date().toISOString();
    saveOrders();

    recordStatusChange(orderId, order.status, status, status === '已取消' ? reason : null, staff_note);

    res.json({ success: true, data: orders[orderIndex] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/orders/:id', (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { customer_name, phone, pickup_time, drink, quantity, temperature, sweetness, notes } = req.body;

    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }

    const order = orders[orderIndex];

    if (order.status === '已取消' || order.status === '已完成') {
      return res.status(400).json({ success: false, message: '已完成或已取消的订单不能修改' });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ success: false, message: '请输入有效的11位手机号' });
    }

    if (pickup_time && !validatePickupTime(pickup_time)) {
      return res.status(400).json({ success: false, message: '请输入有效的取杯时间（格式：HH:MM）' });
    }

    const checkPhone = phone || order.phone;
    const checkTime = pickup_time || order.pickup_time;

    if (checkDuplicateOrder(checkPhone, checkTime, orderId)) {
      return res.status(400).json({ success: false, message: '该手机号同一取杯时间已有订单' });
    }

    if (customer_name !== undefined) orders[orderIndex].customer_name = customer_name;
    if (phone !== undefined) orders[orderIndex].phone = phone;
    if (pickup_time !== undefined) orders[orderIndex].pickup_time = pickup_time;
    if (drink !== undefined) orders[orderIndex].drink = drink;
    if (quantity !== undefined) orders[orderIndex].quantity = quantity;
    if (temperature !== undefined) orders[orderIndex].temperature = temperature;
    if (sweetness !== undefined) orders[orderIndex].sweetness = sweetness;
    if (notes !== undefined) orders[orderIndex].notes = notes;
    orders[orderIndex].updated_at = new Date().toISOString();

    saveOrders();

    res.json({ success: true, data: orders[orderIndex] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/stats/daily', (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const todayOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      return orderDate === targetDate;
    });

    const summary = {
      total_orders: todayOrders.length,
      total_cups: todayOrders.reduce((sum, o) => sum + o.quantity, 0),
      completed_cups: todayOrders.filter(o => o.status === '已完成').reduce((sum, o) => sum + o.quantity, 0),
      cancelled_cups: todayOrders.filter(o => o.status === '已取消').reduce((sum, o) => sum + o.quantity, 0),
      in_progress_cups: todayOrders.filter(o => o.status === '制作中').reduce((sum, o) => sum + o.quantity, 0),
      confirmed_cups: todayOrders.filter(o => o.status === '已确认').reduce((sum, o) => sum + o.quantity, 0),
      pending_cups: todayOrders.filter(o => o.status === '待确认').reduce((sum, o) => sum + o.quantity, 0)
    };

    const drinkMap = {};
    todayOrders
      .filter(o => o.status !== '已取消')
      .forEach(order => {
        if (!drinkMap[order.drink]) {
          drinkMap[order.drink] = { drink: order.drink, total_quantity: 0, order_count: 0 };
        }
        drinkMap[order.drink].total_quantity += order.quantity;
        drinkMap[order.drink].order_count += 1;
      });

    const drinkRanking = Object.values(drinkMap)
      .sort((a, b) => b.total_quantity - a.total_quantity)
      .slice(0, 10);

    const timeMap = {};
    todayOrders
      .filter(o => o.status !== '已取消')
      .forEach(order => {
        if (!timeMap[order.pickup_time]) {
          timeMap[order.pickup_time] = { pickup_time: order.pickup_time, total_cups: 0, order_count: 0 };
        }
        timeMap[order.pickup_time].total_cups += order.quantity;
        timeMap[order.pickup_time].order_count += 1;
      });

    const timeSlots = Object.values(timeMap)
      .sort((a, b) => a.pickup_time.localeCompare(b.pickup_time));

    res.json({
      success: true,
      data: {
        date: targetDate,
        summary,
        drink_ranking: drinkRanking,
        time_slots: timeSlots
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/seed', (req, res) => {
  try {
    const drinks = ['美式咖啡', '拿铁', '卡布奇诺', '摩卡', '焦糖玛奇朵', '香草拿铁', '冰美式', '冰拿铁', '热巧克力', '抹茶拿铁'];
    const temperatures = ['热', '冰', '常温'];
    const sweetness = ['无糖', '少糖', '半糖', '全糖'];
    const names = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴'];
    const phones = ['13800138001', '13800138002', '13800138003', '13800138004', '13800138005'];

    const today = new Date().toISOString().split('T')[0];
    const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    const statuses = ['待确认', '已确认', '制作中', '已完成'];

    let createdCount = 0;
    const usedPhoneTime = new Set();

    for (let i = 0; i < 20; i++) {
      const name = names[Math.floor(Math.random() * names.length)] + (Math.random() > 0.5 ? '先生' : '女士');
      const phone = phones[Math.floor(Math.random() * phones.length)];
      const pickupTime = timeSlots[Math.floor(Math.random() * timeSlots.length)];
      const key = `${phone}-${pickupTime}`;

      if (usedPhoneTime.has(key)) continue;
      usedPhoneTime.add(key);

      const drink = drinks[Math.floor(Math.random() * drinks.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const temp = temperatures[Math.floor(Math.random() * temperatures.length)];
      const sweet = sweetness[Math.floor(Math.random() * sweetness.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const notes = Math.random() > 0.7 ? '少冰' : null;

      const newOrder = {
        id: nextOrderId++,
        customer_name: name,
        phone,
        pickup_time: pickupTime,
        drink,
        quantity,
        temperature: temp,
        sweetness: sweet,
        notes,
        status,
        cancel_reason: null,
        created_at: `${today}T10:00:00.000Z`,
        updated_at: `${today}T10:00:00.000Z`
      };

      orders.push(newOrder);
      recordStatusChange(newOrder.id, null, '待确认', null, '种子数据创建');
      if (status !== '待确认') {
        recordStatusChange(newOrder.id, '待确认', status, null, '状态变更');
      }
      createdCount++;
    }

    const cancelKey = '13999999999-18:00';
    if (!usedPhoneTime.has(cancelKey)) {
      const cancelOrder = {
        id: nextOrderId++,
        customer_name: '临时取消',
        phone: '13999999999',
        pickup_time: '18:00',
        drink: '美式咖啡',
        quantity: 2,
        temperature: '冰',
        sweetness: '无糖',
        notes: null,
        status: '已取消',
        cancel_reason: '客户临时有事',
        created_at: `${today}T10:00:00.000Z`,
        updated_at: `${today}T10:00:00.000Z`
      };
      orders.push(cancelOrder);
      recordStatusChange(cancelOrder.id, null, '待确认', null, '种子数据创建');
      recordStatusChange(cancelOrder.id, '待确认', '已取消', '客户临时有事', '订单取消');
      createdCount++;
    }

    saveOrders();

    res.json({ success: true, message: `成功创建 ${createdCount} 条种子数据`, count: createdCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`☕ 咖啡店预订单系统已启动`);
  console.log(`========================================`);
  console.log(`首页: http://localhost:${PORT}`);
  console.log(`订单录入: http://localhost:${PORT}/order-form.html`);
  console.log(`制作队列: http://localhost:${PORT}/queue.html`);
  console.log(`异常处理: http://localhost:${PORT}/exceptions.html`);
  console.log(`统计页面: http://localhost:${PORT}/stats.html`);
  console.log(`========================================`);
  console.log(`数据存储在: ${DATA_DIR}`);
  console.log(`========================================\n`);
});
