const express = require('express');
const router = express.Router();
const db = require('../database/db');

const statusMap = {
  in_room: '在房间',
  pending_handover: '待楼层交接',
  floor_handover: '楼层交接中',
  sent_to_factory: '已送洗涤厂'
};

const logHandoverChange = (handoverId, fieldName, oldValue, newValue, changedBy) => {
  db.run(`
    INSERT INTO floor_handover_logs (handover_id, field_name, old_value, new_value, changed_by)
    VALUES (?, ?, ?, ?, ?)
  `, [handoverId, fieldName, oldValue, newValue, changedBy]);
};

const addTimeline = (linenTagId, status, operator, remarks = '', relatedId = null, relatedType = null) => {
  db.run(`
    INSERT INTO status_timeline (linen_tag_id, status, status_text, operator, remarks, related_id, related_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [linenTagId, status, statusMap[status] || status, operator, remarks, relatedId, relatedType]);
};

router.get('/', (req, res) => {
  db.all(`
    SELECT fh.*, lt.tag_code, lt.linen_type 
    FROM floor_handover fh
    JOIN linen_tags lt ON fh.linen_tag_id = lt.id
    ORDER BY fh.handover_time DESC
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
    SELECT * FROM floor_handover_logs 
    WHERE handover_id = ? 
    ORDER BY changed_at DESC
  `, [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { tag_code, floor, handover_type, quantity, handler, receiver, remarks, operator } = req.body;
  
  db.get(`SELECT id, status as old_status FROM linen_tags WHERE tag_code = ?`, [tag_code], (err, linen) => {
    if (err || !linen) {
      res.status(404).json({ error: '布草标签不存在' });
      return;
    }
    
    db.run(`
      INSERT INTO floor_handover (linen_tag_id, floor, handover_type, quantity, handler, receiver, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [linen.id, floor, handover_type, quantity || 1, handler, receiver, remarks], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const handoverId = this.lastID;
      const newStatus = 'floor_handover';
      
      db.run(`
        UPDATE linen_tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [newStatus, linen.id]);
      
      db.run(`
        INSERT INTO linen_tag_logs (linen_tag_id, field_name, old_value, new_value, changed_by)
        VALUES (?, 'status', ?, ?, ?)
      `, [linen.id, linen.old_status, newStatus, operator || handler]);
      
      addTimeline(linen.id, newStatus, operator || handler, `楼层交接: ${handover_type}`, handoverId, 'handover');
      
      res.json({ id: handoverId, message: '楼层交接创建成功' });
    });
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { floor, handover_type, quantity, handler, receiver, remarks, operator } = req.body;
  
  db.get(`SELECT * FROM floor_handover WHERE id = ?`, [id], (err, oldHandover) => {
    if (err || !oldHandover) {
      res.status(404).json({ error: '交接记录不存在' });
      return;
    }
    
    const updates = [];
    const params = [];
    
    if (floor !== undefined && floor !== oldHandover.floor) {
      updates.push('floor = ?');
      params.push(floor);
      logHandoverChange(id, 'floor', oldHandover.floor, floor, operator);
    }
    if (handover_type !== undefined && handover_type !== oldHandover.handover_type) {
      updates.push('handover_type = ?');
      params.push(handover_type);
      logHandoverChange(id, 'handover_type', oldHandover.handover_type, handover_type, operator);
    }
    if (quantity !== undefined && quantity !== oldHandover.quantity) {
      updates.push('quantity = ?');
      params.push(quantity);
      logHandoverChange(id, 'quantity', oldHandover.quantity, quantity, operator);
    }
    if (handler !== undefined && handler !== oldHandover.handler) {
      updates.push('handler = ?');
      params.push(handler);
      logHandoverChange(id, 'handler', oldHandover.handler, handler, operator);
    }
    if (receiver !== undefined && receiver !== oldHandover.receiver) {
      updates.push('receiver = ?');
      params.push(receiver);
      logHandoverChange(id, 'receiver', oldHandover.receiver, receiver, operator);
    }
    if (remarks !== undefined && remarks !== oldHandover.remarks) {
      updates.push('remarks = ?');
      params.push(remarks);
      logHandoverChange(id, 'remarks', oldHandover.remarks, remarks, operator);
    }
    
    if (updates.length === 0) {
      res.json({ message: '无更新内容' });
      return;
    }
    
    params.push(id);
    
    db.run(`UPDATE floor_handover SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: '更新成功' });
    });
  });
});

module.exports = router;