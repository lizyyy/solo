const { getDb, runQuery, getOne, getAll } = require('../db');
const appConfig = require('../../config/app');
const moment = require('moment');

function generateQueueNo() {
  const today = moment().format('YYYYMMDD');
  const lastQueue = getOne(
    `SELECT queue_no FROM queue_numbers WHERE queue_no LIKE ? ORDER BY id DESC LIMIT 1`,
    [`Q${today}%`]
  );
  
  let seq = 1;
  if (lastQueue) {
    const match = lastQueue.queue_no.match(/Q\d{8}(\d{3})/);
    if (match) {
      seq = parseInt(match[1]) + 1;
    }
  }
  return `Q${today}${String(seq).padStart(3, '0')}`;
}

function getNextPosition() {
  const maxPos = getOne(
    `SELECT MAX(position) as max_pos FROM queue_numbers WHERE status IN ('等待中', '服务中')`
  );
  return (maxPos?.max_pos || 0) + 1;
}

function checkDuplicateQueue(memberId) {
  if (!memberId) return false;
  const existing = getOne(
    `SELECT id FROM queue_numbers WHERE member_id = ? AND status IN ('等待中', '服务中') LIMIT 1`,
    [memberId]
  );
  return !!existing;
}

function createQueueNumber(data) {
  const { member_id, appointment_id, service_type } = data;

  if (!appConfig.serviceTypes.includes(service_type)) {
    throw { status: 400, message: '无效的服务类型', conclusion: '服务类型不在允许列表中' };
  }

  if (checkDuplicateQueue(member_id)) {
    throw { status: 400, message: '该会员已有正在等待或服务中的排队号', conclusion: '拦截重复取号请求' };
  }

  const queueNo = generateQueueNo();
  const position = getNextPosition();

  const result = runQuery(
    `INSERT INTO queue_numbers (queue_no, member_id, appointment_id, service_type, position, status)
     VALUES (?, ?, ?, ?, ?, '等待中')`,
    [queueNo, member_id, appointment_id, service_type, position]
  );

  return getOne(`SELECT * FROM queue_numbers WHERE id = ?`, [result.lastInsertRowid]);
}

