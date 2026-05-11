const express = require('express');
const { readDB, writeDB, getTimestamp } = require('../database');

function createDefectRouter() {
  const router = express.Router();

  router.get('/batch/:batchId', (req, res) => {
    const db = readDB();
    const batchId = Number(req.params.batchId);
    
    const defects = db.defects
      .filter(d => d.batch_id === batchId)
      .map(d => {
        const batch = db.batches.find(b => b.id === d.batch_id);
        return {
          ...d,
          batch_no: batch?.batch_no || '',
          product_name: batch?.product_name || ''
        };
      })
      .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at));
    
    res.json(defects);
  });

  router.post('/', (req, res) => {
    const { batch_id, defect_type, severity, quantity, description, detected_by } = req.body;

    if (!batch_id || !defect_type || !severity || !quantity || !detected_by) {
      return res.status(400).json({ error: '批次ID、缺陷类型、严重程度、数量和检测人为必填项' });
    }

    const validSeverity = ['轻微', '一般', '严重', '致命'];
    if (!validSeverity.includes(severity)) {
      return res.status(400).json({ error: '严重程度必须是: 轻微、一般、严重、致命' });
    }

    const db = readDB();
    const batch = db.batches.find(b => b.id === Number(batch_id));
    
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const existing = db.defects.find(d => 
      d.batch_id === Number(batch_id) && 
      d.defect_type === defect_type && 
      d.severity === severity && 
      d.detected_by === detected_by
    );

    if (existing) {
      return res.status(400).json({ 
        error: '同一缺陷重复登记',
        details: `批次${batch.batch_no}已存在${severity}级${defect_type}缺陷记录`
      });
    }

    const totalDefectQty = db.defects
      .filter(d => d.batch_id === Number(batch_id))
      .reduce((sum, d) => sum + d.quantity, 0);

    if (totalDefectQty + Number(quantity) > batch.quantity) {
      return res.status(400).json({ 
        error: '复判数量超过批次',
        details: `批次总数量: ${batch.quantity}, 已登记缺陷数量: ${totalDefectQty}, 本次登记: ${quantity}`
      });
    }

    const newDefect = {
      id: Date.now(),
      batch_id: Number(batch_id),
      defect_type,
      severity,
      quantity: Number(quantity),
      description: description || '',
      detected_by,
      detected_at: getTimestamp()
    };

    db.defects.push(newDefect);
    
    const batchIndex = db.batches.findIndex(b => b.id === Number(batch_id));
    if (batchIndex !== -1) {
      db.batches[batchIndex].status = '待处理';
      db.batches[batchIndex].updated_at = getTimestamp();
    }
    
    writeDB(db);

    res.status(201).json({ 
      id: newDefect.id, 
      message: '缺陷登记成功'
    });
  });

  router.post('/quarantine', (req, res) => {
    const { batch_id, quantity, reason, quarantined_by } = req.body;

    if (!batch_id || !quantity || !quarantined_by) {
      return res.status(400).json({ error: '批次ID、数量和隔离人为必填项' });
    }

    const db = readDB();
    const batch = db.batches.find(b => b.id === Number(batch_id));
    
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const totalQuarantined = db.quarantine
      .filter(q => q.batch_id === Number(batch_id) && q.status === '隔离中')
      .reduce((sum, q) => sum + q.quantity, 0);

    if (totalQuarantined + Number(quantity) > batch.quantity) {
      return res.status(400).json({ 
        error: '隔离数量超过批次总数',
        details: `批次总数量: ${batch.quantity}, 已隔离: ${totalQuarantined}`
      });
    }

    const newQuarantine = {
      id: Date.now(),
      batch_id: Number(batch_id),
      quantity: Number(quantity),
      reason: reason || '',
      quarantined_by,
      status: '隔离中',
      created_at: getTimestamp(),
      released_at: null,
      released_by: null,
      release_confirmation: null
    };

    db.quarantine.push(newQuarantine);
    
    const batchIndex = db.batches.findIndex(b => b.id === Number(batch_id));
    if (batchIndex !== -1) {
      db.batches[batchIndex].status = '隔离中';
      db.batches[batchIndex].updated_at = getTimestamp();
    }
    
    writeDB(db);

    res.status(201).json({ 
      id: newQuarantine.id, 
      message: '隔离登记成功'
    });
  });

  router.post('/release-quarantine', (req, res) => {
    const { quarantine_id, released_by, confirm_code } = req.body;

    if (!quarantine_id || !released_by) {
      return res.status(400).json({ error: '隔离记录ID和释放人为必填项' });
    }

    const db = readDB();
    const quarantineIndex = db.quarantine.findIndex(q => 
      q.id === Number(quarantine_id) && q.status === '隔离中'
    );

    if (quarantineIndex === -1) {
      return res.status(404).json({ error: '隔离记录不存在或已释放' });
    }

    if (!confirm_code) {
      return res.status(400).json({ 
        error: '隔离库存释放前需要二次确认',
        needs_confirmation: true
      });
    }

    db.quarantine[quarantineIndex].status = '已释放';
    db.quarantine[quarantineIndex].released_at = getTimestamp();
    db.quarantine[quarantineIndex].released_by = released_by;
    db.quarantine[quarantineIndex].release_confirmation = confirm_code;

    const batchId = db.quarantine[quarantineIndex].batch_id;
    const activeQuarantine = db.quarantine.filter(q => 
      q.batch_id === batchId && q.status === '隔离中'
    ).length;

    if (activeQuarantine === 0) {
      const batchIndex = db.batches.findIndex(b => b.id === batchId);
      if (batchIndex !== -1) {
        db.batches[batchIndex].status = '待复判';
        db.batches[batchIndex].updated_at = getTimestamp();
      }
    }

    writeDB(db);
    res.json({ message: '隔离释放成功' });
  });

  router.get('/statistics', (req, res) => {
    const db = readDB();
    
    const statsMap = new Map();
    db.defects.forEach(d => {
      const key = `${d.defect_type}|${d.severity}`;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          defect_type: d.defect_type,
          severity: d.severity,
          defect_count: 0,
          total_quantity: 0
        });
      }
      const stat = statsMap.get(key);
      stat.defect_count++;
      stat.total_quantity += d.quantity;
    });

    const stats = Array.from(statsMap.values())
      .sort((a, b) => b.total_quantity - a.total_quantity);
    
    res.json(stats);
  });

  return router;
}

module.exports = { createDefectRouter };
