const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { run, get, all } = require('../database');

const storage = multer.memoryStorage();
const upload = multer({ storage });

function checkNearExpiry(expiryDate) {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  return diffDays <= 7 && diffDays > 0;
}

router.post('/inventory/:batchId', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please upload CSV file' });
  const batchId = req.params.batchId;
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const records = [];
    const nearExpiryItems = [];
    const stream = Readable.from(req.file.buffer.toString());
    stream.pipe(csv()).on('data', (row) => {
      const skuCode = row.sku_code || row.skuCode || row['SKU编码'] || '';
      const skuName = row.sku_name || row.skuName || row['SKU名称'] || '';
      const quantity = parseInt(row.quantity || row['数量']) || 0;
      const unitPrice = parseFloat(row.unit_price || row['单价']) || 0;
      const expiryDate = row.expiry_date || row['过期日期'] || null;
      const inventoryPerson = row.inventory_person || row['盘点人'] || null;
      const isNearExpiry = checkNearExpiry(expiryDate);
      if (isNearExpiry) nearExpiryItems.push({ sku_code: skuCode, sku_name: skuName, expiry_date: expiryDate });
      records.push({ batch_id: batchId, sku_code: skuCode, sku_name: skuName, quantity, unit_price: unitPrice, expiry_date: expiryDate, is_near_expiry: isNearExpiry ? 1 : 0, inventory_person: inventoryPerson });
    }).on('end', async () => {
      for (const rec of records) await run('INSERT INTO inventory_records (batch_id, sku_code, sku_name, quantity, unit_price, expiry_date, is_near_expiry, inventory_person) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [rec.batch_id, rec.sku_code, rec.sku_name, rec.quantity, rec.unit_price, rec.expiry_date, rec.is_near_expiry, rec.inventory_person]);
      res.json({ batch_id: batchId, imported: records.length, near_expiry_count: nearExpiryItems.length, near_expiry_items: nearExpiryItems.slice(0, 10) });
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sales/:batchId', async (req, res) => {
  const batchId = req.params.batchId;
  const salesData = req.body;
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const records = Array.isArray(salesData) ? salesData : (salesData.records || []);
    for (const record of records) {
      await run('INSERT INTO sales_records (batch_id, sku_code, sku_name, quantity, amount, sale_time) VALUES (?, ?, ?, ?, ?, ?)', [batchId, record.sku_code || record.skuCode || '', record.sku_name || record.skuName || '', record.quantity || 0, record.amount || record.total || 0, record.sale_time || record.saleTime || null]);
    }
    res.json({ batch_id: batchId, imported: records.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/replenishment/:batchId', async (req, res) => {
  const batchId = req.params.batchId;
  const data = req.body;
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const records = Array.isArray(data) ? data : (data.records || []);
    const differences = [];
    const nearExpiryItems = [];
    for (const record of records) {
      const expectedQty = record.expected_qty || record.expectedQty || 0;
      const actualQty = record.actual_qty || record.actualQty || 0;
      const diff = actualQty - expectedQty;
      let differenceType = 'normal';
      if (diff > 0) { differenceType = 'over'; differences.push({ type: 'over', sku: record.sku_code, diff, expected: expectedQty, actual: actualQty }); }
      else if (diff < 0) { differenceType = 'under'; differences.push({ type: 'under', sku: record.sku_code, diff, expected: expectedQty, actual: actualQty }); }
      const isNearExpiry = checkNearExpiry(record.expiry_date);
      if (isNearExpiry) nearExpiryItems.push({ sku_code: record.sku_code, expiry_date: record.expiry_date });
      await run('INSERT INTO replenishment_records (batch_id, sku_code, sku_name, expected_qty, actual_qty, difference_type, unit_price, expiry_date, is_near_expiry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [batchId, record.sku_code || '', record.sku_name || '', expectedQty, actualQty, differenceType, record.unit_price || 0, record.expiry_date || null, isNearExpiry ? 1 : 0]);
    }
    res.json({ batch_id: batchId, imported: records.length, over_count: differences.filter(d => d.type === 'over').length, under_count: differences.filter(d => d.type === 'under').length, differences: differences.slice(0, 20), near_expiry_count: nearExpiryItems.length, near_expiry_items: nearExpiryItems });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
            if (isNearExpiry) {
              nearExpiryItems.push({ sku_code: finalSkuCode, sku_name: finalSkuName, expiry_date: expiryDate });
            }

            insertPromises.push(run(
              `INSERT INTO inventory_records 
               (batch_id, sku_code, sku_name, quantity, unit_price, expiry_date, is_near_expiry, inventory_person)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [batchId, finalSkuCode, finalSkuName, quantity, unitPrice, expiryDate, isNearExpiry ? 1 : 0, inventoryPerson]
            ));
          }

          await Promise.all(insertPromises);
          
          for (const alias of aliasDetections) {
            aliasPromises.push(run(
              `INSERT INTO sku_alias_detections (batch_id, detected_alias, mapped_sku, record_type)
               VALUES (?, ?, ?, ?)`,
              [alias.batch_id, alias.detected_alias, alias.mapped_sku, alias.record_type]
            ));
          }
          await Promise.all(aliasPromises);

          res.json({
            batch_id: batchId,
            imported: records.length,
            near_expiry_count: nearExpiryItems.length,
            near_expiry_items: nearExpiryItems.slice(0, 10),
            alias_detections: aliasDetections
          });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sales/:batchId', async (req, res) => {
  const batchId = req.params.batchId;
  const salesData = req.body;

  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const records = Array.isArray(salesData) ? salesData : (salesData.records || []);
    const insertPromises = [];

    for (const record of records) {
      insertPromises.push(run(
        `INSERT INTO sales_records (batch_id, sku_code, sku_name, quantity, amount, sale_time)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          batchId,
          record.sku_code || record.skuCode || '',
          record.sku_name || record.skuName || '',
          record.quantity || 0,
          record.amount || record.total || 0,
          record.sale_time || record.saleTime || null
        ]
      ));
    }

    await Promise.all(insertPromises);

    res.json({
      batch_id: batchId,
      imported: records.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/replenishment/:batchId', async (req, res) => {
  const batchId = req.params.batchId;
  const replenishmentData = req.body;

  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const records = Array.isArray(replenishmentData) ? replenishmentData : (replenishmentData.records || []);
    const differences = [];
    const nearExpiryItems = [];
    const aliasDetections = [];
    const insertPromises = [];
    const aliasPromises = [];

    for (const record of records) {
      const expectedQty = record.expected_qty || record.expectedQty || 0;
      const actualQty = record.actual_qty || record.actualQty || 0;
      const diff = actualQty - expectedQty;
      let differenceType = 'normal';
      
      if (diff > 0) {
        differenceType = 'over';
        differences.push({ type: 'over', sku: record.sku_code, diff, expected: expectedQty, actual: actualQty });
      } else if (diff < 0) {
        differenceType = 'under';
        differences.push({ type: 'under', sku: record.sku_code, diff, expected: expectedQty, actual: actualQty });
      }

      const isNearExpiry = checkNearExpiry(record.expiry_date);
      if (isNearExpiry) {
        nearExpiryItems.push({ sku_code: record.sku_code, expiry_date: record.expiry_date });
      }

      let finalSkuCode = record.sku_code || '';
      let finalSkuName = record.sku_name || '';
      
      if (!record.sku_code && record.sku_name) {
        const normalized = await normalizeSKU(record.sku_name);
        if (normalized) {
          finalSkuCode = normalized.sku_code;
          finalSkuName = normalized.sku_name;
          aliasDetections.push({
            batch_id: batchId,
            detected_alias: normalized.alias,
            mapped_sku: normalized.sku_code,
            record_type: 'replenishment'
          });
        }
      }

      insertPromises.push(run(
        `INSERT INTO replenishment_records 
         (batch_id, sku_code, sku_name, expected_qty, actual_qty, difference_type, unit_price, expiry_date, is_near_expiry)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [batchId, finalSkuCode, finalSkuName, expectedQty, actualQty, differenceType, 
         record.unit_price || 0, record.expiry_date || null, isNearExpiry ? 1 : 0]
      ));
    }

    await Promise.all(insertPromises);
    
    for (const alias of aliasDetections) {
      aliasPromises.push(run(
        `INSERT INTO sku_alias_detections (batch_id, detected_alias, mapped_sku, record_type)
         VALUES (?, ?, ?, ?)`,
        [alias.batch_id, alias.detected_alias, alias.mapped_sku, alias.record_type]
      ));
    }
    await Promise.all(aliasPromises);

    res.json({
      batch_id: batchId,
      imported: records.length,
      over_count: differences.filter(d => d.type === 'over').length,
      under_count: differences.filter(d => d.type === 'under').length,
      differences: differences.slice(0, 20),
      near_expiry_count: nearExpiryItems.length,
      near_expiry_items: nearExpiryItems,
      alias_detections: aliasDetections
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
        expiry_date: expiryDate,
        is_near_expiry: isNearExpiry ? 1 : 0,
        inventory_person: inventoryPerson
      });
    })
    .on('end', () => {
      const insertStmt = db.prepare(`
        INSERT INTO inventory_records 
        (batch_id, sku_code, sku_name, quantity, unit_price, expiry_date, is_near_expiry, inventory_person)
        VALUES (@batch_id, @sku_code, @sku_name, @quantity, @unit_price, @expiry_date, @is_near_expiry, @inventory_person)
      `);

      const insertMany = db.transaction((recs) => {
        for (const rec of recs) insertStmt.run(rec);
      });

      insertMany(records);

      if (aliasDetections.length > 0) {
        const aliasStmt = db.prepare(`
          INSERT INTO sku_alias_detections (batch_id, detected_alias, mapped_sku, record_type)
          VALUES (@batch_id, @detected_alias, @mapped_sku, @record_type)
        `);
        db.transaction((aliases) => {
          for (const a of aliases) aliasStmt.run(a);
        })(aliasDetections);
      }

      res.json({
        batch_id: batchId,
        imported: records.length,
        near_expiry_count: nearExpiryItems.length,
        near_expiry_items: nearExpiryItems.slice(0, 10),
        alias_detections: aliasDetections
      });
    });
});

router.post('/sales/:batchId', (req, res) => {
  const batchId = req.params.batchId;
  const salesData = req.body;

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const records = Array.isArray(salesData) ? salesData : (salesData.records || []);
  const inserted = [];

  const insertStmt = db.prepare(`
    INSERT INTO sales_records (batch_id, sku_code, sku_name, quantity, amount, sale_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const record of records) {
      const result = insertStmt.run(
        batchId,
        record.sku_code || record.skuCode || '',
        record.sku_name || record.skuName || '',
        record.quantity || 0,
        record.amount || record.total || 0,
        record.sale_time || record.saleTime || null
      );
      inserted.push({ id: result.lastInsertRowid, ...record });
    }
  })();

  res.json({
    batch_id: batchId,
    imported: inserted.length
  });
});

router.post('/replenishment/:batchId', (req, res) => {
  const batchId = req.params.batchId;
  const replenishmentData = req.body;

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const records = Array.isArray(replenishmentData) ? replenishmentData : (replenishmentData.records || []);
  const differences = [];
  const nearExpiryItems = [];
  const aliasDetections = [];

  const insertStmt = db.prepare(`
    INSERT INTO replenishment_records 
    (batch_id, sku_code, sku_name, expected_qty, actual_qty, difference_type, unit_price, expiry_date, is_near_expiry)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const record of records) {
      const expectedQty = record.expected_qty || record.expectedQty || 0;
      const actualQty = record.actual_qty || record.actualQty || 0;
      const diff = actualQty - expectedQty;
      let differenceType = 'normal';
      
      if (diff > 0) {
        differenceType = 'over';
        differences.push({ type: 'over', sku: record.sku_code, diff, expected: expectedQty, actual: actualQty });
      } else if (diff < 0) {
        differenceType = 'under';
        differences.push({ type: 'under', sku: record.sku_code, diff, expected: expectedQty, actual: actualQty });
      }

      const isNearExpiry = checkNearExpiry(record.expiry_date);
      if (isNearExpiry) {
        nearExpiryItems.push({ sku_code: record.sku_code, expiry_date: record.expiry_date });
      }

      let finalSkuCode = record.sku_code || '';
      let finalSkuName = record.sku_name || '';
      
      if (!record.sku_code && record.sku_name) {
        const normalized = normalizeSKU(record.sku_name);
        if (normalized) {
          finalSkuCode = normalized.sku_code;
          finalSkuName = normalized.sku_name;
          aliasDetections.push({
            batch_id: batchId,
            detected_alias: normalized.alias,
            mapped_sku: normalized.sku_code,
            record_type: 'replenishment'
          });
        }
      }

      insertStmt.run(
        batchId,
        finalSkuCode,
        finalSkuName,
        expectedQty,
        actualQty,
        differenceType,
        record.unit_price || 0,
        record.expiry_date || null,
        isNearExpiry ? 1 : 0
      );
    }
  })();

  res.json({
    batch_id: batchId,
    imported: records.length,
    over_count: differences.filter(d => d.type === 'over').length,
    under_count: differences.filter(d => d.type === 'under').length,
    differences: differences.slice(0, 20),
    near_expiry_count: nearExpiryItems.length,
    near_expiry_items: nearExpiryItems,
    alias_detections: aliasDetections
  });
});

module.exports = router;
