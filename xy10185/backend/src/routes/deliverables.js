const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { queryAll, queryOne, runQuery, db } = require('../utils/db');
const { success, error, handleAsync } = require('../utils/response');

const router = express.Router();

const uploadsDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ storage });

router.get('/milestone/:milestoneId', handleAsync(async (req, res) => {
  const { milestoneId } = req.params;
  
  const milestone = queryOne('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
  if (!milestone) {
    return res.status(404).json(error('里程碑不存在', 404));
  }
  
  const deliverables = queryAll(`
    SELECT * FROM deliverables 
    WHERE milestone_id = ? 
    ORDER BY created_at DESC
  `, [milestoneId]);
  
  const deliverablesWithDetails = deliverables.map(d => {
    const acceptanceRecords = queryAll(`
      SELECT * FROM acceptance_records 
      WHERE deliverable_id = ? 
      ORDER BY created_at DESC
    `, [d.id]);
    
    const reworkRecords = queryAll(`
      SELECT * FROM rework_records 
      WHERE deliverable_id = ? 
      ORDER BY created_at DESC
    `, [d.id]);
    
    return {
      ...d,
      acceptance_records: acceptanceRecords,
      rework_records: reworkRecords
    };
  });
  
  res.json(success(deliverablesWithDetails));
}));

router.get('/:id', handleAsync(async (req, res) => {
  const { id } = req.params;
  
  const deliverable = queryOne('SELECT * FROM deliverables WHERE id = ?', [id]);
  if (!deliverable) {
    return res.status(404).json(error('交付物不存在', 404));
  }
  
  const acceptanceRecords = queryAll(`
    SELECT * FROM acceptance_records 
    WHERE deliverable_id = ? 
    ORDER BY created_at DESC
  `, [id]);
  
  const reworkRecords = queryAll(`
    SELECT * FROM rework_records 
    WHERE deliverable_id = ? 
    ORDER BY created_at DESC
  `, [id]);
  
  res.json(success({
    ...deliverable,
    acceptance_records: acceptanceRecords,
    rework_records: reworkRecords
  }));
}));

router.post('/', upload.single('file'), handleAsync(async (req, res) => {
  const { milestone_id, name, description, version, uploader } = req.body;
  const file = req.file;
  
  if (!milestone_id || !name || !version) {
    return res.status(400).json(error('里程碑ID、交付物名称和版本不能为空', 400));
  }
  
  const milestone = queryOne('SELECT * FROM milestones WHERE id = ?', [milestone_id]);
  if (!milestone) {
    return res.status(404).json(error('里程碑不存在', 404));
  }
  
  const existingSameVersion = queryOne(
    'SELECT * FROM deliverables WHERE milestone_id = ? AND name = ? AND version = ?',
    [milestone_id, name, version]
  );
  if (existingSameVersion) {
    return res.status(400).json(error('该里程碑下已存在同名同版本的交付物', 400));
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const id = uuidv4();
  
  runQuery(
    `INSERT INTO deliverables (id, milestone_id, name, description, version, file_name, file_path, file_size, uploader, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, 
      milestone_id, 
      name, 
      description || '', 
      version, 
      file ? file.originalname : null, 
      file ? file.filename : null, 
      file ? file.size : null, 
      uploader || '', 
      'submitted', 
      now, 
      now
    ]
  );
  
  res.json(success({ id }, '交付物提交成功'));
}));

router.put('/:id', handleAsync(async (req, res) => {
  const { id } = req.params;
  const { name, description, version } = req.body;
  
  const existing = queryOne('SELECT * FROM deliverables WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json(error('交付物不存在', 404));
  }
  
  if (existing.status !== 'submitted' && existing.status !== 'rejected') {
    return res.status(400).json(error('只能编辑已提交或被驳回的交付物', 400));
  }
  
  if (version && version !== existing.version) {
    const sameVersion = queryOne(
      'SELECT * FROM deliverables WHERE milestone_id = ? AND name = ? AND version = ? AND id != ?',
      [existing.milestone_id, name || existing.name, version, id]
    );
    if (sameVersion) {
      return res.status(400).json(error('该里程碑下已存在同名同版本的交付物', 400));
    }
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  runQuery(
    `UPDATE deliverables SET 
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      version = COALESCE(?, version),
      updated_at = ?
     WHERE id = ?`,
    [name, description, version, now, id]
  );
  
  res.json(success(null, '交付物更新成功'));
}));

router.delete('/:id', handleAsync(async (req, res) => {
  const { id } = req.params;
  
  const existing = queryOne('SELECT * FROM deliverables WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json(error('交付物不存在', 404));
  }
  
  if (existing.file_path) {
    const filePath = path.join(uploadsDir, existing.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  
  runQuery('DELETE FROM deliverables WHERE id = ?', [id]);
  
  res.json(success(null, '交付物删除成功'));
}));

router.get('/:id/download', handleAsync(async (req, res) => {
  const { id } = req.params;
  
  const deliverable = queryOne('SELECT * FROM deliverables WHERE id = ?', [id]);
  if (!deliverable) {
    return res.status(404).json(error('交付物不存在', 404));
  }
  
  if (!deliverable.file_path) {
    return res.status(400).json(error('该交付物没有文件附件', 400));
  }
  
  const filePath = path.join(uploadsDir, deliverable.file_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json(error('文件不存在', 404));
  }
  
  res.download(filePath, deliverable.file_name || deliverable.file_path);
}));

router.post('/:id/accept', handleAsync(async (req, res) => {
  const { id } = req.params;
  const { opinion, reviewer } = req.body;
  
  const deliverable = queryOne('SELECT * FROM deliverables WHERE id = ?', [id]);
  if (!deliverable) {
    return res.status(404).json(error('交付物不存在', 404));
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  const recordId = uuidv4();
  runQuery(
    `INSERT INTO acceptance_records (id, deliverable_id, result, opinion, reviewer, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [recordId, id, 'accepted', opinion || '', reviewer || '', now]
  );
  
  runQuery(
    'UPDATE deliverables SET status = ?, updated_at = ? WHERE id = ?',
    ['accepted', now, id]
  );
  
  res.json(success(null, '验收通过'));
}));

router.post('/:id/reject', handleAsync(async (req, res) => {
  const { id } = req.params;
  const { opinion, reviewer, rework_description, rework_requirements, rework_expected_date } = req.body;
  
  const deliverable = queryOne('SELECT * FROM deliverables WHERE id = ?', [id]);
  if (!deliverable) {
    return res.status(404).json(error('交付物不存在', 404));
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  const recordId = uuidv4();
  runQuery(
    `INSERT INTO acceptance_records (id, deliverable_id, result, opinion, reviewer, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [recordId, id, 'rejected', opinion || '', reviewer || '', now]
  );
  
  runQuery(
    'UPDATE deliverables SET status = ?, updated_at = ? WHERE id = ?',
    ['rejected', now, id]
  );
  
  if (rework_description) {
    const reworkId = uuidv4();
    runQuery(
      `INSERT INTO rework_records (id, deliverable_id, description, requirements, expected_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [reworkId, id, rework_description, rework_requirements || '', rework_expected_date || null, 'pending', now, now]
    );
  }
  
  res.json(success(null, '验收驳回，已创建返工记录'));
}));

module.exports = router;