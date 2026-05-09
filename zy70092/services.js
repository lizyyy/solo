const { getDb, saveDatabase } = require('./database');
const { v4: uuidv4 } = require('uuid');
const {
  ITEM_STATUSES,
  CLAIM_STATUSES,
  getRuleValue,
  canCreateClaim,
  canApproveClaim,
  canTransferItem,
  shouldProcessOverdue,
  calculateDaysBetween,
  addAuditLog,
  rowsToObjects
} = require('./rules');

function getBusRoutes() {
  const db = getDb();
  const result = db.exec('SELECT * FROM bus_routes ORDER BY route_number, vehicle_number');
  return rowsToObjects(result);
}

function getBusRouteById(id) {
  const db = getDb();
  const result = db.exec('SELECT * FROM bus_routes WHERE id = ?', [id]);
  const rows = rowsToObjects(result);
  return rows.length > 0 ? rows[0] : null;
}

function createBusRoute(routeNumber, vehicleNumber, driverName, performedBy) {
  const db = getDb();
  const id = uuidv4();
  
  db.run(
    'INSERT INTO bus_routes (id, route_number, vehicle_number, driver_name) VALUES (?, ?, ?, ?)',
    [id, routeNumber, vehicleNumber, driverName]
  );
  
  addAuditLog('CREATE_BUS_ROUTE', 'bus_routes', id, null, { routeNumber, vehicleNumber, driverName }, performedBy);
  saveDatabase();
  
  return getBusRouteById(id);
}

function getStoragePoints() {
  const db = getDb();
  const result = db.exec('SELECT * FROM storage_points ORDER BY name');
  return rowsToObjects(result);
}

function getStoragePointById(id) {
  const db = getDb();
  const result = db.exec('SELECT * FROM storage_points WHERE id = ?', [id]);
  const rows = rowsToObjects(result);
  return rows.length > 0 ? rows[0] : null;
}

