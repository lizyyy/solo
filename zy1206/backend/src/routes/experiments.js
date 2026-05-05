const express = require('express');
const router = express.Router();
const simulator = require('../simulator');

router.get('/', async (req, res) => {
  try {
    const experiments = await simulator.getAllExperiments();
    res.json({ success: true, data: experiments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, consistencyModel, config } = req.body;
    const experiment = await simulator.createExperiment(name, consistencyModel, config);
    res.json({ success: true, data: experiment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const experiment = await simulator.getExperiment(req.params.id);
    res.json({ success: true, data: experiment });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.get('/:id/nodes', async (req, res) => {
  try {
    const nodes = await simulator.getNodes(req.params.id);
    res.json({ success: true, data: nodes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/nodes', async (req, res) => {
  try {
    const { name, role } = req.body;
    const node = await simulator.createNode(req.params.id, name, role);
    res.json({ success: true, data: node });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/nodes/:nodeId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await simulator.updateNodeStatus(req.params.nodeId, status);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/partitions', async (req, res) => {
  try {
    const { name, nodeIds } = req.body;
    const partition = await simulator.createPartition(req.params.id, name, nodeIds);
    res.json({ success: true, data: partition });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/partitions/:partitionId/isolate', async (req, res) => {
  try {
    const result = await simulator.isolatePartition(req.params.partitionId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/partitions/:partitionId/restore', async (req, res) => {
  try {
    const result = await simulator.restorePartition(req.params.partitionId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/write', async (req, res) => {
  try {
    const { key, value, consistencyModel } = req.body;
    const result = await simulator.simulateWrite(req.params.id, key, value, consistencyModel);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/leader-failure', async (req, res) => {
  try {
    const result = await simulator.simulateLeaderFailure(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/lock/acquire', async (req, res) => {
  try {
    const { lockKey, nodeId, timeout } = req.body;
    const result = await simulator.simulateLockAcquire(req.params.id, lockKey, nodeId, timeout);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/lock/release', async (req, res) => {
  try {
    const { lockKey, nodeId } = req.body;
    const result = await simulator.simulateLockRelease(req.params.id, lockKey, nodeId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/stale-read', async (req, res) => {
  try {
    const { key, nodeId } = req.body;
    const result = await simulator.simulateStaleRead(req.params.id, key, nodeId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const timeline = await simulator.getTimeline(req.params.id);
    res.json({ success: true, data: timeline });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const { nodeId } = req.query;
    const logs = await simulator.getNodeLogs(req.params.id, nodeId);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/report', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const report = await simulator.generateReport(req.params.id, format);
    
    if (format === 'markdown') {
      res.set('Content-Type', 'text/markdown');
      res.send(report);
    } else {
      res.json({ success: true, data: report });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
