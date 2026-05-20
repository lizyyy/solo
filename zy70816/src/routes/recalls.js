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
      return res.status(400).json({ error: '请上传Markdown文件' });
    }

    const recallData = await FileParserService.parseRecallMarkdown(req.file.path);

    const existing = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM recalls WHERE recall_no = ?', [recallData.recall_no], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existing) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '该召回公告编号已存在' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO recalls (recall_no, title, content, batch_nos, reason, level, published_date, publisher)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recallData.recall_no,
          recallData.title,
          recallData.content,
          recallData.batch_nos,
          recallData.reason,
          recallData.level,
          recallData.published_date,
          recallData.publisher
        ],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    if (recallData.batch_nos) {
      const batchNos = recallData.batch_nos.split(',');
      for (const batchNo of batchNos) {
        const batch = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM batches WHERE batch_no = ?', [batchNo.trim()], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (batch) {
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE batches SET status = 'recalled', is_frozen = 1, frozen_reason = ?, frozen_by = ?, frozen_at = CURRENT_TIMESTAMP
               WHERE batch_no = ?`,
              [recallData.reason, recallData.publisher, batchNo.trim()],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });

          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO approvals (batch_id, action, status, reason, handler, notes, previous_status)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                batch.id,
                '系统自动召回',
                'recalled',
                recallData.reason,
                recallData.publisher,
                `关联召回公告: ${recallData.recall_no}`,
                batch.status
              ],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
      }
    }

    fs.unlinkSync(req.file.path);

    res.json({
      message: '召回公告导入成功，涉及批次已自动冻结',
      recall_no: recallData.recall_no,
      title: recallData.title,
      affected_batches: recallData.batch_nos ? recallData.batch_nos.split(',') : []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT * FROM recalls`;
    const params = [];

    if (status) {
      sql += ` WHERE status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) throw err;
      res.json(rows);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/affected-batches', async (req, res) => {
  try {
    const Recall = require('../models/Recall');
    const affected = await Recall.getAffectedBatches();
    res.json({ count: affected.length, batches: affected });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:recall_no', async (req, res) => {
  try {
    const recall = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM recalls WHERE recall_no = ?', [req.params.recall_no], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!recall) {
      return res.status(404).json({ error: '召回公告不存在' });
    }

    res.json(recall);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:recall_no/resolve', async (req, res) => {
  try {
    const { resolved_by, notes } = req.body;

    const recall = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM recalls WHERE recall_no = ?', [req.params.recall_no], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!recall) {
      return res.status(404).json({ error: '召回公告不存在' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE recalls SET status = 'resolved' WHERE recall_no = ?`,
        [req.params.recall_no],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: '召回公告已标记为已处理', recall_no: req.params.recall_no });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
