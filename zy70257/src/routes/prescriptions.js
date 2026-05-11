const express = require('express');
const router = express.Router();
const PrescriptionService = require('../services/prescriptionService');
const { success, error } = require('../utils/response');

router.get('/', async (req, res) => {
  const result = await PrescriptionService.listPrescriptions(req.query);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '获取处方列表成功'));
});

router.post('/', async (req, res) => {
  const result = await PrescriptionService.createPrescription(req.body);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.status(201).json(success(result.data, '处方创建成功'));
});

router.get('/:id', async (req, res) => {
  const result = await PrescriptionService.getPrescription(req.params.id);
  if (result.error) {
    return res.status(404).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '获取处方成功'));
});

router.get('/:id/details', async (req, res) => {
  const result = await PrescriptionService.getPrescriptionWithDetails(req.params.id);
  if (result.error) {
    return res.status(404).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '获取处方详情成功'));
});

router.patch('/:id/status', async (req, res) => {
  const result = await PrescriptionService.updatePrescriptionStatus(req.params.id, req.body.status);
  if (result.error) {
    return res.status(400).json(error(result.error.code, result.error.message));
  }
  res.json(success(result.data, '状态更新成功'));
});

module.exports = router;