function registerLostItem(data, performedBy) {
  const db = getDb();
  const id = uuidv4();
  
  const now = new Date().toISOString();
  
  db.run(
    `INSERT INTO lost_items (
      id, item_name, description, item_category, photos, status,
      driver_id, driver_name, route_number, vehicle_number, bus_route_id,
      current_storage_point_id, found_time, estimated_value, owner_name, owner_phone, special_marks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.item_name,
      data.description || null,
      data.item_category || null,
      data.photos ? JSON.stringify(data.photos) : null,
      ITEM_STATUSES.REGISTERED,
      data.driver_id || null,
      data.driver_name || null,
      data.route_number || null,
      data.vehicle_number || null,
      data.bus_route_id || null,
      data.current_storage_point_id || null,
      data.found_time || now,
      data.estimated_value || null,
      data.owner_name || null,
      data.owner_phone || null,
      data.special_marks || null
    ]
  );
  
  addAuditLog('REGISTER_ITEM', 'lost_items', id, null, data, performedBy);
  saveDatabase();
  
  return getLostItemById(id);
}

function getLostItems(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM lost_items WHERE 1=1';
  const params = [];
  
  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  
  if (filters.route_number) {
    query += ' AND route_number = ?';
    params.push(filters.route_number);
  }
  
  if (filters.vehicle_number) {
    query += ' AND vehicle_number = ?';
    params.push(filters.vehicle_number);
  }
  
  if (filters.item_name) {
    query += ' AND item_name LIKE ?';
    params.push(`%${filters.item_name}%`);
  }
  
  if (filters.item_category) {
    query += ' AND item_category = ?';
    params.push(filters.item_category);
  }
  
  if (filters.current_storage_point_id) {
    query += ' AND current_storage_point_id = ?';
    params.push(filters.current_storage_point_id);
  }
  
  query += ' ORDER BY found_time DESC';
  
  const result = db.exec(query, params);
  return rowsToObjects(result).map(item => ({
    ...item,
    photos: item.photos ? JSON.parse(item.photos) : null
  }));
}

function getLostItemById(id) {
  const db = getDb();
  const result = db.exec('SELECT * FROM lost_items WHERE id = ?', [id]);
  const rows = rowsToObjects(result);
  
  if (rows.length === 0) return null;
  
  const item = rows[0];
  return {
    ...item,
    photos: item.photos ? JSON.parse(item.photos) : null
  };
}

function bindBusRoute(lostItemId, busRouteId, performedBy) {
  const db = getDb();
  const item = getLostItemById(lostItemId);
  const busRoute = getBusRouteById(busRouteId);
  
  if (!item) throw new Error('失物不存在');
  if (!busRoute) throw new Error('线路车辆不存在');
  
  const oldValues = {
    bus_route_id: item.bus_route_id,
    route_number: item.route_number,
    vehicle_number: item.vehicle_number
  };
  
  db.run(
    'UPDATE lost_items SET bus_route_id = ?, route_number = ?, vehicle_number = ? WHERE id = ?',
    [busRouteId, busRoute.route_number, busRoute.vehicle_number, lostItemId]
  );
  
  addAuditLog(
    'BIND_BUS_ROUTE',
    'lost_items',
    lostItemId,
    oldValues,
    { bus_route_id: busRouteId, route_number: busRoute.route_number, vehicle_number: busRoute.vehicle_number },
    performedBy
  );
  
  saveDatabase();
  return getLostItemById(lostItemId);
}

function transferStorage(lostItemId, toStoragePointId, reason, notes, performedBy) {
  const db = getDb();
  const item = getLostItemById(lostItemId);
  const toPoint = getStoragePointById(toStoragePointId);
  
  if (!item) throw new Error('失物不存在');
  if (!toPoint) throw new Error('目标保管点不存在');
  if (!canTransferItem(item.status)) {
    throw new Error(`当前状态 ${item.status} 不允许进行保管流转`);
  }
  
  const transferId = uuidv4();
  const fromStoragePointId = item.current_storage_point_id;
  
  db.run(
    `INSERT INTO storage_transfers (
      id, lost_item_id, from_storage_point_id, to_storage_point_id,
      transferred_by, reason, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      transferId, 
      lostItemId, 
      fromStoragePointId ?? null, 
      toStoragePointId, 
      performedBy ?? null, 
      reason ?? null, 
      notes ?? null
    ]
  );
  
  const newStatus = ITEM_STATUSES.IN_TRANSIT;
  db.run(
    'UPDATE lost_items SET current_storage_point_id = ?, status = ? WHERE id = ?',
    [toStoragePointId, newStatus, lostItemId]
  );
  
  addAuditLog(
    'TRANSFER_STORAGE',
    'lost_items',
    lostItemId,
    { current_storage_point_id: fromStoragePointId, status: item.status },
    { current_storage_point_id: toStoragePointId, status: newStatus },
    performedBy
  );
  
  saveDatabase();
  return getLostItemById(lostItemId);
}

function confirmStorageArrival(lostItemId, performedBy) {
  const db = getDb();
  const item = getLostItemById(lostItemId);
  
  if (!item) throw new Error('失物不存在');
  if (item.status !== ITEM_STATUSES.IN_TRANSIT) {
    throw new Error(`只有在运输中状态才能确认到达，当前状态: ${item.status}`);
  }
  
  const oldStatus = item.status;
  const newStatus = ITEM_STATUSES.IN_STORAGE;
  
  db.run('UPDATE lost_items SET status = ? WHERE id = ?', [newStatus, lostItemId]);
  
  addAuditLog(
    'CONFIRM_ARRIVAL',
    'lost_items',
    lostItemId,
    { status: oldStatus },
    { status: newStatus },
    performedBy
  );
  
  saveDatabase();
  return getLostItemById(lostItemId);
}

