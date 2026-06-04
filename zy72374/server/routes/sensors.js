const express = require('express');
const router = express.Router();
const SensorService = require('../services/SensorService');

router.get('/', (req, res) => {
  const sensors = SensorService.getAllSensors();
  res.json(sensors);
});

router.get('/active', (req, res) => {
  const sensors = SensorService.getAllActiveSensors();
  res.json(sensors);
});

router.get('/:id', (req, res) => {
  const sensor = SensorService.getSensorById(req.params.id);
  if (!sensor) {
    return res.status(404).json({ error: '传感器未找到' });
  }
  res.json(sensor);
});

router.get('/physical/:physicalId', (req, res) => {
  const sensor = SensorService.getSensorByPhysicalId(req.params.physicalId);
  if (!sensor) {
    return res.status(404).json({ error: '传感器未找到' });
  }
  res.json(sensor);
});

router.get('/physical/:physicalId/history', (req, res) => {
  const history = SensorService.getSensorHistory(req.params.physicalId);
  if (!history) {
    return res.status(404).json({ error: '传感器未找到' });
  }
  res.json(history);
});

router.post('/', (req, res) => {
  const sensor = SensorService.createSensor(req.body);
  res.status(201).json(sensor);
});

router.post('/restart', (req, res) => {
  const { physicalId, newNumber } = req.body;
  const result = SensorService.handleSensorRestart(physicalId, newNumber);
  res.json(result);
});

router.post('/resolve', (req, res) => {
  const { sensorNumber, timestamp } = req.body;
  const result = SensorService.resolveSensorConflict(sensorNumber, timestamp);
  res.json(result);
});

router.put('/:id', (req, res) => {
  const sensor = SensorService.updateSensor(req.params.id, req.body);
  if (!sensor) {
    return res.status(404).json({ error: '传感器未找到' });
  }
  res.json(sensor);
});

router.delete('/:id', (req, res) => {
  const sensor = SensorService.deactivateSensor(req.params.id);
  if (!sensor) {
    return res.status(404).json({ error: '传感器未找到' });
  }
  res.json(sensor);
});

module.exports = router;
