const {
  createMaintenanceNote,
  updateMaintenanceNote,
  getMaintenanceNoteById,
  getMaintenanceNoteList,
  batchImportNotes,
  TABLE_NAME,
} = require('../models/maintenanceNote');
const { createBatch, updateBatchStats } = require('../models/batch');
const { getWorkflowHistory } = require('../utils/workflow');
const { getChangeHistory } = require('../utils/audit');
const config = require('../config');

function createNote(req, res) {
  try {
    const note = createMaintenanceNote(req.body, req.user);
    res.json({ success: true, data: note });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function updateNote(req, res) {
  try {
    const { id } = req.params;
    const { change_reason, ...data } = req.body;
    const note = updateMaintenanceNote(id, data, req.user, change_reason || '更新维修备注');
    res.json({ success: true, data: note });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function getNote(req, res) {
  try {
    const { id } = req.params;
    const note = getMaintenanceNoteById(id);
    if (!note) {
      return res.status(404).json({ success: false, error: '维修备注不存在' });
    }
    res.json({ success: true, data: note });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function listNotes(req, res) {
  try {
    const notes = getMaintenanceNoteList(req.query);
    res.json({ success: true, data: notes });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function importNotes(req, res) {
  try {
    const { notes, merge_strategy } = req.body;
    const mergeStrategy = merge_strategy || config.mergeStrategy.APPEND;
    
    const batch = createBatch('maintenance', req.user, mergeStrategy);
    
    const results = batchImportNotes(notes, req.user, mergeStrategy);
    
    updateBatchStats(batch.id, results.total, results.success, results.failed);
    
    res.json({
      success: true,
      data: {
        batch_id: batch.id,
        batch_no: batch.batch_no,
        ...results,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function getNoteHistory(req, res) {
  try {
    const { id } = req.params;
    const history = getChangeHistory(TABLE_NAME, id);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function getNoteWorkflow(req, res) {
  try {
    const { id } = req.params;
    const history = getWorkflowHistory(TABLE_NAME, id);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  createNote,
  updateNote,
  getNote,
  listNotes,
  importNotes,
  getNoteHistory,
  getNoteWorkflow,
};
