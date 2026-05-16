const express = require('express');
const router = express.Router();
const rotationService = require('../services/RotationService');
const signatureService = require('../services/SignatureService');

router.post('/', (req, res) => {
  try {
    const { vendorId, oldSecret, newSecret, dualKeyStartTime, dualKeyEndTime, metadata } = req.body;
    
    if (!vendorId || !oldSecret || !newSecret) {
      return res.status(400).json({
        error: '缺少必要参数: vendorId, oldSecret, newSecret'
      });
    }

    const result = rotationService.createRotation(vendorId, oldSecret, newSecret, {
      dualKeyStartTime,
      dualKeyEndTime,
      metadata
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const rotations = rotationService.getAllRotations();
    res.json({
      success: true,
      data: rotations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const rotation = rotationService.getRotation(req.params.id);
    res.json({
      success: true,
      data: rotation
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/vendor/:vendorId', (req, res) => {
  try {
    const rotation = rotationService.getRotationByVendorId(req.params.vendorId);
    res.json({
      success: true,
      data: rotation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/advance', (req, res) => {
  try {
    const { targetState } = req.body;
    if (!targetState) {
      return res.status(400).json({
        success: false,
        error: '缺少 targetState 参数'
      });
    }

    const result = rotationService.advanceRotationState(req.params.id, targetState);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/deprecate-old-key', (req, res) => {
  try {
    const result = rotationService.deprecateOldKey(req.params.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/complete', (req, res) => {
  try {
    const result = rotationService.completeRotation(req.params.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/fail', (req, res) => {
  try {
    const { reason } = req.body;
    const result = rotationService.markAsFailed(req.params.id, reason || '手动标记失败');
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/retry', (req, res) => {
  try {
    const result = rotationService.retryRotation(req.params.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/report', (req, res) => {
  try {
    const report = rotationService.generateReport(req.params.id);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/export', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const result = await rotationService.exportReport(req.params.id, format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="rotation-${req.params.id}-report.csv"`);
      
      const csvContent = [
        result.content.headers.map(h => h.title).join(','),
        ...result.content.rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))
      ].join('\n');
      
      res.send(csvContent);
    } else {
      res.json({
        success: true,
        data: result.content
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/failed-samples', (req, res) => {
  try {
    const samples = rotationService.getFailedSamples(req.params.id);
    res.json({
      success: true,
      data: samples
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/samples/:sampleId/manual-fix', (req, res) => {
  try {
    const { operator, note } = req.body;
    if (!operator || !note) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: operator, note'
      });
    }

    const result = rotationService.manuallyFixSample(req.params.sampleId, operator, note);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/samples/:sampleId', (req, res) => {
  try {
    const sample = rotationService.getSampleDetails(req.params.sampleId);
    res.json({
      success: true,
      data: sample
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { vendorId, payload, signature, idempotencyKey, signatureVersion } = req.body;
    
    if (!vendorId || !payload || !signature) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: vendorId, payload, signature'
      });
    }

    const result = await signatureService.verifyWebhook(
      vendorId,
      payload,
      signature,
      idempotencyKey,
      signatureVersion
    );

    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(401).json({
        success: false,
        error: '验签失败',
        data: result
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;