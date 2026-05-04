import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database.js';

const router = Router();

router.get('/:sessionId/issues', (req, res) => {
  const db = getDB();
  const { sessionId } = req.params;
  
  const issues = db.prepare(`
    SELECT * FROM identified_issues 
    WHERE session_id = ?
    ORDER BY 
      CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        ELSE 5 
      END,
      created_at DESC
  `).all(sessionId);
  
  const result = issues.map(issue => ({
    ...issue,
    details: issue.details ? JSON.parse(issue.details) : null
  }));
  
  res.json(result);
});

router.get('/:sessionId/notes', (req, res) => {
  const db = getDB();
  const { sessionId } = req.params;
  
  const notes = db.prepare(`
    SELECT * FROM review_notes 
    WHERE session_id = ?
    ORDER BY reviewed_at DESC
  `).all(sessionId);
  
  res.json(notes);
});

router.post('/:sessionId/notes', (req, res) => {
  const db = getDB();
  const { sessionId } = req.params;
  const { issue_id, note_type, content, reviewed_by } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: '备注内容不能为空' });
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO review_notes (id, session_id, issue_id, note_type, content, reviewed_by, reviewed_at, is_resolved)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    id,
    sessionId,
    issue_id || null,
    note_type || 'general',
    content,
    reviewed_by || '匿名',
    now
  );
  
  const newNote = db.prepare(`SELECT * FROM review_notes WHERE id = ?`).get(id);
  res.status(201).json(newNote);
});

router.put('/notes/:noteId', (req, res) => {
  const db = getDB();
  const { noteId } = req.params;
  const { content, is_resolved, resolution } = req.body;
  
  const existing = db.prepare(`SELECT id FROM review_notes WHERE id = ?`).get(noteId);
  if (!existing) {
    return res.status(404).json({ error: '备注不存在' });
  }
  
  const now = new Date().toISOString();
  
  const updateFields = [];
  const updateValues = [];
  
  if (content !== undefined) {
    updateFields.push('content = ?');
    updateValues.push(content);
  }
  
  if (is_resolved !== undefined) {
    updateFields.push('is_resolved = ?');
    updateValues.push(is_resolved ? 1 : 0);
  }
  
  if (resolution !== undefined) {
    updateFields.push('resolution = ?');
    updateValues.push(resolution);
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }
  
  updateFields.push('reviewed_at = ?');
  updateValues.push(now);
  
  updateValues.push(noteId);
  
  const stmt = db.prepare(`
    UPDATE review_notes SET ${updateFields.join(', ')} WHERE id = ?
  `);
  
  stmt.run(...updateValues);
  
  const updated = db.prepare(`SELECT * FROM review_notes WHERE id = ?`).get(noteId);
  res.json(updated);
});

router.delete('/notes/:noteId', (req, res) => {
  const db = getDB();
  const { noteId } = req.params;
  
  const existing = db.prepare(`SELECT id FROM review_notes WHERE id = ?`).get(noteId);
  if (!existing) {
    return res.status(404).json({ error: '备注不存在' });
  }
  
  db.prepare(`DELETE FROM review_notes WHERE id = ?`).run(noteId);
  res.json({ success: true, message: '备注已删除' });
});

router.post('/:sessionId/issues/:issueId/resolve', (req, res) => {
  const db = getDB();
  const { sessionId, issueId } = req.params;
  const { resolution, reviewed_by } = req.body;
  
  const noteId = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO review_notes (id, session_id, issue_id, note_type, content, reviewed_by, reviewed_at, is_resolved, resolution)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    noteId,
    sessionId,
    issueId,
    'resolution',
    resolution || '问题已复核确认',
    reviewed_by || '匿名',
    now,
    resolution || '问题已复核确认'
  );
  
  const note = db.prepare(`SELECT * FROM review_notes WHERE id = ?`).get(noteId);
  res.status(201).json(note);
});

router.get('/:sessionId/summary', (req, res) => {
  const db = getDB();
  const { sessionId } = req.params;
  
  const issues = db.prepare(`
    SELECT severity, COUNT(*) as count
    FROM identified_issues 
    WHERE session_id = ?
    GROUP BY severity
  `).all(sessionId);
  
  const issueTypes = db.prepare(`
    SELECT issue_type, severity, COUNT(*) as count
    FROM identified_issues 
    WHERE session_id = ?
    GROUP BY issue_type, severity
  `).all(sessionId);
  
  const notes = db.prepare(`
    SELECT COUNT(*) as total, SUM(CASE WHEN is_resolved = 1 THEN 1 ELSE 0 END) as resolved
    FROM review_notes 
    WHERE session_id = ?
  `).get(sessionId);
  
  const session = db.prepare(`
    SELECT name, created_at, updated_at
    FROM training_sessions 
    WHERE id = ?
  `).get(sessionId);
  
  const severityMap = { critical: 0, high: 0, medium: 0, low: 0 };
  issues.forEach(i => {
    severityMap[i.severity] = i.count;
  });
  
  res.json({
    session: session,
    issues: {
      bySeverity: severityMap,
      total: severityMap.critical + severityMap.high + severityMap.medium + severityMap.low,
      byType: issueTypes
    },
    notes: {
      total: notes.total || 0,
      resolved: notes.resolved || 0,
      unresolved: (notes.total || 0) - (notes.resolved || 0)
    }
  });
});

export default router;
