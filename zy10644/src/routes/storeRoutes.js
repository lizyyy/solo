const express = require('express');
const router = express.Router();
const { Store } = require('../models/Store');

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, region, keyword } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (region) query.region = region;
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { storeCode: { $regex: keyword, $options: 'i' } }
      ];
    }

    const stores = await Store.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Store.countDocuments(query);

    res.json({
      data: stores,
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
    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ error: '门店不存在' });
    }
    res.json(store);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
