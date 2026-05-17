const { run, get, all } = require('./db');
const moment = require('moment');

const STATUS = {
  NOT_ENABLED: 'not_enabled',
  IN_GRAY: 'in_gray',
  SWITCHED: 'switched',
  ROLLED_BACK: 'rolled_back'
};

const STATUS_MAP = {
  not_enabled: '未启用',
  in_gray: '灰度中',
  switched: '已切换',
  rolled_back: '已回滚'
};

async function addHistory(rotation_id, action, old_status, new_status, operator, remark) {
  await run(
    `INSERT INTO rotation_history (rotation_id, action, old_status, new_status, operator, remark) VALUES (?, ?, ?, ?, ?, ?)`,
    [rotation_id, action, old_status, new_status, operator || 'system', remark || '']
  );
}

async function createRotation(data) {
  const { app_key, callback_url, old_signature_version, new_signature_version, old_key_expire_time, operator } = data;

  const existing = await get(
    `SELECT * FROM signature_rotations WHERE app_key = ? AND old_signature_version = ? AND new_signature_version = ?`,
    [app_key, old_signature_version, new_signature_version]
  );

  if (existing) {
    throw new Error('该应用的签名版本轮换记录已存在，不能静默覆盖');
  }

  const result = await run(
    `INSERT INTO signature_rotations 
     (app_key, callback_url, old_signature_version, new_signature_version, current_signature_version, status, old_key_expire_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [app_key, callback_url, old_signature_version, new_signature_version, old_signature_version, STATUS.NOT_ENABLED, old_key_expire_time]
  );

  await addHistory(result.lastID, 'create', null, STATUS.NOT_ENABLED, operator, '创建轮换记录');

  return result.lastID;
}

async function updateRotation(id, data) {
  const { callback_url, old_key_expire_time, operator, remark } = data;
  
  const rotation = await get(`SELECT * FROM signature_rotations WHERE id = ?`, [id]);
  if (!rotation) {
    throw new Error('轮换记录不存在');
  }

  if (rotation.status !== STATUS.NOT_ENABLED) {
    throw new Error('仅未启用状态的记录可修改');
  }

  await run(
    `UPDATE signature_rotations SET callback_url = ?, old_key_expire_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [callback_url || rotation.callback_url, old_key_expire_time || rotation.old_key_expire_time, id]
  );

  await addHistory(id, 'update', rotation.status, rotation.status, operator, remark || '修改轮换记录');

  return true;
}

async function startGray(id, operator) {
  const rotation = await get(`SELECT * FROM signature_rotations WHERE id = ?`, [id]);
  if (!rotation) {
    throw new Error('轮换记录不存在');
  }

  if (rotation.status !== STATUS.NOT_ENABLED) {
    throw new Error('仅未启用状态的记录可开始灰度');
  }

  await run(
    `UPDATE signature_rotations SET status = ?, gray_start_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [STATUS.IN_GRAY, id]
  );

  await addHistory(id, 'start_gray', rotation.status, STATUS.IN_GRAY, operator, '开始灰度');

  return true;
}

async function approveSwitch(id, operator) {
  const rotation = await get(`SELECT * FROM signature_rotations WHERE id = ?`, [id]);
  if (!rotation) {
    throw new Error('轮换记录不存在');
  }

  if (rotation.status !== STATUS.IN_GRAY) {
    throw new Error('仅灰度中状态的记录可审核切换');
  }

  await run(
    `UPDATE signature_rotations SET status = ?, current_signature_version = new_signature_version, switch_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [STATUS.SWITCHED, id]
  );

  await addHistory(id, 'approve_switch', rotation.status, STATUS.SWITCHED, operator, '审核通过并切换签名版本');

  return true;
}

