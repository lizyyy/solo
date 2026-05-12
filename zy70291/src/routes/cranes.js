const express = require('express');
const craneService = require('../services/craneService');
const { handleAsync } = require('../utils/errors');

const router = express.Router();

router.get('/', handleAsync(async (req, res) => {
  const cranes = craneService.listCranes(req.query);
  res.json({ data: cranes });
}));

router.post('/', handleAsync(async (req, res) => {
  const crane = craneService.createCrane(req.body);
  res.status(201).json({ data: crane });
}));

router.get('/:id', handleAsync(async (req, res) => {
  const crane = craneService.getCraneById(req.params.id);
  res.json({ data: crane });
}));

router.put('/:id', handleAsync(async (req, res) => {
  const crane = craneService.updateCrane(req.params.id, req.body);
  res.json({ data: crane });
}));

router.delete('/:id', handleAsync(async (req, res) => {
  const result = craneService.deleteCrane(req.params.id);
  res.json({ data: result });
}));

router.get('/by-code/:code', handleAsync(async (req, res) => {
  const crane = craneService.getCraneByCode(req.params.code);
  res.json({ data: crane });
}));

router.get('/materials/list', handleAsync(async (req, res) => {
  const materials = craneService.listMaterials();
  res.json({ data: materials });
}));

router.post('/materials', handleAsync(async (req, res) => {
  const material = craneService.createMaterial(req.body);
  res.status(201).json({ data: material });
}));

router.get('/materials/:id', handleAsync(async (req, res) => {
  const material = craneService.getMaterialById(req.params.id);
  res.json({ data: material });
}));

router.put('/materials/:id', handleAsync(async (req, res) => {
  const material = craneService.updateMaterial(req.params.id, req.body);
  res.json({ data: material });
}));

router.post('/weather/wind-speed', handleAsync(async (req, res) => {
  const record = craneService.recordWindSpeed(req.body.wind_speed);
  res.status(201).json({ data: record });
}));

router.get('/weather/wind-speed/latest', handleAsync(async (req, res) => {
  const latest = craneService.getLatestWindSpeed();
  res.json({ data: latest });
}));

module.exports = router;
