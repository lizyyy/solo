const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery } = require('../db/database');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/packages', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const results = [];
    const errors = [];
    let successCount = 0;

    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);

    bufferStream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        for (let i = 0; i < results.length; i++) {
          const row = results[i];
          try {
            const existing = await getQuery(
              'SELECT * FROM packages WHERE tracking_number = ?',
              [row.tracking_number]
            );

            if (existing) {
              errors.push({ row: i + 2, tracking_number: row.tracking_number, error: '运单号已存在' });
              continue;
            }

            const packageId = uuidv4();
            await runQuery(
              `INSERT INTO packages (id, tracking_number, sender_name, sender_country, receiver_name, receiver_address, weight, declared_value, currency, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
              [
                packageId,
                row.tracking_number,
                row.sender_name || '',
                row.sender_country || '',
                row.receiver_name || '',
                row.receiver_address || '',
                parseFloat(row.weight) || 0,
                parseFloat(row.declared_value) || 0,
                row.currency || 'USD'
              ]
            );

            if (row.product_name) {
              await runQuery(
                `INSERT INTO declaration_items (id, package_id, product_name, quantity, unit_price, total_value, category)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  uuidv4(),
                  packageId,
                  row.product_name,
                  parseInt(row.quantity) || 1,
                  parseFloat(row.unit_price) || 0,
                  parseFloat(row.total_value) || parseFloat(row.declared_value) || 0,
                  row.category || 'general'
                ]
              );
            }

            successCount++;
          } catch (err) {
            errors.push({ row: i + 2, tracking_number: row.tracking_number, error: err.message });
          }
        }

        res.json({
          success: true,
          total: results.length,
          imported: successCount,
          failed: errors.length,
          errors
        });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
