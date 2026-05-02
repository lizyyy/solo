import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, initDatabase } from './database.js';
import { StateMachine, CASE_STATES } from './state-machine.js';
import { RuleEngine } from './rule-engine.js';
import { ImportExportService } from './import-export.js';

const upload = multer({ storage: multer.memoryStorage() });
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let db;
let stateMachine;
let ruleEngine;
let importExport;

function ensureInitialized() {
  if (!db) {
    db = getDatabase();
    stateMachine = new StateMachine(db);
    ruleEngine = new RuleEngine(db);
    importExport = new ImportExportService(db);
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/cases', (req, res) => {
  ensureInitialized();
  const { status, search } = req.query;
  
  let query = 'SELECT * FROM cases WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (search) {
    query += ' AND (case_number LIKE ? OR patient_name LIKE ? OR doctor_name LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const cases = db.prepare(query).all(...params);
  
  const enriched = cases.map(c => ({
    ...c,
    statusDescription: stateMachine.getStateDescription(c.status)
  }));
  
  res.json(enriched);
});

app.get('/api/cases/:id', (req, res) => {
  ensureInitialized();
  const caseData = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
  
  if (!caseData) {
    return res.status(404).json({ error: 'Case not found' });
  }
  
  const teeth = db.prepare('SELECT * FROM teeth WHERE case_id = ? ORDER BY tooth_number').all(req.params.id);
  const prescriptions = db.prepare('SELECT * FROM prescriptions WHERE case_id = ?').all(req.params.id);
  const scanFiles = db.prepare('SELECT * FROM scan_files WHERE case_id = ?').all(req.params.id);
  const processSteps = db.prepare('SELECT * FROM process_steps WHERE case_id = ? ORDER BY step_order').all(req.params.id);
  const reworkRequests = db.prepare('SELECT * FROM rework_requests WHERE case_id = ? ORDER BY request_date DESC').all(req.params.id);
  const tryInFeedbacks = db.prepare('SELECT * FROM try_in_feedbacks WHERE case_id = ? ORDER BY feedback_date DESC').all(req.params.id);
  const versionHistory = db.prepare('SELECT * FROM version_history WHERE case_id = ? ORDER BY created_at ASC').all(req.params.id);
  
  const validation = ruleEngine.runFullCaseValidation(req.params.id);
  
  res.json({
    case: {
      ...caseData,
      statusDescription: stateMachine.getStateDescription(caseData.status),
      availableNextStates: stateMachine.getAvailableNextStates(caseData.status)
    },
    teeth,
    prescriptions,
    scanFiles,
    processSteps,
    reworkRequests,
    tryInFeedbacks,
    versionHistory,
    validation
  });
});

app.post('/api/cases', (req, res) => {
  ensureInitialized();
  const { caseNumber, patientName, doctorName, clinicName, notes } = req.body;
  
  const id = uuidv4();
  const status = CASE_STATES.PRESCRIPTION_RECEIVED;
  
  const stmt = db.prepare(`
    INSERT INTO cases (id, case_number, patient_name, doctor_name, clinic_name, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, caseNumber, patientName, doctorName, clinicName, status, notes);
  
  const newCase = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
  
  res.status(201).json(newCase);
});

app.put('/api/cases/:id/transition', (req, res) => {
  ensureInitialized();
  const { newState, changedBy, reason } = req.body;
  
  try {
    const result = stateMachine.transitionState(req.params.id, newState, changedBy, reason);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/cases/:id/teeth', (req, res) => {
  ensureInitialized();
  const { toothNumber, toothType } = req.body;
  
  const existing = db.prepare('SELECT * FROM teeth WHERE case_id = ? AND tooth_number = ? AND version = 1')
    .get(req.params.id, toothNumber);
  
  if (existing) {
    return res.status(400).json({ error: '该牙位已存在' });
  }
  
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO teeth (id, case_id, tooth_number, tooth_type, is_rework, rework_count, version, status)
    VALUES (?, ?, ?, ?, 0, 0, 1, 'PENDING')
  `);
  
  stmt.run(id, req.params.id, toothNumber, toothType);
  
  const newTooth = db.prepare('SELECT * FROM teeth WHERE id = ?').get(id);
  res.status(201).json(newTooth);
});

