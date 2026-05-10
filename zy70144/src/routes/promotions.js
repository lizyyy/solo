const express = require('express');
const promotionService = require('../services/promotionService');
const gateRuleService = require('../services/gateRuleService');

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const { artifactId, targetStage } = req.body;
    const actor = req.header('X-Actor') || 'api';
    
    if (!artifactId || !targetStage) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要字段: artifactId, targetStage' 
      });
    }

    const result = promotionService.createPromotionRequest(artifactId, targetStage, actor);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.message.includes('无效的目标阶段')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err.message.includes('制品不存在')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    if (err.message.includes('已经在')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const { status, limit } = req.query;
    const requests = promotionService.listPromotionRequests(
      status, 
      limit ? parseInt(limit) : 100
    );
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const request = promotionService.getPromotionRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: '晋级请求不存在' });
    }
    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/artifact/:artifactId', (req, res) => {
  try {
    const history = promotionService.getPromotionHistory(req.params.artifactId);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/gates/check/:artifactId', (req, res) => {
  try {
    const result = gateRuleService.evaluateGate(req.params.artifactId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
