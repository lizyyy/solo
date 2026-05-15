const express = require('express');
const router = express.Router();
const db = require('../database/connection');

router.get('/slices/:document_id/:rule_id', (req, res) => {
  const { document_id, rule_id } = req.params;
  const format = req.query.format || 'json';

  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id);
  const rule = db.prepare('SELECT * FROM slice_rules WHERE id = ?').get(rule_id);

  if (!document) {
    return res.status(404).json({ error: '文档不存在', code: 'DOCUMENT_NOT_FOUND' });
  }
  if (!rule) {
    return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
  }

  const slices = db.prepare(`
    SELECT * FROM slice_previews 
    WHERE document_id = ? AND rule_id = ?
    ORDER BY chunk_index ASC
  `).all(document_id, rule_id);

  if (format === 'json') {
    res.json({
      export_info: {
        document_title: document.title,
        rule_name: rule.name,
        rule_version: rule.version,
        slices_count: slices.length,
        exported_at: new Date().toISOString()
      },
      slices: slices
    });
  } else if (format === 'txt') {
    let txtContent = `文档切片导出\n`;
    txtContent += `文档: ${document.title}\n`;
    txtContent += `规则: ${rule.name} (v${rule.version})\n`;
    txtContent += `切片数量: ${slices.length}\n`;
    txtContent += `导出时间: ${new Date().toISOString()}\n`;
    txtContent += `${'='.repeat(80)}\n\n`;

    slices.forEach((slice, index) => {
      txtContent += `[切片 ${index + 1}] 长度: ${slice.chunk_length} 字符\n`;
      if (slice.heading_path) {
        txtContent += `标题路径: ${slice.heading_path}\n`;
      }
      txtContent += `${'-'.repeat(80)}\n`;
      txtContent += slice.content;
      txtContent += `\n\n${'='.repeat(80)}\n\n`;
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="slices_${document_id}_${rule_id}.txt"`);
    res.send(txtContent);
  } else {
    res.status(400).json({ error: '不支持的导出格式', code: 'UNSUPPORTED_FORMAT' });
  }
});

router.get('/logs', (req, res) => {
  const { limit = 100, offset = 0, status, start_date, end_date } = req.query;

  let query = 'SELECT * FROM request_logs WHERE 1=1';
  const params = [];

  if (status) { query += ' AND status = ?'; params.push(status); }
  if (start_date) { query += ' AND created_at >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND created_at <= ?'; params.push(end_date); }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const logs = db.prepare(query).all(...params);

  res.json({
    data: logs,
    pagination: { limit: parseInt(limit), offset: parseInt(offset) }
  });
});

router.get('/rules/:id/full', (req, res) => {
  const rule = db.prepare('SELECT * FROM slice_rules WHERE id = ?').get(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
  }

  const versions = db.prepare(
    'SELECT * FROM published_versions WHERE rule_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);

  const previewDocs = db.prepare(`
    SELECT DISTINCT d.id, d.title, d.status, d.created_at
    FROM documents d
    JOIN slice_previews sp ON d.id = sp.document_id
    WHERE sp.rule_id = ?
    LIMIT 10
  `).all(req.params.id);

  versions.forEach(v => { v.config_snapshot = JSON.parse(v.config_snapshot); });

  res.json({
    rule,
    versions,
    previewed_documents: previewDocs
  });
});

module.exports = router;
