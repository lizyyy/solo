const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { queryAll, queryOne, runQuery } = require('../utils/db');
const { success, error, handleAsync } = require('../utils/response');

const router = express.Router();

router.get('/', handleAsync(async (req, res) => {
  const { status, keyword } = req.query;
  let sql = 'SELECT * FROM projects WHERE 1=1';
  const params = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (keyword) {
    sql += ' AND (name LIKE ? OR vendor LIKE ? OR description LIKE ?)';
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }
  sql += ' ORDER BY created_at DESC';
  
  const projects = queryAll(sql, params);
  
  const projectsWithStats = projects.map(project => {
    const milestones = queryAll('SELECT * FROM milestones WHERE project_id = ?', [project.id]);
    const deliverables = queryAll(`
      SELECT d.* FROM deliverables d 
      JOIN milestones m ON d.milestone_id = m.id 
      WHERE m.project_id = ?
    `, [project.id]);
    
    return {
      ...project,
      milestone_count: milestones.length,
      deliverable_count: deliverables.length,
      completed_milestones: milestones.filter(m => m.status === 'completed').length,
      paid_amount: milestones.filter(m => m.payment_status === 'paid').reduce((sum, m) => sum + m.payment_amount, 0)
    };
  });
  
  res.json(success(projectsWithStats));
}));

router.get('/:id', handleAsync(async (req, res) => {
  const { id } = req.params;
  const project = queryOne('SELECT * FROM projects WHERE id = ?', [id]);
  
  if (!project) {
    return res.status(404).json(error('项目不存在', 404));
  }
  
  const milestones = queryAll(`
    SELECT * FROM milestones 
    WHERE project_id = ? 
    ORDER BY sequence ASC
  `, [id]);
  
  const milestonesWithDetails = milestones.map(ms => {
    const deliverables = queryAll(`
      SELECT * FROM deliverables 
      WHERE milestone_id = ? 
      ORDER BY created_at DESC
    `, [ms.id]);
    
    return {
      ...ms,
      deliverables
    };
  });
  
  res.json(success({
    ...project,
    milestones: milestonesWithDetails
  }));
}));

router.post('/', handleAsync(async (req, res) => {
  const { name, vendor, description, start_date, end_date, total_amount } = req.body;
  
  if (!name || !vendor) {
    return res.status(400).json(error('项目名称和供应商不能为空', 400));
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const id = uuidv4();
  
  runQuery(
    `INSERT INTO projects (id, name, vendor, description, start_date, end_date, total_amount, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, vendor, description || '', start_date || null, end_date || null, total_amount || 0, 'active', now, now]
  );
  
  res.json(success({ id }, '项目创建成功'));
}));

router.put('/:id', handleAsync(async (req, res) => {
  const { id } = req.params;
  const { name, vendor, description, start_date, end_date, total_amount, status } = req.body;
  
  const existing = queryOne('SELECT * FROM projects WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json(error('项目不存在', 404));
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  runQuery(
    `UPDATE projects SET 
      name = COALESCE(?, name),
      vendor = COALESCE(?, vendor),
      description = COALESCE(?, description),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      total_amount = COALESCE(?, total_amount),
      status = COALESCE(?, status),
      updated_at = ?
     WHERE id = ?`,
    [name, vendor, description, start_date, end_date, total_amount, status, now, id]
  );
  
  res.json(success(null, '项目更新成功'));
}));

router.delete('/:id', handleAsync(async (req, res) => {
  const { id } = req.params;
  
  const existing = queryOne('SELECT * FROM projects WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json(error('项目不存在', 404));
  }
  
  runQuery('DELETE FROM projects WHERE id = ?', [id]);
  
  res.json(success(null, '项目删除成功'));
}));

module.exports = router;