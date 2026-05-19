const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/connection');

function extractTables(content) {
  const tables = [];
  const tableRegex = /(?:^|\n)\|.*\|(?:\n\|[-:| ]+\|)?(?:\n\|.*\|)*/gm;
  let match;
  let index = 0;

  while ((match = tableRegex.exec(content)) !== null) {
    const tableContent = match[0].trim();
    const lines = tableContent.split('\n').filter(line => line.trim());
    
    if (lines.length >= 2) {
      const rowCount = lines.filter(line => !/^[-:| ]+$/.test(line)).length;
      const firstLine = lines[0];
      const colCount = (firstLine.match(/\|/g) || []).length - 1;
      
      tables.push({
        index: index++,
        original_table: tableContent,
        fragment_content: tableContent,
        row_count: rowCount,
        col_count: colCount,
        handling_method: 'preserved'
      });
    }
  }

  return tables;
}

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

router.post('/generate', async (req, res) => {
  try {
    const { document_id, rule_id } = req.body;

    if (!document_id || !rule_id) {
      return res.status(400).json({
        error: '文档ID和规则ID不能为空',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const document = await get('SELECT * FROM documents WHERE id = ?', [document_id]);
    if (!document) {
      return res.status(404).json({ error: '文档不存在', code: 'DOCUMENT_NOT_FOUND' });
    }

    const rule = await get('SELECT * FROM slice_rules WHERE id = ?', [rule_id]);
    if (!rule) {
      return res.status(404).json({ error: '规则不存在', code: 'RULE_NOT_FOUND' });
    }

    await run('DELETE FROM slice_previews WHERE document_id = ? AND rule_id = ?', [document_id, rule_id]);
    await run('DELETE FROM heading_hierarchies WHERE document_id = ? AND rule_id = ?', [document_id, rule_id]);
    await run('DELETE FROM table_fragments WHERE document_id = ? AND rule_id = ?', [document_id, rule_id]);

    const slices = generateSlices(document.content, rule);
    const tables = extractTables(document.content);

    for (const slice of slices) {
      await run(
        `INSERT INTO slice_previews 
         (document_id, rule_id, chunk_index, content, heading_path, chunk_length, has_table, quality_score, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generated')`,
        [
          document_id, rule_id, slice.chunk_index, slice.content,
          slice.heading_path, slice.chunk_length, slice.has_table, slice.quality_score
        ]
      );
    }

    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let headingMatch;
    let position = 0;

    while ((headingMatch = headingRegex.exec(document.content)) !== null) {
      await run(
        'INSERT INTO heading_hierarchies (document_id, rule_id, level, text, position) VALUES (?, ?, ?, ?, ?)',
        [document_id, rule_id, headingMatch[1].length, headingMatch[2], position++]
      );
    }

    for (const table of tables) {
      await run(
        `INSERT INTO table_fragments 
         (document_id, rule_id, original_table, fragment_content, row_count, col_count, handling_method)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          document_id, rule_id, table.original_table, table.fragment_content,
          table.row_count, table.col_count, table.handling_method
        ]
      );
    }

    res.json({
      message: '切片预览生成成功',
      document_id,
      rule_id,
      slices_count: slices.length,
      tables_count: tables.length,
      slices: slices.slice(0, 10)
    });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'GENERATE_ERROR' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { document_id, rule_id, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM slice_previews WHERE 1=1';
    const params = [];

    if (document_id) { query += ' AND document_id = ?'; params.push(document_id); }
    if (rule_id) { query += ' AND rule_id = ?'; params.push(rule_id); }

    query += ' ORDER BY chunk_index ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const previews = await all(query, params);

    res.json({ data: previews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tables/:document_id/:rule_id', async (req, res) => {
  try {
    const tables = await all(
      'SELECT * FROM table_fragments WHERE document_id = ? AND rule_id = ? ORDER BY id ASC',
      [req.params.document_id, req.params.rule_id]
    );

    res.json({ data: tables });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const preview = await get('SELECT * FROM slice_previews WHERE id = ?', [req.params.id]);

    if (!preview) {
      return res.status(404).json({ error: '预览不存在', code: 'PREVIEW_NOT_FOUND' });
    }

    const document = await get('SELECT title FROM documents WHERE id = ?', [preview.document_id]);
    const rule = await get('SELECT name, version FROM slice_rules WHERE id = ?', [preview.rule_id]);

    res.json({
      ...preview,
      document_title: document?.title,
      rule_name: rule?.name,
      rule_version: rule?.version
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
