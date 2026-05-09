const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { queryAll, queryOne, runQuery } = require('../utils/db');
const { success, error, handleAsync } = require('../utils/response');

const router = express.Router();

router.get('/deliverable/:deliverableId', handleAsync(async (req, res) => {
  const { deliverableId } = req.params;
  
  const reworks = queryAll(`
    SELECT * FROM rework_records 
    WHERE deliverable_id = ? 
    ORDER BY created_at DESC
  `, [deliverableId]);
  
  res.json(success(reworks));
}));

router.post('/', handleAsync(async (req, res) => {
  const { deliverable_id, description, requirements, expected_date } = req.body;
  
  if (!deliverable_id || !description) {
    return res.status(400).json(error('交付物ID和返工描述不能为空', 400));
  }
  
  const deliverable = queryOne('SELECT * FROM deliverables WHERE id = ?', [deliverable_id]);
  if (!deliverable) {
    return res.status(404).json(error('交付物不存在', 404));
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const id = uuidv4();
  
  runQuery(
    `INSERT INTO rework_records (id, deliverable_id, description, requirements, expected_date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, deliverable_id, description, requirements || '', expected_date || null, 'pending', now, now]
  );
  
  res.json(success({ id }, '返工记录创建成功'));
}));

router.put('/:id', handleAsync(async (req, res) => {
  const { id } = req.params;
  const { description, requirements, expected_date, status, actual_date } = req.body;
  
  const existing = queryOne('SELECT * FROM rework_records WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json(error('返工记录不存在', 404));
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  runQuery(
    `UPDATE rework_records SET 
      description = COALESCE(?, description),
      requirements = COALESCE(?, requirements),
      expected_date = COALESCE(?, expected_date),
      status = COALESCE(?, status),
      actual_date = COALESCE(?, actual_date),
      updated_at = ?
     WHERE id = ?`,
    [description, requirements, expected_date, status, actual_date, now, id]
  );
  
  res.json(success(null, '返工记录更新成功'));
}));

router.post('/:id/complete', handleAsync(async (req, res) => {
  const { id } = req.params;
  
  const rework = queryOne('SELECT * FROM rework_records WHERE id = ?', [id]);
  if (!rework) {
    return res.status(404).json(error('返工记录不存在', 404));
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  runQuery(
    'UPDATE rework_records SET status = ?, actual_date = ?, updated_at = ? WHERE id = ?',
    ['completed', dayjs().format('YYYY-MM-DD'), now, id]
  );
  
  res.json(success(null, '返工已完成'));
}));

router.delete('/:id', handleAsync(async (req, res) => {
  const { id } = req.params;
  
  const existing = queryOne('SELECT * FROM rework_records WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json(error('返工记录不存在', 404));
  }
  
  runQuery('DELETE FROM rework_records WHERE id = ?', [id]);
  
  res.json(success(null, '返工记录删除成功'));
}));

module.exports = router;