async function rollback(id, operator, remark) {
  const rotation = await get(`SELECT * FROM signature_rotations WHERE id = ?`, [id]);
  if (!rotation) {
    throw new Error('轮换记录不存在');
  }

  if (rotation.status !== STATUS.SWITCHED && rotation.status !== STATUS.IN_GRAY) {
    throw new Error('仅灰度中或已切换状态的记录可回滚');
  }

  await run(
    `UPDATE signature_rotations SET status = ?, current_signature_version = old_signature_version, rollback_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [STATUS.ROLLED_BACK, id]
  );

  await addHistory(id, 'rollback', rotation.status, STATUS.ROLLED_BACK, operator, remark || '回滚签名版本');

  return true;
}

async function getList(params = {}) {
  const { app_key, status, page = 1, pageSize = 20 } = params;
  
  let whereConditions = [];
  let queryParams = [];

  if (app_key) {
    whereConditions.push('sr.app_key = ?');
    queryParams.push(app_key);
  }

  if (status) {
    whereConditions.push('sr.status = ?');
    queryParams.push(status);
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  
  const offset = (page - 1) * pageSize;
  queryParams.push(pageSize, offset);

  const list = await all(
    `SELECT sr.*, 
            (SELECT COUNT(*) FROM rotation_history rh WHERE rh.rotation_id = sr.id) as history_count,
            (SELECT COUNT(*) FROM callback_retries cr WHERE cr.rotation_id = sr.id) as retry_count
     FROM signature_rotations sr 
     ${whereClause}
     ORDER BY sr.created_at DESC 
     LIMIT ? OFFSET ?`,
    queryParams
  );

  const totalResult = await get(
    `SELECT COUNT(*) as total FROM signature_rotations sr ${whereClause}`,
    queryParams.slice(0, -2)
  );

  return {
    list: list.map(item => ({
      ...item,
      status_text: STATUS_MAP[item.status] || item.status
    })),
    total: totalResult.total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  };
}

async function getDetail(id) {
  const rotation = await get(
    `SELECT sr.*, 
            (SELECT COUNT(*) FROM rotation_history rh WHERE rh.rotation_id = sr.id) as history_count,
            (SELECT COUNT(*) FROM callback_retries cr WHERE cr.rotation_id = sr.id) as retry_count
     FROM signature_rotations sr WHERE sr.id = ?`,
    [id]
  );

  if (!rotation) {
    throw new Error('轮换记录不存在');
  }

  const history = await all(
    `SELECT * FROM rotation_history WHERE rotation_id = ? ORDER BY created_at DESC`,
    [id]
  );

  const retries = await all(
    `SELECT * FROM callback_retries WHERE rotation_id = ? ORDER BY last_retry_time DESC`,
    [id]
  );

  return {
    ...rotation,
    status_text: STATUS_MAP[rotation.status] || rotation.status,
    history,
    retries
  };
}

async function getHistory(id) {
  const history = await all(
    `SELECT * FROM rotation_history WHERE rotation_id = ? ORDER BY created_at DESC`,
    [id]
  );

  return history;
}

async function exportData(params = {}) {
  const { app_key, status } = params;
  
  let whereConditions = [];
  let queryParams = [];

  if (app_key) {
    whereConditions.push('app_key = ?');
    queryParams.push(app_key);
  }

  if (status) {
    whereConditions.push('status = ?');
    queryParams.push(status);
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  const data = await all(
    `SELECT * FROM signature_rotations ${whereClause} ORDER BY created_at DESC`,
    queryParams
  );

  return data.map(item => ({
    ...item,
    status_text: STATUS_MAP[item.status] || item.status
  }));
}

async function recordCallbackRetry(app_key, signature_version, callback_url) {
  const rotation = await get(
    `SELECT * FROM signature_rotations WHERE app_key = ? AND (old_signature_version = ? OR new_signature_version = ?)`,
    [app_key, signature_version, signature_version]
  );

  if (!rotation) {
    return null;
  }

  const existingRetry = await get(
    `SELECT * FROM callback_retries WHERE rotation_id = ? AND signature_version = ?`,
    [rotation.id, signature_version]
  );

  if (existingRetry) {
    await run(
      `UPDATE callback_retries SET retry_count = retry_count + 1, last_retry_time = CURRENT_TIMESTAMP WHERE id = ?`,
      [existingRetry.id]
    );
  } else {
    await run(
      `INSERT INTO callback_retries (rotation_id, app_key, signature_version, callback_url) VALUES (?, ?, ?, ?)`,
      [rotation.id, app_key, signature_version, callback_url]
    );
  }

  return rotation.id;
}

async function incrementFailCount(id) {
  await run(
    `UPDATE signature_rotations SET fail_count = fail_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [id]
  );
  return true;
}

module.exports = {
  STATUS,
  STATUS_MAP,
  createRotation,
  updateRotation,
  startGray,
  approveSwitch,
  rollback,
  getList,
  getDetail,
  getHistory,
  exportData,
  recordCallbackRetry,
  incrementFailCount
};
