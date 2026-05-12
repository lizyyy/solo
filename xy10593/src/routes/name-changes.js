const express = require('express');
const router = express.Router();
const nameChangeService = require('../services/nameChangeService');
const { getStatusHistory } = require('../utils');

router.get('/', (req, res) => {
  try {
    const { booking_id, status } = req.query;
    const applications = nameChangeService.listNameChangeApplications(booking_id, status);
    res.json({ success: true, data: applications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/changes', (req, res) => {
  try {
    const { booking_id } = req.query;
    const changes = nameChangeService.getCustomerChanges(booking_id);
    res.json({ success: true, data: changes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const application = nameChangeService.getNameChangeApplication(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, error: '改名申请不存在' });
    }
    res.json({ success: true, data: application });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = getStatusHistory('name_change', req.params.id);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const application = nameChangeService.createNameChangeApplication(req.body);
    res.status(201).json({ success: true, data: application });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/submit', (req, res) => {
  try {
    const { operator } = req.body;
    const application = nameChangeService.submitForApproval(req.params.id, operator || 'system');
    res.json({ success: true, data: application });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/approve', (req, res) => {
  try {
    const { approval_notes, operator } = req.body;
    const application = nameChangeService.approveNameChange(
      req.params.id, 
      approval_notes, 
      operator || 'admin'
    );
    res.json({ success: true, data: application });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const { approval_notes, operator } = req.body;
    const application = nameChangeService.rejectNameChange(
      req.params.id, 
      approval_notes, 
      operator || 'admin'
    );
    res.json({ success: true, data: application });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
