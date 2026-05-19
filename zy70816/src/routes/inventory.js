const express = require('express');
const router = express.Router();
const db = require('../config/database');
const FileParserService = require('../services/FileParserService');
const fs = require('fs');
const path = require('path');

const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});
const upload = multer({ storage });

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const inventoryData = await FileParserService.parseInventoryCSV(req.file.path);
    const imported = [];
    const errors = [];

    for (const item of inventoryData) {
      try {
        let product = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM products WHERE product_code = ?', [item.product_code], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (!product) {
          product = await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO products (product_code, product_name, category) VALUES (?, ?, ?)`,
              [item.product_code, item.product_name || '未命名', '耗材'],
              function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, product_code: item.product_code });
              }
            );
          });
        }

        let supplier = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM suppliers WHERE supplier_code = ?', [item.supplier_code || 'SUP001'], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (!supplier) {
          supplier = await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO suppliers (supplier_code, supplier_name) VALUES (?, ?)`,
              [item.supplier_code || 'SUP001', '默认供应商'],
              function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
              }
            );
          });
        }

        let store = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM stores WHERE store_code = ?', [item.store_code || 'STORE001'], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (!store) {
          store = await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO stores (store_code, store_name) VALUES (?, ?)`,
              [item.store_code || 'STORE001', '默认门店'],
              function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
              }
            );
          });
        }

        let batch = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM batches WHERE batch_no = ?', [item.batch_no], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (!batch) {
          batch = await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO batches (batch_no, product_id, supplier_id, production_date, expiry_date, quantity, status)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [item.batch_no, product.id || product, supplier.id || supplier, item.production_date, item.expiry_date, item.quantity, 'pending'],
              function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
              }
            );
          });
        }

        const inventory = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM inventory WHERE batch_id = ? AND store_id = ?', [batch.id, store.id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (inventory) {
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE inventory SET quantity = quantity + ?, warehouse_location = ?, updated_at = CURRENT_TIMESTAMP
               WHERE batch_id = ? AND store_id = ?`,
              [item.quantity, item.warehouse_location, batch.id, store.id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        } else {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO inventory (batch_id, store_id, quantity, warehouse_location)
               VALUES (?, ?, ?, ?)`,
              [batch.id, store.id, item.quantity, item.warehouse_location],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }

        imported.push(item.batch_no);
      } catch (err) {
        errors.push({ batch_no: item.batch_no, error: err.message });
      }
    }

    fs.unlinkSync(req.file.path);

    res.json({
      message: '文件上传处理完成',
      imported_count: imported.length,
      error_count: errors.length,
      imported_batches: imported,
      errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { store_id } = req.query;
    let sql = `SELECT i.*, b.batch_no, p.product_code, p.product_name,
                       s.store_name, b.expiry_date, b.status, b.is_frozen
                FROM inventory i
                LEFT JOIN batches b ON i.batch_id = b.id
                LEFT JOIN products p ON b.product_id = p.id
                LEFT JOIN stores s ON i.store_id = s.id
                WHERE 1=1`;
    const params = [];

    if (store_id) {
      sql += ` AND i.store_id = ?`;
      params.push(store_id);
    }

    sql += ` ORDER BY s.store_name, b.expiry_date ASC`;

    db.all(sql, params, (err, rows) => {
      if (err) throw err;
      res.json(rows);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
