const {
  createCleaningMessage,
  updateCleaningMessage,
  getCleaningMessageById,
  getCleaningMessageList,
  batchImportMessages,
  TABLE_NAME,
} = require('../models/cleaningMessage');
const { createBatch, updateBatchStats } = require('../models/batch');
const { getWorkflowHistory } = require('../utils/workflow');
const { getChangeHistory } = require('../utils/audit');
const { maskSensitiveData } = require('../utils/export');
const config = require('../config');

function createMessage(req, res) {
  try {
    const message = createCleaningMessage(req.body, req.user);
    res.json({ success: true, data: message });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function updateMessage(req, res) {
  try {
    const { id } = req.params;
    const { change_reason, ...data } = req.body;
    const message = updateCleaningMessage(id, data, req.user, change_reason || '更新保洁消息');
    res.json({ success: true, data: message });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function getMessage(req, res) {
  try {
    const { id } = req.params;
    let message = getCleaningMessageById(id);
    if (!message) {
      return res.status(404).json({ success: false, error: '消息不存在' });
    }
    message = maskSensitiveData(message, req.user.role);
    res.json({ success: true, data: message });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function listMessages(req, res) {
  try {
    let messages = getCleaningMessageList(req.query);
    messages = messages.map(m => maskSensitiveData(m, req.user.role));
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function importMessages(req, res) {
  try {
    const { messages, merge_strategy } = req.body;
    const mergeStrategy = merge_strategy || config.mergeStrategy.APPEND;
    
    const batch = createBatch('cleaning_message', req.user, mergeStrategy);
    
    const results = batchImportMessages(messages, req.user, mergeStrategy);
    
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

function getMessageHistory(req, res) {
  try {
    const { id } = req.params;
    const history = getChangeHistory(TABLE_NAME, id);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function getMessageWorkflow(req, res) {
  try {
    const { id } = req.params;
    const history = getWorkflowHistory(TABLE_NAME, id);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  createMessage,
  updateMessage,
  getMessage,
  listMessages,
  importMessages,
  getMessageHistory,
  getMessageWorkflow,
};
