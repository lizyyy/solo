const express = require('express');
const router = express.Router();
const { ManualCorrectionDAO, StoreDAO, ProductDAO, DiscrepancyReportDAO } = require('../database/dao');
const { validate } = require('../utils/validation');
const { successResponse, createdResponse, notFoundResponse } = require('../utils/response');
const { logException } = require('../middleware/exceptionHandler');

const manualCorrectionDAO = new ManualCorrectionDAO();
const storeDAO = new StoreDAO();
const productDAO = new ProductDAO();
const discrepancyReportDAO = new DiscrepancyReportDAO();

router.post('/', validate('manualCorrection'), async (req, res, next) => {
  try {
    const store = await storeDAO.findByCode(req.body.store_code);
    if (!store) {
      return await notFoundResponse(res, '门店不存在', req);
    }

    const product = await productDAO.findByBarcode(req.body.barcode);
    if (!product) {
      return await notFoundResponse(res, '商品不存在', req);
    }

    if (req.body.discrepancy_id) {
      const discrepancy = await discrepancyReportDAO.findById(req.body.discrepancy_id);
      if (!discrepancy) {
        return await notFoundResponse(res, '关联的差异报告不存在', req);
      }
    }

    const result = await manualCorrectionDAO.create(req.body);
    const correction = await manualCorrectionDAO.findById(result.lastID);
    return createdResponse(res, correction, '人工修正已记录');
  } catch (err) {
    await logException(req, err, 'create_correction_failed');
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { store_code, barcode } = req.query;
    let where = '';
    let params = [];

    if (store_code) {
      where += 'store_code = ?';
      params.push(store_code);
    }

    if (barcode) {
      where += where ? ' AND ' : '';
      where += 'barcode = ?';
      params.push(barcode);
    }

    const corrections = await manualCorrectionDAO.findAll(where, params);
    return successResponse(res, corrections);
  } catch (err) {
    await logException(req, err, 'list_corrections_failed');
    next(err);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const correction = await manualCorrectionDAO.findByCode(req.params.code);
    if (!correction) {
      return await notFoundResponse(res, '人工修正记录不存在', req);
    }
    return successResponse(res, correction);
  } catch (err) {
    await logException(req, err, 'get_correction_failed');
    next(err);
  }
});

module.exports = router;
