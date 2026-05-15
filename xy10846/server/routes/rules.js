const express = require('express');
const router = express.Router();
const db = require('../database/connection');

router.post('/', (req, res) => {
  const {
    name, description, max_chunk_length, min_chunk_length,
    preserve_tables, inherit_headers, table_handling_strategy,
    heading_hierarchy_level, overlap_size, created_by
  } = req.body;

  if (!name) {
    return res.status(400).json({
      error: '规则名称不能为空',
      code: 'MISSING_RULE_NAME'
    });
  }

  const stmt = db.prepare(`
    INSERT INTO slice_rules 
    (name, description, max_chunk_length, min_chunk_length, preserve_tables, 
     inherit_headers, table_handling_strategy, heading_hierarchy_level, overlap_size, created_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `);

  const result = stmt.run(
    name, description, max_chunk_length || 500, min_chunk_length || 100,
    preserve_tables !== undefined ? preserve_tables : 1,
    inherit_headers !== undefined ? inherit_headers : 1,
    table_handling_strategy || 'split',
    heading_hierarchy_level || 3,
    overlap_size || 50,
    created_by || 'system'
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    message: '切片规则创建成功',
    rule: { id: result.lastInsertRowid, name, version: '1.0.0', status: 'draft' }
  });
});

router.get('/', (req, res) => {
  const { status, search, limit = 20, offset = 0 } = req.query;

  let query = 'SELECT * FROM slice_rules WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const rules = db.prepare(query).all(...params);

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total').split(' ORDER BY')[0];
  const countParams = params.slice(0, -2);
  const { total } = db.prepare(countQuery).get(...countParams);

  res.json({
    data: rules,
    pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
  });
});

router.get('/:id', (req, res) => {
  const rule = db.prepare('SELECT * FROM slice_rules WHERE id = ?').get(req.params.id);

  if (!rule) {
    return res.status(404).json({
      error: '规则不存在',
      code: 'RULE_NOT_FOUND'
    });
  }

  res.json(rule);
});

router.put('/:id', (req, res) => {
  const {
    name, description, max_chunk_length, min_chunk_length,
    preserve_tables, inherit_headers, table_handling_strategy,
    heading_hierarchy_level, overlap_size, effect_remark
  } = req.body;

  const rule = db.prepare('SELECT * FROM slice_rules WHERE id = ?').get(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
  }

  const stmt = db.prepare(`
    UPDATE slice_rules SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      max_chunk_length = COALESCE(?, max_chunk_length),
      min_chunk_length = COALESCE(?, min_chunk_length),
      preserve_tables = COALESCE(?, preserve_tables),
      inherit_headers = COALESCE(?, inherit_headers),
      table_handling_strategy = COALESCE(?, table_handling_strategy),
      heading_hierarchy_level = COALESCE(?, heading_hierarchy_level),
      overlap_size = COALESCE(?, overlap_size),
      effect_remark = COALESCE(?, effect_remark),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(
    name, description, max_chunk_length, min_chunk_length,
    preserve_tables, inherit_headers, table_handling_strategy,
    heading_hierarchy_level, overlap_size, effect_remark,
    req.params.id
  );

  res.json({ message: '规则更新成功', rule_id: req.params.id });
});

router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'testing', 'approved', 'published', 'deprecated'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: '无效的状态值',
      code: 'INVALID_STATUS',
      valid_statuses: validStatuses
    });
  }

  const result = db.prepare(
    'UPDATE slice_rules SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(status, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
  }

  res.json({
    message: '状态更新成功',
    rule_id: req.params.id,
    new_status: status
  });
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM slice_rules WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
  }

  res.json({ message: '规则删除成功' });
});

module.exports = router;