function getQueueList(status = null) {
  let sql = `
    SELECT q.*, m.name as member_name, m.phone, s.name as station_name
    FROM queue_numbers q
    LEFT JOIN members m ON q.member_id = m.id
    LEFT JOIN stations s ON q.station_id = s.id
  `;
  const params = [];

  if (status) {
    sql += ` WHERE q.status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY q.position ASC`;

  return getAll(sql, params);
}

function getQueueById(id) {
  return getOne(
    `SELECT q.*, m.name as member_name, m.phone, s.name as station_name
     FROM queue_numbers q
     LEFT JOIN members m ON q.member_id = m.id
     LEFT JOIN stations s ON q.station_id = s.id
     WHERE q.id = ?`,
    [id]
  );
}

function callNextQueue() {
  const db = getDb();
  const nextQueue = getOne(
    `SELECT id FROM queue_numbers WHERE status = '等待中' ORDER BY position ASC LIMIT 1`
  );

  if (!nextQueue) {
    throw { status: 404, message: '没有等待中的排队号', conclusion: '队列为空' };
  }

  const freeStation = getOne(
    `SELECT id FROM stations WHERE status = '空闲' LIMIT 1`
  );

  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  runQuery(
    `UPDATE queue_numbers SET status = '服务中', called_at = ?, station_id = ?, started_at = ? WHERE id = ?`,
    [now, freeStation?.id || null, now, nextQueue.id]
  );

  if (freeStation) {
    runQuery(
      `UPDATE stations SET status = '忙碌', current_queue_id = ? WHERE id = ?`,
      [nextQueue.id, freeStation.id]
    );
  }

  return getQueueById(nextQueue.id);
}

function completeQueue(id) {
  const queue = getQueueById(id);
  if (!queue) {
    throw { status: 404, message: '排队号不存在', conclusion: '找不到对应排队记录' };
  }

  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  runQuery(
    `UPDATE queue_numbers SET status = '已完成', completed_at = ? WHERE id = ?`,
    [now, id]
  );

  if (queue.station_id) {
    runQuery(
      `UPDATE stations SET status = '空闲', current_queue_id = NULL WHERE id = ?`,
      [queue.station_id]
    );
  }

  return getQueueById(id);
}

function markOvernumber(id, reason = '客户未到场') {
  const queue = getQueueById(id);
  if (!queue) {
    throw { status: 404, message: '排队号不存在', conclusion: '找不到对应排队记录' };
  }

  if (queue.status !== '等待中' && queue.status !== '服务中') {
    throw { status: 400, message: '该状态下无法标记过号', conclusion: '状态不允许过号操作' };
  }

  const db = getDb();
  const now = moment().format('YYYY-MM-DD HH:mm:ss');

  runQuery(`UPDATE queue_numbers SET status = '已过号' WHERE id = ?`, [id]);

  if (queue.station_id) {
    runQuery(
      `UPDATE stations SET status = '空闲', current_queue_id = NULL WHERE id = ?`,
      [queue.station_id]
    );
  }

  runQuery(
    `INSERT INTO overnumber_records (queue_id, original_queue_no, reason) VALUES (?, ?, ?)`,
    [id, queue.queue_no, reason]
  );

  return getQueueById(id);
}

function requeueOvernumber(id) {
  const overRecord = getOne(
    `SELECT * FROM overnumber_records WHERE queue_id = ? ORDER BY id DESC LIMIT 1`,
    [id]
  );

  if (!overRecord) {
    throw { status: 404, message: '未找到过号记录', conclusion: '无法进行补排' };
  }

  if (overRecord.new_queue_id) {
    throw { status: 400, message: '该过号记录已补排过', conclusion: '禁止重复补排' };
  }

  const originalQueue = getQueueById(id);
  const newPosition = getNextPosition() + appConfig.overnumberWaitCount;
  const newQueueNo = generateQueueNo();

  const db = getDb();
  
  const result = runQuery(
    `INSERT INTO queue_numbers (queue_no, member_id, service_type, position, status)
     VALUES (?, ?, ?, ?, '等待中')`,
    [newQueueNo, originalQueue.member_id, originalQueue.service_type, newPosition]
  );

  runQuery(
    `UPDATE overnumber_records SET new_queue_id = ?, requeue_count = requeue_count + 1 WHERE id = ?`,
    [result.lastInsertRowid, overRecord.id]
  );

  return getQueueById(result.lastInsertRowid);
}

function cancelQueue(id) {
  const queue = getQueueById(id);
  if (!queue) {
    throw { status: 404, message: '排队号不存在', conclusion: '找不到对应排队记录' };
  }

  if (queue.status === '已完成' || queue.status === '已取消') {
    throw { status: 400, message: '该状态下无法取消', conclusion: '状态不允许取消操作' };
  }

  if (queue.station_id) {
    runQuery(
      `UPDATE stations SET status = '空闲', current_queue_id = NULL WHERE id = ?`,
      [queue.station_id]
    );
  }

  runQuery(`UPDATE queue_numbers SET status = '已取消' WHERE id = ?`, [id]);

  return getQueueById(id);
}

function manualUpdateQueue(id, data) {
  const queue = getQueueById(id);
  if (!queue) {
    throw { status: 404, message: '排队号不存在', conclusion: '找不到对应排队记录' };
  }

  const allowedFields = ['status', 'position', 'station_id'];
  const updates = [];
  const params = [];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      if (field === 'status' && !appConfig.queueStatuses.includes(data[field])) {
        throw { status: 400, message: '无效的状态值', conclusion: '状态不在允许列表中' };
      }
      updates.push(`${field} = ?`);
      params.push(data[field]);
    }
  }

  if (updates.length === 0) {
    throw { status: 400, message: '没有有效更新字段', conclusion: '请求参数无效' };
  }

  params.push(id);
  runQuery(`UPDATE queue_numbers SET ${updates.join(', ')} WHERE id = ?`, params);

  return getQueueById(id);
}

module.exports = {
  generateQueueNo,
  createQueueNumber,
  getQueueList,
  getQueueById,
  callNextQueue,
  completeQueue,
  markOvernumber,
  requeueOvernumber,
  cancelQueue,
  manualUpdateQueue
};
