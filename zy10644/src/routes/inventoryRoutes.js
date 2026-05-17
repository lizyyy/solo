const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, sku, storeCode, hasStock } = req.query;
    const query = {};
    
    if (sku) query.sku = sku;
    if (storeCode) query.storeCode = storeCode;
    if (hasStock === 'true') query.availableQuantity = { $gt: 0 };

    const inventories = await Inventory.find(query)
      .populate('preparedMealId', 'name category price')
      .populate('storeId', 'name storeCode')
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Inventory.countDocuments(query);

    res.json({
      data: inventories,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const inventory = await Inventory.findById(req.params.id)
      .populate('preparedMealId', 'name category price')
      .populate('storeId', 'name storeCode');
    if (!inventory) {
      return res.status(404).json({ error: '库存记录不存在' });
    }
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
