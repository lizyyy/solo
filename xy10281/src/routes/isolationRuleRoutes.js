const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const IsolationRuleDao = require('../daos/isolationRuleDao');
const IdempotencyDao = require('../daos/idempotencyDao');

router.post('/', async (req, res) => {
  try {
    const requestId = req.headers['x-request-id'];
    
    if (requestId) {
      const existing = await IdempotencyDao.get(requestId);
      if (existing) {
        return res.status(200).json({
          ...JSON.parse(existing.response_data),
          _from_cache: true
        });
      }
    }

    const {
      diseaseName,
      affectedSpecies,
      requiredTankType,
      minPh,
      maxPh,
      minTemperature,
      maxTemperature,
      maxSalinity,
      minQualityScore,
      quarantineDays,
      priority,
      isActive
    } = req.body;
    
    if (!diseaseName || !requiredTankType) {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        required: ['diseaseName', 'requiredTankType'] 
      });
    }

    if (!['quarantine', 'hospital'].includes(requiredTankType)) {
      return res.status(400).json({ error: 'requiredTankType 必须是 quarantine 或 hospital' });
    }

    const id = uuidv4();
    const result = await IsolationRuleDao.create({
      id,
      diseaseName,
      affectedSpecies,
      requiredTankType,
      minPh,
      maxPh,
      minTemperature,
      maxTemperature,
      maxSalinity,
      minQualityScore,
      quarantineDays: quarantineDays || 14,
      priority: priority || 1,
      isActive: isActive !== false
    });
    
    const response = {
      success: true,
      data: result,
      message: '隔离规则创建成功'
    };

    if (requestId) {
      await IdempotencyDao.create(requestId, 'POST /api/isolation-rules', response);
    }

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const rules = await IsolationRuleDao.all(includeInactive !== 'true');
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rule = await IsolationRuleDao.getById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: '隔离规则不存在' });
    }
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/disease/:diseaseName', async (req, res) => {
  try {
    const rule = await IsolationRuleDao.getByDisease(req.params.diseaseName);
    if (!rule) {
      return res.status(404).json({ error: '未找到该疾病的隔离规则' });
    }
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
