const express = require('express');
const { ApiResponse } = require('../utils/response');
const SealService = require('../services/sealService');
const { authenticate } = require('../middleware/auth');
const { idempotent } = require('../middleware/idempotent');

const router = express.Router();

router.post('/seal/:seizedItemId', authenticate, idempotent(), async (req, res, next) => {
  try {
    const seal = await SealService.createSeal(req, req.params.seizedItemId, req.body);
    res.status(201).json(ApiResponse.success(seal, '封存成功'));
  } catch (error) {
    next(error);
  }
});

router.post('/unseal/:sealId', authenticate, async (req, res, next) => {
  try {
    const result = await SealService.unseal(req, req.params.sealId, req.body);
    res.json(ApiResponse.success(result));
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { 
      seal_number, seal_status, seized_item_id,
      start_date, end_date,
      page = 1, page_size = 20 
    } = req.query;

    const result = await SealService.list(
      {
        seal_number,
        seal_status,
        seized_item_id,
        start_date,
        end_date
      },
      parseInt(page),
      parseInt(page_size)
    );

    res.json(ApiResponse.pagination(result.seals, result.total, page, page_size));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const seal = await SealService.getById(req.params.id);
    res.json(ApiResponse.success(seal));
  } catch (error) {
    next(error);
  }
});

router.get('/item/:seizedItemId', authenticate, async (req, res, next) => {
  try {
    const seals = await SealService.getByItemId(req.params.seizedItemId);
    res.json(ApiResponse.success(seals));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
