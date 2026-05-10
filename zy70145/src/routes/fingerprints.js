const express = require('express');
const router = express.Router();
const slowQueryService = require('../services/slowQueryService');

router.get('/', (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.owner_id) filters.owner_id = parseInt(req.query.owner_id);
    
    const fingerprints = slowQueryService.listFingerprints(filters);
    res.json({
      success: true,
      data: fingerprints
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const detail = slowQueryService.getFingerprintDetail(id);
    
    if (!detail) {
      return res.status(404).json({
        success: false,
        error: 'Fingerprint not found'
      });
    }
    
    res.json({
      success: true,
      data: detail
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

router.post('/:id/claim', (req, res) => {
  try {
    const fingerprintId = parseInt(req.params.id);
    const { owner_id, note } = req.body;
    
    if (!owner_id) {
      return res.status(400).json({
        success: false,
        error: 'owner_id is required'
      });
    }
    
    const result = slowQueryService.claimFingerprint(
      fingerprintId,
      parseInt(owner_id),
      note
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    if (e.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: e.message
      });
    }
    res.status(400).json({
      success: false,
      error: e.message
    });
  }
});

router.post('/:id/optimize', (req, res) => {
  try {
    const fingerprintId = parseInt(req.params.id);
    const { owner_id, before_sql, after_sql, description } = req.body;
    
    if (!owner_id) {
      return res.status(400).json({
        success: false,
        error: 'owner_id is required'
      });
    }
    
    const result = slowQueryService.createOptimization(
      fingerprintId,
      parseInt(owner_id),
      { before_sql, after_sql, description }
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    if (e.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: e.message
      });
    }
    res.status(400).json({
      success: false,
      error: e.message
    });
  }
});

module.exports = router;
