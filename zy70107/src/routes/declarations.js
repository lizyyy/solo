const express = require('express');
const router = express.Router();
const declarationService = require('../services/declarationService');

router.get('/', (req, res) => {
  try {
    const filters = {
      boat_id: req.query.boat_id,
      status: req.query.status,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };
    const declarations = declarationService.listDeclarations(filters);
    res.json({ success: true, data: declarations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const declaration = declarationService.getDeclarationWithDetails(req.params.id);
    if (!declaration) {
      return res.status(404).json({ success: false, error: '申报不存在' });
    }
    res.json({ success: true, data: declaration });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const declaration = declarationService.createDeclaration(req.body);
    res.status(201).json({ success: true, data: declaration });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/approve', (req, res) => {
  try {
    const declaration = declarationService.approveDeclaration(req.params.id);
    res.json({ success: true, data: declaration });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const declaration = declarationService.rejectDeclaration(req.params.id, req.body.reason);
    res.json({ success: true, data: declaration });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/departure', (req, res) => {
  try {
    const declaration = declarationService.recordDeparture(req.params.id, req.body.departure_time);
    res.json({ success: true, data: declaration });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/return', (req, res) => {
  try {
    const declaration = declarationService.recordReturn(req.params.id, req.body);
    res.json({ success: true, data: declaration });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/re-departure', (req, res) => {
  try {
    const declaration = declarationService.recordReDeparture(req.params.id);
    res.json({ success: true, data: declaration });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/complete', (req, res) => {
  try {
    const declaration = declarationService.completeDeclaration(req.params.id);
    res.json({ success: true, data: declaration });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/correct-status', (req, res) => {
  try {
    const { new_status, changed_by, reason } = req.body;
    const declaration = declarationService.manualCorrectStatus(req.params.id, new_status, changed_by, reason);
    res.json({ success: true, data: declaration });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/fuel', (req, res) => {
  try {
    const declaration = declarationService.addFuelRecord(req.params.id, req.body);
    res.json({ success: true, data: declaration });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
