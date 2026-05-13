const express = require('express');
const router = express.Router();
const db = require('../database/db');

const statusMap = {
  compensation_pending: '待赔付',
  compensation_completed: '赔付完成'
};

const addTimeline = (linenTagId, status, operator, remarks = '', relatedId = null, relatedType = null) => {
  db.run(`
    INSERT INTO status_timeline (linen_tag_id, status, status_text, operator, remarks, related_id, related_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [linenTagId, status, statusMap[status] || status, operator, remarks, relatedId, relatedType]);
};

router.get('/rules', (req, res) => {
  db.all(`SELECT * FROM compensation_rules ORDER BY created_at DESC`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/rules/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT * FROM compensation_rules WHERE id = ?`, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

router.post('/rules', (req, res) => {
  const { rule_name, linen_type, damage_type, damage_level, compensation_amount, description } = req.body;
  db.run(`
    INSERT INTO compensation_rules (rule_name, linen_type, damage_type, damage_level, compensation_amount, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [rule_name, linen_type, damage_type, damage_level, compensation_amount, description], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, message: '赔付规则创建成功' });
  });
});

router.get('/records', (req, res) => {
  db.all(`
    SELECT cr.*, lt.tag_code, lt.linen_type, crl.rule_name, dp.photo_path
    FROM compensation_records cr
    JOIN linen_tags lt ON cr.linen_tag_id = lt.id
    JOIN compensation_rules crl ON cr.rule_id = crl.id
    LEFT JOIN damage_photos dp ON cr.damage_photo_id = dp.id
    ORDER BY cr.created_at DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/records', (req, res) => {
  const { damage_photo_id, rule_id, responsible_party, responsible_person, remarks, operator } = req.body;
  
  db.get(`SELECT * FROM damage_photos WHERE id = ?`, [damage_photo_id], (err, damage) => {
    if (err || !damage) {
      res.status(404).json({ error: '破损记录不存在' });
      return;
    }
    
    db.get(`SELECT * FROM compensation_rules WHERE id = ?`, [rule_id], (err, rule) => {
      if (err || !rule) {
        res.status(404).json({ error: '赔付规则不存在' });
        return;
      }
      
      const deduplicationKey = `damage-${damage_photo_id}-rule-${rule_id}`;
      
      db.get(`SELECT * FROM compensation_records WHERE deduplication_key = ?`, [deduplicationKey], (err, existingRecord) => {
        if (existingRecord) {
          return res.status(400).json({ 
            error: '该破损记录已创建过赔付，重复回调不重复扣减',
            existing_record: existingRecord
          });
        }
        
        db.run(`
          INSERT INTO compensation_records (linen_tag_id, damage_photo_id, rule_id, compensation_amount, responsible_party, responsible_person, deduplication_key, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [damage.linen_tag_id, damage_photo_id, rule_id, rule.compensation_amount, responsible_party, responsible_person, deduplicationKey, remarks], function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          const recordId = this.lastID;
          
          addTimeline(damage.linen_tag_id, 'compensation_pending', operator || responsible_person, `赔付规则: ${rule.rule_name}, 金额: ${rule.compensation_amount}`, recordId, 'compensation');
          
          res.json({ id: recordId, message: '赔付记录创建成功', amount: rule.compensation_amount });
        });
      });
    });
  });
});

router.post('/records/:id/deduct', (req, res) => {
  const { id } = req.params;
  const { deducted_by, remarks } = req.body;
  
  db.get(`SELECT * FROM compensation_records WHERE id = ?`, [id], (err, record) => {
    if (err || !record) {
      res.status(404).json({ error: '赔付记录不存在' });
      return;
    }
    
    if (record.deducted) {
      return res.status(400).json({ error: '该赔付已执行过扣减，不能重复扣减' });
    }
    
    db.run(`
      UPDATE compensation_records 
      SET deducted = 1, deducted_at = CURRENT_TIMESTAMP, deducted_by = ?
      WHERE id = ?
    `, [deducted_by, id], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const newStatus = 'compensation_completed';
      db.run(`
        UPDATE linen_tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [newStatus, record.linen_tag_id]);
      
      addTimeline(record.linen_tag_id, newStatus, deducted_by, '赔付扣减完成', id, 'compensation');
      
      res.json({ message: '赔付扣减完成' });
    });
  });
});

module.exports = router;