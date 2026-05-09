const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { queryAll, queryOne, runQuery, db } = require('../utils/db');
const { success, error, handleAsync } = require('../utils/response');

const router = express.Router();

router.get('/project/:projectId', handleAsync(async (req, res) => {
  const { projectId } = req.params;
  
  const project = queryOne('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) {
    return res.status(404).json(error('项目不存在', 404));
  }
  
  const milestones = queryAll(`
    SELECT * FROM milestones 
    WHERE project_id = ? 
    ORDER BY sequence ASC
  `, [projectId]);
  
  const milestonesWithDetails = milestones.map(ms => {
    const deliverables = queryAll(`
      SELECT d.* FROM deliverables d 
      WHERE d.milestone_id = ? 
      ORDER BY d.created_at DESC
    `, [ms.id]);
    
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
    
    return {
      ...ms,
      deliverables: deliverablesWithDetails
    };
  });
  
  res.json(success(milestonesWithDetails));
}));

router.post('/', handleAsync(async (req, res) => {
  const { project_id, name, description, sequence, planned_date, payment_percentage, payment_amount } = req.body;
  
  if (!project_id || !name) {
    return res.status(400).json(error('项目ID和里程碑名称不能为空', 400));
  }
  
  const project = queryOne('SELECT * FROM projects WHERE id = ?', [project_id]);
  if (!project) {
    return res.status(404).json(error('项目不存在', 404));
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const id = uuidv4();
  const seq = sequence || queryOne('SELECT COALESCE(MAX(sequence), 0) + 1 as next_seq FROM milestones WHERE project_id = ?', [project_id]).next_seq;
  
  runQuery(
    `INSERT INTO milestones (id, project_id, name, description, sequence, planned_date, status, payment_percentage, payment_amount, payment_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, project_id, name, description || '', seq, planned_date || null, 'pending', payment_percentage || 0, payment_amount || 0, 'unpaid', now, now]
  );
  
  res.json(success({ id }, '里程碑创建成功'));
}));

router.put('/:id', handleAsync(async (req, res) => {
  const { id } = req.params;
  const { name, description, sequence, planned_date, actual_date, status, payment_percentage, payment_amount, payment_status } = req.body;
  
  const existing = queryOne('SELECT * FROM milestones WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json(error('里程碑不存在', 404));
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  runQuery(
    `UPDATE milestones SET 
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      sequence = COALESCE(?, sequence),
      planned_date = COALESCE(?, planned_date),
      actual_date = COALESCE(?, actual_date),
      status = COALESCE(?, status),
      payment_percentage = COALESCE(?, payment_percentage),
      payment_amount = COALESCE(?, payment_amount),
      payment_status = COALESCE(?, payment_status),
      updated_at = ?
     WHERE id = ?`,
    [name, description, sequence, planned_date, actual_date, status, payment_percentage, payment_amount, payment_status, now, id]
  );
  
  res.json(success(null, '里程碑更新成功'));
}));

router.delete('/:id', handleAsync(async (req, res) => {
  const { id } = req.params;
  
  const existing = queryOne('SELECT * FROM milestones WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json(error('里程碑不存在', 404));
  }
  
  runQuery('DELETE FROM milestones WHERE id = ?', [id]);
  
  res.json(success(null, '里程碑删除成功'));
}));

router.post('/:id/complete', handleAsync(async (req, res) => {
  const { id } = req.params;
  
  const ms = queryOne('SELECT * FROM milestones WHERE id = ?', [id]);
  if (!ms) {
    return res.status(404).json(error('里程碑不存在', 404));
  }
  
  const deliverables = queryAll('SELECT * FROM deliverables WHERE milestone_id = ?', [id]);
  const allAccepted = deliverables.length > 0 && deliverables.every(d => d.status === 'accepted');
  
  if (!allAccepted) {
    return res.status(400).json(error('里程碑下存在未验收或验收不通过的交付物', 400));
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  runQuery(
    'UPDATE milestones SET status = ?, actual_date = ?, updated_at = ? WHERE id = ?',
    ['completed', dayjs().format('YYYY-MM-DD'), now, id]
  );
  
  res.json(success(null, '里程碑完成'));
}));

module.exports = router;