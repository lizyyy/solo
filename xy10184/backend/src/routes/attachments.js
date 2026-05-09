const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { createLog, logActions, logModules } = require('../utils/logger');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

router.get('/:id/download', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
  
  if (!attachment) {
    return res.status(404).json({ error: '附件不存在' });
  }
  
  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(attachment.appeal_id);
  const user = req.user;
  
  if (user.role === 'operator' && appeal.operator_id !== user.id && appeal.status === 'pending') {
    return res.status(403).json({ error: '无权限下载该附件' });
  }
  
  const filePath = path.join(uploadDir, attachment.filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }
  
  res.download(filePath, attachment.original_name, (err) => {
    if (err) {
      console.error('下载失败:', err);
      res.status(500).json({ error: '下载失败' });
    }
  });
});

router.post('/:appealId/upload', authMiddleware, (req, res) => {
  const { appealId } = req.params;
  const user = req.user;
  
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ error: '没有上传文件' });
  }
  
  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(appealId);
  
  if (!appeal) {
    return res.status(404).json({ error: '申诉不存在' });
  }
  
  if (user.role === 'operator' && appeal.operator_id !== user.id) {
    return res.status(403).json({ error: '无权限上传附件' });
  }
  
  if (['completed', 'rejected'].includes(appeal.status)) {
    return res.status(400).json({ error: '已完结的申诉不能上传附件' });
  }
  
  const uploadedFiles = [];
  const files = Array.isArray(req.files.file) ? req.files.file : [req.files.file];
  
  for (const file of files) {
    const ext = path.extname(file.name);
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(uploadDir, filename);
    
    file.mv(filePath, (err) => {
      if (err) {
        console.error('文件保存失败:', err);
        return res.status(500).json({ error: '文件保存失败' });
      }
    });
    
    const stmt = db.prepare(`
      INSERT INTO attachments (appeal_id, filename, original_name, file_path, file_size, mime_type, uploaded_by, uploaded_by_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      appealId,
      filename,
      file.name,
      filePath,
      file.size,
      file.mimetype,
      user.id,
      user.name
    );
    
    uploadedFiles.push({
      id: result.lastInsertRowid,
      original_name: file.name,
      filename,
      file_size: file.size
    });
  }
  
  createLog(req, logActions.UPLOAD_ATTACHMENT, logModules.ATTACHMENT, `申诉 ${appeal.appeal_no} 上传附件 ${uploadedFiles.length} 个`, Number(appealId));
  
  res.json({ success: true, files: uploadedFiles });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const user = req.user;
  
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
  
  if (!attachment) {
    return res.status(404).json({ error: '附件不存在' });
  }
  
  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(attachment.appeal_id);
  
  if (user.role === 'operator' && attachment.uploaded_by !== user.id) {
    return res.status(403).json({ error: '只能删除自己上传的附件' });
  }
  
  if (user.role !== 'admin' && ['completed', 'rejected'].includes(appeal.status)) {
    return res.status(400).json({ error: '已完结的申诉附件不能删除' });
  }
  
  const filePath = path.join(uploadDir, attachment.filename);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  db.prepare('DELETE FROM attachments WHERE id = ?').run(id);
  
  createLog(req, logActions.DELETE_ATTACHMENT, logModules.ATTACHMENT, `删除附件: ${attachment.original_name}`, attachment.appeal_id);
  
  res.json({ success: true });
});

module.exports = router;
