const express = require('express');
const router = express.Router();
const service = require('../services/pointRecordService');

router.get('/', (req, res) => {
  res.json({
    name: '影院会员部积分补录 API',
    version: '1.0.0',
    endpoints: {
      records: {
        list: 'GET /api/records',
        create: 'POST /api/records',
        get: 'GET /api/records/:id',
        updateStatus: 'PUT /api/records/:id/status',
        flows: 'GET /api/records/:id/flows',
        logs: 'GET /api/records/:id/logs',
        verify: 'GET /api/records/:id/verify'
      },
      status_transitions: 'GET /api/status-transitions'
    },
    statuses: service.RECORD_STATUSES
  });
});

router.get('/status-transitions', (req, res) => {
  res.json({
    statuses: {
      normal: '正常待审核',
      rejected: '已驳回',
      supplemented: '已补录',
      completed: '已完成'
    },
    transitions: service.STATUS_TRANSITIONS,
    rules: [
      'normal 状态可以转为 rejected 或 completed',
      'rejected 状态只能转为 supplemented',
      'supplemented 状态可以转为 rejected 或 completed',
      'completed 为最终状态，不可转换'
    ]
  });
});

router.get('/records', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      member_id: req.query.member_id,
      cinema_id: req.query.cinema_id
    };
    const records = await service.getAllPointRecords(filters);
    res.json({
      success: true,
      total: records.length,
      data: records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/records', async (req, res) => {
  try {
    const result = await service.createPointRecord(req.body);
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/records/:id', async (req, res) => {
  try {
    const record = await service.getPointRecord(req.params.id);
    if (record) {
      res.json({
        success: true,
        data: record
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'RECORD_NOT_FOUND',
        message: '记录不存在'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/records/:id/status', async (req, res) => {
  try {
    const { new_status, operator, note } = req.body;
    const result = await service.updateStatus(
      req.params.id,
      new_status,
      operator,
      note
    );
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/records/:id/flows', async (req, res) => {
  try {
    const flows = await service.getPointFlows(req.params.id);
    res.json({
      success: true,
      data: flows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/records/:id/logs', async (req, res) => {
  try {
    const logs = await service.getOperationLogs(req.params.id);
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/records/:id/verify', async (req, res) => {
  try {
    const result = await service.verifyPointsConsistency(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;