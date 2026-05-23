const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../database');
const config = require('../config');
const { recordChanges } = require('../utils/audit');

const TABLE_NAME = 'maintenance_notes';

function createMaintenanceNote(data, operator, batchId = null) {
  const db = getDatabase();
  
  const note = {
    id: uuidv4(),
    batch_id: batchId,
    room_no: data.room_no,
    issue_type: data.issue_type,
    description: data.description,
    reporter: data.reporter || null,
    report_time: dayjs(data.report_time || new Date()).valueOf(),
    image_urls: data.image_urls ? JSON.stringify(data.image_urls) : null,
    priority: data.priority || 'normal',
    status: data.status || 'pending',
    workflow_status: data.workflow_status || config.workflow.DRAFT,
    handler: data.handler || null,
    handle_time: data.handle_time ? dayjs(data.handle_time).valueOf() : null,
    handle_result: data.handle_result || null,
    operator_id: operator.id,
    operator_name: operator.name,
    created_at: dayjs().valueOf(),
    updated_at: dayjs().valueOf(),
  };

  const stmt = db.prepare(`
    INSERT INTO maintenance_notes (
      id, batch_id, room_no, issue_type, description, reporter, report_time,
      image_urls, priority, status, workflow_status, handler, handle_time,
      handle_result, operator_id, operator_name, created_at, updated_at
    ) VALUES (
      @id, @batch_id, @room_no, @issue_type, @description, @reporter, @report_time,
      @image_urls, @priority, @status, @workflow_status, @handler, @handle_time,
      @handle_result, @operator_id, @operator_name, @created_at, @updated_at
    )
  `);

  stmt.run(note);
  
  recordChanges(TABLE_NAME, note.id, null, note, operator, '创建维修备注', batchId, ['id', 'created_at', 'updated_at']);
  
  return note;
}

function updateMaintenanceNote(id, data, operator, changeReason = '更新维修备注', batchId = null) {
  const db = getDatabase();
  
  const oldNote = getMaintenanceNoteById(id);
  if (!oldNote) {
    throw new Error('维修备注不存在');
  }

  const updateData = {
    ...data,
    updated_at: dayjs().valueOf(),
    operator_id: operator.id,
    operator_name: operator.name,
  };

  if (data.report_time) {
    updateData.report_time = dayjs(data.report_time).valueOf();
  }
  if (data.handle_time) {
    updateData.handle_time = dayjs(data.handle_time).valueOf();
  }
  if (data.image_urls) {
    updateData.image_urls = JSON.stringify(data.image_urls);
  }

  const fields = Object.keys(updateData);
  const setClauses = fields.map(f => `${f} = ?`).join(', ');
  const values = [...fields.map(f => updateData[f]), id];

  const stmt = db.prepare(`UPDATE maintenance_notes SET ${setClauses} WHERE id = ?`);
  stmt.run(...values);

  const newNote = getMaintenanceNoteById(id);
  recordChanges(TABLE_NAME, id, oldNote, newNote, operator, changeReason, batchId, ['updated_at']);

  return newNote;
}

function getMaintenanceNoteById(id) {
  const db = getDatabase();
  
  const stmt = db.prepare('SELECT * FROM maintenance_notes WHERE id = ?');
  const note = stmt.get(id);
  
  if (note) {
    note.image_urls = note.image_urls ? JSON.parse(note.image_urls) : null;
    note.report_time = dayjs(note.report_time).format('YYYY-MM-DD HH:mm:ss');
    note.handle_time = note.handle_time ? dayjs(note.handle_time).format('YYYY-MM-DD HH:mm:ss') : null;
    note.created_at = dayjs(note.created_at).format('YYYY-MM-DD HH:mm:ss');
    note.updated_at = dayjs(note.updated_at).format('YYYY-MM-DD HH:mm:ss');
  }
  
  return note;
}

function getMaintenanceNoteList(filters = {}) {
  const db = getDatabase();
  let sql = 'SELECT * FROM maintenance_notes WHERE 1=1';
  const params = [];

  if (filters.room_no) {
    sql += ' AND room_no = ?';
    params.push(filters.room_no);
  }
  if (filters.issue_type) {
    sql += ' AND issue_type = ?';
    params.push(filters.issue_type);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.priority) {
    sql += ' AND priority = ?';
    params.push(filters.priority);
  }
  if (filters.workflow_status) {
    sql += ' AND workflow_status = ?';
    params.push(filters.workflow_status);
  }

  sql += ' ORDER BY report_time DESC LIMIT ? OFFSET ?';
  params.push(filters.limit || 50, filters.offset || 0);

  const stmt = db.prepare(sql);
  const notes = stmt.all(...params);

  return notes.map(note => ({
    ...note,
    image_urls: note.image_urls ? JSON.parse(note.image_urls) : null,
    report_time: dayjs(note.report_time).format('YYYY-MM-DD HH:mm:ss'),
    handle_time: note.handle_time ? dayjs(note.handle_time).format('YYYY-MM-DD HH:mm:ss') : null,
    created_at: dayjs(note.created_at).format('YYYY-MM-DD HH:mm:ss'),
    updated_at: dayjs(note.updated_at).format('YYYY-MM-DD HH:mm:ss'),
  }));
}

function updateWorkflowStatus(id, newStatus, operator, remark = null) {
  return updateMaintenanceNote(id, { workflow_status: newStatus }, operator, remark || `状态变更为${newStatus}`);
}

function batchImportNotes(notes, operator, mergeStrategy = config.mergeStrategy.APPEND) {
  const results = {
    total: notes.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < notes.length; i++) {
    try {
      createMaintenanceNote(notes[i], operator);
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({ index: i, error: err.message, data: notes[i] });
    }
  }

  return results;
}

module.exports = {
  createMaintenanceNote,
  updateMaintenanceNote,
  getMaintenanceNoteById,
  getMaintenanceNoteList,
  updateWorkflowStatus,
  batchImportNotes,
  TABLE_NAME,
};
