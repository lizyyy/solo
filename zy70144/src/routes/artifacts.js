const express = require('express');
const artifactService = require('../services/artifactService');
const reportService = require('../services/reportService');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { stage, limit } = req.query;
    const artifacts = artifactService.listArtifacts(stage, limit ? parseInt(limit) : 100);
    res.json({ success: true, data: artifacts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, version, repository, metadata } = req.body;
    const actor = req.header('X-Actor') || 'api';
    
    if (!name || !version || !repository) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要字段: name, version, repository' 
      });
    }

    const artifact = artifactService.createArtifact(name, version, repository, metadata || {}, actor);
    res.status(201).json({ success: true, data: artifact });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, error: '制品已存在' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const artifact = artifactService.getArtifactById(req.params.id);
    if (!artifact) {
      return res.status(404).json({ success: false, error: '制品不存在' });
    }
    res.json({ success: true, data: artifact });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/report', (req, res) => {
  try {
    const report = reportService.getArtifactFullReport(req.params.id);
    res.json({ success: true, data: report });
  } catch (err) {
    if (err.message === '制品不存在') {
      return res.status(404).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/metadata', (req, res) => {
  try {
    const { key, value } = req.body;
    const actor = req.header('X-Actor') || 'api';
    
    if (!key) {
      return res.status(400).json({ success: false, error: '缺少必要字段: key' });
    }

    const artifact = artifactService.addMetadata(req.params.id, key, value, actor);
    if (!artifact) {
      return res.status(404).json({ success: false, error: '制品不存在' });
    }
    res.json({ success: true, data: artifact });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
