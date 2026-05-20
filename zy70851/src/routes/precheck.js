const express = require('express');
const { precheckSingleClaim, precheckBatch } = require('../services/precheckService');
const { get, all } = require('../db');

const router = express.Router();

router.post('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const result = await precheckBatch(batchId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/claim/:claimId', async (req, res) => {
  try {
    const { claimId } = req.params;
    const claim = await get('SELECT * FROM claim_materials WHERE id = ?', [claimId]);
    if (!claim) {
      return res.status(404).json({ error: '理赔材料不存在' });
    }

    const result = await precheckSingleClaim(claim);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batch/:batchId/results', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { category } = req.query;

    let sql = 'SELECT * FROM precheck_results WHERE batch_id = ?';
    const params = [batchId];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY created_at DESC';

    const results = await all(sql, params);

    const formattedResults = results.map(r => ({
      ...r,
      policy_responsibility: JSON.parse(r.policy_responsibility || '{}'),
      material_gaps: JSON.parse(r.material_gaps || '[]'),
      duplicate_claim: JSON.parse(r.duplicate_claim || '{}'),
      reasons: JSON.parse(r.reasons || '[]'),
      next_actions: JSON.parse(r.next_actions || '[]')
    }));

    const stats = {
      total: results.length,
      normal: results.filter(r => r.category === 'normal').length,
      supplement: results.filter(r => r.category === 'supplement').length,
      blocked: results.filter(r => r.category === 'blocked').length,
      manual_review: results.filter(r => r.needs_manual_review === 1).length
    };

    res.json({
      batch_id: batchId,
      stats,
      results: formattedResults
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories', (req, res) => {
  res.json({
    categories: {
      normal: {
        name: '正常',
        description: '材料齐全，属于保险责任，可以进入下一环节',
        color: 'green'
      },
      supplement: {
        name: '待补充',
        description: '缺少必要材料，需要客户补充',
        color: 'yellow'
      },
      blocked: {
        name: '已拦截',
        description: '不属于保险责任或重复报案，做拒赔处理',
        color: 'red'
      }
    },
    statuses: {
      pending: '待处理',
      processing: '处理中',
      completed: '已完成',
      failed: '处理失败',
      manual_confirm: '人工确认',
      exported: '已导出'
    },
    manual_review_threshold: 50000
  });
});

module.exports = router;
