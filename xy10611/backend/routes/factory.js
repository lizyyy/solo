const express = require('express');
const router = express.Router();
const db = require('../database/db');

const statusMap = {
  floor_handover: '楼层交接中',
  sent_to_factory: '已送洗涤厂',
  in_factory: '洗涤厂处理中',
  damaged: '发现破损',
  returned_from_factory: '工厂送回'
};

const logFactoryChange = (transactionId, fieldName, oldValue, newValue, changedBy) => {
  db.run(`
    INSERT INTO factory_transaction_logs (transaction_id, field_name, old_value, new_value, changed_by)
    VALUES (?, ?, ?, ?, ?)
  `, [transactionId, fieldName, oldValue, newValue, changedBy]);
};

const addTimeline = (linenTagId, status, operator, remarks = '', relatedId = null, relatedType = null) => {
  db.run(`
    INSERT INTO status_timeline (linen_tag_id, status, status_text, operator, remarks, related_id, related_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [linenTagId, status, statusMap[status] || status, operator, remarks, relatedId, relatedType]);
};

router.get('/', (req, res) => {
  db.all(`
    SELECT ft.*, lt.tag_code, lt.linen_type 
    FROM factory_transactions ft
    JOIN linen_tags lt ON ft.linen_tag_id = lt.id
    ORDER BY ft.transaction_time DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id/logs', (req, res) => {
  const { id } = req.params;
  db.all(`
    SELECT * FROM factory_transaction_logs 
    WHERE transaction_id = ? 
    ORDER BY changed_at DESC
  `, [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/send', (req, res) => {
  const { tag_code, factory_name, quantity, sender, receiver, vehicle_number, remarks, operator } = req.body;
  
  db.get(`SELECT id, status as old_status FROM linen_tags WHERE tag_code = ?`, [tag_code], (err, linen) => {
    if (err || !linen) {
      res.status(404).json({ error: '布草标签不存在' });
      return;
    }
    
    db.run(`
      INSERT INTO factory_transactions (transaction_type, linen_tag_id, factory_name, quantity, sender, receiver, vehicle_number, remarks)
      VALUES ('send', ?, ?, ?, ?, ?, ?, ?)
    `, [linen.id, factory_name, quantity || 1, sender, receiver, vehicle_number, remarks], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const transactionId = this.lastID;
      const newStatus = 'sent_to_factory';
      
      db.run(`
        UPDATE linen_tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [newStatus, linen.id]);
      
      db.run(`
        INSERT INTO linen_tag_logs (linen_tag_id, field_name, old_value, new_value, changed_by)
        VALUES (?, 'status', ?, ?, ?)
      `, [linen.id, linen.old_status, newStatus, operator || sender]);
      
      addTimeline(linen.id, newStatus, operator || sender, `送往洗涤厂: ${factory_name}`, transactionId, 'factory');
      
      res.json({ id: transactionId, message: '送厂记录创建成功' });
    });
  });
});

router.post('/receive', (req, res) => {
  const { tag_code, factory_name, quantity, sender, receiver, vehicle_number, remarks, operator } = req.body;
  
  db.get(`SELECT id, status as old_status FROM linen_tags WHERE tag_code = ?`, [tag_code], (err, linen) => {
    if (err || !linen) {
      res.status(404).json({ error: '布草标签不存在' });
      return;
    }
    
    db.run(`
      INSERT INTO factory_transactions (transaction_type, linen_tag_id, factory_name, quantity, sender, receiver, vehicle_number, remarks)
      VALUES ('receive', ?, ?, ?, ?, ?, ?, ?)
    `, [linen.id, factory_name, quantity || 1, sender, receiver, vehicle_number, remarks], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const transactionId = this.lastID;
      const newStatus = 'returned_from_factory';
      
      db.run(`
        UPDATE linen_tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [newStatus, linen.id]);
      
      db.run(`
        INSERT INTO linen_tag_logs (linen_tag_id, field_name, old_value, new_value, changed_by)
        VALUES (?, 'status', ?, ?, ?)
      `, [linen.id, linen.old_status, newStatus, operator || receiver]);
      
      addTimeline(linen.id, newStatus, operator || receiver, `工厂送回: ${factory_name}`, transactionId, 'factory');
      
      res.json({ id: transactionId, message: '接收记录创建成功' });
    });
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { factory_name, quantity, sender, receiver, vehicle_number, remarks, operator } = req.body;
  
  db.get(`SELECT * FROM factory_transactions WHERE id = ?`, [id], (err, oldTransaction) => {
    if (err || !oldTransaction) {
      res.status(404).json({ error: '交易记录不存在' });
      return;
    }
    
    const updates = [];
    const params = [];
    
    if (factory_name !== undefined && factory_name !== oldTransaction.factory_name) {
      updates.push('factory_name = ?');
      params.push(factory_name);
      logFactoryChange(id, 'factory_name', oldTransaction.factory_name, factory_name, operator);
    }
    if (quantity !== undefined && quantity !== oldTransaction.quantity) {
      updates.push('quantity = ?');
      params.push(quantity);
      logFactoryChange(id, 'quantity', oldTransaction.quantity, quantity, operator);
    }
    if (sender !== undefined && sender !== oldTransaction.sender) {
      updates.push('sender = ?');
      params.push(sender);
      logFactoryChange(id, 'sender', oldTransaction.sender, sender, operator);
    }
    if (receiver !== undefined && receiver !== oldTransaction.receiver) {
      updates.push('receiver = ?');
      params.push(receiver);
      logFactoryChange(id, 'receiver', oldTransaction.receiver, receiver, operator);
    }
    if (vehicle_number !== undefined && vehicle_number !== oldTransaction.vehicle_number) {
      updates.push('vehicle_number = ?');
      params.push(vehicle_number);
      logFactoryChange(id, 'vehicle_number', oldTransaction.vehicle_number, vehicle_number, operator);
    }
    if (remarks !== undefined && remarks !== oldTransaction.remarks) {
      updates.push('remarks = ?');
      params.push(remarks);
      logFactoryChange(id, 'remarks', oldTransaction.remarks, remarks, operator);
    }
    
    if (updates.length === 0) {
      res.json({ message: '无更新内容' });
      return;
    }
    
    params.push(id);
    
    db.run(`UPDATE factory_transactions SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: '更新成功' });
    });
  });
});

module.exports = router;