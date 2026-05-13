const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../database/db');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'damage-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

const statusMap = {
  in_factory: '洗涤厂处理中',
  damaged: '发现破损',
  compensation_pending: '待赔付'
};

const addTimeline = (linenTagId, status, operator, remarks = '', relatedId = null, relatedType = null) => {
  db.run(`
    INSERT INTO status_timeline (linen_tag_id, status, status_text, operator, remarks, related_id, related_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [linenTagId, status, statusMap[status] || status, operator, remarks, relatedId, relatedType]);
};

router.get('/', (req, res) => {
  db.all(`
    SELECT dp.*, lt.tag_code, lt.linen_type 
    FROM damage_photos dp
    JOIN linen_tags lt ON dp.linen_tag_id = lt.id
    ORDER BY dp.reported_at DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get(`
    SELECT dp.*, lt.tag_code, lt.linen_type 
    FROM damage_photos dp
    JOIN linen_tags lt ON dp.linen_tag_id = lt.id
    WHERE dp.id = ?
  `, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

router.post('/', upload.single('photo'), (req, res) => {
  const { tag_code, damage_type, damage_level, description, reported_by, factory_transaction_id } = req.body;
  
  if (!req.file) {
    res.status(400).json({ error: '请上传破损照片' });
    return;
  }
  
  db.get(`SELECT id, status as old_status FROM linen_tags WHERE tag_code = ?`, [tag_code], (err, linen) => {
    if (err || !linen) {
      res.status(404).json({ error: '布草标签不存在' });
      return;
    }
    
    db.run(`
      INSERT INTO damage_photos (linen_tag_id, factory_transaction_id, photo_path, damage_type, damage_level, description, reported_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [linen.id, factory_transaction_id, req.file.filename, damage_type, damage_level, description, reported_by], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const damageId = this.lastID;
      const newStatus = 'damaged';
      
      db.run(`
        UPDATE linen_tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [newStatus, linen.id]);
      
      db.run(`
        INSERT INTO linen_tag_logs (linen_tag_id, field_name, old_value, new_value, changed_by)
        VALUES (?, 'status', ?, ?, ?)
      `, [linen.id, linen.old_status, newStatus, reported_by]);
      
      addTimeline(linen.id, newStatus, reported_by, `发现破损: ${damage_type} - ${damage_level}`, damageId, 'damage');
      
      res.json({ id: damageId, message: '破损记录创建成功', photo_path: req.file.filename });
    });
  });
});

router.post('/:id/review', (req, res) => {
  const { id } = req.params;
  const { reviewed_by, review_result, remarks } = req.body;
  
  db.get(`SELECT * FROM damage_photos WHERE id = ?`, [id], (err, damage) => {
    if (err || !damage) {
      res.status(404).json({ error: '破损记录不存在' });
      return;
    }
    
    db.run(`
      UPDATE damage_photos 
      SET is_reviewed = 1, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_result = ?
      WHERE id = ?
    `, [reviewed_by, review_result, id], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (review_result === 'compensation') {
        const newStatus = 'compensation_pending';
        db.run(`
          UPDATE linen_tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [newStatus, damage.linen_tag_id]);
        
        addTimeline(damage.linen_tag_id, newStatus, reviewed_by, '审核通过，进入赔付流程', id, 'damage');
      } else if (review_result === 'no_compensation') {
        const newStatus = 'in_factory';
        db.run(`
          UPDATE linen_tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [newStatus, damage.linen_tag_id]);
        
        addTimeline(damage.linen_tag_id, newStatus, reviewed_by, '审核通过，无需赔付，继续处理', id, 'damage');
      }
      
      res.json({ message: '审核完成' });
    });
  });
});

module.exports = router;