const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/connection');

const VALID_STATUSES = ['draft', 'testing', 'active', 'deprecated'];

router.post('/', async (req, res) => {
  try {
    const {
      name, description, max_chunk_length, min_chunk_length,
      overlap_size, heading_hierarchy_level, inherit_headers,
      preserve_tables, effect_remark, responsibility_node
    } = req.body;

    if (!name) {
      return res.status(400).json({
        error: '规则名称不能为空',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const result = await run(
      `INSERT INTO slice_rules 
       (name, description, max_chunk_length, min_chunk_length, overlap_size, 
        heading_hierarchy_level, inherit_headers, preserve_tables, effect_remark, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        name, description || '', max_chunk_length || 500, min_chunk_length || 100,
        overlap_size || 50, heading_hierarchy_level || 3, inherit_headers ? 1 : 0,
        preserve_tables ? 1 : 0, effect_remark || ''
      ]
    );

    const rule = await get('SELECT * FROM slice_rules WHERE id = ?', [result.lastID]);
    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'DATABASE_ERROR' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM slice_rules WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const rules = await all(query, params);
    res.json({ data: rules, total: rules.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rule = await get('SELECT * FROM slice_rules WHERE id = ?', [req.params.id]);

    if (!rule) {
      return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
    }

    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `无效状态，有效状态: ${VALID_STATUSES.join(', ')}`,
        code: 'INVALID_STATUS'
      });
    }

    const result = await run(
      'UPDATE slice_rules SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
    }

    const rule = await get('SELECT * FROM slice_rules WHERE id = ?', [req.params.id]);
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      name, description, max_chunk_length, min_chunk_length,
      overlap_size, heading_hierarchy_level, inherit_headers,
      preserve_tables, effect_remark
    } = req.body;

    const result = await run(
      `UPDATE slice_rules SET 
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        max_chunk_length = COALESCE(?, max_chunk_length),
        min_chunk_length = COALESCE(?, min_chunk_length),
        overlap_size = COALESCE(?, overlap_size),
        heading_hierarchy_level = COALESCE(?, heading_hierarchy_level),
        inherit_headers = COALESCE(?, inherit_headers),
        preserve_tables = COALESCE(?, preserve_tables),
        effect_remark = COALESCE(?, effect_remark),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name, description, max_chunk_length, min_chunk_length, overlap_size,
        heading_hierarchy_level, inherit_headers, preserve_tables, effect_remark, req.params.id
      ]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
    }

    const rule = await get('SELECT * FROM slice_rules WHERE id = ?', [req.params.id]);
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await run('DELETE FROM slice_rules WHERE id = ?', [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
    }

    res.json({ message: '删除成功', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
