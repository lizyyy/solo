const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logAudit, logFlow, logException } = require('../utils/audit');
const { validateRental, validateReturn } = require('../middleware/validation');

router.get('/', (req, res) => {
  const { device_number, status, customer_name } = req.query;
  let query = 'SELECT * FROM rental_orders WHERE 1=1';
  const params = [];

  if (device_number) {
    query += ' AND device_number LIKE ?';
    params.push(`%${device_number}%`);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (customer_name) {
    query += ' AND customer_name LIKE ?';
    params.push(`%${customer_name}%`);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM rental_orders WHERE id = ?', [req.params.id], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else if (!row) res.status(404).json({ error: '订单不存在' });
    else res.json(row);
  });
});

router.post('/rent', validateRental, async (req, res) => {
  const { customer_name, customer_phone, deposit_amount, operator } = req.body;
  const device = req.device;
  const orderId = uuidv4();
  const rentalTime = new Date().toISOString();

  try {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO rental_orders (id, device_id, device_number, customer_name, customer_phone, deposit_amount, rental_time, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [orderId, device.id, device.device_number, customer_name, customer_phone, deposit_amount, rentalTime, operator],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE devices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['rented', device.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await logFlow(device.id, device.device_number, orderId, 'rent', 
      { status: device.status }, 
      { status: 'rented', customer_name, deposit_amount }, 
      operator, `客户: ${customer_name}`);

    if (device.battery_level < 50) {
      await logException(device.id, device.device_number, orderId, 'low_battery_rent', 
        `租借时电量为${device.battery_level}%，低于50%`, operator, operator);
    }

    db.get('SELECT * FROM rental_orders WHERE id = ?', [orderId], (err, row) => {
      if (err) res.status(500).json({ error: err.message });
      else res.status(201).json(row);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/return', validateReturn, async (req, res) => {
  const { battery_level, inspection_result, damage_description, operator } = req.body;
  const order = req.order;
  const device = req.device;
  const returnTime = new Date().toISOString();
  const newDeviceStatus = inspection_result === 'pass' ? 'available' : 'repairing';

  try {
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE rental_orders SET return_time = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [returnTime, 'completed', order.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE devices SET status = ?, battery_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newDeviceStatus, battery_level, device.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await logFlow(device.id, device.device_number, order.id, 'return',
      { status: device.status, order_status: order.status },
      { status: newDeviceStatus, order_status: 'completed', battery_level, inspection_result },
      operator, damage_description || '');

    if (inspection_result !== 'pass') {
      await logException(device.id, device.device_number, order.id, 'damage_found',
        damage_description || '归还验收发现损坏', operator, operator);

      const repairId = uuidv4();
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO repair_records (id, device_id, device_number, issue_description, responsible_person, operator) VALUES (?, ?, ?, ?, ?, ?)',
          [repairId, device.id, device.device_number, damage_description || '归还时发现损坏', operator, operator],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    if (battery_level < 20) {
      await logException(device.id, device.device_number, order.id, 'low_battery_return',
        `归还时电量为${battery_level}%，低于20%`, operator, operator);
    }

    db.get('SELECT * FROM rental_orders WHERE id = ?', [order.id], (err, row) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(row);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const { deposit_amount, operator } = req.body;

  try {
    const oldOrder = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM rental_orders WHERE id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!oldOrder) {
      return res.status(404).json({ error: '订单不存在' });
    }

    if (deposit_amount !== undefined && oldOrder.deposit_amount !== deposit_amount) {
      await logAudit('rental_orders', req.params.id, 'deposit_amount', 
        oldOrder.deposit_amount, deposit_amount, operator);
      
      await logFlow(oldOrder.device_id, oldOrder.device_number, req.params.id, 'deposit_change',
        { deposit_amount: oldOrder.deposit_amount },
        { deposit_amount },
        operator, '押金金额变更');
    }

    db.run(
      'UPDATE rental_orders SET deposit_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [deposit_amount, req.params.id],
      (err) => {
        if (err) res.status(500).json({ error: err.message });
        else {
          db.get('SELECT * FROM rental_orders WHERE id = ?', [req.params.id], (err, row) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json(row);
          });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
