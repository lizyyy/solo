const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const importService = require('../services/importService');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/service-orders', upload.single('file'), async (req, res) => {
  try {
    const { batch_id, created_by } = req.body;
    if (!batch_id || !created_by) {
      return res.status(400).json({ error: '批次ID和创建人不能为空' });
    }
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }
    const result = await importService.importServiceOrdersCsv(req.file.path, batch_id, created_by);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/nurse-calendar', (req, res) => {
  try {
    const { data, created_by } = req.body;
    if (!data || !created_by) {
      return res.status(400).json({ error: '数据和创建人不能为空' });
    }
    const result = importService.importNurseCalendarJson(data, created_by);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/elderly-profiles', (req, res) => {
  try {
    const { data, created_by } = req.body;
    if (!data || !created_by) {
      return res.status(400).json({ error: '数据和创建人不能为空' });
    }
    const result = importService.importElderlyProfiles(data, created_by);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
