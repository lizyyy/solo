const express = require('express');
const { Product } = require('../models');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const historyService = require('../services/historyService');
const { withOptimisticLock } = require('../utils/optimisticLock');
const { Op } = require('sequelize');

const router = express.Router();

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const { keyword, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    const where = { isActive: true };

    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { code: { [Op.like]: `%${keyword}%` } },
        { barcode: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { rows: products, count } = await Product.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(pageSize),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: count
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    const product = await Product.create(req.body);

    await historyService.logCreate(product, req.user, req);

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    const oldProduct = { ...product.toJSON() };
    const updatedProduct = await withOptimisticLock(
      Product,
      req.params.id,
      { ...req.body, version: req.body.version },
      req.user
    );

    await historyService.logUpdate(oldProduct, updatedProduct, req.user, req);

    res.json({
      success: true,
      data: updatedProduct
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    await historyService.logDelete(product, req.user, req);

    await product.update({ isActive: false });

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;