const express = require('express');
const rollbackService = require('../services/rollbackService');

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const { artifactId, promotionRequestId, reason } = req.body;
    const actor = req.header('X-Actor') || 'api';
    
    if (!artifactId || !reason) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要字段: artifactId, reason' 
      });
    }

    const result = rollbackService.createRollback(
      artifactId, 
      promotionRequestId, 
      reason, 
      actor
    );
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.message === '制品不存在') {
      return res.status(404).json({ success: false, error: err.message });
    }
    if (err.message.includes('无法回滚')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/artifact/:artifactId', (req, res) => {
  try {
    const rollbacks = rollbackService.getRollbacksForArtifact(req.params.artifactId);
    res.json({ success: true, data: rollbacks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const rollback = rollbackService.getRollbackById(req.params.id);
    if (!rollback) {
      return res.status(404).json({ success: false, error: '回滚记录不存在' });
    }
    res.json({ success: true, data: rollback });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
