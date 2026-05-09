const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ApprovalService = require('../services/approvalService');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post('/submit', (req, res) => {
  try {
    const { task_id, submitter } = req.body;
    const approval = ApprovalService.submitForApproval(task_id, submitter);
    res.status(201).json(approval);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  const approvals = ApprovalService.getApprovals(req.query);
  res.json(approvals);
});

router.get('/:id', (req, res) => {
  const approval = ApprovalService.getApproval(req.params.id);
  if (!approval) return res.status(404).json({ error: '审批不存在' });
  res.json(approval);
});

router.post('/:id/approve', (req, res) => {
  try {
    const { reviewer, comment } = req.body;
    const approval = ApprovalService.approve(req.params.id, reviewer, comment);
    res.json(approval);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const { reviewer, comment } = req.body;
    const approval = ApprovalService.reject(req.params.id, reviewer, comment);
    res.json(approval);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:taskId/complete', upload.array('photos', 10), (req, res) => {
  try {
    const photos = req.files.map(f => ({
      fileName: f.originalname,
      filePath: f.path
    }));
    const uploader = req.body.uploader;
    const result = ApprovalService.completeDestruction(req.params.taskId, photos, uploader);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:taskId/photos', (req, res) => {
  const photos = ApprovalService.getTaskPhotos(req.params.taskId);
  res.json(photos);
});

module.exports = router;
