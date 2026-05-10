const express = require('express');
const router = express.Router();
const {
  createFrozenBatch,
  getBatchById,
  getBatchByCode,
  getBatchesByDonation,
  getAllBatches,
  updateBatchStatus,
  getBatchWithDetails,
  getBatchInventory,
  getBatchTraceability,
  BATCH_STATUSES,
  CONTAINER_TYPES,
  CONTAINER_VOLUME
} = require('../services/batchService');

router.get('/statuses', (req, res) => {
  res.json({
    success: true,
    data: {
      statuses: BATCH_STATUSES,
      container_types: CONTAINER_TYPES,
      container_volume: CONTAINER_VOLUME
    }
  });
});

router.get('/inventory', (req, res) => {
  try {
    const inventory = getBatchInventory();
    res.json({
      success: true,
      data: inventory
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { donationId, containerType, containerCount, freezerLocation, freezerLevel } = req.body;

    if (!donationId || !containerType || !containerCount || !freezerLocation) {
      return res.status(400).json({
        error: '缺少必要字段',
        required: ['donationId', 'containerType', 'containerCount', 'freezerLocation'],
        code: 'MISSING_FIELDS'
      });
    }

    if (containerCount <= 0) {
      return res.status(400).json({
        error: '容器数量必须大于0',
        code: 'INVALID_COUNT'
      });
    }

    const batch = createFrozenBatch(donationId, containerType, containerCount, freezerLocation, freezerLevel);
    res.status(201).json({
      success: true,
      data: batch,
      message: '冻存批次创建成功'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'CREATE_FAILED'
    });
  }
});

router.get('/', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      freezerLocation: req.query.freezerLocation,
      batchCode: req.query.batchCode
    };
    const batches = getAllBatches(filters);
    res.json({
      success: true,
      data: batches,
      count: batches.length
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.get('/code/:batchCode', (req, res) => {
  try {
    const batch = getBatchByCode(req.params.batchCode);
    if (!batch) {
      return res.status(404).json({
        error: '批次不存在',
        code: 'NOT_FOUND'
      });
    }
    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.get('/donation/:donationId', (req, res) => {
  try {
    const batches = getBatchesByDonation(req.params.donationId);
    res.json({
      success: true,
      data: batches,
      count: batches.length
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const batch = getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({
        error: '批次不存在',
        code: 'NOT_FOUND'
      });
    }
    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.get('/:id/details', (req, res) => {
  try {
    const details = getBatchWithDetails(req.params.id);
    if (!details) {
      return res.status(404).json({
        error: '批次不存在',
        code: 'NOT_FOUND'
      });
    }
    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.get('/:id/traceability', (req, res) => {
  try {
    const trace = getBatchTraceability(req.params.id);
    if (!trace) {
      return res.status(404).json({
        error: '批次不存在',
        code: 'NOT_FOUND'
      });
    }
    res.json({
      success: true,
      data: trace
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'QUERY_FAILED'
    });
  }
});

router.patch('/:id/status', (req, res) => {
  try {
    const { status, reason } = req.body;

    if (!status) {
      return res.status(400).json({
        error: '缺少 status 字段',
        code: 'MISSING_FIELDS'
      });
    }

    const result = updateBatchStatus(req.params.id, status, reason);

    if (result === null) {
      return res.status(404).json({
        error: '批次不存在',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: result,
      message: result._message || '批次状态更新成功'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'STATUS_UPDATE_FAILED'
    });
  }
});

module.exports = router;
