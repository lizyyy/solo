const express = require('express');
const router = express.Router();
const db = require('../config/database');
const FileParserService = require('../services/FileParserService');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
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
      return res.status(400).json({ error: '请上传消耗表CSV文件' });
    }

    const consumptionData = await FileParserService.parseConsumptionCSV(req.file.path);
    const imported = [];
    const errors = [];

    for (const item of consumptionData) {
      try {
        let store = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM stores WHERE store_code = ?', [item.store_code], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (!store) {
          errors.push({ batch_no: item.batch_no, store_code: item.store_code, error: '门店不存在' });
          continue;
        }

        const batch = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM batches WHERE batch_no = ?', [item.batch_no], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (!batch) {
          errors.push({ batch_no: item.batch_no, error: '批次不存在' });
          continue;
        }

        const inventory = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM inventory WHERE batch_id = ? AND store_id = ?', [batch.id, store.id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (!inventory || inventory.quantity < item.quantity) {
          errors.push({ batch_no: item.batch_no, error: '库存不足，无法登记消耗' });
          continue;
        }

        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO consumption (store_id, batch_id, consumption_date, quantity, used_by, patient_info, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              store.id,
              batch.id,
              item.consumption_date,
              item.quantity,
              item.used_by,
              item.patient_info,
              item.notes
            ],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });

        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
             WHERE batch_id = ? AND store_id = ?`,
            [item.quantity, batch.id, store.id],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        imported.push({
          batch_no: item.batch_no,
          store_code: item.store_code,
          quantity: item.quantity
        });
      } catch (err) {
        errors.push({ batch_no: item.batch_no, error: err.message });
      }
    }

    fs.unlinkSync(req.file.path);

    res.json({
      message: '消耗表导入处理完成',
      imported_count: imported.length,
      error_count: errors.length,
      imported,
      errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { store_id, batch_id, start_date, end_date } = req.query;
    let sql = `SELECT c.*, s.store_name, b.batch_no, p.product_name
               FROM consumption c
               LEFT JOIN stores s ON c.store_id = s.id
               LEFT JOIN batches b ON c.batch_id = b.id
               LEFT JOIN products p ON b.product_id = p.id
               WHERE 1=1`;
    const params = [];

    if (store_id) {
      sql += ` AND c.store_id = ?`;
      params.push(store_id);
    }
    if (batch_id) {
      sql += ` AND c.batch_id = ?`;
      params.push(batch_id);
    }
    if (start_date) {
      sql += ` AND c.consumption_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND c.consumption_date <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY c.consumption_date DESC, c.created_at DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) throw err;
      res.json(rows);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { store_code, batch_no, consumption_date, quantity, used_by, patient_info, notes } = req.body;

    if (!store_code || !batch_no || !consumption_date || !quantity) {
      return res.status(400).json({ error: '门店编码、批号、消耗日期、数量为必填项' });
    }

    const store = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM stores WHERE store_code = ?', [store_code], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!store) {
      return res.status(404).json({ error: '门店不存在' });
    }

    const batch = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM batches WHERE batch_no = ?', [batch_no], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const inventory = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM inventory WHERE batch_id = ? AND store_id = ?', [batch.id, store.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!inventory || inventory.quantity < quantity) {
      return res.status(400).json({ error: '库存不足，无法登记消耗' });
    }

    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO consumption (store_id, batch_id, consumption_date, quantity, used_by, patient_info, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [store.id, batch.id, consumption_date, quantity, used_by, patient_info, notes],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
         WHERE batch_id = ? AND store_id = ?`,
        [quantity, batch.id, store.id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.status(201).json({
      message: '消耗登记成功',
      id: result.id,
      remaining_quantity: inventory.quantity - quantity
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { store_id, start_date, end_date } = req.query;
    let sql = `SELECT p.product_code, p.product_name, b.batch_no,
                      SUM(c.quantity) as total_consumed, s.store_name
               FROM consumption c
               LEFT JOIN batches b ON c.batch_id = b.id
               LEFT JOIN products p ON b.product_id = p.id
               LEFT JOIN stores s ON c.store_id = s.id
               WHERE 1=1`;
    const params = [];

    if (store_id) {
      sql += ` AND c.store_id = ?`;
      params.push(store_id);
    }
    if (start_date) {
      sql += ` AND c.consumption_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND c.consumption_date <= ?`;
      params.push(end_date);
    }

    sql += ` GROUP BY p.product_code, b.batch_no, c.store_id ORDER BY total_consumed DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) throw err;
      res.json(rows);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
