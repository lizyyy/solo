const express = require('express');
const scanService = require('../services/scanService');

const router = express.Router();

router.post('/:artifactId', (req, res) => {
  try {
    const { scanner, scanResult } = req.body;
    const actor = req.header('X-Actor') || 'api';
    
    if (!scanner || !scanResult) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要字段: scanner, scanResult' 
      });
    }

    const result = scanService.recordScan(req.params.artifactId, scanner, scanResult, actor);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:artifactId', (req, res) => {
  try {
    const scans = scanService.getScansForArtifact(req.params.artifactId);
    res.json({ success: true, data: scans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:artifactId/latest', (req, res) => {
  try {
    const scan = scanService.getLatestScanForArtifact(req.params.artifactId);
    if (!scan) {
      return res.status(404).json({ success: false, error: '未找到扫描记录' });
    }
    res.json({ success: true, data: scan });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
