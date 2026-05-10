const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const STATUS_FLOW = {
  pending: ['approved', 'rejected'],
  approved: ['out_at_sea'],
  out_at_sea: ['temporary_return', 'returned'],
  temporary_return: ['out_at_sea_again', 'returned'],
  out_at_sea_again: ['temporary_return', 'returned'],
  returned: ['completed'],
  completed: [],
  rejected: []
};

const TERMINAL_STATUSES = ['rejected', 'completed'];

function validateStatusTransition(currentStatus, newStatus) {
  if (TERMINAL_STATUSES.includes(currentStatus)) {
    return { valid: false, reason: `当前状态「${currentStatus}」为终态，不可变更` };
  }
  const allowedNext = STATUS_FLOW[currentStatus] || [];
  if (!allowedNext.includes(newStatus)) {
    return { valid: false, reason: `状态「${currentStatus}」不允许变更为「${newStatus}」` };
  }
  return { valid: true };
}

function createDeclaration(data) {
  const { boat_id, departure_time, expected_return_time, intended_route, fuel_amount, crew_ids } = data;
  
  if (!boat_id || !departure_time || !expected_return_time || fuel_amount === undefined) {
    throw new Error('缺少必要参数');
  }

  const boat = db.prepare('SELECT * FROM boats WHERE id = ? AND status = \'active\'').get(boat_id);
  if (!boat) {
    throw new Error('渔船不存在或未激活');
  }

  if (fuel_amount <= 0) {
    throw new Error('油料数量必须大于0');
  }

  if (fuel_amount > boat.fuel_tank_capacity) {
    throw new Error(`油料数量超过油箱容量（${boat.fuel_tank_capacity}升）`);
  }

  if (crew_ids && Array.isArray(crew_ids) && crew_ids.length > 0) {
    if (crew_ids.length > boat.crew_capacity) {
      throw new Error(`船员数量超过渔船承载量（${boat.crew_capacity}人）`);
    }
    const placeholders = crew_ids.map(() => '?').join(',');
    const validCrew = db.prepare(
      `SELECT COUNT(*) as count FROM crew WHERE id IN (${placeholders}) AND status = 'active'`
    ).get(...crew_ids);
    if (validCrew.count !== crew_ids.length) {
      throw new Error('存在无效或未激活的船员');
    }
  }

  const declarationId = uuidv4();
  
  const insertDecl = db.prepare(`
    INSERT INTO declarations (id, boat_id, departure_time, expected_return_time, intended_route, fuel_amount, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `);
  
  const insertCrew = db.prepare(`
    INSERT INTO declaration_crew (id, declaration_id, crew_id)
    VALUES (?, ?, ?)
  `);
  
  const insertHistory = db.prepare(`
    INSERT INTO status_history (id, declaration_id, old_status, new_status, change_type, change_reason)
    VALUES (?, ?, ?, 'pending', 'normal', '创建申报')
  `);

  const transaction = db.transaction(() => {
    insertDecl.run(declarationId, boat_id, departure_time, expected_return_time, intended_route, fuel_amount);
    
    if (crew_ids && Array.isArray(crew_ids)) {
      crew_ids.forEach(crewId => {
        insertCrew.run(uuidv4(), declarationId, crewId);
      });
    }
    
    insertHistory.run(uuidv4(), declarationId, null);
  });

  transaction();
  
  return getDeclarationWithDetails(declarationId);
}

function getDeclarationWithDetails(id) {
  const declaration = db.prepare('SELECT * FROM declarations WHERE id = ?').get(id);
  if (!declaration) return null;

  const crewList = db.prepare(`
    SELECT c.* FROM crew c
    INNER JOIN declaration_crew dc ON c.id = dc.crew_id
    WHERE dc.declaration_id = ?
  `).all(id);

  const returnReceipts = db.prepare('SELECT * FROM return_receipts WHERE declaration_id = ? ORDER BY created_at').all(id);
  const fuelRecords = db.prepare('SELECT * FROM fuel_records WHERE declaration_id = ? ORDER BY record_time').all(id);
  const statusHistory = db.prepare('SELECT * FROM status_history WHERE declaration_id = ? ORDER BY created_at').all(id);

  const boat = db.prepare('SELECT * FROM boats WHERE id = ?').get(declaration.boat_id);

  return {
    ...declaration,
    boat,
    crew: crewList,
    return_receipts: returnReceipts,
    fuel_records: fuelRecords,
    status_history: statusHistory
  };
}

function approveDeclaration(id) {
  const decl = db.prepare('SELECT * FROM declarations WHERE id = ?').get(id);
  if (!decl) throw new Error('申报不存在');
  
  const validation = validateStatusTransition(decl.status, 'approved');
  if (!validation.valid) throw new Error(validation.reason);

  updateDeclarationStatus(id, 'approved', 'normal', null, '审核通过');
  return getDeclarationWithDetails(id);
}

function rejectDeclaration(id, reason) {
  const decl = db.prepare('SELECT * FROM declarations WHERE id = ?').get(id);
  if (!decl) throw new Error('申报不存在');
  
  const validation = validateStatusTransition(decl.status, 'rejected');
  if (!validation.valid) throw new Error(validation.reason);

  updateDeclarationStatus(id, 'rejected', 'normal', null, reason || '审核拒绝');
  return getDeclarationWithDetails(id);
}

function recordDeparture(id, departureTime) {
  const decl = db.prepare('SELECT * FROM declarations WHERE id = ?').get(id);
  if (!decl) throw new Error('申报不存在');
  
  const validation = validateStatusTransition(decl.status, 'out_at_sea');
  if (!validation.valid) throw new Error(validation.reason);

  updateDeclarationStatus(id, 'out_at_sea', 'normal', null, '已出港');
  
  db.prepare(`
    INSERT INTO fuel_records (id, declaration_id, record_type, amount, record_time, remarks)
    VALUES (?, ?, 'departure', ?, ?, '出港油料记录')
  `).run(uuidv4(), id, decl.fuel_amount, departureTime || new Date().toISOString());

  return getDeclarationWithDetails(id);
}

