const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const { status, pickup_time } = req.query;
  
  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (pickup_time) {
    query += ' AND pickup_time = ?';
    params.push(pickup_time);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const orderId = req.params.id;
  
  db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId], (err, items) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ ...order, items });
    });
  });
});

router.post('/', (req, res) => {
  const { user_name, user_phone, pickup_time, items, notes } = req.body;
  
  if (!user_name || !pickup_time || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '用户名、取货时间和订单项为必填项' });
  }

  const orderId = uuidv4();
  const status = 'pending';
  
  let totalAmount = 0;
  const orderItems = [];
  
  for (const item of items) {
    if (!item.product_id || !item.product_name || item.price === undefined || !item.quantity) {
      return res.status(400).json({ error: '每个订单项必须包含商品ID、商品名称、价格和数量' });
    }
    const subtotal = item.price * item.quantity;
    totalAmount += subtotal;
    orderItems.push({
      id: uuidv4(),
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name,
      price: item.price,
      quantity: item.quantity,
      subtotal: subtotal,
      replacement_status: 'none'
    });
  }

  db.serialize(() => {
    const orderStmt = db.prepare('INSERT INTO orders (id, user_name, user_phone, pickup_time, total_amount, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    orderStmt.run(orderId, user_name, user_phone || '', pickup_time, totalAmount, status, notes || '');
    orderStmt.finalize();

    const itemStmt = db.prepare('INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, subtotal, replacement_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    orderItems.forEach(item => {
      itemStmt.run(item.id, item.order_id, item.product_id, item.product_name, item.price, item.quantity, item.subtotal, item.replacement_status);
    });
    itemStmt.finalize();

    res.json({
      id: orderId,
      user_name,
      user_phone,
      pickup_time,
      total_amount: totalAmount,
      status,
      notes,
      items: orderItems
    });
  });
});

router.put('/:id', (req, res) => {
  const orderId = req.params.id;
  const { user_name, user_phone, pickup_time, items, notes, status } = req.body;

  db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const updatedName = user_name !== undefined ? user_name : order.user_name;
    const updatedPhone = user_phone !== undefined ? user_phone : order.user_phone;
    const updatedPickup = pickup_time !== undefined ? pickup_time : order.pickup_time;
    const updatedNotes = notes !== undefined ? notes : order.notes;
    const updatedStatus = status !== undefined ? status : order.status;

    if (items && Array.isArray(items)) {
      db.serialize(() => {
        db.run('DELETE FROM order_items WHERE order_id = ?', [orderId]);

        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
          if (!item.product_id || !item.product_name || item.price === undefined || !item.quantity) {
            return res.status(400).json({ error: '每个订单项必须包含商品ID、商品名称、价格和数量' });
          }
          const subtotal = item.price * item.quantity;
          totalAmount += subtotal;
          orderItems.push({
            id: item.id || uuidv4(),
            order_id: orderId,
            product_id: item.product_id,
            product_name: item.product_name,
            price: item.price,
            quantity: item.quantity,
            subtotal: subtotal,
            replacement_status: item.replacement_status || 'none',
            replacement_product_id: item.replacement_product_id,
            replacement_product_name: item.replacement_product_name,
            replacement_price: item.replacement_price,
            price_difference: item.price_difference
          });
        }

        const itemStmt = db.prepare(`
          INSERT INTO order_items 
          (id, order_id, product_id, product_name, price, quantity, subtotal, replacement_status, replacement_product_id, replacement_product_name, replacement_price, price_difference) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        orderItems.forEach(item => {
          itemStmt.run(
            item.id, item.order_id, item.product_id, item.product_name, item.price, 
            item.quantity, item.subtotal, item.replacement_status, 
            item.replacement_product_id, item.replacement_product_name, 
            item.replacement_price, item.price_difference
          );
        });
        itemStmt.finalize();

        db.run(
          'UPDATE orders SET user_name = ?, user_phone = ?, pickup_time = ?, total_amount = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [updatedName, updatedPhone, updatedPickup, totalAmount, updatedStatus, updatedNotes, orderId],
          function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            res.json({
              id: orderId,
              user_name: updatedName,
              user_phone: updatedPhone,
              pickup_time: updatedPickup,
              total_amount: totalAmount,
              status: updatedStatus,
              notes: updatedNotes,
              items: orderItems
            });
          }
        );
      });
    } else {
      db.run(
        'UPDATE orders SET user_name = ?, user_phone = ?, pickup_time = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [updatedName, updatedPhone, updatedPickup, updatedStatus, updatedNotes, orderId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({
            id: orderId,
            user_name: updatedName,
            user_phone: updatedPhone,
            pickup_time: updatedPickup,
            total_amount: order.total_amount,
            status: updatedStatus,
            notes: updatedNotes
          });
        }
      );
    }
  });
});

router.delete('/:id', (req, res) => {
  const orderId = req.params.id;

  db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    db.serialize(() => {
      db.run('DELETE FROM replacements WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)', [orderId]);
      db.run('DELETE FROM order_items WHERE order_id = ?', [orderId]);
      db.run('DELETE FROM orders WHERE id = ?', [orderId], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: '订单已删除', id: orderId });
      });
    });
  });
});

router.get('/:id/items', (req, res) => {
  const orderId = req.params.id;
  
  db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.put('/:orderId/items/:itemId', (req, res) => {
  const { orderId, itemId } = req.params;
  const { replacement_status, replacement_product_id, replacement_product_name, replacement_price, price_difference } = req.body;

  db.get('SELECT * FROM order_items WHERE id = ? AND order_id = ?', [itemId, orderId], (err, item) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!item) {
      return res.status(404).json({ error: '订单项不存在' });
    }

    const updatedReplacementStatus = replacement_status !== undefined ? replacement_status : item.replacement_status;
    const updatedReplacementProductId = replacement_product_id !== undefined ? replacement_product_id : item.replacement_product_id;
    const updatedReplacementProductName = replacement_product_name !== undefined ? replacement_product_name : item.replacement_product_name;
    const updatedReplacementPrice = replacement_price !== undefined ? replacement_price : item.replacement_price;
    const updatedPriceDifference = price_difference !== undefined ? price_difference : item.price_difference;

    db.run(
      `UPDATE order_items 
       SET replacement_status = ?, replacement_product_id = ?, replacement_product_name = ?, replacement_price = ?, price_difference = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [updatedReplacementStatus, updatedReplacementProductId, updatedReplacementProductName, updatedReplacementPrice, updatedPriceDifference, itemId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (updatedReplacementStatus === 'confirmed') {
          db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId], (err, items) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }

            let newTotal = 0;
            items.forEach(i => {
              if (i.replacement_status === 'confirmed' && i.replacement_price !== null) {
                newTotal += i.replacement_price * i.quantity;
              } else {
                newTotal += i.subtotal;
              }
            });

            db.run('UPDATE orders SET total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newTotal, orderId]);
          });
        }

        res.json({
          id: itemId,
          order_id: orderId,
          product_id: item.product_id,
          product_name: item.product_name,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.subtotal,
          replacement_status: updatedReplacementStatus,
          replacement_product_id: updatedReplacementProductId,
          replacement_product_name: updatedReplacementProductName,
          replacement_price: updatedReplacementPrice,
          price_difference: updatedPriceDifference
        });
      }
    );
  });
});

module.exports = router;
