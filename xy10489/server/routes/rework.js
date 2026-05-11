const express = require('express');
const { readDB, writeDB, getTimestamp } = require('../database');

function createReworkRouter() {
  const router = express.Router();

  router.get('/batch/:batchId', (req, res) => {
    const db = readDB();
    const batchId = Number(req.params.batchId);
    
    const records = db.rework_records
      .filter(r => r.batch_id === batchId)
      .map(r => {
        const batch = db.batches.find(b => b.id === r.batch_id);
        const defect = db.defects.find(d => d.id === r.defect_id);
        return {
          ...r,
          batch_no: batch?.batch_no || '',
          product_name: batch?.product_name || '',
          defect_type: defect?.defect_type || ''
        };
      })
      .sort((a, b) => new Date(b.rework_start) - new Date(a.rework_start));
    
    res.json(records);
  });

  router.post('/', (req, res) => {
    const { batch_id, defect_id, quantity, rework_method, reworked_by } = req.body;

    if (!batch_id || !quantity || !rework_method || !reworked_by) {
      return res.status(400).json({ error: '批次ID、数量、返工方法和返工人为必填项' });
    }

    const db = readDB();
    const batch = db.batches.find(b => b.id === Number(batch_id));
    
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const totalDefectQty = db.defects
      .filter(d => d.batch_id === Number(batch_id))
      .reduce((sum, d) => sum + d.quantity, 0);

    const totalReworked = db.rework_records
      .filter(r => r.batch_id === Number(batch_id) && r.status !== '已取消')
      .reduce((sum, r) => sum + r.quantity, 0);

    if (totalReworked + Number(quantity) > totalDefectQty) {
      return res.status(400).json({ 
        error: '返工数量超过缺陷数量',
        details: `缺陷总数: ${totalDefectQty}, 已返工: ${totalReworked}, 本次申请: ${quantity}`
      });
    }

    const newRework = {
      id: Date.now(),
      batch_id: Number(batch_id),
      defect_id: defect_id ? Number(defect_id) : null,
      quantity: Number(quantity),
      rework_method,
      reworked_by,
      rework_start: getTimestamp(),
      rework_end: null,
      recheck_result: null,
      rechecked_by: null,
      rechecked_at: null,
      status: '返工中'
    };

    db.rework_records.push(newRework);
    
    const batchIndex = db.batches.findIndex(b => b.id === Number(batch_id));
    if (batchIndex !== -1) {
      db.batches[batchIndex].status = '返工中';
      db.batches[batchIndex].updated_at = getTimestamp();
    }
    
    writeDB(db);

    res.status(201).json({ 
      id: newRework.id, 
      message: '返工记录创建成功'
    });
  });

  router.post('/:id/recheck', (req, res) => {
    const { recheck_result, rechecked_by } = req.body;

    if (!recheck_result || !rechecked_by) {
      return res.status(400).json({ error: '复检结果和复检人为必填项' });
    }

    const db = readDB();
    const reworkIndex = db.rework_records.findIndex(r => r.id === Number(req.params.id));
    
    if (reworkIndex === -1) {
      return res.status(404).json({ error: '返工记录不存在' });
    }

    if (db.rework_records[reworkIndex].status !== '返工中') {
      return res.status(400).json({ error: '只有返工中的记录可以复检' });
    }

    const validResults = ['合格', '不合格', '部分合格'];
    if (!validResults.includes(recheck_result)) {
      return res.status(400).json({ error: '复检结果必须是: 合格、不合格、部分合格' });
    }

    db.rework_records[reworkIndex].recheck_result = recheck_result;
    db.rework_records[reworkIndex].rechecked_by = rechecked_by;
    db.rework_records[reworkIndex].rechecked_at = getTimestamp();
    db.rework_records[reworkIndex].rework_end = getTimestamp();
    db.rework_records[reworkIndex].status = '已复检';

    if (recheck_result === '不合格') {
      const batchId = db.rework_records[reworkIndex].batch_id;
      const batchIndex = db.batches.findIndex(b => b.id === batchId);
      if (batchIndex !== -1) {
        db.batches[batchIndex].status = '待复判';
        db.batches[batchIndex].updated_at = getTimestamp();
      }
    }

    writeDB(db);
    res.json({ message: '复检完成' });
  });

  router.post('/decision', (req, res) => {
    const { batch_id, decision, quantity, reason, approval_basis, approved_by } = req.body;

    if (!batch_id || !decision || !quantity || !approved_by) {
      return res.status(400).json({ error: '批次ID、复判决定、数量和批准人为必填项' });
    }

    const validDecisions = ['入库', '返工', '让步放行', '报废', '退回供应商'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ error: '复判决定必须是: 入库、返工、让步放行、报废、退回供应商' });
    }

    const db = readDB();
    const batch = db.batches.find(b => b.id === Number(batch_id));
    
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const activeQuarantine = db.quarantine
      .filter(q => q.batch_id === Number(batch_id) && q.status === '隔离中')
      .reduce((sum, q) => sum + q.quantity, 0);

    if (activeQuarantine > 0 && (decision === '入库' || decision === '让步放行')) {
      return res.status(400).json({ 
        error: '未隔离就放行',
        details: `该批次尚有 ${activeQuarantine} 件产品处于隔离状态，请先处理隔离库存`
      });
    }

    if (decision === '入库') {
      const pendingRework = db.rework_records.filter(r => 
        r.batch_id === Number(batch_id) && r.status === '返工中'
      ).length;

      if (pendingRework > 0) {
        return res.status(400).json({ 
          error: '返工后未复检就入库',
          details: '存在未完成复检的返工记录'
        });
      }
    }

    if (decision === '让步放行' && !approval_basis) {
      return res.status(400).json({ 
        error: '让步放行缺少批准依据',
        details: '让步放行批次必须提供批准依据，如客户确认函、标准豁免条款等'
      });
    }

    if (Number(quantity) > batch.quantity) {
      return res.status(400).json({ 
        error: '复判数量超过批次',
        details: `批次总数量: ${batch.quantity}, 申请数量: ${quantity}`
      });
    }

    const newDecision = {
      id: Date.now(),
      batch_id: Number(batch_id),
      decision,
      quantity: Number(quantity),
      reason: reason || '',
      approval_basis: approval_basis || '',
      approved_by,
      decided_at: getTimestamp(),
      status: '已执行'
    };

    db.reinspection_decisions.push(newDecision);

    let newStatus = '待处理';
    if (decision === '入库') newStatus = '完成';
    else if (decision === '返工') newStatus = '返工中';
    else if (decision === '报废') newStatus = '报废';
    
    const batchIndex = db.batches.findIndex(b => b.id === Number(batch_id));
    if (batchIndex !== -1) {
      db.batches[batchIndex].status = newStatus;
      db.batches[batchIndex].updated_at = getTimestamp();
    }

    writeDB(db);

    res.status(201).json({ 
      id: newDecision.id, 
      message: '复判决定已记录'
    });
  });

  router.get('/history', (req, res) => {
    const { batchId, limit = 50 } = req.query;
    const db = readDB();
    
    let decisions = db.reinspection_decisions.map(d => ({
      record_type: 'decision',
      id: d.id,
      batch_id: d.batch_id,
      action: d.decision,
      quantity: d.quantity,
      description: d.reason,
      approval_basis: d.approval_basis,
      operator: d.approved_by,
      created_at: d.decided_at,
      status: d.status
    }));

    let reworks = db.rework_records.map(r => ({
      record_type: 'rework',
      id: r.id,
      batch_id: r.batch_id,
      action: r.rework_method,
      quantity: r.quantity,
      description: r.recheck_result,
      approval_basis: null,
      operator: r.reworked_by,
      created_at: r.rework_start,
      status: r.status
    }));

    if (batchId) {
      decisions = decisions.filter(d => d.batch_id === Number(batchId));
      reworks = reworks.filter(r => r.batch_id === Number(batchId));
    }

    const history = [...decisions, ...reworks]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, Number(limit));

    res.json(history);
  });

  return router;
}

module.exports = { createReworkRouter };
