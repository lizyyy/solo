const express = require('express');
const router = express.Router();
const WarehouseService = require('../services/warehouse-service');
const AccountingService = require('../services/accounting-service');
const LogisticsService = require('../services/logistics-service');
const db = require('../config/database');

router.get('/warehouse/inventory', (req, res) => {
  try {
    const inventory = WarehouseService.listAllInventory();
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/warehouse/inventory/:sku/:location', (req, res) => {
  try {
    const { sku, location } = req.params;
    const inventory = WarehouseService.getInventory(sku, location);
    
    if (!inventory) {
      return res.status(404).json({ error: '库存不存在' });
    }

    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/warehouse/inventory', (req, res) => {
  try {
    const { sku, location, quantity } = req.body;
    
    if (!sku || !location || quantity === undefined) {
      return res.status(400).json({ error: '缺少必填参数: sku, location, quantity' });
    }

    const existing = WarehouseService.getInventory(sku, location);
    
    if (existing) {
      db.prepare(`
        UPDATE warehouse SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
        WHERE sku = ? AND location = ?
      `).run(parseInt(quantity), sku, location);
    } else {
      db.prepare(`
        INSERT INTO warehouse (sku, location, quantity) VALUES (?, ?, ?)
      `).run(sku, location, parseInt(quantity));
    }

    res.json({ success: true, sku, location, quantity });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/accounting/accounts', (req, res) => {
  try {
    const accounts = AccountingService.listAllAccounts();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/accounting/accounts/:accountId', (req, res) => {
  try {
    const { accountId } = req.params;
    const account = AccountingService.getAccount(accountId);
    
    if (!account) {
      return res.status(404).json({ error: '账户不存在' });
    }

    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/accounting/accounts', (req, res) => {
  try {
    const { accountId, balance } = req.body;
    
    if (!accountId) {
      return res.status(400).json({ error: '缺少 accountId' });
    }

    const existing = AccountingService.getAccount(accountId);
    
    if (existing) {
      return res.status(409).json({ error: '账户已存在' });
    }

    db.prepare(`
      INSERT INTO accounts (account_id, balance, frozen_balance) VALUES (?, ?, 0)
    `).run(accountId, balance ? parseFloat(balance) : 0);

    res.json({ success: true, accountId, balance: balance || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/logistics/shipments', (req, res) => {
  try {
    const shipments = LogisticsService.listAllShipments();
    res.json(shipments.map(s => ({
      ...s,
      items: JSON.parse(s.items)
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/logistics/shipments/:shipmentNo', (req, res) => {
  try {
    const { shipmentNo } = req.params;
    const shipment = LogisticsService.getShipment(shipmentNo);
    
    if (!shipment) {
      return res.status(404).json({ error: '运单不存在' });
    }

    res.json({
      ...shipment,
      items: JSON.parse(shipment.items)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
