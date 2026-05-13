const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { Database } = require('../utils/db');

const validateOvenCapacity = async (pickupTime, quantity) => {
  const pickupDate = moment(pickupTime);
  const dateStr = pickupDate.format('YYYY-MM-DD');
  
  const ovens = await Database.all('SELECT * FROM oven_capacities WHERE is_active = 1');
  let totalCapacity = 0;
  
  ovens.forEach(oven => {
    const [startHour, endHour] = oven.available_hours.split('-');
    const pickupHour = pickupDate.format('HH:mm');
    
    if (pickupHour >= startHour && pickupHour <= endHour) {
      totalCapacity += oven.max_batches * oven.batch_size;
    }
  });

  const existingOrders = await Database.get(`
    SELECT SUM(quantity) as total_quantity FROM orders 
    WHERE DATE(pickup_time) = ? AND status != 'cancelled'
  `, dateStr);
  
  const usedCapacity = existingOrders.total_quantity || 0;
  
  return { available: totalCapacity - usedCapacity, totalCapacity, usedCapacity, requested: quantity };
};

const validatePickupTime = (pickupTime) => {
  const now = moment();
  const pickup = moment(pickupTime);
  
  if (pickup.isBefore(now)) {
    return { valid: false, reason: '取货时间不能早于当前时间' };
  }
  
  if (pickup.diff(now, 'hours') < 2) {
    return { valid: false, reason: '需要提前至少2小时下单' };
  }
  
  const hour = pickup.hour();
  if (hour < 8 || hour > 20) {
    return { valid: false, reason: '取货时间只能在8:00-20:00之间' };
  }
  
  return { valid: true };
};

const checkIngredientStock = async (recipeId, quantity) => {
  const recipe = await Database.get('SELECT * FROM flavor_recipes WHERE id = ?', recipeId);
  if (!recipe) return { sufficient: false, missing: ['配方不存在'] };
  
  const ingredients = recipe.ingredients.split(',').map(ing => {
    const [name, amount] = ing.split(':');
    const num = parseFloat(amount);
    const unit = amount.replace(/[0-9.]/g, '');
    return { name: name.trim(), amount: num, unit };
  });
  
  const missing = [];
  for (const ing of ingredients) {
    const stock = await Database.get('SELECT * FROM ingredient_stocks WHERE ingredient_name = ?', ing.name);
    if (!stock) {
      missing.push(`${ing.name}: 库存不存在`);
    } else if (stock.current_quantity < ing.amount * quantity) {
      missing.push(`${ing.name}: 需求 ${ing.amount * quantity}${stock.unit}, 库存 ${stock.current_quantity}${stock.unit}`);
    }
  }
  
  return { sufficient: missing.length === 0, missing };
};

const assignShift = async (pickupTime) => {
  const pickup = moment(pickupTime);
  const pickupHour = pickup.format('HH:mm');
  
  const shifts = await Database.all('SELECT * FROM production_shifts');
  
  for (const shift of shifts) {
    if (pickupHour >= shift.start_time && pickupHour <= shift.end_time) {
      return shift.id;
    }
  }
  
  return null;
};

