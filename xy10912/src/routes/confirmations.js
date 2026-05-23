const express = require('express');
const router = express.Router();
const { ConfirmationDAO, StoreDAO, PriceVersionDAO } = require('../database/dao');
const { validate } = require('../utils/validation');
const { successResponse, createdResponse, notFoundResponse, duplicateResponse } = require('../utils/response');
const { logException } = require('../middleware/exceptionHandler');

const confirmationDAO = new ConfirmationDAO();
const storeDAO = new StoreDAO();
const priceVersionDAO = new PriceVersionDAO();

router.post('/', validate('confirmation'), async (req, res, next) => {
  try {
    const store = await storeDAO.findByCode(req.body.store_code);
    if (!store) {
      return notFoundResponse(res, '门店不存在');
    }

    const priceVersion = await priceVersionDAO.findById(req.body.price_version_id);
    if (!priceVersion) {
      return notFoundResponse(res, '价签版本不存在');
    }

    const existing = await confirmationDAO.findByStoreAndVersion(
      req.body.store_code,
      req.body.price_version_id
    );
    if (existing) {
      return duplicateResponse(res, '该门店已确认过此价签版本');
    }

    const result = await confirmationDAO.create(req.body);
    const confirmation = await confirmationDAO.findById(result.lastID);
    return createdResponse(res, confirmation, '价签确认成功');
  } catch (err) {
    await logException(req, err, 'create_confirmation_failed');
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { store_code, price_version_id } = req.query;
    let where = '';
    let params = [];

    if (store_code) {
      where += 'store_code = ?';
      params.push(store_code);
    }

    if (price_version_id) {
      where += where ? ' AND ' : '';
      where += 'price_version_id = ?';
      params.push(price_version_id);
    }

    const confirmations = await confirmationDAO.findAll(where, params);
    return successResponse(res, confirmations);
  } catch (err) {
    await logException(req, err, 'list_confirmations_failed');
    next(err);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const confirmation = await confirmationDAO.findByCode(req.params.code);
    if (!confirmation) {
      return notFoundResponse(res, '确认记录不存在');
    }
    return successResponse(res, confirmation);
  } catch (err) {
    await logException(req, err, 'get_confirmation_failed');
    next(err);
  }
});

module.exports = router;
