const { getDb, saveDb } = require('../db');
const { UUID, now, VOUCHER_STATUS, CAR_TYPES } = require('../utils');

const MAX_NO_SHOW = 2;

const getVoucherById = (voucherId) => {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM vouchers WHERE voucher_id = ?');
  stmt.bind([voucherId]);
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.reset();
    return result;
  }
  stmt.reset();
  return undefined;
};

const getDriverActiveVouchers = (driverId) => {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT * FROM vouchers WHERE driver_id = ? AND status IN (?, ?)'
  );
  stmt.bind([driverId, VOUCHER_STATUS.CREATED, VOUCHER_STATUS.IN_QUEUE]);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  return results;
};

const createVoucher = (driverId, terminalId, carType, createdBy = null) => {
  const db = getDb();
  const timestamp = now();

  const driverStmt = db.prepare('SELECT * FROM drivers WHERE driver_id = ?');
  driverStmt.bind([driverId]);
  const driver = driverStmt.step() ? driverStmt.getAsObject() : undefined;
  driverStmt.reset();

  if (!driver) {
    throw new Error('司机不存在');
  }

  if (!CAR_TYPES.includes(carType)) {
    throw new Error(`无效车型: ${carType}`);
  }

  const terminalStmt = db.prepare('SELECT * FROM terminals WHERE terminal_id = ? AND is_active = 1');
  terminalStmt.bind([terminalId]);
  const terminal = terminalStmt.step() ? terminalStmt.getAsObject() : undefined;
  terminalStmt.reset();

  if (!terminal) {
    throw new Error(`无效航站楼: ${terminalId}`);
  }

  const activeVouchers = getDriverActiveVouchers(driverId);
  if (activeVouchers.length > 0) {
    throw new Error('司机已有未完成的排队券');
  }

  const noShowStmt = db.prepare(
    'SELECT COUNT(*) as cnt FROM no_show_records WHERE driver_id = ? AND created_at > ?'
  );
  noShowStmt.bind([driverId, timestamp - 24 * 60 * 60 * 1000]);
  let noShowCount = 0;
  if (noShowStmt.step()) {
    const row = noShowStmt.getAsObject();
    noShowCount = row.cnt;
  }
  noShowStmt.reset();

  if (noShowCount >= MAX_NO_SHOW) {
    throw new Error('司机24小时内爽约次数过多，暂时无法领券');
  }

  const voucherId = UUID();
  db.run(
    `INSERT INTO vouchers (
      voucher_id, driver_id, terminal_id, car_type, status, 
      no_show_count, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      voucherId, driverId, terminalId, carType, VOUCHER_STATUS.CREATED,
      noShowCount, createdBy, timestamp, timestamp
    ]
  );
  saveDb();

  return getVoucherById(voucherId);
};

const advanceVoucher = (voucherId) => {
  const db = getDb();
  const timestamp = now();
  const voucher = getVoucherById(voucherId);

  if (!voucher) {
    throw new Error('排队券不存在');
  }

  if (voucher.status === VOUCHER_STATUS.CREATED) {
    const maxStmt = db.prepare(
      'SELECT MAX(position) as max_pos FROM terminal_queues WHERE terminal_id = ? AND car_type = ? AND exited_at IS NULL'
    );
    maxStmt.bind([voucher.terminal_id, voucher.car_type]);
    let currentMax = 0;
    if (maxStmt.step()) {
      const row = maxStmt.getAsObject();
      currentMax = row.max_pos || 0;
    }
    maxStmt.reset();

    const queueId = UUID();
    const newPosition = currentMax + 1;

    db.run(
      `INSERT INTO terminal_queues (
        queue_id, terminal_id, car_type, voucher_id, 
        position, entered_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [queueId, voucher.terminal_id, voucher.car_type, voucher.voucher_id, newPosition, timestamp]
    );

    db.run(
      'UPDATE vouchers SET status = ?, queue_position = ?, updated_at = ? WHERE voucher_id = ?',
      [VOUCHER_STATUS.IN_QUEUE, newPosition, timestamp, voucher.voucher_id]
    );
    saveDb();

    return { ...getVoucherById(voucherId), queue_position: newPosition };
  } else if (voucher.status === VOUCHER_STATUS.IN_QUEUE) {
    db.run(
      'UPDATE vouchers SET status = ?, updated_at = ? WHERE voucher_id = ?',
      [VOUCHER_STATUS.CALLED, timestamp, voucher.voucher_id]
    );
    saveDb();
    return getVoucherById(voucherId);
  } else if (voucher.status === VOUCHER_STATUS.CALLED) {
    db.run(
      'UPDATE terminal_queues SET exited_at = ?, exit_reason = ? WHERE voucher_id = ? AND exited_at IS NULL',
      [timestamp, 'COMPLETED', voucher.voucher_id]
    );

    db.run(
      'UPDATE vouchers SET status = ?, updated_at = ? WHERE voucher_id = ?',
      [VOUCHER_STATUS.COMPLETED, timestamp, voucher.voucher_id]
    );
    saveDb();
    return getVoucherById(voucherId);
  } else {
    throw new Error(`当前状态 ${voucher.status} 无法推进`);
  }
};

