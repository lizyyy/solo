const express = require('express');
const router = express.Router();
const IsolationService = require('../services/isolationService');
const QuarantineSessionDao = require('../daos/quarantineSessionDao');
const TreatmentRecordDao = require('../daos/treatmentRecordDao');
const TransferTransactionDao = require('../daos/transferTransactionDao');
const RiskReportDao = require('../daos/riskReportDao');
const IdempotencyDao = require('../daos/idempotencyDao');

router.post('/request', async (req, res) => {
  try {
    const requestId = req.headers['x-request-id'];
    
    if (requestId) {
      const existing = await IdempotencyDao.get(requestId);
      if (existing) {
        return res.status(200).json({
          ...JSON.parse(existing.response_data),
          _from_cache: true,
          idempotency_note: '重复请求，返回缓存结果'
        });
      }
    }

    const { fishGroupId, disease, affectedCount, operator } = req.body;
    
    if (!fishGroupId || !disease) {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        required: ['fishGroupId', 'disease'] 
      });
    }

    const result = await IsolationService.createIsolationRequest({
      fishGroupId,
      disease,
      affectedCount: affectedCount || 0,
      operator
    });
    
    if (requestId) {
      await IdempotencyDao.create(requestId, 'POST /api/isolation/request', result);
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ 
      success: false, 
      error: err.message,
      error_type: 'BUSINESS_LOGIC_ERROR'
    });
  }
});

router.post('/:sessionId/advance', async (req, res) => {
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

    const { operator } = req.body;
    const result = await IsolationService.advanceIsolation(req.params.sessionId, operator);
    
    if (requestId) {
      await IdempotencyDao.create(requestId, 'POST /api/isolation/:sessionId/advance', result);
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:sessionId/withdraw', async (req, res) => {
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

    const { reason, operator } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: '撤回原因是必要参数' });
    }

    const result = await IsolationService.withdrawIsolation(req.params.sessionId, reason, operator);
    
    if (requestId) {
      await IdempotencyDao.create(requestId, 'POST /api/isolation/:sessionId/withdraw', result);
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:sessionId/complete', async (req, res) => {
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

    const { operator } = req.body;
    const result = await IsolationService.completeIsolation(req.params.sessionId, operator);
    
    if (requestId) {
      await IdempotencyDao.create(requestId, 'POST /api/isolation/:sessionId/complete', result);
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/sessions', async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const sessions = await QuarantineSessionDao.all(activeOnly === 'true');
    res.json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await QuarantineSessionDao.getById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: '隔离会话不存在' });
    }
    
    const treatments = await TreatmentRecordDao.getByFishGroupId(session.fish_group_id);
    const transfers = await TransferTransactionDao.getByFishGroupId(session.fish_group_id);
    const reports = await RiskReportDao.getByFishGroupId(session.fish_group_id, true);
    
    res.json({ 
      success: true, 
      data: {
        session,
        treatments,
        transfers,
        riskReports: reports
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
