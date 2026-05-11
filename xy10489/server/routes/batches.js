const express = require('express');
const { readDB, writeDB, getTimestamp } = require('../database');

function createBatchRouter() {
  const router = express.Router();

  router.get('/', (req, res) => {
    const db = readDB();
    
    const batches = db.batches.map(batch => {
      const defectCount = db.defects.filter(d => d.batch_id === batch.id).length;
      const quarantinedQty = db.quarantine
        .filter(q => q.batch_id === batch.id && q.status === '隔离中')
        .reduce((sum, q) => sum + q.quantity, 0);
      
      return {
        ...batch,
        defect_count: defectCount,
        quarantined_qty: quarantinedQty
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json(batches);
  });

  router.get('/:id', (req, res) => {
    const db = readDB();
    const batchId = Number(req.params.id);
    
    const batch = db.batches.find(b => b.id === batchId);
    if (!batch) return res.status(404).json({ error: '批次不存在' });
    
    const defects = db.defects.filter(d => d.batch_id === batchId);
    const quarantine = db.quarantine.filter(q => q.batch_id === batchId);
    const rework = db.rework_records.filter(r => r.batch_id === batchId);
    const decisions = db.reinspection_decisions.filter(r => r.batch_id === batchId);
    
    const defectCount = defects.length;
    const quarantinedQty = quarantine
      .filter(q => q.status === '隔离中')
      .reduce((sum, q) => sum + q.quantity, 0);
    
    res.json({
      ...batch,
      defect_count: defectCount,
      quarantined_qty: quarantinedQty,
      defects,
      quarantine,
      rework_records: rework,
      reinspection_decisions: decisions
    });
  });

  router.post('/', (req, res) => {
    const { batch_no, product_name, model, quantity, production_line, inspector, production_date } = req.body;
    
    if (!batch_no || !product_name || !quantity) {
      return res.status(400).json({ error: '批次号、产品名称和数量为必填项' });
    }

    const db = readDB();
    const existing = db.batches.find(b => b.batch_no === batch_no);
    if (existing) {
      return res.status(400).json({ error: '批次号已存在' });
    }

    const newBatch = {
      id: Date.now(),
      batch_no,
      product_name,
      model: model || '',
      quantity: Number(quantity),
      production_line: production_line || '',
      inspector: inspector || '',
      production_date: production_date || getTimestamp().split(' ')[0],
      status: '待抽检',
      created_at: getTimestamp(),
      updated_at: getTimestamp()
    };

    db.batches.push(newBatch);
    writeDB(db);
    
    res.status(201).json({ id: newBatch.id, message: '批次创建成功' });
  });

  router.put('/:id/status', (req, res) => {
    const { status, updated_by } = req.body;
    
    const validStatuses = ['待抽检', '抽检中', '待处理', '隔离中', '返工中', '待复判', '完成', '报废'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }

    const db = readDB();
    const batchIndex = db.batches.findIndex(b => b.id === Number(req.params.id));
    
    if (batchIndex === -1) {
      return res.status(404).json({ error: '批次不存在' });
    }

    db.batches[batchIndex].status = status;
    db.batches[batchIndex].updated_at = getTimestamp();
    writeDB(db);
    
    res.json({ message: '状态更新成功' });
  });

  return router;
}

module.exports = { createBatchRouter };
