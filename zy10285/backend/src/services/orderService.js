const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const crypto = require('crypto');

function generateOrderNo(callback) {
  const date = dayjs().format('YYYYMMDD');
  db.get(`SELECT COUNT(*) as count FROM orders WHERE order_no LIKE ?`, [`${date}%`], (err, row) => {
    if (err) return callback(err);
    callback(null, `ICE${date}${String(row.count + 1).padStart(4, '0')}`);
  });
}

function generateImportHash(orderData) {
  const data = `${orderData.customer_id}-${orderData.ice_spec_id}-${orderData.delivery_slot_id}-${orderData.quantity}-${dayjs().format('YYYYMMDD')}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

function checkDuplicateOrder(importHash, callback) {
  db.get(`SELECT id FROM orders WHERE import_hash = ?`, [importHash], (err, row) => {
    callback(err, !!row);
  });
}

function checkCapacity(deliverySlotId, quantity, iceSpecId, callback) {
  db.get(`SELECT * FROM delivery_slots WHERE id = ?`, [deliverySlotId], (err, slot) => {
    if (err) return callback(err);
    if (!slot) return callback(null, { available: false, message: '配送时段不存在' });
    
    db.get(`SELECT weight FROM ice_specs WHERE id = ?`, [iceSpecId], (err, iceSpec) => {
      if (err) return callback(err);
      if (!iceSpec) return callback(null, { available: false, message: '冰块规格不存在' });
      
      const additionalLoad = quantity * iceSpec.weight;
      const totalLoad = slot.current_load + additionalLoad;
      
      callback(null, {
        available: totalLoad <= slot.max_capacity,
        currentLoad: slot.current_load,
        maxCapacity: slot.max_capacity,
        additionalLoad,
        totalLoad
      });
    });
  });
}

function createOrder(orderData, callback) {
  const importHash = generateImportHash(orderData);
  
  checkDuplicateOrder(importHash, (err, isDuplicate) => {
    if (err) return callback(err);
    if (isDuplicate) {
      return callback(null, { success: false, message: '重复订单，已拦截', code: 'DUPLICATE_ORDER' });
    }
    
    checkCapacity(orderData.delivery_slot_id, orderData.quantity, orderData.ice_spec_id, (err, capacityCheck) => {
      if (err) return callback(err);
      if (!capacityCheck.available) {
        return callback(null, { 
          success: false, 
          message: `产能不足，当前负载${capacityCheck.currentLoad}kg，新增${capacityCheck.additionalLoad}kg后将超过最大容量${capacityCheck.maxCapacity}kg`,
          code: 'INSUFFICIENT_CAPACITY',
          capacity: capacityCheck
        });
      }
      
      db.get(`SELECT price FROM ice_specs WHERE id = ?`, [orderData.ice_spec_id], (err, iceSpec) => {
        if (err) return callback(err);
        const totalAmount = orderData.quantity * iceSpec.price;
        
        generateOrderNo((err, orderNo) => {
          if (err) return callback(err);
          
          const orderId = uuidv4();
          const now = dayjs().format();
          
          db.run(`BEGIN TRANSACTION`, (err) => {
            if (err) return callback(err);
            
            db.run(`
              INSERT INTO orders (
                id, order_no, customer_id, ice_spec_id, quantity, delivery_slot_id,
                status, total_amount, delivery_address, contact_phone, import_hash,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
            `, [
              orderId, orderNo, orderData.customer_id, orderData.ice_spec_id,
              orderData.quantity, orderData.delivery_slot_id, totalAmount,
              orderData.delivery_address, orderData.contact_phone, importHash,
              now, now
            ], (err) => {
              if (err) return db.run('ROLLBACK', () => callback(err));
              
              db.run(`
                UPDATE delivery_slots 
                SET current_load = current_load + ?, updated_at = ?
                WHERE id = ?
              `, [capacityCheck.additionalLoad, now, orderData.delivery_slot_id], (err) => {
                if (err) return db.run('ROLLBACK', () => callback(err));
                
                db.run(`
                  INSERT INTO order_history (id, order_id, action, new_status, operator, created_at)
                  VALUES (?, ?, 'create', 'pending', 'system', ?)
                `, [uuidv4(), orderId, now], (err) => {
                  if (err) return db.run('ROLLBACK', () => callback(err));
                  
                  db.run('COMMIT', (err) => {
                    if (err) return callback(err);
                    callback(null, { success: true, orderId, orderNo });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

function confirmOrder(orderId, callback) {
  db.get(`SELECT * FROM orders WHERE id = ?`, [orderId], (err, order) => {
    if (err) return callback(err);
    if (!order) return callback(null, { success: false, message: '订单不存在' });
    if (order.status !== 'pending') return callback(null, { success: false, message: '订单状态不正确' });
    
    const now = dayjs().format();
    
    db.run(`BEGIN TRANSACTION`, (err) => {
      if (err) return callback(err);
      
      db.run(`
        UPDATE orders SET status = 'confirmed', updated_at = ? WHERE id = ?
      `, [now, orderId], (err) => {
        if (err) return db.run('ROLLBACK', () => callback(err));
        
        db.run(`
          INSERT INTO order_history (id, order_id, action, old_status, new_status, operator, created_at)
          VALUES (?, ?, 'confirm', 'pending', 'confirmed', 'system', ?)
        `, [uuidv4(), orderId, now], (err) => {
          if (err) return db.run('ROLLBACK', () => callback(err));
          
          db.run('COMMIT', (err) => {
            if (err) return callback(err);
            callback(null, { success: true });
          });
        });
      });
    });
  });
}

function dispatchOrder(orderId, coolerIdOrSerial, callback) {
  db.get(`SELECT * FROM orders WHERE id = ?`, [orderId], (err, order) => {
    if (err) return callback(err);
    if (!order) return callback(null, { success: false, message: '订单不存在' });
    if (order.status !== 'confirmed') return callback(null, { success: false, message: '订单状态不正确' });
    
    db.get(`SELECT * FROM coolers WHERE id = ? OR serial_number = ?`, [coolerIdOrSerial, coolerIdOrSerial], (err, cooler) => {
      if (err) return callback(err);
      if (!cooler || cooler.status !== 'available') {
        return callback(null, { success: false, message: '保温箱不可用' });
      }
      
      const now = dayjs().format();
      
      db.run(`BEGIN TRANSACTION`, (err) => {
        if (err) return callback(err);
        
        db.run(`
          UPDATE orders 
          SET status = 'dispatched', cooler_id = ?, updated_at = ? 
          WHERE id = ?
        `, [cooler.id, now, orderId], (err) => {
          if (err) return db.run('ROLLBACK', () => callback(err));
          
          db.run(`
            UPDATE coolers 
            SET status = 'in_use', customer_id = ?, assigned_at = ?, updated_at = ?
            WHERE id = ?
          `, [order.customer_id, now, now, cooler.id], (err) => {
            if (err) return db.run('ROLLBACK', () => callback(err));
            
            db.run(`
              INSERT INTO order_history (id, order_id, action, old_status, new_status, operator, created_at)
              VALUES (?, ?, 'dispatch', 'confirmed', 'dispatched', 'system', ?)
            `, [uuidv4(), orderId, now], (err) => {
              if (err) return db.run('ROLLBACK', () => callback(err));
              
              db.run('COMMIT', (err) => {
                if (err) return callback(err);
                callback(null, { success: true });
              });
            });
          });
        });
      });
    });
  });
}

function signOrder(orderId, signedBy, callback) {
  db.get(`SELECT * FROM orders WHERE id = ?`, [orderId], (err, order) => {
    if (err) return callback(err);
    if (!order) return callback(null, { success: false, message: '订单不存在' });
    if (order.status !== 'dispatched') return callback(null, { success: false, message: '订单状态不正确' });
    
    const now = dayjs().format();
    
    db.run(`BEGIN TRANSACTION`, (err) => {
      if (err) return callback(err);
      
      db.run(`
        UPDATE orders 
        SET status = 'signed', signed_at = ?, signed_by = ?, updated_at = ? 
        WHERE id = ?
      `, [now, signedBy, now, orderId], (err) => {
        if (err) return db.run('ROLLBACK', () => callback(err));
        
        db.run(`
          INSERT INTO order_history (id, order_id, action, old_status, new_status, operator, created_at)
          VALUES (?, ?, 'sign', 'dispatched', 'signed', 'system', ?)
        `, [uuidv4(), orderId, now], (err) => {
          if (err) return db.run('ROLLBACK', () => callback(err));
          
          db.run('COMMIT', (err) => {
            if (err) return callback(err);
            callback(null, { success: true });
          });
        });
      });
    });
  });
}

function refundOrder(orderId, reason, callback) {
  db.get(`SELECT * FROM orders WHERE id = ?`, [orderId], (err, order) => {
    if (err) return callback(err);
    if (!order) return callback(null, { success: false, message: '订单不存在' });
    if (['refunded', 'cancelled'].includes(order.status)) {
      return callback(null, { success: false, message: '订单已退款或取消' });
    }
    
    const now = dayjs().format();
    
    db.get(`SELECT weight FROM ice_specs WHERE id = ?`, [order.ice_spec_id], (err, iceSpec) => {
      if (err) return callback(err);
      const loadToReduce = order.quantity * iceSpec.weight;
      
      db.run(`BEGIN TRANSACTION`, (err) => {
        if (err) return callback(err);
        
        db.run(`
          UPDATE orders 
          SET status = 'refunded', refund_reason = ?, refund_amount = total_amount, refund_at = ?, updated_at = ? 
          WHERE id = ?
        `, [reason, now, now, orderId], (err) => {
          if (err) return db.run('ROLLBACK', () => callback(err));
          
          db.run(`
            UPDATE delivery_slots 
            SET current_load = MAX(0, current_load - ?), updated_at = ?
            WHERE id = ?
          `, [loadToReduce, now, order.delivery_slot_id], (err) => {
            if (err) return db.run('ROLLBACK', () => callback(err));
            
            db.run(`
              INSERT INTO order_history (id, order_id, action, old_status, new_status, operator, notes, created_at)
              VALUES (?, ?, 'refund', ?, 'refunded', 'system', ?, ?)
            `, [uuidv4(), orderId, order.status, reason, now], (err) => {
              if (err) return db.run('ROLLBACK', () => callback(err));
              
              db.run('COMMIT', (err) => {
                if (err) return callback(err);
                callback(null, { success: true });
              });
            });
          });
        });
      });
    });
  });
}

function getOrders(filters, callback) {
  let sql = `
    SELECT o.*, c.name as customer_name, c.phone as customer_phone,
           s.name as ice_spec_name, s.weight as ice_spec_weight, s.price as ice_spec_price,
           sl.date as delivery_date, sl.start_time, sl.end_time,
           cool.serial_number as cooler_serial
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN ice_specs s ON o.ice_spec_id = s.id
    JOIN delivery_slots sl ON o.delivery_slot_id = sl.id
    LEFT JOIN coolers cool ON o.cooler_id = cool.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (filters.status) {
    sql += ' AND o.status = ?';
    params.push(filters.status);
  }
  
  if (filters.customer_id) {
    sql += ' AND o.customer_id = ?';
    params.push(filters.customer_id);
  }
  
  if (filters.delivery_date) {
    sql += ' AND sl.date = ?';
    params.push(filters.delivery_date);
  }
  
  sql += ' ORDER BY o.created_at DESC';
  
  db.all(sql, params, callback);
}

function getOrderDetail(orderId, callback) {
  db.get(`
    SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
           s.name as ice_spec_name, s.weight as ice_spec_weight, s.price as ice_spec_price,
           sl.date as delivery_date, sl.start_time, sl.end_time,
           cool.serial_number as cooler_serial
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN ice_specs s ON o.ice_spec_id = s.id
    JOIN delivery_slots sl ON o.delivery_slot_id = sl.id
    LEFT JOIN coolers cool ON o.cooler_id = cool.id
    WHERE o.id = ?
  `, [orderId], (err, order) => {
    if (err) return callback(err);
    if (!order) return callback(null, null);
    
    db.all(`
      SELECT * FROM order_history WHERE order_id = ? ORDER BY created_at ASC
    `, [orderId], (err, history) => {
      if (err) return callback(err);
      callback(null, { ...order, history });
    });
  });
}

module.exports = {
  createOrder,
  confirmOrder,
  dispatchOrder,
  signOrder,
  refundOrder,
  getOrders,
  getOrderDetail,
  checkCapacity,
  generateImportHash
};
