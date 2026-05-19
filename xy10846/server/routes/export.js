const express = require('express');
const router = express.Router();
const { get, all } = require('../database/connection');

router.get('/slices/:document_id/:rule_id', async (req, res) => {
  try {
    const { document_id, rule_id } = req.params;

    const document = await get('SELECT title FROM documents WHERE id = ?', [document_id]);
    if (!document) {
      return res.status(404).json({ error: '文档不存在', code: 'DOCUMENT_NOT_FOUND' });
    }

    const slices = await all(
      'SELECT * FROM slice_previews WHERE document_id = ? AND rule_id = ? ORDER BY chunk_index ASC',
      [document_id, rule_id]
    );

    const tables = await all(
      'SELECT * FROM table_fragments WHERE document_id = ? AND rule_id = ? ORDER BY id ASC',
      [document_id, rule_id]
    );

    res.json({
      document_title: document.title,
      slices_count: slices.length,
      tables_count: tables.length,
      slices: slices.map(s => ({
        index: s.chunk_index,
        content: s.content,
        heading_path: s.heading_path,
        length: s.chunk_length,
        has_table: s.has_table
      })),
      tables: tables.map(t => ({
        row_count: t.row_count,
        col_count: t.col_count,
        handling_method: t.handling_method,
        content: t.fragment_content
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const logs = await all(
      'SELECT * FROM request_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [parseInt(limit), parseInt(offset)]
    );

    res.json({
      data: logs,
      total: logs.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/rules/:id', async (req, res) => {
  try {
    const rule = await get('SELECT * FROM slice_rules WHERE id = ?', [req.params.id]);

    if (!rule) {
      return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
    }

    const versions = await all(
      'SELECT * FROM published_versions WHERE rule_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({
      rule,
      versions: versions.map(v => ({
        id: v.id,
        version_tag: v.version_tag,
        description: v.description,
        is_active: v.is_active,
        published_at: v.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
