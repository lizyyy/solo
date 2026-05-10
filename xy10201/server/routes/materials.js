const express = require('express');
const router = express.Router();
const materialService = require('../services/materialService');

router.get('/', (req, res) => {
  try {
    const { category, keyword } = req.query;
    const materials = materialService.getAllMaterials({ category, keyword });
    res.json({ success: true, data: materials });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/low-stock', (req, res) => {
  try {
    const materials = materialService.getLowStockMaterials();
    res.json({ success: true, data: materials });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/categories', (req, res) => {
  try {
    const categories = materialService.getMaterialCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const material = materialService.getMaterialById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, error: '耗材不存在' });
    }
    res.json({ success: true, data: material });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = materialService.getMaterialHistory(req.params.id, req.query.limit || 20);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const material = materialService.createMaterial(req.body);
    res.status(201).json({ success: true, data: material });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const material = materialService.updateMaterial(req.params.id, req.body);
    res.json({ success: true, data: material });
  } catch (error) {
    if (error.message.includes('不存在')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/adjust', (req, res) => {
  try {
    const { change_quantity, operator, notes } = req.body;
    const snapshotType = change_quantity > 0 ? 'MANUAL_ADD' : 'MANUAL_DEDUCT';
    
    const result = materialService.updateStock(
      req.params.id,
      change_quantity,
      snapshotType,
      'MANUAL_ADJUST',
      Date.now(),
      operator || 'system',
      notes || '手动调整'
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
