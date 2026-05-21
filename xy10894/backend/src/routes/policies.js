const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const { PolicyVersion, PolicyStatus } = require('../models/PolicyVersion');
const { PolicyService } = require('../services/PolicyService');

router.get('/', async (req, res) => {
  try {
    const { status, createdBy } = req.query;
    const policies = await PolicyVersion.findAll({ status, createdBy });
    res.json({ success: true, data: policies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const policy = await PolicyService.getPolicyDetail(req.params.id);
    if (!policy) {
      return res.status(404).json({ success: false, error: '制度不存在' });
    }
    res.json({ success: true, data: policy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const createdBy = req.headers['x-user-id'] || 'system';
    const policy = await PolicyService.createPolicy(req.body, createdBy);
    res.status(201).json({ success: true, data: policy });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/submit-approval', async (req, res) => {
  try {
    const result = await PolicyService.submitForApproval(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/approval-nodes/:nodeId/approve', async (req, res) => {
  try {
    const { approverUser, comment } = req.body;
    const result = await PolicyService.approveNode(req.params.nodeId, approverUser, comment);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/approval-nodes/:nodeId/reject', async (req, res) => {
  try {
    const { approverUser, comment } = req.body;
    const result = await PolicyService.rejectNode(req.params.nodeId, approverUser, comment);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/publish', async (req, res) => {
  try {
    const result = await PolicyService.publishPolicy(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/publish-channels/:channelId/retry', async (req, res) => {
  try {
    const result = await PolicyService.retryPublish(req.params.channelId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/confirm-reading', async (req, res) => {
  try {
    const { userId, userName } = req.body;
    const result = await PolicyService.confirmReading(req.params.id, userId, userName);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/abolish', async (req, res) => {
  try {
    const { reason, abolishedBy } = req.body;
    const result = await PolicyService.abolishPolicy(req.params.id, reason, abolishedBy);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:policyCode/references', async (req, res) => {
  try {
    const references = await PolicyService.checkReferences(req.params.policyCode);
    res.json({ success: true, data: references });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { status, createdBy } = req.query;
    const data = await PolicyService.exportPolicies({ status, createdBy });
    
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=policies.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const allPolicies = await PolicyVersion.findAll({});
    
    const stats = {
      total: allPolicies.length,
      byStatus: {}
    };
    
    Object.values(PolicyStatus).forEach(status => {
      stats.byStatus[status] = allPolicies.filter(p => p.status === status).length;
    });
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
