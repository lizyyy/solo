const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const evidenceService = require('../services/evidence-service');
const { generateId } = require('../utils');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${generateId()}${ext}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/upload/:orderId', upload.single('file'), (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const { orderId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }

    const evidence = evidenceService.addEvidence(orderId, {
      file_name: req.file.originalname,
      file_path: req.file.path,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      description: req.body.description
    }, operator);

    res.status(201).json({ success: true, data: evidence });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/:orderId', (req, res) => {
  try {
    const evidences = evidenceService.getEvidences(req.params.orderId);
    res.json({ success: true, data: evidences });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/file/:id', (req, res) => {
  try {
    const evidence = evidenceService.getEvidence(req.params.id);
    if (!evidence) {
      return res.status(404).json({ success: false, error: '证据不存在' });
    }
    if (!fs.existsSync(evidence.file_path)) {
      return res.status(404).json({ success: false, error: '文件已删除' });
    }
    res.download(evidence.file_path, evidence.file_name);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const result = evidenceService.deleteEvidence(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