function createClaim(lostItemId, claimantData, performedBy) {
  const db = getDb();
  const item = getLostItemById(lostItemId);
  
  if (!item) throw new Error('失物不存在');
  if (!canCreateClaim(item.status)) {
    throw new Error(`当前状态 ${item.status} 不允许认领申请`);
  }
  
  const existingPendingClaim = db.exec(
    "SELECT * FROM claims WHERE lost_item_id = ? AND status = 'PENDING'",
    [lostItemId]
  );
  
  if (existingPendingClaim.length > 0 && existingPendingClaim[0].values.length > 0) {
    throw new Error('该失物已有待审核的认领申请');
  }
  
  const claimId = uuidv4();
  const itemOldStatus = item.status;
  const itemNewStatus = ITEM_STATUSES.CLAIM_PENDING;
  
  db.run(
    `INSERT INTO claims (
      id, lost_item_id, claimant_name, claimant_phone, claimant_id_number,
      claim_description, proof_photos, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      claimId,
      lostItemId,
      claimantData.claimant_name,
      claimantData.claimant_phone,
      claimantData.claimant_id_number || null,
      claimantData.claim_description || null,
      claimantData.proof_photos ? JSON.stringify(claimantData.proof_photos) : null,
      CLAIM_STATUSES.PENDING
    ]
  );
  
  db.run('UPDATE lost_items SET status = ? WHERE id = ?', [itemNewStatus, lostItemId]);
  
  addAuditLog(
    'CREATE_CLAIM',
    'claims',
    claimId,
    null,
    claimantData,
    performedBy
  );
  
  addAuditLog(
    'ITEM_CLAIM_PENDING',
    'lost_items',
    lostItemId,
    { status: itemOldStatus },
    { status: itemNewStatus },
    performedBy
  );
  
  saveDatabase();
  return getClaimById(claimId);
}

function getClaims(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM claims WHERE 1=1';
  const params = [];
  
  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  
  if (filters.lost_item_id) {
    query += ' AND lost_item_id = ?';
    params.push(filters.lost_item_id);
  }
  
  if (filters.claimant_phone) {
    query += ' AND claimant_phone = ?';
    params.push(filters.claimant_phone);
  }
  
  query += ' ORDER BY submitted_at DESC';
  
  const result = db.exec(query, params);
  return rowsToObjects(result).map(claim => ({
    ...claim,
    proof_photos: claim.proof_photos ? JSON.parse(claim.proof_photos) : null
  }));
}

function getClaimById(id) {
  const db = getDb();
  const result = db.exec('SELECT * FROM claims WHERE id = ?', [id]);
  const rows = rowsToObjects(result);
  
  if (rows.length === 0) return null;
  
  const claim = rows[0];
  return {
    ...claim,
    proof_photos: claim.proof_photos ? JSON.parse(claim.proof_photos) : null
  };
}

function reviewClaim(claimId, approved, reviewNotes, performedBy) {
  const db = getDb();
  const claim = getClaimById(claimId);
  
  if (!claim) throw new Error('认领申请不存在');
  
  const item = getLostItemById(claim.lost_item_id);
  
  if (!canApproveClaim(claim.status, item.status)) {
    throw new Error(`无法审核：认领状态=${claim.status}, 失物状态=${item.status}`);
  }
  
  const now = new Date().toISOString();
  const newClaimStatus = approved ? CLAIM_STATUSES.APPROVED : CLAIM_STATUSES.REJECTED;
  const newItemStatus = approved ? ITEM_STATUSES.CLAIMED : ITEM_STATUSES.IN_STORAGE;
  
  db.run(
    'UPDATE claims SET status = ?, reviewed_at = ?, reviewed_by = ?, review_notes = ? WHERE id = ?',
    [newClaimStatus, now, performedBy, reviewNotes, claimId]
  );
  
  db.run('UPDATE lost_items SET status = ? WHERE id = ?', [newItemStatus, claim.lost_item_id]);
  
  addAuditLog(
    approved ? 'APPROVE_CLAIM' : 'REJECT_CLAIM',
    'claims',
    claimId,
    { status: claim.status },
    { status: newClaimStatus, review_notes: reviewNotes },
    performedBy
  );
  
  addAuditLog(
    approved ? 'ITEM_CLAIMED' : 'ITEM_RETURNED_TO_STORAGE',
    'lost_items',
    claim.lost_item_id,
    { status: item.status },
    { status: newItemStatus },
    performedBy
  );
  
  saveDatabase();
  return getClaimById(claimId);
}

function confirmPickup(claimId, performedBy) {
  const db = getDb();
  const claim = getClaimById(claimId);
  
  if (!claim) throw new Error('认领申请不存在');
  if (claim.status !== CLAIM_STATUSES.APPROVED) {
    throw new Error(`只有已批准的认领才能确认领取，当前状态: ${claim.status}`);
  }
  
  const now = new Date().toISOString();
  
  db.run(
    'UPDATE claims SET status = ?, pickup_time = ?, pickup_verified = 1 WHERE id = ?',
    [CLAIM_STATUSES.PICKED_UP, now, claimId]
  );
  
  addAuditLog(
    'CONFIRM_PICKUP',
    'claims',
    claimId,
    { status: claim.status, pickup_verified: 0 },
    { status: CLAIM_STATUSES.PICKED_UP, pickup_time: now, pickup_verified: 1 },
    performedBy
  );
  
  saveDatabase();
  return getClaimById(claimId);
}

function processOverdueItems(performedBy) {
  const db = getDb();
  const allItems = getLostItems({});
  const now = new Date();
  const results = [];
  
  for (const item of allItems) {
    if ([ITEM_STATUSES.CLAIMED, ITEM_STATUSES.DONATED, ITEM_STATUSES.DISCARDED].includes(item.status)) {
      continue;
    }
    
    const daysSinceFound = calculateDaysBetween(item.found_time, now.toISOString());
    const overdueCheck = shouldProcessOverdue(daysSinceFound);
    
    if (overdueCheck.shouldDonate && item.status !== ITEM_STATUSES.DONATED) {
      const processingId = uuidv4();
      const oldStatus = item.status;
      
      db.run(
        `INSERT INTO overdue_processing (
          id, lost_item_id, overdue_days, processing_type, processed_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [processingId, item.id, daysSinceFound, 'DONATION', performedBy, '逾期超过捐赠期限，已捐赠']
      );
      
      db.run('UPDATE lost_items SET status = ? WHERE id = ?', [ITEM_STATUSES.DONATED, item.id]);
      
      addAuditLog(
        'OVERDUE_DONATION',
        'lost_items',
        item.id,
        { status: oldStatus },
        { status: ITEM_STATUSES.DONATED, overdue_days: daysSinceFound },
        performedBy
      );
      
      results.push({
        item_id: item.id,
        action: 'DONATED',
        overdue_days: daysSinceFound
      });
    } else if (overdueCheck.shouldSendNotice && item.status === ITEM_STATUSES.IN_STORAGE) {
      const oldStatus = item.status;
      db.run('UPDATE lost_items SET status = ? WHERE id = ?', [ITEM_STATUSES.OVERDUE_NOTICE, item.id]);
      
      addAuditLog(
        'OVERDUE_NOTICE',
        'lost_items',
        item.id,
        { status: oldStatus },
        { status: ITEM_STATUSES.OVERDUE_NOTICE, overdue_days: daysSinceFound },
        performedBy
      );
      
      results.push({
        item_id: item.id,
        action: 'NOTICE_SENT',
        overdue_days: daysSinceFound
      });
    }
  }
  
  saveDatabase();
  return results;
}

