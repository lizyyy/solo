const express = require('express');
const router = express.Router();
const { store } = require('../services/store');

router.get('/', (req, res) => {
  try {
    const inventory = store.inventory.map(inv => {
      const wh = store.warehouses.find(h => h.id === inv.warehouse_id);
      const sku = store.skus.find(s => s.id === inv.sku_id);
      return {
        warehouse_code: wh ? wh.code : null,
        warehouse_name: wh ? wh.name : null,
        sku_code: sku ? sku.code : null,
        sku_name: sku ? sku.name : null,
        available_qty: inv.available_qty,
        locked_qty: inv.locked_qty
      };
    });
    res.json({ success: true, data: inventory });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/warehouse/:warehouseCode', (req, res) => {
  try {
    const wh = store.warehouses.find(w => w.code === req.params.warehouseCode);
    if (!wh) {
      return res.status(404).json({ success: false, error: '仓库不存在' });
    }

    const inventory = store.inventory
      .filter(inv => inv.warehouse_id === wh.id)
      .map(inv => {
        const sku = store.skus.find(s => s.id === inv.sku_id);
        return {
          sku_code: sku ? sku.code : null,
          sku_name: sku ? sku.name : null,
          available_qty: inv.available_qty,
          locked_qty: inv.locked_qty
        };
      });

    res.json({ success: true, data: { warehouse: wh, inventory } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
