const express = require('express');
const router = express.Router();
const HeatLoadService = require('../services/HeatLoadService');

router.get('/', (req, res) => {
  const records = HeatLoadService.getAllRecords();
  res.json(records);
});

router.get('/workflow/summary', (req, res) => {
  const summary = HeatLoadService.getWorkflowSummary();
  res.json(summary);
});

router.get('/date/:date', (req, res) => {
  const records = HeatLoadService.getRecordsByDate(req.params.date);
  res.json(records);
});

router.get('/pool/:poolId', (req, res) => {
  const records = HeatLoadService.getRecordsByPool(req.params.poolId);
  res.json(records);
});

router.get('/status/:status', (req, res) => {
  const records = HeatLoadService.getRecordsByStatus(req.params.status);
  res.json(records);
});

router.get('/workflow/step/:step', (req, res) => {
  const records = HeatLoadService.getRecordsByWorkflowStep(parseInt(req.params.step));
  res.json(records);
});

router.get('/engineering/pending', (req, res) => {
  const records = HeatLoadService.getPendingEngineeringReview();
  res.json(records);
});

router.get('/safety/pending', (req, res) => {
  const records = HeatLoadService.getPendingSafetyReview();
  res.json(records);
});

router.get('/:id', (req, res) => {
  const record = HeatLoadService.getRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.get('/:id/evidence', (req, res) => {
  const evidence = HeatLoadService.getRecordWithEvidence(req.params.id);
  if (!evidence) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(evidence);
});

router.get('/:id/history', (req, res) => {
  const history = HeatLoadService.getRecordHistory(req.params.id);
  if (!history) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(history);
});

router.get('/:id/can-modify', (req, res) => {
  const { userId, userRole } = req.query;
  const canModify = HeatLoadService.canModifyRecord(req.params.id, userId, userRole);
  res.json({ canModify });
});

router.get('/pool/:poolId/chart', (req, res) => {
  const { startDate, endDate } = req.query;
  const chartData = HeatLoadService.getChartData(
    req.params.poolId,
    startDate,
    endDate
  );
  res.json(chartData);
});

router.post('/calculate', (req, res) => {
  const { inletTemp, outletTemp, flowRate, specificHeat } = req.body;
  const heatLoad = HeatLoadService.calculateHeatLoad(
    inletTemp,
    outletTemp,
    flowRate,
    specificHeat
  );
  res.json({ heatLoad });
});

router.post('/', (req, res) => {
  const record = HeatLoadService.createRecord(req.body);
  res.status(201).json(record);
});

router.post('/:id/submit-engineering', (req, res) => {
  const { editor } = req.body;
  const record = HeatLoadService.submitForEngineeringReview(req.params.id, editor);
  if (record && record.error) {
    return res.status(400).json({ error: record.error });
  }
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/engineer-approve', (req, res) => {
  const { engineer, notes } = req.body;
  const record = HeatLoadService.engineerApprove(req.params.id, engineer, notes);
  if (record && record.error) {
    return res.status(400).json({ error: record.error });
  }
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/engineer-reject', (req, res) => {
  const { engineer, reason } = req.body;
  const record = HeatLoadService.engineerReject(req.params.id, engineer, reason);
  if (record && record.error) {
    return res.status(400).json({ error: record.error });
  }
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/safety-approve', (req, res) => {
  const { safetyOfficer, reminders } = req.body;
  const record = HeatLoadService.safetyApprove(req.params.id, safetyOfficer, reminders);
  if (record && record.error) {
    return res.status(400).json({ error: record.error });
  }
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/safety-reject', (req, res) => {
  const { safetyOfficer, reason } = req.body;
  const record = HeatLoadService.safetyReject(req.params.id, safetyOfficer, reason);
  if (record && record.error) {
    return res.status(400).json({ error: record.error });
  }
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/photos', (req, res) => {
  const { photoId } = req.body;
  const record = HeatLoadService.addPhotoToRecord(req.params.id, photoId);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/notes', (req, res) => {
  const { noteId } = req.body;
  const record = HeatLoadService.addNoteToRecord(req.params.id, noteId);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/check-sensor-restart', (req, res) => {
  const record = HeatLoadService.checkSensorRestart(req.params.id);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.put('/:id/heat-load', (req, res) => {
  const { heatLoad, editor, reason } = req.body;
  const record = HeatLoadService.updateHeatLoadValue(req.params.id, heatLoad, editor, reason);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.delete('/:id', (req, res) => {
  const record = HeatLoadService.deleteRecord(req.params.id);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

module.exports = router;
