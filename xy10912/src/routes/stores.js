const express = require('express');
const router = express.Router();
const { StoreDAO } = require('../database/dao');
const { validate } = require('../utils/validation');
const { successResponse, createdResponse, notFoundResponse, duplicateResponse, errorResponse } = require('../utils/response');
const { logException } = require('../middleware/exceptionHandler');

const storeDAO = new StoreDAO();

router.post('/', validate('store'), async (req, res, next) => {
  try {
    const existing = await storeDAO.findByCode(req.body.store_code);
    if (existing) {
      return await duplicateResponse(res, '门店编码已存在', req);
    }

    const result = await storeDAO.create(req.body);
    const store = await storeDAO.findById(result.lastID);
    return createdResponse(res, store);
  } catch (err) {
    await logException(req, err, 'create_store_failed');
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, store_code } = req.query;
    let where = '';
    let params = [];

    if (status) {
      where += 'status = ?';
      params.push(status);
    }

    if (store_code) {
      where += where ? ' AND ' : '';
      where += 'store_code = ?';
      params.push(store_code);
    }

    const stores = await storeDAO.findAll(where, params);
    return successResponse(res, stores);
  } catch (err) {
    await logException(req, err, 'list_stores_failed');
    next(err);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const store = await storeDAO.findByCode(req.params.code);
    if (!store) {
      return await notFoundResponse(res, '门店不存在', req);
    }
    return successResponse(res, store);
  } catch (err) {
    await logException(req, err, 'get_store_failed');
    next(err);
  }
});

router.put('/:code', validate('store'), async (req, res, next) => {
  try {
    const store = await storeDAO.findByCode(req.params.code);
    if (!store) {
      return await notFoundResponse(res, '门店不存在', req);
    }

    req.body.updated_at = new Date().toISOString();
    await storeDAO.update(store.id, req.body);
    const updatedStore = await storeDAO.findById(store.id);
    return successResponse(res, updatedStore, '门店更新成功');
  } catch (err) {
    await logException(req, err, 'update_store_failed');
    next(err);
  }
});

module.exports = router;
