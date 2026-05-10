const express = require('express');

function createSourcesRouter(service) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const sources = service.getAllSources().map(s => s.toJSON());
    res.json({
      success: true,
      data: {
        count: sources.length,
        sources
      }
    });
  });

  router.post('/', (req, res) => {
    const { id, name, config } = req.body;

    if (!id || !name) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: id 和 name'
      });
    }

    const result = service.registerSource(id, name, config || {});

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.status(201).json({
      success: true,
      data: {
        source: result.source.toJSON()
      }
    });
  });

  router.get('/:id', (req, res) => {
    const source = service.getSource(req.params.id);

    if (!source) {
      return res.status(404).json({
        success: false,
        error: `召回源 ${req.params.id} 不存在`
      });
    }

    res.json({
      success: true,
      data: {
        source: source.toJSON()
      }
    });
  });

  router.post('/:id/transition', (req, res) => {
    const { targetState, reason } = req.body;

    if (!targetState) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: targetState'
      });
    }

    const result = service.manualTransition(
      req.params.id,
      targetState,
      reason || '手动状态切换'
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        details: result.result
      });
    }

    res.json({
      success: true,
      data: result.result
    });
  });

  router.post('/:id/record', (req, res) => {
    const { status, latencyMs } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: status'
      });
    }

    const result = service.recordSourceResult(req.params.id, status, latencyMs || 0);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        record: result.record
      }
    });
  });

  router.post('/:id/evaluate', (req, res) => {
    const result = service.evaluateAndTransition(req.params.id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result
    });
  });

  router.post('/evaluate-all', (req, res) => {
    const results = service.evaluateAllSources();

    res.json({
      success: true,
      data: {
        count: results.length,
        results
      }
    });
  });

  return router;
}

module.exports = {
  createSourcesRouter
};