const express = require('express');
const router = express.Router();
const db = require('../database/db');

const statusMap = {
  returned_from_factory: '工厂送回',
  restocked: '库存回补',
  back_to_room: '返回房间'
};

const addTimeline = (linenTagId, status, operator, remarks = '', relatedId = null, relatedType = null) => {
  db.run(`
    INSERT INTO status_timeline (linen_tag_id, status, status_text, operator, remarks, related_id, related_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [linenTagId, status, statusMap[status] || status, operator, remarks, relatedId, relatedType]);
};

router.get('/', (req, res) => {
  db.all(`
    SELECT ir.*, lt.tag_code, lt.linen_type 
    FROM inventory_restock ir
    JOIN linen_tags lt ON ir.linen_tag_id = lt.id
    ORDER BY ir.restock_time DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/restock', (req, res) => {
  const { tag_code, restock_type, quantity, source, handler, remarks } = req.body;
  
  db.get(`SELECT id, status as old_status FROM linen_tags WHERE tag_code = ?`, [tag_code], (err, linen) => {
    if (err || !linen) {
      res.status(404).json({ error: '布草标签不存在' });
      return;
    }
    
    db.run(`
      INSERT INTO inventory_restock (linen_tag_id, restock_type, quantity, source, handler, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [linen.id, restock_type, quantity || 1, source, handler, remarks], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const restockId = this.lastID;
      const newStatus = 'restocked';
      
      db.run(`
        UPDATE linen_tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [newStatus, linen.id]);
      
      db.run(`
        INSERT INTO linen_tag_logs (linen_tag_id, field_name, old_value, new_value, changed_by)
        VALUES (?, 'status', ?, ?, ?)
      `, [linen.id, linen.old_status, newStatus, handler]);
      
      addTimeline(linen.id, newStatus, handler, `库存回补: ${restock_type}`, restockId, 'inventory');
      
      res.json({ id: restockId, message: '库存回补成功' });
    });
  });
});

router.post('/back-to-room', (req, res) => {
  const { tag_code, floor, room_number, handler, remarks } = req.body;
  
  db.get(`SELECT id, status as old_status FROM linen_tags WHERE tag_code = ?`, [tag_code], (err, linen) => {
    if (err || !linen) {
      res.status(404).json({ error: '布草标签不存在' });
      return;
    }
    
    const newStatus = 'back_to_room';
    
    db.run(`
      UPDATE linen_tags SET status = ?, floor = ?, room_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [newStatus, floor, room_number, linen.id], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      db.run(`
        INSERT INTO linen_tag_logs (linen_tag_id, field_name, old_value, new_value, changed_by)
        VALUES (?, 'status', ?, ?, ?)
      `, [linen.id, linen.old_status, newStatus, handler]);
      
      addTimeline(linen.id, newStatus, handler, `返回房间: ${floor} ${room_number}`, null, 'inventory');
      
      res.json({ message: '返回房间成功' });
    });
  });
});

module.exports = router;