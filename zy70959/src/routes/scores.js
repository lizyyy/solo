const express = require('express');
const router = express.Router();
const scoreService = require('../services/scoreService');

router.post('/:recordId/appeal', async (req, res) => {
  try {
    const { batch_id, modified_by, appeal_score, appeal_reason } = req.body;
    
    if (!batch_id || !modified_by || !appeal_score || !appeal_reason) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const record = await scoreService.submitAppeal(
      req.params.recordId,
      batch_id,
      modified_by,
      appeal_score,
      appeal_reason
    );

    res.json({
      message: '申诉提交成功',
      record
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:recordId/review', async (req, res) => {
  try {
    const { batch_id, modified_by, review_score, review_reason, is_malicious_low_score, malicious_reason } = req.body;
    
    if (!batch_id || !modified_by || review_score === undefined || !review_reason) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    if (is_malicious_low_score && !malicious_reason) {
      return res.status(400).json({ error: '标记为恶意低分时必须提供复核理由' });
    }

    const record = await scoreService.reviewScore(
      req.params.recordId,
      batch_id,
      modified_by,
      review_score,
      review_reason,
      is_malicious_low_score || false,
      malicious_reason || ''
    );

    res.json({
      message: '复核完成',
      record
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:recordId/audit', async (req, res) => {
  try {
    const logs = await scoreService.getRecordAuditLogs(req.params.recordId);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:recordId/final-score', async (req, res) => {
  try {
    const { batch_id, modified_by, final_score, change_reason } = req.body;
    
    if (!batch_id || !modified_by || final_score === undefined || !change_reason) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const record = await scoreService.updateFinalScore(
      req.params.recordId,
      batch_id,
      modified_by,
      final_score,
      change_reason
    );

    res.json({
      message: '最终分数更新成功',
      record
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