app.post('/api/rework-requests', (req, res) => {
  ensureInitialized();
  const { caseId, toothId, reasonCode, reasonDescription, reworkType, requestedBy, sourceStep, targetStep } = req.body;
  
  const toothViolations = toothId ? ruleEngine.checkDuplicateRework(toothId) : [];
  const errorViolation = toothViolations.find(v => v.severity === 'ERROR' || v.severity === 'CRITICAL');
  
  if (errorViolation) {
    return res.status(400).json({
      error: errorViolation.message,
      violation: errorViolation
    });
  }
  
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO rework_requests (
      id, case_id, tooth_id, request_date, reason_code,
      reason_description, rework_type, requested_by, source_step,
      target_step, status
    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, 'PENDING')
  `);
  
  stmt.run(id, caseId, toothId, reasonCode, reasonDescription, reworkType, requestedBy, sourceStep, targetStep);
  
  if (toothId) {
    db.prepare(`
      UPDATE teeth SET is_rework = 1, status = 'REWORK_NEEDED' WHERE id = ?
    `).run(toothId);
  }
  
  const newRequest = db.prepare('SELECT * FROM rework_requests WHERE id = ?').get(id);
  res.status(201).json(newRequest);
});

app.put('/api/rework-requests/:id/review', (req, res) => {
  ensureInitialized();
  const { status, reviewedBy, reviewNotes } = req.body;
  
  const request = db.prepare('SELECT * FROM rework_requests WHERE id = ?').get(req.params.id);
  
  if (!request) {
    return res.status(404).json({ error: 'Rework request not found' });
  }
  
  if (request.status !== 'PENDING') {
    return res.status(400).json({ error: '只有待审核状态才能进行复核' });
  }
  
  db.prepare(`
    UPDATE rework_requests 
    SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?
    WHERE id = ?
  `).run(status, reviewedBy, reviewNotes, req.params.id);
  
  if (status === 'APPROVED' && request.tooth_id) {
    const tooth = db.prepare('SELECT * FROM teeth WHERE id = ?').get(request.tooth_id);
    const newVersion = tooth.version + 1;
    
    const insertStmt = db.prepare(`
      INSERT INTO teeth (
        id, case_id, tooth_number, tooth_type, is_rework, rework_count, version, status
      ) VALUES (?, ?, ?, ?, 1, ?, ?, 'REWORK_IN_PROGRESS')
    `);
    
    const newToothId = uuidv4();
    insertStmt.run(
      newToothId, 
      tooth.case_id, 
      tooth.tooth_number, 
      tooth.tooth_type, 
      tooth.rework_count + 1, 
      newVersion
    );
    
    db.prepare(`
      UPDATE teeth SET version = ? WHERE id = ?
    `).run(newVersion, tooth.id);
    
    db.prepare(`
      INSERT INTO version_history (
        id, case_id, tooth_id, entity_type, entity_id, version,
        action, previous_status, new_status, changed_by, change_reason
      ) VALUES (?, ?, ?, 'TOOTH', ?, ?, 'NEW_VERSION', ?, ?, ?, ?)
    `).run(
      uuidv4(),
      tooth.case_id,
      request.tooth_id,
      request.tooth_id,
      newVersion,
      tooth.status,
      'REWORK_IN_PROGRESS',
      reviewedBy,
      `返工批准: ${reasonCode}`
    );
  }
  
  const updatedRequest = db.prepare('SELECT * FROM rework_requests WHERE id = ?').get(req.params.id);
  res.json(updatedRequest);
});

app.post('/api/try-in-feedbacks', (req, res) => {
  ensureInitialized();
  const { caseId, toothId, doctorName, fitStatus, occlusionStatus, estheticsStatus, notes, needsRework, reworkReason } = req.body;
  
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO try_in_feedbacks (
      id, case_id, tooth_id, feedback_date, doctor_name,
      fit_status, occlusion_status, esthetics_status, notes,
      needs_rework, rework_reason, is_followed_up
    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, 0)
  `);
  
  stmt.run(id, caseId, toothId, doctorName, fitStatus, occlusionStatus, estheticsStatus, notes, needsRework, reworkReason);
  
  const newFeedback = db.prepare('SELECT * FROM try_in_feedbacks WHERE id = ?').get(id);
  res.status(201).json(newFeedback);
});

