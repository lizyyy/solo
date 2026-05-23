const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../database');
const config = require('../config');
const { recordChanges } = require('../utils/audit');

const TABLE_NAME = 'cleaning_messages';

function createCleaningMessage(data, operator, batchId = null) {
  const db = getDatabase();
  
  const message = {
    id: uuidv4(),
    batch_id: batchId,
    message_id: data.message_id || uuidv4(),
    room_no: data.room_no || null,
    cleaner_name: data.cleaner_name || null,
    cleaner_phone: data.cleaner_phone || null,
    message_type: data.message_type,
    content: data.content,
    image_urls: data.image_urls ? JSON.stringify(data.image_urls) : null,
    send_time: dayjs(data.send_time || new Date()).valueOf(),
    sender_name: data.sender_name || null,
    status: data.status || 'pending',
    workflow_status: data.workflow_status || config.workflow.DRAFT,
    operator_id: operator.id,
    operator_name: operator.name,
    created_at: dayjs().valueOf(),
    updated_at: dayjs().valueOf(),
  };

  const stmt = db.prepare(`
    INSERT INTO cleaning_messages (
      id, batch_id, message_id, room_no, cleaner_name, cleaner_phone,
      message_type, content, image_urls, send_time, sender_name,
      status, workflow_status, operator_id, operator_name, created_at, updated_at
    ) VALUES (
      @id, @batch_id, @message_id, @room_no, @cleaner_name, @cleaner_phone,
      @message_type, @content, @image_urls, @send_time, @sender_name,
      @status, @workflow_status, @operator_id, @operator_name, @created_at, @updated_at
    )
  `);

  stmt.run(message);
  
  recordChanges(TABLE_NAME, message.id, null, message, operator, '创建保洁消息', batchId, ['id', 'created_at', 'updated_at']);
  
  return message;
}

function findExistingMessage(messageId) {
  const db = getDatabase();
  
  const stmt = db.prepare('SELECT * FROM cleaning_messages WHERE message_id = ? LIMIT 1');
  return stmt.get(messageId);
}

function updateCleaningMessage(id, data, operator, changeReason = '更新保洁消息', batchId = null) {
  const db = getDatabase();
  
  const oldMessage = getCleaningMessageById(id);
  if (!oldMessage) {
    throw new Error('消息不存在');
  }

  const updateData = {
    ...data,
    updated_at: dayjs().valueOf(),
    operator_id: operator.id,
    operator_name: operator.name,
  };

  if (data.send_time) {
    updateData.send_time = dayjs(data.send_time).valueOf();
  }
  if (data.image_urls) {
    updateData.image_urls = JSON.stringify(data.image_urls);
  }

  const fields = Object.keys(updateData);
  const setClauses = fields.map(f => `${f} = ?`).join(', ');
  const values = [...fields.map(f => updateData[f]), id];

  const stmt = db.prepare(`UPDATE cleaning_messages SET ${setClauses} WHERE id = ?`);
  stmt.run(...values);

  const newMessage = getCleaningMessageById(id);
  recordChanges(TABLE_NAME, id, oldMessage, newMessage, operator, changeReason, batchId, ['updated_at']);

  return newMessage;
}

function getCleaningMessageById(id) {
  const db = getDatabase();
  
  const stmt = db.prepare('SELECT * FROM cleaning_messages WHERE id = ?');
  const message = stmt.get(id);
  
  if (message) {
    message.image_urls = message.image_urls ? JSON.parse(message.image_urls) : null;
    message.send_time = dayjs(message.send_time).format('YYYY-MM-DD HH:mm:ss');
    message.created_at = dayjs(message.created_at).format('YYYY-MM-DD HH:mm:ss');
    message.updated_at = dayjs(message.updated_at).format('YYYY-MM-DD HH:mm:ss');
  }
  
  return message;
}

function getCleaningMessageList(filters = {}) {
  const db = getDatabase();
  let sql = 'SELECT * FROM cleaning_messages WHERE 1=1';
  const params = [];

  if (filters.room_no) {
    sql += ' AND room_no = ?';
    params.push(filters.room_no);
  }
  if (filters.message_type) {
    sql += ' AND message_type = ?';
    params.push(filters.message_type);
  }
  if (filters.start_time) {
    sql += ' AND send_time >= ?';
    params.push(dayjs(filters.start_time).valueOf());
  }
  if (filters.end_time) {
    sql += ' AND send_time <= ?';
    params.push(dayjs(filters.end_time).valueOf());
  }
  if (filters.workflow_status) {
    sql += ' AND workflow_status = ?';
    params.push(filters.workflow_status);
  }

  sql += ' ORDER BY send_time DESC LIMIT ? OFFSET ?';
  params.push(filters.limit || 50, filters.offset || 0);

  const stmt = db.prepare(sql);
  const messages = stmt.all(...params);

  return messages.map(msg => ({
    ...msg,
    image_urls: msg.image_urls ? JSON.parse(msg.image_urls) : null,
    send_time: dayjs(msg.send_time).format('YYYY-MM-DD HH:mm:ss'),
    created_at: dayjs(msg.created_at).format('YYYY-MM-DD HH:mm:ss'),
    updated_at: dayjs(msg.updated_at).format('YYYY-MM-DD HH:mm:ss'),
  }));
}

function updateWorkflowStatus(id, newStatus, operator, remark = null) {
  return updateCleaningMessage(id, { workflow_status: newStatus }, operator, remark || `状态变更为${newStatus}`);
}

function batchImportMessages(messages, operator, mergeStrategy = config.mergeStrategy.APPEND) {
  const results = {
    total: messages.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < messages.length; i++) {
    try {
      const msgData = messages[i];
      const existing = msgData.message_id ? findExistingMessage(msgData.message_id) : null;

      if (existing) {
        if (mergeStrategy === config.mergeStrategy.IGNORE) {
          results.skipped++;
          continue;
        } else if (mergeStrategy === config.mergeStrategy.OVERWRITE) {
          updateCleaningMessage(existing.id, msgData, operator, '批量导入-覆盖');
          results.success++;
        } else {
          createCleaningMessage(msgData, operator);
          results.success++;
        }
      } else {
        createCleaningMessage(msgData, operator);
        results.success++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ index: i, error: err.message, data: messages[i] });
    }
  }

  return results;
}

module.exports = {
  createCleaningMessage,
  updateCleaningMessage,
  getCleaningMessageById,
  getCleaningMessageList,
  updateWorkflowStatus,
  findExistingMessage,
  batchImportMessages,
  TABLE_NAME,
};
