const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/connection');

router.post('/publish', async (req, res) => {
  try {
    const { rule_id, version_tag, description, published_by } = req.body;

    if (!rule_id || !version_tag) {
      return res.status(400).json({
        error: '规则ID和版本标签不能为空',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const rule = await get('SELECT * FROM slice_rules WHERE id = ?', [rule_id]);
    if (!rule) {
      return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
    }

    await run('UPDATE published_versions SET is_active = 0 WHERE rule_id = ?', [rule_id]);

    const configSnapshot = JSON.stringify({
      name: rule.name,
      description: rule.description,
      max_chunk_length: rule.max_chunk_length,
      min_chunk_length: rule.min_chunk_length,
      overlap_size: rule.overlap_size,
      heading_hierarchy_level: rule.heading_hierarchy_level,
      inherit_headers: rule.inherit_headers,
      preserve_tables: rule.preserve_tables,
      effect_remark: rule.effect_remark
    });

    const result = await run(
      `INSERT INTO published_versions 
       (rule_id, version_tag, description, config_snapshot, is_active, published_by)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [rule_id, version_tag, description || '', configSnapshot, published_by || 'system']
    );

    await run('UPDATE slice_rules SET status = ?, version = ? WHERE id = ?', ['active', version_tag, rule_id]);

    const version = await get('SELECT * FROM published_versions WHERE id = ?', [result.lastID]);
    res.status(201).json(version);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({
        error: '版本标签已存在',
        code: 'VERSION_TAG_EXISTS'
      });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { rule_id, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM published_versions WHERE 1=1';
    const params = [];

    if (rule_id) {
      query += ' AND rule_id = ?';
      params.push(rule_id);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const versions = await all(query, params);
    res.json({ data: versions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rollback', async (req, res) => {
  try {
    const { version_id } = req.body;

    if (!version_id) {
      return res.status(400).json({
        error: '版本ID不能为空',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const targetVersion = await get('SELECT * FROM published_versions WHERE id = ?', [version_id]);
    if (!targetVersion) {
      return res.status(404).json({ error: '版本不存在', code: 'VERSION_NOT_FOUND' });
    }

    const config = JSON.parse(targetVersion.config_snapshot);

    await run(
      `UPDATE slice_rules SET 
        name = ?, description = ?, max_chunk_length = ?, min_chunk_length = ?,
        overlap_size = ?, heading_hierarchy_level = ?, inherit_headers = ?,
        preserve_tables = ?, effect_remark = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        config.name, config.description, config.max_chunk_length, config.min_chunk_length,
        config.overlap_size, config.heading_hierarchy_level, config.inherit_headers,
        config.preserve_tables, config.effect_remark, targetVersion.rule_id
      ]
    );

    await run('UPDATE published_versions SET is_active = 0 WHERE rule_id = ?', [targetVersion.rule_id]);
    await run('UPDATE published_versions SET is_active = 1 WHERE id = ?', [version_id]);

    const updatedRule = await get('SELECT * FROM slice_rules WHERE id = ?', [targetVersion.rule_id]);

    res.json({
      message: '回滚成功',
      version: targetVersion,
      rule: updatedRule
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