app.put('/api/try-in-feedbacks/:id/follow-up', (req, res) => {
  ensureInitialized();
  const { followedUpBy } = req.body;
  
  db.prepare(`
    UPDATE try_in_feedbacks 
    SET is_followed_up = 1, followed_up_by = ?, followed_up_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(followedUpBy, req.params.id);
  
  const updated = db.prepare('SELECT * FROM try_in_feedbacks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.post('/api/import/:entityType', upload.single('file'), async (req, res) => {
  ensureInitialized();
  const { entityType } = req.params;
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const content = file.buffer.toString('utf-8');
  const isCSV = file.originalname.endsWith('.csv') || file.mimetype.includes('csv');
  
  try {
    let result;
    if (isCSV) {
      result = await importExport.importCSV(content, entityType);
    } else {
      result = importExport.importJSON(content, entityType);
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/export/:entityType', async (req, res) => {
  ensureInitialized();
  const { entityType } = req.params;
  const { format } = req.query;
  
  try {
    let content, contentType, extension;
    
    switch (format) {
      case 'csv':
        content = await importExport.exportCSV(entityType);
        contentType = 'text/csv';
        extension = 'csv';
        break;
      case 'json':
        content = importExport.exportJSON(entityType);
        contentType = 'application/json';
        extension = 'json';
        break;
      case 'markdown':
      case 'md':
        content = importExport.exportMarkdown(entityType);
        contentType = 'text/markdown';
        extension = 'md';
        break;
      default:
        return res.status(400).json({ error: `Unknown format: ${format}` });
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${entityType}.${extension}"`);
    res.send(content);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/dashboard', (req, res) => {
  ensureInitialized();
  
  const caseStats = db.prepare(`
    SELECT 
      status,
      COUNT(*) as count
    FROM cases
    GROUP BY status
  `).all();
  
  const reworkStats = db.prepare(`
    SELECT 
      reason_code,
      COUNT(*) as count,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_count
    FROM rework_requests
    GROUP BY reason_code
  `).all();
  
  const overdueFeedbacks = db.prepare(`
    SELECT 
      f.*,
      c.case_number,
      c.patient_name,
      t.tooth_number
    FROM try_in_feedbacks f
    LEFT JOIN cases c ON f.case_id = c.id
    LEFT JOIN teeth t ON f.tooth_id = t.id
    WHERE f.is_followed_up = 0
    ORDER BY f.feedback_date ASC
  `).all();
  
  const excessiveRework = db.prepare(`
    SELECT 
      t.*,
      c.case_number,
      c.patient_name
    FROM teeth t
    LEFT JOIN cases c ON t.case_id = c.id
    WHERE t.rework_count >= 2
    ORDER BY t.rework_count DESC
  `).all();
  
  const pendingReworks = db.prepare(`
    SELECT 
      r.*,
      c.case_number,
      c.patient_name,
      t.tooth_number
    FROM rework_requests r
    LEFT JOIN cases c ON r.case_id = c.id
    LEFT JOIN teeth t ON r.tooth_id = t.id
    WHERE r.status = 'PENDING'
    ORDER BY r.request_date ASC
  `).all();
  
  res.json({
    caseStats,
    reworkStats,
    overdueFeedbacks,
    excessiveRework,
    pendingReworks
  });
});

app.get('/api/validation/:caseId', (req, res) => {
  ensureInitialized();
  const validation = ruleEngine.runFullCaseValidation(req.params.id);
  res.json(validation);
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

export function startServer() {
  initDatabase();
  ensureInitialized();
  
  app.listen(PORT, () => {
    console.log(`义齿返工闭环台 后端服务运行在 http://localhost:${PORT}`);
  });
}

export { app };

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
