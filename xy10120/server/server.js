const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csvParser = require('csv-parser');
const XLSX = require('xlsx');
const { Parser } = require('json2csv');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const { db, initDatabase } = require('./database');
const validator = require('./validator');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const upload = multer({
  dest: path.join(__dirname, '..', 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/knowledge-base', (req, res) => {
  const { document_id, title, content } = req.body;
  
  if (!document_id || !title || !content) {
    return res.status(400).json({ error: '缺少必填字段: document_id, title, content' });
  }
  
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO knowledge_base (id, document_id, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(id, document_id, title, content);
  
  db.prepare(`
    INSERT INTO version_history (id, entity_type, entity_id, action, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), 'knowledge_base', id, 'create', JSON.stringify({ document_id, title, content }));
  
  res.json({ id, document_id, title, content });
});

app.post('/api/knowledge-base/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let records = [];
    
    if (ext === '.csv') {
      records = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => records.push(row))
        .on('end', () => {
          processRecords(records, res);
          fs.unlinkSync(filePath);
        });
      return;
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (ext === '.json') {
      const content = fs.readFileSync(filePath, 'utf-8');
      records = JSON.parse(content);
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: '不支持的文件格式，请上传 CSV, XLSX, 或 JSON 文件' });
    }
    
    fs.unlinkSync(filePath);
    processRecords(records, res);
    
  } catch (error) {
    console.error('导入错误:', error);
    res.status(500).json({ error: error.message });
  }
  
  function processRecords(records, res) {
    const insertStmt = db.prepare(`
      INSERT INTO knowledge_base (id, document_id, title, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    const insertVersion = db.prepare(`
      INSERT INTO version_history (id, entity_type, entity_id, action, data)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const transaction = db.transaction((recs) => {
      const imported = [];
      recs.forEach(record => {
        const document_id = record.document_id || record.docId || record.doc_id || uuidv4();
        const title = record.title || record.name || `知识条目_${document_id}`;
        const content = record.content || record.text || record.body;
        
        if (content) {
          const id = uuidv4();
          insertStmt.run(id, document_id, title, content);
          insertVersion.run(uuidv4(), 'knowledge_base', id, 'create', JSON.stringify({ document_id, title, content }));
          imported.push({ id, document_id, title });
        }
      });
      return imported;
    });
    
    const imported = transaction(records);
    res.json({ imported: imported.length, records: imported });
  }
});

app.get('/api/knowledge-base', (req, res) => {
  const { page = 1, pageSize = 20, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  
  let query = 'SELECT * FROM knowledge_base';
  let params = [];
  let countQuery = 'SELECT COUNT(*) as total FROM knowledge_base';
  
  if (search) {
    query += ' WHERE title LIKE ? OR content LIKE ? OR document_id LIKE ?';
    countQuery += ' WHERE title LIKE ? OR content LIKE ? OR document_id LIKE ?';
    const searchTerm = `%${search}%`;
    params = [searchTerm, searchTerm, searchTerm];
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);
  
  const records = db.prepare(query).all(...params);
  const total = db.prepare(countQuery).get(...params.slice(0, params.length - 2));
  
  res.json({ records, total: total.total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

app.post('/api/qa-records', (req, res) => {
  const { question, answer, citations } = req.body;
  
  if (!question || !answer) {
    return res.status(400).json({ error: '缺少必填字段: question, answer' });
  }
  
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO qa_records (id, question, answer, created_at, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(id, question, answer);
  
  db.prepare(`
    INSERT INTO version_history (id, entity_type, entity_id, action, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), 'qa_record', id, 'create', JSON.stringify({ question, answer }));
  
  if (citations && Array.isArray(citations)) {
    const insertCitation = db.prepare(`
      INSERT INTO citations (id, qa_record_id, knowledge_base_id, document_id, cited_text, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    citations.forEach((citation, index) => {
      const citationId = uuidv4();
      insertCitation.run(
        citationId,
        id,
        citation.knowledge_base_id || null,
        citation.document_id || null,
        citation.cited_text || null,
        index
      );
    });
  }
  
  res.json({ id, question, answer });
});

app.post('/api/qa-records/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let records = [];
    
    if (ext === '.csv') {
      records = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => records.push(row))
        .on('end', () => {
          processQARecords(records, res);
          fs.unlinkSync(filePath);
        });
      return;
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (ext === '.json') {
      const content = fs.readFileSync(filePath, 'utf-8');
      records = JSON.parse(content);
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: '不支持的文件格式' });
    }
    
    fs.unlinkSync(filePath);
    processQARecords(records, res);
    
  } catch (error) {
    console.error('导入错误:', error);
    res.status(500).json({ error: error.message });
  }
  
  function processQARecords(records, res) {
    const insertQA = db.prepare(`
      INSERT INTO qa_records (id, question, answer, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    const insertCitation = db.prepare(`
      INSERT INTO citations (id, qa_record_id, knowledge_base_id, document_id, cited_text, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const insertVersion = db.prepare(`
      INSERT INTO version_history (id, entity_type, entity_id, action, data)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const transaction = db.transaction((recs) => {
      const imported = [];
      recs.forEach(record => {
        const question = record.question || record.q || record.query;
        const answer = record.answer || record.a || record.response;
        
        if (question && answer) {
          const id = uuidv4();
          insertQA.run(id, question, answer);
          insertVersion.run(uuidv4(), 'qa_record', id, 'create', JSON.stringify({ question, answer }));
          
          let citations = record.citations;
          if (typeof citations === 'string') {
            try {
              citations = JSON.parse(citations);
            } catch (e) {
              citations = [];
            }
          }
          
          if (citations && Array.isArray(citations)) {
            citations.forEach((citation, index) => {
              const citationId = uuidv4();
              insertCitation.run(
                citationId,
                id,
                citation.knowledge_base_id || null,
                citation.document_id || null,
                citation.cited_text || null,
                index
              );
            });
          }
          
          imported.push({ id, question: question.substring(0, 50) + '...' });
        }
      });
      return imported;
    });
    
    const imported = transaction(records);
    res.json({ imported: imported.length, records: imported });
  }
});

app.get('/api/qa-records', (req, res) => {
  const { page = 1, pageSize = 20, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  
  let query = 'SELECT * FROM qa_records';
  let params = [];
  let countQuery = 'SELECT COUNT(*) as total FROM qa_records';
  
  if (search) {
    query += ' WHERE question LIKE ? OR answer LIKE ?';
    countQuery += ' WHERE question LIKE ? OR answer LIKE ?';
    const searchTerm = `%${search}%`;
    params = [searchTerm, searchTerm];
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);
  
  const records = db.prepare(query).all(...params);
  const total = db.prepare(countQuery).get(...params.slice(0, params.length - 2));
  
  const recordsWithDetails = records.map(record => {
    const citations = db.prepare('SELECT * FROM citations WHERE qa_record_id = ?').all(record.id);
    const validations = db.prepare('SELECT * FROM validation_results WHERE qa_record_id = ?').all(record.id);
    return { ...record, citations, validations };
  });
  
  res.json({ records: recordsWithDetails, total: total.total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

app.get('/api/qa-records/:id', (req, res) => {
  const record = db.prepare('SELECT * FROM qa_records WHERE id = ?').get(req.params.id);
  
  if (!record) {
    return res.status(404).json({ error: '问答记录不存在' });
  }
  
  const citations = db.prepare('SELECT * FROM citations WHERE qa_record_id = ?').all(record.id);
  const validations = db.prepare(`
    SELECT vr.*, c.* FROM validation_results vr
    LEFT JOIN citations c ON vr.citation_id = c.id
    WHERE vr.qa_record_id = ?
    ORDER BY vr.created_at DESC
  `).all(record.id);
  
  const reviewHistory = db.prepare(`
    SELECT rh.*, vr.status as current_status FROM review_history rh
    JOIN validation_results vr ON rh.validation_result_id = vr.id
    WHERE vr.qa_record_id = ?
    ORDER BY rh.created_at DESC
  `).all(record.id);
  
  res.json({ ...record, citations, validations, reviewHistory });
});

app.post('/api/validate/:qaRecordId', (req, res) => {
  try {
    const results = validator.validateQARecord(req.params.qaRecordId);
    res.json({ success: true, results });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/validate-all', (req, res) => {
  try {
    const results = validator.validateAll();
    res.json({ success: true, count: results.length, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/review/:validationResultId', (req, res) => {
  const { newStatus, comment, reviewer } = req.body;
  
  if (!newStatus) {
    return res.status(400).json({ error: '缺少 newStatus' });
  }
  
  const validation = db.prepare('SELECT * FROM validation_results WHERE id = ?').get(req.params.validationResultId);
  
  if (!validation) {
    return res.status(404).json({ error: '校验结果不存在' });
  }
  
  const previousStatus = validation.status;
  
  db.prepare('UPDATE validation_results SET status = ? WHERE id = ?').run(newStatus, req.params.validationResultId);
  
  const historyId = uuidv4();
  db.prepare(`
    INSERT INTO review_history (id, validation_result_id, previous_status, new_status, reviewer_comment, reviewer)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(historyId, req.params.validationResultId, previousStatus, newStatus, comment || null, reviewer || 'anonymous');
  
  const updatedValidation = db.prepare('SELECT * FROM validation_results WHERE id = ?').get(req.params.validationResultId);
  
  db.prepare(`
    INSERT INTO version_history (id, entity_type, entity_id, action, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    'validation_result',
    req.params.validationResultId,
    'update',
    JSON.stringify({ previousStatus, newStatus, comment, reviewer })
  );
  
  res.json({ success: true, validation: updatedValidation, historyId });
});

app.post('/api/rollback/:validationResultId', (req, res) => {
  const { reason } = req.body;
  
  const history = db.prepare(`
    SELECT * FROM review_history 
    WHERE validation_result_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(req.params.validationResultId);
  
  const validation = db.prepare('SELECT * FROM validation_results WHERE id = ?').get(req.params.validationResultId);
  
  if (!validation) {
    return res.status(404).json({ error: '校验结果不存在' });
  }
  
  const previousStatus = validation.status;
  const newStatus = history ? history.previous_status : validator.VALIDATION_STATUS.PENDING_REVIEW;
  
  db.prepare('UPDATE validation_results SET status = ? WHERE id = ?').run(newStatus, req.params.validationResultId);
  
  const historyId = uuidv4();
  db.prepare(`
    INSERT INTO review_history (id, validation_result_id, previous_status, new_status, reviewer_comment, reviewer)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(historyId, req.params.validationResultId, previousStatus, newStatus, `[回滚] ${reason || ''}`, 'rollback');
  
  db.prepare(`
    INSERT INTO version_history (id, entity_type, entity_id, action, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    'validation_result',
    req.params.validationResultId,
    'rollback',
    JSON.stringify({ previousStatus, newStatus, reason })
  );
  
  const updatedValidation = db.prepare('SELECT * FROM validation_results WHERE id = ?').get(req.params.validationResultId);
  
  res.json({ success: true, validation: updatedValidation, historyId });
});

app.get('/api/version-history/:entityType/:entityId', (req, res) => {
  const history = db.prepare(`
    SELECT * FROM version_history 
    WHERE entity_type = ? AND entity_id = ? 
    ORDER BY created_at DESC
  `).all(req.params.entityType, req.params.entityId);
  
  res.json({ history });
});

app.get('/api/validation-results', (req, res) => {
  const { page = 1, pageSize = 20, status, qaRecordId } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  
  let query = `
    SELECT vr.*, q.question, q.answer, c.cited_text, c.document_id, c.knowledge_base_id,
           COALESCE(kb1.title, kb2.title) as kb_title,
           COALESCE(kb1.content, kb2.content) as kb_content
    FROM validation_results vr
    JOIN qa_records q ON vr.qa_record_id = q.id
    LEFT JOIN citations c ON vr.citation_id = c.id
    LEFT JOIN knowledge_base kb1 ON c.knowledge_base_id = kb1.id
    LEFT JOIN (
      SELECT document_id, MIN(id) as id, title, content 
      FROM knowledge_base 
      GROUP BY document_id
    ) kb2 ON c.document_id = kb2.document_id
  `;
  
  let countQuery = 'SELECT COUNT(*) as total FROM validation_results vr WHERE 1=1';
  let params = [];
  let conditions = [];
  
  if (status) {
    conditions.push('vr.status = ?');
    params.push(status);
  }
  
  if (qaRecordId) {
    conditions.push('vr.qa_record_id = ?');
    params.push(qaRecordId);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
    countQuery += ' AND ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY vr.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);
  
  const results = db.prepare(query).all(...params);
  const total = db.prepare(countQuery).get(...params.slice(0, params.length - 2));
  
  res.json({ results, total: total ? total.total : 0, page: parseInt(page), pageSize: parseInt(pageSize) });
});

app.get('/api/stats', (req, res) => {
  const stats = {};
  
  stats.knowledgeBaseCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get().count;
  stats.qaRecordCount = db.prepare('SELECT COUNT(*) as count FROM qa_records').get().count;
  stats.citationCount = db.prepare('SELECT COUNT(*) as count FROM citations').get().count;
  stats.validationCount = db.prepare('SELECT COUNT(*) as count FROM validation_results').get().count;
  
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM validation_results 
    GROUP BY status
  `).all();
  
  stats.byStatus = {};
  statusCounts.forEach(row => {
    stats.byStatus[row.status] = row.count;
  });
  
  res.json(stats);
});

app.get('/api/export/report', (req, res) => {
  const { format = 'json' } = req.query;
  
  const data = db.prepare(`
    SELECT 
      vr.id,
      vr.qa_record_id,
      q.question,
      q.answer,
      c.cited_text,
      c.document_id,
      COALESCE(kb1.title, kb2.title) as kb_title,
      COALESCE(kb1.content, kb2.content) as kb_content,
      vr.status,
      vr.score,
      vr.reason,
      vr.created_at as validation_time
    FROM validation_results vr
    JOIN qa_records q ON vr.qa_record_id = q.id
    LEFT JOIN citations c ON vr.citation_id = c.id
    LEFT JOIN knowledge_base kb1 ON c.knowledge_base_id = kb1.id
    LEFT JOIN (
      SELECT document_id, MIN(id) as id, title, content 
      FROM knowledge_base 
      GROUP BY document_id
    ) kb2 ON c.document_id = kb2.document_id
    ORDER BY vr.created_at DESC
  `).all();
  
  const reviewHistory = db.prepare(`
    SELECT 
      rh.validation_result_id,
      rh.previous_status,
      rh.new_status,
      rh.reviewer_comment,
      rh.reviewer,
      rh.created_at as review_time
    FROM review_history rh
    ORDER BY rh.created_at DESC
  `).all();
  
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalValidations: data.length,
      byStatus: {}
    },
    validations: data,
    reviewHistory: reviewHistory
  };
  
  const statusCounts = {};
  data.forEach(row => {
    statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
  });
  report.summary.byStatus = statusCounts;
  
  if (format === 'csv') {
    const parser = new Parser();
    const csv = parser.parse(data);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="validation-report-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } else if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(data);
    const ws2 = XLSX.utils.json_to_sheet(reviewHistory);
    
    XLSX.utils.book_append_sheet(wb, ws1, '校验结果');
    XLSX.utils.book_append_sheet(wb, ws2, '复核历史');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="validation-report-${Date.now()}.xlsx"`);
    res.send(buffer);
  } else {
    res.json(report);
  }
});

app.get('/api/export/error-samples', (req, res) => {
  const { format = 'json' } = req.query;
  
  const errorStatuses = [
    validator.VALIDATION_STATUS.MISSING_REFERENCE,
    validator.VALIDATION_STATUS.WRONG_DOCUMENT,
    validator.VALIDATION_STATUS.CONTENT_MISMATCH,
    validator.VALIDATION_STATUS.REVIEWED_INVALID
  ];
  
  const data = db.prepare(`
    SELECT 
      vr.id,
      vr.qa_record_id,
      q.question,
      q.answer,
      c.cited_text,
      c.document_id,
      COALESCE(kb1.title, kb2.title) as kb_title,
      COALESCE(kb1.content, kb2.content) as kb_content,
      vr.status,
      vr.score,
      vr.reason,
      vr.created_at as validation_time
    FROM validation_results vr
    JOIN qa_records q ON vr.qa_record_id = q.id
    LEFT JOIN citations c ON vr.citation_id = c.id
    LEFT JOIN knowledge_base kb1 ON c.knowledge_base_id = kb1.id
    LEFT JOIN (
      SELECT document_id, MIN(id) as id, title, content 
      FROM knowledge_base 
      GROUP BY document_id
    ) kb2 ON c.document_id = kb2.document_id
    WHERE vr.status IN (${errorStatuses.map(() => '?').join(',')})
    ORDER BY vr.created_at DESC
  `).all(...errorStatuses);
  
  if (format === 'csv') {
    const parser = new Parser();
    const csv = parser.parse(data);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="error-samples-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } else {
    res.json({ 
      generatedAt: new Date().toISOString(),
      totalErrorSamples: data.length,
      errorStatuses,
      samples: data 
    });
  }
});

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`知识库问答引用校验器服务运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
