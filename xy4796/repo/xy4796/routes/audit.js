const express = require('express');
const Storage = require('../services/storage');

const router = express.Router();

router.post('/tags', async (req, res) => {
  try {
    const { run_id, tag, created_by, notes } = req.body;
    
    if (!run_id || !tag) {
      return res.status(400).json({
        error: 'Both run_id and tag are required'
      });
    }
    
    const run = await Storage.getBenchmarkRun(run_id);
    if (!run) {
      return res.status(404).json({
        error: 'Benchmark run not found'
      });
    }
    
    const tagId = await Storage.addAuditTag(
      run.id,
      tag,
      created_by || 'anonymous',
      notes
    );
    
    const tags = await Storage.getAuditTags(run.id);
    
    res.status(201).json({
      message: 'Tag added successfully',
      tagId,
      tags
    });
  } catch (error) {
    console.error('Add tag error:', error);
    res.status(500).json({
      error: 'Failed to add tag',
      details: error.message
    });
  }
});

router.get('/tags/:runId', async (req, res) => {
  try {
    const run = await Storage.getBenchmarkRun(req.params.runId);
    if (!run) {
      return res.status(404).json({
        error: 'Benchmark run not found'
      });
    }
    
    const tags = await Storage.getAuditTags(run.id);
    
    res.json({
      runId: req.params.runId,
      tags,
      count: tags.length
    });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({
      error: 'Failed to get tags',
      details: error.message
    });
  }
});

router.put('/notes/:runId', async (req, res) => {
  try {
    const { notes } = req.body;
    
    if (notes === undefined) {
      return res.status(400).json({
        error: 'Notes field is required'
      });
    }
    
    const run = await Storage.getBenchmarkRun(req.params.runId);
    if (!run) {
      return res.status(404).json({
        error: 'Benchmark run not found'
      });
    }
    
    await Storage.updateBenchmarkRun(run.id, { notes });
    
    const updatedRun = await Storage.getBenchmarkRun(req.params.runId);
    
    res.json({
      message: 'Notes updated successfully',
      run: updatedRun
    });
  } catch (error) {
    console.error('Update notes error:', error);
    res.status(500).json({
      error: 'Failed to update notes',
      details: error.message
    });
  }
});

module.exports = router;
