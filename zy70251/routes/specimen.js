const express = require('express');
const router = express.Router();
const specimenService = require('../services/specimenService');
const statusHistoryService = require('../services/statusHistoryService');
const { NotFoundError } = require('../utils/errors');

router.get('/', async (req, res, next) => {
  try {
    const { status, patient_id, batch_id, destination_lab } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (patient_id) filters.patient_id = patient_id;
    if (batch_id) filters.batch_id = batch_id;
    if (destination_lab) filters.destination_lab = destination_lab;

    const specimens = await specimenService.getAllSpecimens(filters);
    res.json({ data: specimens });
  } catch (err) {
    next(err);
  }
});

router.get('/barcode/:barcode', async (req, res, next) => {
  try {
    const specimen = await specimenService.getSpecimenByBarcode(req.params.barcode);
    res.json({ data: specimen });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const specimen = await specimenService.getSpecimenById(req.params.id);
    if (!specimen) {
      throw new NotFoundError('标本', req.params.id);
    }
    res.json({ data: specimen });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const specimenData = { ...req.body };
    delete specimenData.operator;
    
    const specimen = await specimenService.createSpecimen(specimenData);
    res.status(201).json({ 
      data: specimen,
      message: '标本条码创建成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/add-to-batch', async (req, res, next) => {
  try {
    const { batch_id, operator } = req.body;
    const specimen = await specimenService.addToBatch(req.params.id, batch_id, operator);
    res.json({ 
      data: specimen,
      message: '标本已加入批次'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/remove-from-batch', async (req, res, next) => {
  try {
    const { operator } = req.body;
    const specimen = await specimenService.removeFromBatch(req.params.id, operator);
    res.json({ 
      data: specimen,
      message: '标本已从批次移除'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const history = await statusHistoryService.getStatusHistory('specimen', req.params.id);
    res.json({ data: history });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