function recordReturn(id, data) {
  const { actual_return_time, return_reason, is_temporary, remarks } = data;
  const decl = db.prepare('SELECT * FROM declarations WHERE id = ?').get(id);
  if (!decl) throw new Error('申报不存在');

  const newStatus = is_temporary ? 'temporary_return' : 'returned';
  const validation = validateStatusTransition(decl.status, newStatus);
  if (!validation.valid) throw new Error(validation.reason);

  const insertReceipt = db.prepare(`
    INSERT INTO return_receipts (id, declaration_id, actual_return_time, return_reason, is_temporary, remarks)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertReceipt.run(uuidv4(), id, actual_return_time || new Date().toISOString(), return_reason, is_temporary ? 1 : 0, remarks);
    updateDeclarationStatus(id, newStatus, 'normal', null, is_temporary ? '临时返港' : '已返港');
  });

  transaction();
  return getDeclarationWithDetails(id);
}

function recordReDeparture(id) {
  const decl = db.prepare('SELECT * FROM declarations WHERE id = ?').get(id);
  if (!decl) throw new Error('申报不存在');

  const validation = validateStatusTransition(decl.status, 'out_at_sea_again');
  if (!validation.valid) throw new Error(validation.reason);

  updateDeclarationStatus(id, 'out_at_sea_again', 'normal', null, '再次出港');
  return getDeclarationWithDetails(id);
}

function completeDeclaration(id) {
  const decl = db.prepare('SELECT * FROM declarations WHERE id = ?').get(id);
  if (!decl) throw new Error('申报不存在');

  const validation = validateStatusTransition(decl.status, 'completed');
  if (!validation.valid) throw new Error(validation.reason);

  updateDeclarationStatus(id, 'completed', 'normal', null, '申报完成');
  return getDeclarationWithDetails(id);
}

function manualCorrectStatus(id, newStatus, changedBy, reason) {
  const decl = db.prepare('SELECT * FROM declarations WHERE id = ?').get(id);
  if (!decl) throw new Error('申报不存在');

  if (!newStatus || !reason) {
    throw new Error('必须提供新状态和修正原因');
  }

  if (decl.status === newStatus) {
    throw new Error('新状态与当前状态相同');
  }

  updateDeclarationStatus(id, newStatus, 'manual_correction', changedBy, reason);
  return getDeclarationWithDetails(id);
}

function updateDeclarationStatus(id, newStatus, changeType, changedBy, reason) {
  const decl = db.prepare('SELECT * FROM declarations WHERE id = ?').get(id);

  db.prepare(`
    UPDATE declarations 
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newStatus, id);

  db.prepare(`
    INSERT INTO status_history (id, declaration_id, old_status, new_status, change_type, changed_by, change_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), id, decl.status, newStatus, changeType || 'normal', changedBy, reason || '状态变更');
}

function addFuelRecord(id, data) {
  const { record_type, amount, record_time, remarks } = data;
  
  if (!record_type || !amount) {
    throw new Error('缺少必要参数');
  }

  const decl = db.prepare('SELECT * FROM declarations WHERE id = ?').get(id);
  if (!decl) throw new Error('申报不存在');

  db.prepare(`
    INSERT INTO fuel_records (id, declaration_id, record_type, amount, record_time, remarks)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), id, record_type, amount, record_time || new Date().toISOString(), remarks);

  return getDeclarationWithDetails(id);
}

function listDeclarations(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.boat_id) {
    conditions.push('boat_id = ?');
    params.push(filters.boat_id);
  }
  if (filters.status) {
    conditions.push('d.status = ?');
    params.push(filters.status);
  }
  if (filters.start_date) {
    conditions.push('departure_time >= ?');
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    conditions.push('departure_time <= ?');
    params.push(filters.end_date);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const declarations = db.prepare(`
    SELECT d.*, b.name as boat_name, b.registration_number
    FROM declarations d
    INNER JOIN boats b ON d.boat_id = b.id
    ${whereClause}
    ORDER BY d.created_at DESC
  `).all(...params);

  return declarations;
}

function getStatistics(filters = {}) {
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM declarations
    GROUP BY status
  `).all();

  const result = {};
  statusCounts.forEach(row => {
    result[row.status] = row.count;
  });

  const latestCorrectHistory = db.prepare(`
    SELECT declaration_id, COUNT(*) as correction_count
    FROM status_history
    WHERE change_type = 'manual_correction'
    GROUP BY declaration_id
    HAVING COUNT(*) > 0
  `).all();

  return {
    status_distribution: result,
    manually_corrected_count: latestCorrectHistory.length
  };
}

function exportDeclarations(filters = {}) {
  const declarations = listDeclarations(filters);
  
  return declarations.map(d => ({
    申报编号: d.id,
    渔船名称: d.boat_name,
    渔船注册号: d.registration_number,
    计划出港时间: d.departure_time,
    计划返港时间: d.expected_return_time,
    航线: d.intended_route,
    申报油料: d.fuel_amount,
    当前状态: d.status,
    创建时间: d.created_at,
    更新时间: d.updated_at
  }));
}

module.exports = {
  createDeclaration,
  getDeclarationWithDetails,
  approveDeclaration,
  rejectDeclaration,
  recordDeparture,
  recordReturn,
  recordReDeparture,
  completeDeclaration,
  manualCorrectStatus,
  addFuelRecord,
  listDeclarations,
  getStatistics,
  exportDeclarations,
  validateStatusTransition
};
