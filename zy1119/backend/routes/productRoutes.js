const express = require('express');
const router = express.Router();
const { Product } = require('../models');
const { Op } = require('sequelize');

router.get('/', async (req, res) => {
  try {
    const { category, is_active, search } = req.query;
    const whereClause = {};

    if (category) whereClause.category = category;
    if (is_active !== undefined) whereClause.is_active = is_active === 'true';
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const products = await Product.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('获取商品列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取商品列表失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
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
    console.error('获取商品详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取商品详情失败',
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, sku, category, unit, price, storage_temp, shelf_life_days, description } = req.body;

    if (!name || !price) {
      return res.status(400).json({
        success: false,
        message: '商品名称和价格为必填项'
      });
    }

    const product = await Product.create({
      name,
      sku,
      category: category || 'other',
      unit: unit || '件',
      price,
      storage_temp: storage_temp || 'refrigerated',
      shelf_life_days,
      description,
      is_active: true
    });

    res.status(201).json({
      success: true,
      message: '商品创建成功',
      data: product
    });
  } catch (error) {
    console.error('创建商品失败:', error);
    res.status(500).json({
      success: false,
      message: '创建商品失败',
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    const { name, sku, category, unit, price, storage_temp, shelf_life_days, description, is_active } = req.body;

    await product.update({
      name,
      sku,
      category,
      unit,
      price,
      storage_temp,
      shelf_life_days,
      description,
      is_active
    });

    res.json({
      success: true,
      message: '商品更新成功',
      data: product
    });
  } catch (error) {
    console.error('更新商品失败:', error);
    res.status(500).json({
      success: false,
      message: '更新商品失败',
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    await product.update({ is_active: false });

    res.json({
      success: true,
      message: '商品已停用'
    });
  } catch (error) {
    console.error('停用商品失败:', error);
    res.status(500).json({
      success: false,
      message: '停用商品失败',
      error: error.message
    });
  }
});

module.exports = router;
