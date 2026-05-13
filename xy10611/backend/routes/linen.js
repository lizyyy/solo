const express = require('express');
const router = express.Router();
const db = require('../database/db');

const statusMap = {
  in_room: '在房间',
  pending_handover: '待楼层交接',
  floor_handover: '楼层交接中',
  sent_to_factory: '已送洗涤厂',
  in_factory: '洗涤厂处理中',
  damaged: '发现破损',
  compensation_pending: '待赔付',
  compensation_completed: '赔付完成',
  returned_from_factory: '工厂送回',
  restocked: '库存回补',
  back_to_room: '返回房间'
};

const logLinenChange = (linenTagId, fieldName, oldValue, newValue, changedBy) => {
  db.run(`
    INSERT INTO linen_tag_logs (linen_tag_id, field_name, old_value, new_value, changed_by)
    VALUES (?, ?, ?, ?, ?)
  `, [linenTagId, fieldName, oldValue, newValue, changedBy]);
};

const addTimeline = (linenTagId, status, operator, remarks = '', relatedId = null, relatedType = null) => {
  db.run(`
    INSERT INTO status_timeline (linen_tag_id, status, status_text, operator, remarks, related_id, related_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [linenTagId, status, statusMap[status] || status, operator, remarks, relatedId, relatedType]);
};

router.get('/', (req, res) => {
  db.all(`SELECT * FROM linen_tags ORDER BY updated_at DESC`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:tagCode', (req, res) => {
  const { tagCode } = req.params;
  db.get(`SELECT * FROM linen_tags WHERE tag_code = ?`, [tagCode], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '布草标签不存在' });
      return;
    }
    res.json(row);
  });
});

router.get('/:tagCode/timeline', (req, res) => {
  const { tagCode } = req.params;
  db.get(`SELECT id FROM linen_tags WHERE tag_code = ?`, [tagCode], (err, linen) => {
    if (err || !linen) {
      res.status(404).json({ error: '布草标签不存在' });
      return;
    }
    db.all(`
      SELECT * FROM status_timeline 
      WHERE linen_tag_id = ? 
      ORDER BY operation_time DESC
    `, [linen.id], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    });
  });
});

router.get('/:tagCode/logs', (req, res) => {
  const { tagCode } = req.params;
  db.get(`SELECT id FROM linen_tags WHERE tag_code = ?`, [tagCode], (err, linen) => {
    if (err || !linen) {
      res.status(404).json({ error: '布草标签不存在' });
      return;
    }
    db.all(`
      SELECT * FROM linen_tag_logs 
      WHERE linen_tag_id = ? 
      ORDER BY changed_at DESC
    `, [linen.id], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    });
  });
});

router.post('/', (req, res) => {
  const { tag_code, linen_type, size, floor, room_number } = req.body;
  db.run(`
    INSERT INTO linen_tags (tag_code, linen_type, size, floor, room_number, status)
    VALUES (?, ?, ?, ?, ?, 'in_room')
  `, [tag_code, linen_type, size, floor, room_number], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const linenId = this.lastID;
    addTimeline(linenId, 'in_room', req.body.operator || '系统', '布草标签创建');
    res.json({ id: linenId, message: '创建成功' });
  });
});

router.put('/:tagCode/status', (req, res) => {
  const { tagCode } = req.params;
  const { status, operator, remarks } = req.body;
  
  db.get(`SELECT id, status as old_status FROM linen_tags WHERE tag_code = ?`, [tagCode], (err, linen) => {
    if (err || !linen) {
      res.status(404).json({ error: '布草标签不存在' });
      return;
    }
    
    db.run(`
      UPDATE linen_tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE tag_code = ?
    `, [status, tagCode], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      logLinenChange(linen.id, 'status', linen.old_status, status, operator);
      addTimeline(linen.id, status, operator, remarks);
      
      res.json({ message: '状态更新成功' });
    });
  });
});

router.put('/:tagCode', (req, res) => {
  const { tagCode } = req.params;
  const { linen_type, size, floor, room_number, operator } = req.body;
  
  db.get(`SELECT * FROM linen_tags WHERE tag_code = ?`, [tagCode], (err, oldLinen) => {
    if (err || !oldLinen) {
      res.status(404).json({ error: '布草标签不存在' });
      return;
    }
    
    const updates = [];
    const params = [];
    
    if (linen_type !== undefined && linen_type !== oldLinen.linen_type) {
      updates.push('linen_type = ?');
      params.push(linen_type);
      logLinenChange(oldLinen.id, 'linen_type', oldLinen.linen_type, linen_type, operator);
    }
    if (size !== undefined && size !== oldLinen.size) {
      updates.push('size = ?');
      params.push(size);
      logLinenChange(oldLinen.id, 'size', oldLinen.size, size, operator);
    }
    if (floor !== undefined && floor !== oldLinen.floor) {
      updates.push('floor = ?');
      params.push(floor);
      logLinenChange(oldLinen.id, 'floor', oldLinen.floor, floor, operator);
    }
    if (room_number !== undefined && room_number !== oldLinen.room_number) {
      updates.push('room_number = ?');
      params.push(room_number);
      logLinenChange(oldLinen.id, 'room_number', oldLinen.room_number, room_number, operator);
    }
    
    if (updates.length === 0) {
      res.json({ message: '无更新内容' });
      return;
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(tagCode);
    
    db.run(`UPDATE linen_tags SET ${updates.join(', ')} WHERE tag_code = ?`, params, (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: '更新成功' });
    });
  });
});

module.exports = router;