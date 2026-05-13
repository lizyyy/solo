const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const { status, tracking_number, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM packages WHERE 1=1';
    let params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (tracking_number) {
      sql += ' AND tracking_number LIKE ?';
      params.push(`%${tracking_number}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const packages = await allQuery(sql, params);

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total').split(' ORDER BY ')[0].split(' LIMIT ')[0];
    const countResult = await getQuery(countSql, params.slice(0, params.length - 2));

    res.json({
      data: packages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pkg = await getQuery('SELECT * FROM packages WHERE id = ?', [req.params.id]);
    if (!pkg) {
      return res.status(404).json({ error: '包裹不存在' });
    }

    const declarationItems = await allQuery(
      'SELECT * FROM declaration_items WHERE package_id = ?',
      [req.params.id]
    );
    const taxCalculations = await allQuery(
      'SELECT * FROM tax_calculations WHERE package_id = ?',
      [req.params.id]
    );
    const customsCallbacks = await allQuery(
      'SELECT * FROM customs_callbacks WHERE package_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    const supplementTickets = await allQuery(
      'SELECT * FROM supplement_tickets WHERE package_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    const reSubmissions = await allQuery(
      'SELECT * FROM re_submissions WHERE package_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    const operationLogs = await allQuery(
      'SELECT * FROM operation_logs WHERE package_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({
      ...pkg,
      declarationItems,
      taxCalculations,
      customsCallbacks,
      supplementTickets,
      reSubmissions,
      operationLogs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      tracking_number,
      sender_name,
      sender_country,
      receiver_name,
      receiver_address,
      weight,
      declared_value,
      currency,
      declaration_items
    } = req.body;

    const packageId = uuidv4();
    
    await runQuery(
      `INSERT INTO packages (id, tracking_number, sender_name, sender_country, receiver_name, receiver_address, weight, declared_value, currency, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [packageId, tracking_number, sender_name, sender_country, receiver_name, receiver_address, weight, declared_value, currency || 'USD']
    );

    if (declaration_items && declaration_items.length > 0) {
      for (const item of declaration_items) {
        await runQuery(
          `INSERT INTO declaration_items (id, package_id, hs_code, product_name, quantity, unit_price, total_value, category)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), packageId, item.hs_code, item.product_name, item.quantity, item.unit_price, item.total_value, item.category]
        );
      }
    }

    await runQuery(
      `INSERT INTO operation_logs (id, package_id, operation_type, operator, details)
       VALUES (?, ?, 'create_package', ?, ?)`,
      [uuidv4(), packageId, req.body.operator || 'system', JSON.stringify({ tracking_number })]
    );

    const newPackage = await getQuery('SELECT * FROM packages WHERE id = ?', [packageId]);
    res.status(201).json(newPackage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status, operator, reason } = req.body;
    const pkg = await getQuery('SELECT * FROM packages WHERE id = ?', [req.params.id]);
    
    if (!pkg) {
      return res.status(404).json({ error: '包裹不存在' });
    }

    await runQuery(
      'UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.params.id]
    );

    await runQuery(
      `INSERT INTO operation_logs (id, package_id, operation_type, operator, details)
       VALUES (?, ?, 'status_change', ?, ?)`,
      [uuidv4(), req.params.id, operator || 'system', JSON.stringify({ old_status: pkg.status, new_status: status, reason })]
    );

    const updatedPackage = await getQuery('SELECT * FROM packages WHERE id = ?', [req.params.id]);
    res.json(updatedPackage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