const recordNoShow = (voucherId, reason = null) => {
  const db = getDb();
  const timestamp = now();
  const voucher = getVoucherById(voucherId);

  if (!voucher) {
    throw new Error('排队券不存在');
  }

  if (voucher.status !== VOUCHER_STATUS.CALLED) {
    throw new Error('只有已叫号的排队券才能标记爽约');
  }

  db.run(
    'UPDATE terminal_queues SET exited_at = ?, exit_reason = ? WHERE voucher_id = ? AND exited_at IS NULL',
    [timestamp, 'NO_SHOW', voucher.voucher_id]
  );

  const newNoShowCount = (voucher.no_show_count || 0) + 1;

  db.run(
    'UPDATE vouchers SET status = ?, no_show_count = ?, updated_at = ? WHERE voucher_id = ?',
    [VOUCHER_STATUS.NO_SHOW, newNoShowCount, timestamp, voucher.voucher_id]
  );

  const recordId = UUID();
  db.run(
    `INSERT INTO no_show_records (
      record_id, voucher_id, driver_id, terminal_id, 
      car_type, count, reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recordId, voucher.voucher_id, voucher.driver_id, voucher.terminal_id,
      voucher.car_type, 1, reason, timestamp
    ]
  );
  saveDb();

  return getVoucherById(voucherId);
};

const revokeVoucher = (voucherId, reason = null) => {
  const db = getDb();
  const timestamp = now();
  const voucher = getVoucherById(voucherId);

  if (!voucher) {
    throw new Error('排队券不存在');
  }

  const validStatuses = [VOUCHER_STATUS.CREATED, VOUCHER_STATUS.IN_QUEUE];
  if (!validStatuses.includes(voucher.status)) {
    throw new Error(`当前状态 ${voucher.status} 无法撤回`);
  }

  if (voucher.status === VOUCHER_STATUS.IN_QUEUE) {
    db.run(
      'UPDATE terminal_queues SET exited_at = ?, exit_reason = ? WHERE voucher_id = ? AND exited_at IS NULL',
      [timestamp, 'REVOKED', voucher.voucher_id]
    );
  }

  db.run(
    'UPDATE vouchers SET status = ?, updated_at = ? WHERE voucher_id = ?',
    [VOUCHER_STATUS.REVOKED, timestamp, voucher.voucher_id]
  );
  saveDb();

  return getVoucherById(voucherId);
};

const correctVoucher = (voucherId, updates = {}) => {
  const db = getDb();
  const timestamp = now();
  const voucher = getVoucherById(voucherId);

  if (!voucher) {
    throw new Error('排队券不存在');
  }

  const updatableFields = ['terminal_id', 'car_type'];
  const fields = Object.keys(updates).filter(k => updatableFields.includes(k));

  if (fields.length === 0) {
    throw new Error('没有可修正的字段');
  }

  if (voucher.status !== VOUCHER_STATUS.CREATED) {
    throw new Error('只有待入队状态的排队券才能修正');
  }

  const setClauses = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f]);
  values.push(timestamp, VOUCHER_STATUS.CORRECTED, voucherId);

  db.run(
    `UPDATE vouchers SET ${setClauses}, updated_at = ?, status = ? WHERE voucher_id = ?`,
    values
  );
  saveDb();

  return getVoucherById(voucherId);
};

const queryVouchers = (filters = {}) => {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (filters.driver_id) {
    conditions.push('driver_id = ?');
    params.push(filters.driver_id);
  }
  if (filters.terminal_id) {
    conditions.push('terminal_id = ?');
    params.push(filters.terminal_id);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.car_type) {
    conditions.push('car_type = ?');
    params.push(filters.car_type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM vouchers ${where} ORDER BY created_at DESC`;

  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  return results;
};

const getQueueForTerminal = (terminalId, carType, includeHistory = false) => {
  const db = getDb();
  const conditions = ['q.terminal_id = ?', 'q.car_type = ?'];
  const params = [terminalId, carType];

  if (!includeHistory) {
    conditions.push('exited_at IS NULL');
  }

  const sql = `
    SELECT q.*, v.driver_id, v.status as voucher_status
    FROM terminal_queues q
    JOIN vouchers v ON q.voucher_id = v.voucher_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY q.position ASC
  `;

  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  return results;
};

const getStatistics = (terminalId = null, fromTime = null, toTime = null) => {
  const db = getDb();
  const timestamp = now();
  const from = fromTime || 0;
  const to = toTime || timestamp;

  let totalByStatus = [];
  let noShowByDriver = [];
  let queueStats = [];

  if (terminalId) {
    const totalStmt = db.prepare(
      'SELECT status, COUNT(*) as count FROM vouchers WHERE terminal_id = ? AND created_at BETWEEN ? AND ? GROUP BY status'
    );
    totalStmt.bind([terminalId, from, to]);
    while (totalStmt.step()) {
      totalByStatus.push(totalStmt.getAsObject());
    }
    totalStmt.reset();

    const noShowStmt = db.prepare(
      'SELECT driver_id, COUNT(*) as count, SUM(count) as total FROM no_show_records WHERE terminal_id = ? AND created_at BETWEEN ? AND ? GROUP BY driver_id ORDER BY total DESC'
    );
    noShowStmt.bind([terminalId, from, to]);
    while (noShowStmt.step()) {
      noShowByDriver.push(noShowStmt.getAsObject());
    }
    noShowStmt.reset();

    const queueStmt = db.prepare(
      'SELECT terminal_id, car_type, COUNT(*) as waiting_count FROM terminal_queues WHERE exited_at IS NULL AND terminal_id = ? GROUP BY terminal_id, car_type'
    );
    queueStmt.bind([terminalId]);
    while (queueStmt.step()) {
      queueStats.push(queueStmt.getAsObject());
    }
    queueStmt.reset();
  } else {
    const totalStmt = db.prepare(
      'SELECT status, COUNT(*) as count FROM vouchers WHERE created_at BETWEEN ? AND ? GROUP BY status'
    );
    totalStmt.bind([from, to]);
    while (totalStmt.step()) {
      totalByStatus.push(totalStmt.getAsObject());
    }
    totalStmt.reset();

    const noShowStmt = db.prepare(
      'SELECT driver_id, COUNT(*) as count, SUM(count) as total FROM no_show_records WHERE created_at BETWEEN ? AND ? GROUP BY driver_id ORDER BY total DESC'
    );
    noShowStmt.bind([from, to]);
    while (noShowStmt.step()) {
      noShowByDriver.push(noShowStmt.getAsObject());
    }
    noShowStmt.reset();

    const queueStmt = db.prepare(
      'SELECT terminal_id, car_type, COUNT(*) as waiting_count FROM terminal_queues WHERE exited_at IS NULL GROUP BY terminal_id, car_type'
    );
    while (queueStmt.step()) {
      queueStats.push(queueStmt.getAsObject());
    }
    queueStmt.reset();
  }

  return {
    period: { from, to },
    by_status: totalByStatus,
    no_show_by_driver: noShowByDriver,
    queue_waiting: queueStats
  };
};

module.exports = {
  getVoucherById,
  getDriverActiveVouchers,
  createVoucher,
  advanceVoucher,
  recordNoShow,
  revokeVoucher,
  correctVoucher,
  queryVouchers,
  getQueueForTerminal,
  getStatistics
};
