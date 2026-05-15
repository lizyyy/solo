const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const db = require('../utils/db');

const uploadsDir = path.join(__dirname, '../../data/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传CSV文件'));
    }
  }
});

router.post('/articles', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '请选择文件' });
  }

  const operator = req.body.operator || 'system';
  const importId = null;
  
  try {
    const insertResult = await db.run(
      `INSERT INTO import_history (file_name, operator, status) VALUES (?, ?, 'processing')`,
      [req.file.originalname, operator]
    );
    const importHistoryId = insertResult.lastID;

    const results = [];
    const errors = [];
    let successCount = 0;
    let failCount = 0;

    fs.createReadStream(req.file.path)
      .pipe(csv({ encoding: 'utf-8' }))
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        for (let i = 0; i < results.length; i++) {
          try {
            const row = results[i];
            if (!row.title) {
              errors.push(`行 ${i + 2}: 标题不能为空`);
              failCount++;
              continue;
            }

            const articleResult = await db.run(
              `INSERT INTO articles (title, content, category, author, status) VALUES (?, ?, ?, ?, ?)`,
              [
                row.title,
                row.content || '',
                row.category || '技术文档',
                row.author || operator,
                row.status || 'draft'
              ]
            );

            await db.run(
              `INSERT INTO article_versions (article_id, version_number, title, content, author, change_log) VALUES (?, 1, ?, ?, ?, '批量导入创建')`,
              [articleResult.lastID, row.title, row.content || '', row.author || operator]
            );

            successCount++;
          } catch (rowError) {
            failCount++;
            errors.push(`行 ${i + 2}: ${rowError.message}`);
          }
        }

        await db.run(
          `UPDATE import_history SET total_count = ?, success_count = ?, fail_count = ?, error_details = ?, status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [results.length, successCount, failCount, JSON.stringify(errors), errors.length > 0 ? 'partial' : 'success', importHistoryId]
        );

        fs.unlink(req.file.path, () => {});

        res.json({ 
          success: true, 
          data: { 
            importId: importHistoryId,
            total: results.length, 
            success: successCount, 
            fail: failCount, 
            errors: errors 
          } 
        });
      });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    const history = await db.query(
      `SELECT * FROM import_history ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [parseInt(pageSize), offset]
    );

    const countResult = await db.get(`SELECT COUNT(*) as total FROM import_history`);

    res.json({
      success: true,
      data: history,
      total: countResult.total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/history/:id', async (req, res) => {
  try {
    const record = await db.get(`SELECT * FROM import_history WHERE id = ?`, [req.params.id]);
    if (!record) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    if (record.error_details) {
      record.error_details = JSON.parse(record.error_details);
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/template', (req, res) => {
  const csvContent = 'title,content,category,author,status\n如何使用API,API详细使用说明...\n产品更新日志,新版本功能介绍...,产品说明,产品经理,approved\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=文章导入模板.csv');
  res.send('\uFEFF' + csvContent);
});

module.exports = router;
