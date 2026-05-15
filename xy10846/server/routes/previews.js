const express = require('express');
const router = express.Router();
const db = require('../database/connection');

function generateSlices(content, rule) {
  const slices = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2],
      index: match.index,
      fullMatch: match[0]
    });
  }

  const maxLength = rule.max_chunk_length || 500;
  const overlapSize = rule.overlap_size || 50;
  const inheritHeaders = rule.inherit_headers !== 0;

  let currentChunk = '';
  let currentHeadingPath = [];
  let chunkIndex = 0;

  const sections = content.split(/(?=^#{1,6}\s)/gm);

  for (const section of sections) {
    const sectionHeadingMatch = section.match(/^(#{1,6})\s+(.+)$/m);

    if (sectionHeadingMatch) {
      const level = sectionHeadingMatch[1].length;
      const headingText = sectionHeadingMatch[2];

      while (currentHeadingPath.length > 0 &&
             currentHeadingPath[currentHeadingPath.length - 1].level >= level) {
        currentHeadingPath.pop();
      }
      currentHeadingPath.push({ level, text: headingText });
    }

    const headingPath = currentHeadingPath.map(h => h.text).join(' > ');
    const sectionContent = section;
    const hasTable = section.includes('|') && section.match(/\|.+\|/);

    if (inheritHeaders && headingPath) {
      currentChunk = headingPath + '\n\n';
    }

    if (currentChunk.length + sectionContent.length <= maxLength) {
      currentChunk += sectionContent;
    } else {
      if (currentChunk.trim()) {
        slices.push({
          chunk_index: chunkIndex++,
          content: currentChunk.trim(),
          heading_path: headingPath,
          chunk_length: currentChunk.length,
          has_table: hasTable ? 1 : 0,
          quality_score: Math.min(1, currentChunk.length / maxLength)
        });
      }

      const words = sectionContent.split(' ');
      let subChunk = inheritHeaders ? headingPath + '\n\n' : '';

      for (const word of words) {
        if (subChunk.length + word.length + 1 > maxLength) {
          slices.push({
            chunk_index: chunkIndex++,
            content: subChunk.trim(),
            heading_path: headingPath,
            chunk_length: subChunk.length,
            has_table: hasTable ? 1 : 0,
            quality_score: Math.min(1, subChunk.length / maxLength)
          });

          const overlapWords = subChunk.split(' ').slice(-Math.floor(overlapSize / 10));
          subChunk = inheritHeaders ? headingPath + '\n\n' + overlapWords.join(' ') : overlapWords.join(' ');
        }
        subChunk += ' ' + word;
      }
      currentChunk = subChunk;
    }
  }

  if (currentChunk.trim()) {
    slices.push({
      chunk_index: chunkIndex++,
      content: currentChunk.trim(),
      heading_path: currentHeadingPath.map(h => h.text).join(' > '),
      chunk_length: currentChunk.length,
      has_table: 0,
      quality_score: Math.min(1, currentChunk.length / maxLength)
    });
  }

  return slices;
}

router.post('/generate', (req, res) => {
  const { document_id, rule_id } = req.body;

  if (!document_id || !rule_id) {
    return res.status(400).json({
      error: '文档ID和规则ID不能为空',
      code: 'MISSING_REQUIRED_PARAMS'
    });
  }

  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id);
  const rule = db.prepare('SELECT * FROM slice_rules WHERE id = ?').get(rule_id);

  if (!document) {
    return res.status(404).json({ error: '文档不存在', code: 'DOCUMENT_NOT_FOUND' });
  }
  if (!rule) {
    return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
  }

  db.prepare('DELETE FROM slice_previews WHERE document_id = ? AND rule_id = ?').run(document_id, rule_id);
  db.prepare('DELETE FROM heading_hierarchies WHERE document_id = ? AND rule_id = ?').run(document_id, rule_id);
  db.prepare('DELETE FROM table_fragments WHERE document_id = ? AND rule_id = ?').run(document_id, rule_id);

  const slices = generateSlices(document.content, rule);

  const insertSlice = db.prepare(`
    INSERT INTO slice_previews 
    (document_id, rule_id, chunk_index, content, heading_path, chunk_length, has_table, quality_score, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generated')
  `);

  for (const slice of slices) {
    insertSlice.run(
      document_id, rule_id, slice.chunk_index, slice.content,
      slice.heading_path, slice.chunk_length, slice.has_table, slice.quality_score
    );
  }

  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let headingMatch;
  let position = 0;
  const insertHeading = db.prepare(`
    INSERT INTO heading_hierarchies (document_id, rule_id, level, text, position)
    VALUES (?, ?, ?, ?, ?)
  `);

  while ((headingMatch = headingRegex.exec(document.content)) !== null) {
    insertHeading.run(document_id, rule_id, headingMatch[1].length, headingMatch[2], position++);
  }

  res.json({
    message: '切片预览生成成功',
    document_id,
    rule_id,
    slices_count: slices.length,
    slices: slices.slice(0, 10)
  });
});

router.get('/', (req, res) => {
  const { document_id, rule_id, limit = 50, offset = 0 } = req.query;

  let query = 'SELECT * FROM slice_previews WHERE 1=1';
  const params = [];

  if (document_id) { query += ' AND document_id = ?'; params.push(document_id); }
  if (rule_id) { query += ' AND rule_id = ?'; params.push(rule_id); }

  query += ' ORDER BY chunk_index ASC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const previews = db.prepare(query).all(...params);

  res.json({ data: previews });
});

router.get('/:id', (req, res) => {
  const preview = db.prepare('SELECT * FROM slice_previews WHERE id = ?').get(req.params.id);

  if (!preview) {
    return res.status(404).json({ error: '预览不存在', code: 'PREVIEW_NOT_FOUND' });
  }

  const document = db.prepare('SELECT title FROM documents WHERE id = ?').get(preview.document_id);
  const rule = db.prepare('SELECT name, version FROM slice_rules WHERE id = ?').get(preview.rule_id);

  res.json({
    ...preview,
    document_title: document?.title,
    rule_name: rule?.name,
    rule_version: rule?.version
  });
});

router.get('/tables/:document_id/:rule_id', (req, res) => {
  const tables = db.prepare(`
    SELECT * FROM table_fragments 
    WHERE document_id = ? AND rule_id = ?
    ORDER BY id ASC
  `).all(req.params.document_id, req.params.rule_id);

  res.json({ data: tables });
});

module.exports = router;
