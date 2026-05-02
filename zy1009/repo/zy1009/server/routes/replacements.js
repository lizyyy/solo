const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const { order_item_id, is_accepted } = req.query;
  
  let query = 'SELECT * FROM replacements WHERE 1=1';
  const params = [];
  
  if (order_item_id) {
    query += ' AND order_item_id = ?';
    params.push(order_item_id);
  }
  
  if (is_accepted !== undefined) {
    query += ' AND is_accepted = ?';
    params.push(is_accepted === 'true' || is_accepted === 1 ? 1 : 0);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/pending', (req, res) => {
  const query = `
    SELECT r.*, oi.order_id, oi.quantity, o.user_name, o.user_phone, o.pickup_time
    FROM replacements r
    JOIN order_items oi ON r.order_item_id = oi.id
    JOIN orders o ON oi.order_id = o.id
    WHERE r.is_accepted = 0
    ORDER BY r.created_at DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM replacements WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '替换记录不存在' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { order_item_id, original_product_id, original_product_name, suggested_product_id, suggested_product_name, price_difference, notes } = req.body;
  
  if (!order_item_id || !original_product_id || !original_product_name) {
    return res.status(400).json({ error: '订单项ID、原商品ID和原商品名称为必填项' });
  }

  const id = uuidv4();
  const is_accepted = 0;
  
  db.run(
    `INSERT INTO replacements 
     (id, order_item_id, original_product_id, original_product_name, suggested_product_id, suggested_product_name, price_difference, is_accepted, notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, order_item_id, original_product_id, original_product_name, suggested_product_id || null, suggested_product_name || null, price_difference || null, is_accepted, notes || ''],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.run(
        'UPDATE order_items SET replacement_status = ? WHERE id = ?',
        ['pending', order_item_id]
      );
      
      db.get('SELECT order_id FROM order_items WHERE id = ?', [order_item_id], (err, itemRow) => {
        if (itemRow) {
          db.run(
            'UPDATE orders SET status = ? WHERE id = ?',
            ['needs_replacement', itemRow.order_id]
          );
        }
      });
      
      res.json({
        id,
        order_item_id,
        original_product_id,
        original_product_name,
        suggested_product_id,
        suggested_product_name,
        price_difference,
        is_accepted,
        notes
      });
    }
  );
});

router.put('/:id/accept', (req, res) => {
  const replacementId = req.params.id;
  const { notes } = req.body;

  db.get('SELECT * FROM replacements WHERE id = ?', [replacementId], (err, replacement) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!replacement) {
      return res.status(404).json({ error: '替换记录不存在' });
    }

    db.run(
      'UPDATE replacements SET is_accepted = 1, notes = ? WHERE id = ?',
      [notes || replacement.notes, replacementId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        db.run(
          `UPDATE order_items 
           SET replacement_status = ?, replacement_product_id = ?, replacement_product_name = ?, replacement_price = ?, price_difference = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          ['confirmed', replacement.suggested_product_id, replacement.suggested_product_name, 
           replacement.price_difference !== null ? (replacement.price_difference + (replacement.original_price || 0)) : null, 
           replacement.price_difference, replacement.order_item_id]
        );

        db.get('SELECT order_id, product_name, price, quantity FROM order_items WHERE id = ?', [replacement.order_item_id], (err, item) => {
          if (item) {
            db.all('SELECT * FROM order_items WHERE order_id = ?', [item.order_id], (err, items) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }

              let newTotal = 0;
              let allConfirmed = true;
              
              items.forEach(i => {
                if (i.replacement_status === 'confirmed' && i.replacement_price !== null) {
                  newTotal += i.replacement_price * i.quantity;
                } else {
                  newTotal += i.subtotal;
                }
                
                if (i.replacement_status === 'pending') {
                  allConfirmed = false;
                }
              });

              const newStatus = allConfirmed ? 'pending' : 'needs_replacement';
              db.run(
                'UPDATE orders SET total_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newTotal, newStatus, item.order_id]
              );
            });
          }
        });

        res.json({
          message: '已接受替换',
          id: replacementId,
          is_accepted: 1
        });
      }
    );
  });
});

router.put('/:id/reject', (req, res) => {
  const replacementId = req.params.id;
  const { notes } = req.body;

  db.get('SELECT * FROM replacements WHERE id = ?', [replacementId], (err, replacement) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!replacement) {
      return res.status(404).json({ error: '替换记录不存在' });
    }

    db.run(
      'UPDATE order_items SET replacement_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['none', replacement.order_item_id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        db.run('DELETE FROM replacements WHERE id = ?', [replacementId]);

        db.get('SELECT order_id FROM order_items WHERE id = ?', [replacement.order_item_id], (err, item) => {
          if (item) {
            db.all('SELECT * FROM order_items WHERE order_id = ?', [item.order_id], (err, items) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }

              let allConfirmed = true;
              items.forEach(i => {
                if (i.replacement_status === 'pending') {
                  allConfirmed = false;
                }
              });

              const newStatus = allConfirmed ? 'pending' : 'needs_replacement';
              db.run(
                'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newStatus, item.order_id]
              );
            });
          }
        });

        res.json({
          message: '已拒绝替换，该商品将从订单中移除或保持原样',
          id: replacementId
        });
      }
    );
  });
});

module.exports = router;
