const express = require('express');
const router = express.Router();
const db = require('../database/connection');

router.post('/publish', (req, res) => {
  const { rule_id, version_tag, description, published_by } = req.body;

  if (!rule_id || !version_tag) {
    return res.status(400).json({
      error: '规则ID和版本标签不能为空',
      code: 'MISSING_REQUIRED_PARAMS'
    });
  }

  const rule = db.prepare('SELECT * FROM slice_rules WHERE id = ?').get(rule_id);
  if (!rule) {
    return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
  }

  const existingVersion = db.prepare(
    'SELECT * FROM published_versions WHERE rule_id = ? AND version_tag = ?'
  ).get(rule_id, version_tag);

  if (existingVersion) {
    return res.status(400).json({
      error: '版本标签已存在',
      code: 'VERSION_TAG_EXISTS'
    });
  }

  const configSnapshot = JSON.stringify({
    name: rule.name,
    description: rule.description,
    max_chunk_length: rule.max_chunk_length,
    min_chunk_length: rule.min_chunk_length,
    preserve_tables: rule.preserve_tables,
    inherit_headers: rule.inherit_headers,
    table_handling_strategy: rule.table_handling_strategy,
    heading_hierarchy_level: rule.heading_hierarchy_level,
    overlap_size: rule.overlap_size
  });

  db.prepare('UPDATE published_versions SET is_active = 0 WHERE rule_id = ?').run(rule_id);

  const stmt = db.prepare(`
    INSERT INTO published_versions 
    (rule_id, version_tag, config_snapshot, description, published_by, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  const result = stmt.run(rule_id, version_tag, configSnapshot, description, published_by || 'system');

  db.prepare(
    'UPDATE slice_rules SET status = \'published\', version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(version_tag, rule_id);

  res.status(201).json({
    id: result.lastInsertRowid,
    message: '版本发布成功',
    version: {
      id: result.lastInsertRowid,
      rule_id,
      version_tag,
      is_active: true
    }
  });
});

router.get('/', (req, res) => {
  const { rule_id, is_active, limit = 20, offset = 0 } = req.query;

  let query = 'SELECT * FROM published_versions WHERE 1=1';
  const params = [];

  if (rule_id) { query += ' AND rule_id = ?'; params.push(rule_id); }
  if (is_active !== undefined) { query += ' AND is_active = ?'; params.push(is_active ? 1 : 0); }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const versions = db.prepare(query).all(...params);
  versions.forEach(v => { v.config_snapshot = JSON.parse(v.config_snapshot); });

  res.json({ data: versions });
});

router.get('/:id', (req, res) => {
  const version = db.prepare('SELECT * FROM published_versions WHERE id = ?').get(req.params.id);

  if (!version) {
    return res.status(404).json({ error: '版本不存在', code: 'VERSION_NOT_FOUND' });
  }

  version.config_snapshot = JSON.parse(version.config_snapshot);
  res.json(version);
});

router.post('/rollback', (req, res) => {
  const { version_id, rollback_by } = req.body;

  if (!version_id) {
    return res.status(400).json({
      error: '版本ID不能为空',
      code: 'MISSING_VERSION_ID'
    });
  }

  const targetVersion = db.prepare('SELECT * FROM published_versions WHERE id = ?').get(version_id);
  if (!targetVersion) {
    return res.status(404).json({ error: '版本不存在', code: 'VERSION_NOT_FOUND' });
  }

  const currentActive = db.prepare(
    'SELECT * FROM published_versions WHERE rule_id = ? AND is_active = 1'
  ).get(targetVersion.rule_id);

  db.prepare('UPDATE published_versions SET is_active = 0 WHERE rule_id = ?').run(targetVersion.rule_id);

  db.prepare(
    'UPDATE published_versions SET is_active = 1, rollback_from_id = ? WHERE id = ?'
  ).run(currentActive?.id || null, version_id);

  const config = JSON.parse(targetVersion.config_snapshot);
  db.prepare(`
    UPDATE slice_rules SET
      name = ?, description = ?, max_chunk_length = ?, min_chunk_length = ?,
      preserve_tables = ?, inherit_headers = ?, table_handling_strategy = ?,
      heading_hierarchy_level = ?, overlap_size = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    config.name, config.description, config.max_chunk_length, config.min_chunk_length,
    config.preserve_tables, config.inherit_headers, config.table_handling_strategy,
    config.heading_hierarchy_level, config.overlap_size, targetVersion.rule_id
  );

  res.json({
    message: '回滚成功',
    rolled_back_to: {
      version_id: targetVersion.id,
      version_tag: targetVersion.version_tag,
      rule_id: targetVersion.rule_id
    }
  });
});

module.exports = router;