router.get('/', async (req, res) => {
  try {
    const orders = await Database.all(`
      SELECT o.*, f.name as recipe_name, s.shift_name 
      FROM orders o 
      LEFT JOIN flavor_recipes f ON o.recipe_id = f.id 
      LEFT JOIN production_shifts s ON o.shift_id = s.id 
      ORDER BY o.created_at DESC
    `);
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await Database.get(`
      SELECT o.*, f.name as recipe_name, s.shift_name 
      FROM orders o 
      LEFT JOIN flavor_recipes f ON o.recipe_id = f.id 
      LEFT JOIN production_shifts s ON o.shift_id = s.id 
      WHERE o.id = ?
    `, req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    const timeline = await Database.all('SELECT * FROM order_timeline WHERE order_id = ? ORDER BY event_time ASC', req.params.id);
    res.json({ success: true, data: { ...order, timeline } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { customer_name, recipe_id, quantity, pickup_time, notes, operator } = req.body;
    const now = new Date().toISOString();

    const existingPending = await Database.get(`
      SELECT COUNT(*) as count FROM orders 
      WHERE customer_name = ? AND recipe_id = ? AND DATE(pickup_time) = ? AND status = 'pending'
    `, customer_name, recipe_id, moment(pickup_time).format('YYYY-MM-DD'));
    
    if (existingPending.count > 0) {
      return res.status(400).json({ success: false, message: '该用户当天已有相同的待处理订单', scenario: 'duplicate_submit' });
    }

    const timeValidation = validatePickupTime(pickup_time);
    if (!timeValidation.valid) {
      return res.status(400).json({ success: false, message: timeValidation.reason, scenario: 'rule_blocked' });
    }

    const capacityCheck = await validateOvenCapacity(pickup_time, quantity);
    if (capacityCheck.available < quantity) {
      return res.status(400).json({ 
        success: false, 
        message: `烤炉容量不足，剩余可用: ${capacityCheck.available}, 请求: ${quantity}`, 
        scenario: 'rule_blocked' 
      });
    }

    const stockCheck = await checkIngredientStock(recipe_id, quantity);
    if (!stockCheck.sufficient) {
      return res.status(400).json({ 
        success: false, 
        message: '原料库存不足: ' + stockCheck.missing.join('; '), 
        scenario: 'rule_blocked' 
      });
    }

    const shiftId = await assignShift(pickup_time);
    
    const orderNumber = `ORD${Date.now().toString().slice(-6)}`;
    const id = uuidv4();

    await Database.run(
      'INSERT INTO orders (id, order_number, customer_name, recipe_id, quantity, pickup_time, shift_id, status, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, orderNumber, customer_name, recipe_id, quantity, pickup_time, shiftId, 'confirmed', notes, operator, now, now
    );

    await Database.run(
      'INSERT INTO order_timeline (id, order_id, event_type, event_description, operator, event_time) VALUES (?, ?, ?, ?, ?, ?)',
      uuidv4(), id, 'create', '订单创建并确认', operator, now
    );

    res.json({ 
      success: true, 
      message: '订单创建成功', 
      scenario: 'normal_complete',
      data: { id, order_number: orderNumber } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/reschedule', async (req, res) => {
  try {
    const { requested_pickup_time, reason, operator } = req.body;
    const orderId = req.params.id;
    const now = new Date().toISOString();

    const order = await Database.get('SELECT * FROM orders WHERE id = ?', orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }

    const existingRequest = await Database.get(`
      SELECT COUNT(*) as count FROM reschedule_requests 
      WHERE order_id = ? AND status = 'pending'
    `, orderId);
    
    if (existingRequest.count > 0) {
      return res.status(400).json({ success: false, message: '已有待处理的改期申请' });
    }

    const timeValidation = validatePickupTime(requested_pickup_time);
    if (!timeValidation.valid) {
      return res.status(400).json({ success: false, message: timeValidation.reason });
    }

    const capacityCheck = await validateOvenCapacity(requested_pickup_time, order.quantity);
    let status = capacityCheck.available >= order.quantity ? 'auto_approved' : 'pending_review';

    const requestId = uuidv4();
    await Database.run(
      'INSERT INTO reschedule_requests (id, order_id, original_pickup_time, requested_pickup_time, reason, requested_by, requested_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      requestId, orderId, order.pickup_time, requested_pickup_time, reason, operator, now, status
    );

    if (status === 'auto_approved') {
      const shiftId = await assignShift(requested_pickup_time);
      await Database.run('UPDATE orders SET pickup_time = ?, shift_id = ?, updated_at = ? WHERE id = ?', requested_pickup_time, shiftId, now, orderId);
      
      await Database.run(
        'INSERT INTO order_timeline (id, order_id, event_type, event_description, operator, event_time) VALUES (?, ?, ?, ?, ?, ?)',
        uuidv4(), orderId, 'reschedule', `订单改期从 ${order.pickup_time} 到 ${requested_pickup_time}`, operator, now
      );

      res.json({ 
        success: true, 
        message: '改期申请已自动批准',
        scenario: 'normal_complete'
      });
    } else {
      await Database.run(
        'INSERT INTO order_timeline (id, order_id, event_type, event_description, operator, event_time) VALUES (?, ?, ?, ?, ?, ?)',
        uuidv4(), orderId, 'reschedule_request', '提交改期申请，等待人工审核', operator, now
      );

      res.json({ 
        success: true, 
        message: '改期申请已提交，等待人工审核',
        scenario: 'manual_review'
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/reschedule/:id/review', async (req, res) => {
  try {
    const { approved, review_notes, operator } = req.body;
    const requestId = req.params.id;
    const now = new Date().toISOString();

    const request = await Database.get('SELECT * FROM reschedule_requests WHERE id = ?', requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: '改期申请不存在' });
    }
    if (request.status !== 'pending_review') {
      return res.status(400).json({ success: false, message: '该申请已处理' });
    }

    const newStatus = approved ? 'approved' : 'rejected';
    
    await Database.run(
      'UPDATE reschedule_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, review_notes = ? WHERE id = ?',
      newStatus, operator, now, review_notes, requestId
    );

    if (approved) {
      const shiftId = await assignShift(request.requested_pickup_time);
      await Database.run('UPDATE orders SET pickup_time = ?, shift_id = ?, updated_at = ? WHERE id = ?', request.requested_pickup_time, shiftId, now, request.order_id);
      
      await Database.run(
        'INSERT INTO order_timeline (id, order_id, event_type, event_description, operator, event_time) VALUES (?, ?, ?, ?, ?, ?)',
        uuidv4(), request.order_id, 'reschedule_approved', `改期已批准: 从 ${request.original_pickup_time} 到 ${request.requested_pickup_time}`, operator, now
      );
    } else {
      await Database.run(
        'INSERT INTO order_timeline (id, order_id, event_type, event_description, operator, event_time) VALUES (?, ?, ?, ?, ?, ?)',
        uuidv4(), request.order_id, 'reschedule_rejected', `改期被拒绝: ${review_notes}`, operator, now
      );
    }

    res.json({ success: true, message: approved ? '改期已批准' : '改期已拒绝' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const timeline = await Database.all('SELECT * FROM order_timeline WHERE order_id = ? ORDER BY event_time ASC', req.params.id);
    res.json({ success: true, data: timeline });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/statistics/shifts', async (req, res) => {
  try {
    const { date } = req.query;
    const dateStr = date || moment().format('YYYY-MM-DD');
    
    const shifts = await Database.all('SELECT * FROM production_shifts');
    const stats = [];
    
    for (const shift of shifts) {
      const orderData = await Database.get(`
        SELECT COUNT(o.id) as current_orders, SUM(o.quantity) as total_quantity
        FROM orders o 
        WHERE o.shift_id = ? AND DATE(o.pickup_time) = ? AND o.status != 'cancelled'
      `, shift.id, dateStr);
      
      stats.push({
        ...shift,
        current_orders: orderData.current_orders || 0,
        total_quantity: orderData.total_quantity || 0
      });
    }
    
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
