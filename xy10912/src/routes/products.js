const express = require('express');
const router = express.Router();
const { ProductDAO } = require('../database/dao');
const { validate } = require('../utils/validation');
const { successResponse, createdResponse, notFoundResponse, duplicateResponse } = require('../utils/response');
const { logException } = require('../middleware/exceptionHandler');

const productDAO = new ProductDAO();

router.post('/', validate('product'), async (req, res, next) => {
  try {
    const existing = await productDAO.findByBarcode(req.body.barcode);
    if (existing) {
      return await duplicateResponse(res, '商品条码已存在', req);
    }

    const result = await productDAO.create(req.body);
    const product = await productDAO.findById(result.lastID);
    return createdResponse(res, product);
  } catch (err) {
    await logException(req, err, 'create_product_failed');
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { category, barcode } = req.query;
    let where = '';
    let params = [];

    if (category) {
      where += 'category = ?';
      params.push(category);
    }

    if (barcode) {
      where += where ? ' AND ' : '';
      where += 'barcode = ?';
      params.push(barcode);
    }

    const products = await productDAO.findAll(where, params);
    return successResponse(res, products);
  } catch (err) {
    await logException(req, err, 'list_products_failed');
    next(err);
  }
});

router.get('/:barcode', async (req, res, next) => {
  try {
    const product = await productDAO.findByBarcode(req.params.barcode);
    if (!product) {
      return await notFoundResponse(res, '商品不存在', req);
    }
    return successResponse(res, product);
  } catch (err) {
    await logException(req, err, 'get_product_failed');
    next(err);
  }
});

router.put('/:barcode', validate('product'), async (req, res, next) => {
  try {
    const product = await productDAO.findByBarcode(req.params.barcode);
    if (!product) {
      return await notFoundResponse(res, '商品不存在', req);
    }

    req.body.updated_at = new Date().toISOString();
    await productDAO.update(product.id, req.body);
    const updatedProduct = await productDAO.findById(product.id);
    return successResponse(res, updatedProduct, '商品更新成功');
  } catch (err) {
    await logException(req, err, 'update_product_failed');
    next(err);
  }
});

module.exports = router;