function getStorageTransfers(lostItemId = null) {
  const db = getDb();
  let query = `
    SELECT st.*, 
           sp_from.name as from_storage_name,
           sp_to.name as to_storage_name
    FROM storage_transfers st
    LEFT JOIN storage_points sp_from ON st.from_storage_point_id = sp_from.id
    LEFT JOIN storage_points sp_to ON st.to_storage_point_id = sp_to.id
    WHERE 1=1
  `;
  const params = [];
  
  if (lostItemId) {
    query += ' AND st.lost_item_id = ?';
    params.push(lostItemId);
  }
  
  query += ' ORDER BY st.transfer_time DESC';
  
  const result = db.exec(query, params);
  return rowsToObjects(result);
}

function getOverdueProcessing(lostItemId = null) {
  const db = getDb();
  let query = 'SELECT * FROM overdue_processing WHERE 1=1';
  const params = [];
  
  if (lostItemId) {
    query += ' AND lost_item_id = ?';
    params.push(lostItemId);
  }
  
  query += ' ORDER BY processing_time DESC';
  
  const result = db.exec(query, params);
  return rowsToObjects(result);
}

function getItemFullHistory(itemId) {
  const item = getLostItemById(itemId);
  if (!item) return null;
  
  return {
    item,
    transfers: getStorageTransfers(itemId),
    claims: getClaims({ lost_item_id: itemId }),
    overdueProcessing: getOverdueProcessing(itemId),
    auditLogs: require('./rules').getAuditLogs('lost_items', itemId)
  };
}

module.exports = {
  getBusRoutes,
  getBusRouteById,
  createBusRoute,
  getStoragePoints,
  getStoragePointById,
  registerLostItem,
  getLostItems,
  getLostItemById,
  bindBusRoute,
  transferStorage,
  confirmStorageArrival,
  createClaim,
  getClaims,
  getClaimById,
  reviewClaim,
  confirmPickup,
  processOverdueItems,
  getStorageTransfers,
  getOverdueProcessing,
  getItemFullHistory
};
