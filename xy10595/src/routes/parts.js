const express = require('express');
const router = express.Router();
const { success, error } = require('../utils/response');
const SparePart = require('../models/sparePart');
const MinStock = require('../models/minStock');
const Equipment = require('../models/equipment');
const AlternativePart = require('../models/alternativePart');
const Consumption = require('../models/consumption');
const PurchaseCycle = require('../models/purchaseCycle');
const PurchaseOrder = require('../models/purchaseOrder');
const stockCalculator = require('../services/stockCalculator');

router.get('/', (req, res) => {
  try {
    const parts = SparePart.findAll();
    const enriched = parts.map(p => {
      const minStock = MinStock.getMinQuantity(p.id);
      const inTransit = PurchaseOrder.getInTransitQuantity(p.id);
      return {
        ...p,
        min_stock: minStock,
        in_transit: inTransit,
        effective_stock: p.current_stock + inTransit,
        is_below_min: (p.current_stock + inTransit) < minStock
      };
    });
    res.json(success(enriched));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.get('/:id', (req, res) => {
  try {
    const part = SparePart.findById(req.params.id);
    if (!part) {
      return res.json(error('备件不存在', 404));
    }
    const minStock = MinStock.getMinQuantity(part.id);
    const inTransit = PurchaseOrder.getInTransitQuantity(part.id);
    const alternatives = AlternativePart.findAlternatives(part.id);
    const equipments = Equipment.getByPart(part.id);
    const cycles = PurchaseCycle.findByPart(part.id);
    const inTransitOrders = PurchaseOrder.getInTransitOrders(part.id);
    const recentConsumption = Consumption.getRecentConsumption(part.id);
    const avgConsumption = Consumption.getAverageDailyConsumption(part.id);
    
    res.json(success({
      part,
      minStock,
      inTransit,
      effectiveStock: part.current_stock + inTransit,
      isBelowMin: (part.current_stock + inTransit) < minStock,
      alternatives,
      equipments,
      cycles,
      inTransitOrders,
      recentConsumption,
      avgConsumption
    }));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.post('/', (req, res) => {
  try {
    const { code, name, category, unit, currentStock } = req.body;
    if (!code || !name) {
      return res.json(error('备件编码和名称不能为空', 400));
    }
    const existing = SparePart.findByCode(code);
    if (existing) {
      return res.json(error('备件编码已存在', 400));
    }
    const id = SparePart.create({ code, name, category, unit, currentStock });
    res.json(success({ id, code, name }, '备件创建成功'));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.post('/:id/calculate-min-stock', (req, res) => {
  try {
    const part = SparePart.findById(req.params.id);
    if (!part) {
      return res.json(error('备件不存在', 404));
    }
    const result = stockCalculator.updateMinStockRule(part.id);
    res.json(success(result, '最低库存计算完成'));
  } catch (e) {
    res.json(error(e.message));
  }
});

module.exports = router;
