const express = require('express');
const router = express.Router();
const treatmentService = require('../services/treatmentService');
const consumptionService = require('../services/consumptionService');

router.get('/', (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    const treatments = treatmentService.getAllTreatments(activeOnly);
    res.json({ success: true, data: treatments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const treatment = treatmentService.getTreatmentById(req.params.id);
    if (!treatment) {
      return res.status(404).json({ success: false, error: '诊疗项目不存在' });
    }
    res.json({ success: true, data: treatment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/stock-check', (req, res) => {
  try {
    const result = treatmentService.checkTreatmentStock(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message.includes('不存在')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/summary', (req, res) => {
  try {
    const summary = treatmentService.getTreatmentMaterialSummary(req.params.id);
    if (!summary) {
      return res.status(404).json({ success: false, error: '诊疗项目不存在' });
    }
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/consumption-report', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const report = consumptionService.getTreatmentConsumptionReport(req.params.id, days);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const treatment = treatmentService.createTreatment(req.body);
    res.status(201).json({ success: true, data: treatment });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const treatment = treatmentService.updateTreatment(req.params.id, req.body);
    res.json({ success: true, data: treatment });
  } catch (error) {
    if (error.message.includes('不存在')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/bind-materials', (req, res) => {
  try {
    const { materials } = req.body;
    if (!Array.isArray(materials)) {
      return res.status(400).json({ success: false, error: 'materials必须是数组' });
    }
    const treatment = treatmentService.bindMaterials(req.params.id, materials);
    res.json({ success: true, data: treatment });
  } catch (error) {
    if (error.message.includes('不存在')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
