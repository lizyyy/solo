const express = require('express');
const { all, get, run } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const activities = await all('SELECT * FROM flash_sale_activities ORDER BY created_at DESC');
    res.json({ success: true, data: activities });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.get('/:id/products', async (req, res) => {
  try {
    const products = await all('SELECT * FROM flash_sale_products WHERE activity_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json({ success: true, data: products });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, start_time, end_time } = req.body;
    const id = uuidv4();
    
    await run(`
      INSERT INTO flash_sale_activities (id, name, start_time, end_time, status)
      VALUES (?, ?, ?, ?, 'pending')
    `, [id, name, start_time, end_time]);

    res.json({ success: true, id });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/:id/products', async (req, res) => {
  try {
    const { name, sku, original_price, flash_price, total_stock } = req.body;
    const id = uuidv4();
    
    await run(`
      INSERT INTO flash_sale_products (id, activity_id, name, sku, original_price, flash_price, total_stock, available_stock, locked_stock, sold_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `, [id, req.params.id, name, sku, original_price, flash_price, total_stock, total_stock]);

    res.json({ success: true, id });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;
