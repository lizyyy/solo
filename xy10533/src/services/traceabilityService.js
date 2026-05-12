const { getDb } = require('../database');
const { 
  generateId, 
  getCurrentTime, 
  isExpired, 
  isThawOvertime,
  addStatusHistory,
  checkIdempotency,
  saveIdempotencyResult,
  getStatusHistory
} = require('../utils');

const db = () => getDb();

// 常量定义
const BATCH_STATUS = {
  CREATED: 'CREATED',
  OUTBOUND: 'OUTBOUND',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED: 'RECEIVED',
  THAWING: 'THAWING',
  THAWED: 'THAWED',
  SOLD: 'SOLD',
  PARTIAL_SOLD: 'PARTIAL_SOLD',
  RECALLED: 'RECALLED',
  DAMAGED: 'DAMAGED',
  EXPIRED: 'EXPIRED',
  ABNORMAL: 'ABNORMAL'
};

const COLD_CHAIN_STATUS = {
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED: 'COMPLETED',
  ABNORMAL: 'ABNORMAL'
};

const THAW_STATUS = {
  THAWING: 'THAWING',
  COMPLETED: 'COMPLETED',
  OVERTIME: 'OVERTIME',
  CANCELLED: 'CANCELLED'
};

// 通用数据库操作
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    const database = db();
    database.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    const database = db();
    database.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getAllQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    const database = db();
    database.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// 门店管理
const createStore = async (storeData, operator) => {
  const id = generateId();
  const now = getCurrentTime();
  
  await runQuery(
    `INSERT INTO stores (id, store_name, store_code, city, address, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, storeData.store_name, storeData.store_code, storeData.city, storeData.address, now]
  );
  
  return { id, ...storeData, created_at: now };
};

const getStores = async () => {
  return getAllQuery(`SELECT * FROM stores ORDER BY created_at DESC`);
};

// 批次管理
const createBatch = async (batchData, operator) => {
  const idempotencyKey = `CREATE_BATCH_${batchData.product_code}_${batchData.production_date}`;
  const existingRecord = await checkIdempotency('CREATE_BATCH', idempotencyKey);
  
  if (existingRecord) {
    return JSON.parse(existingRecord.result);
  }

  const id = generateId();
  const now = getCurrentTime();
  
  const expired = isExpired(batchData.expiry_date);
  const status = expired ? BATCH_STATUS.EXPIRED : BATCH_STATUS.CREATED;
  
  await runQuery(
    `INSERT INTO batches (id, product_name, product_code, production_date, expiry_date, quantity, unit, status, created_at, updated_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, batchData.product_name, batchData.product_code, batchData.production_date, 
     batchData.expiry_date, batchData.quantity, batchData.unit || '箱', 
     status, now, now, operator]
  );
  
  await addStatusHistory('BATCH', id, null, status, 'CREATE_BATCH', operator);
  
  const result = { id, ...batchData, status, created_at: now, updated_at: now };
  
  await saveIdempotencyResult('CREATE_BATCH', idempotencyKey, result);
  
  return result;
};

const getBatch = async (batchId) => {
  return getQuery(`SELECT * FROM batches WHERE id = ?`, [batchId]);
};

const getBatches = async (filter = {}) => {
  let sql = `SELECT * FROM batches WHERE 1=1`;
  const params = [];
  
  if (filter.status) {
    sql += ` AND status = ?`;
    params.push(filter.status);
  }
  
  if (filter.product_code) {
    sql += ` AND product_code = ?`;
    params.push(filter.product_code);
  }
  
  sql += ` ORDER BY created_at DESC`;
  
  return getAllQuery(sql, params);
};

// 出库
const createOutbound = async (outboundData, operator) => {
  const idempotencyKey = `OUTBOUND_${outboundData.batch_id}_${outboundData.outbound_time}`;
  const existingRecord = await checkIdempotency('OUTBOUND', idempotencyKey);
  
  if (existingRecord) {
    return JSON.parse(existingRecord.result);
  }

  const batch = await getBatch(outboundData.batch_id);
  
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (batch.status === BATCH_STATUS.RECALLED) {
    throw new Error('该批次已被召回，禁止出库');
  }
  
  if (batch.status === BATCH_STATUS.EXPIRED) {
    throw new Error('该批次已过期，禁止出库');
  }
  
  if (outboundData.quantity > batch.quantity) {
    throw new Error(`出库数量超过批次总数量，批次总数量: ${batch.quantity}`);
  }
  
  const id = generateId();
  const now = getCurrentTime();
  
  await runQuery(
    `INSERT INTO outbound_records (id, batch_id, quantity, outbound_time, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, outboundData.batch_id, outboundData.quantity, outboundData.outbound_time, operator, now]
  );
  
  const newStatus = BATCH_STATUS.OUTBOUND;
  await runQuery(
    `UPDATE batches SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, outboundData.batch_id]
  );
  
  await addStatusHistory('BATCH', outboundData.batch_id, batch.status, newStatus, 'OUTBOUND', operator, null, 
    { quantity: batch.quantity, status: batch.status }, 
    { outbound_quantity: outboundData.quantity, status: newStatus }
  );
  
  const result = {
    id,
    batch_id: outboundData.batch_id,
    quantity: outboundData.quantity,
    outbound_time: outboundData.outbound_time,
    created_by: operator,
    created_at: now
  };
  
  await saveIdempotencyResult('OUTBOUND', idempotencyKey, result);
  
  return result;
};

// 冷链运输开始
const startColdChain = async (coldChainData, operator) => {
  const idempotencyKey = `COLD_CHAIN_START_${coldChainData.batch_id}_${coldChainData.store_id}_${coldChainData.outbound_record_id}`;
  const existingRecord = await checkIdempotency('COLD_CHAIN_START', idempotencyKey);
  
  if (existingRecord) {
    return JSON.parse(existingRecord.result);
  }

  const batch = await getBatch(coldChainData.batch_id);
  
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  const outboundRecord = await getQuery(
    `SELECT * FROM outbound_records WHERE id = ?`,
    [coldChainData.outbound_record_id]
  );
  
  if (!outboundRecord) {
    throw new Error('出库记录不存在');
  }
  
  const existingColdChain = await getQuery(
    `SELECT * FROM cold_chain_records WHERE outbound_record_id = ?`,
    [coldChainData.outbound_record_id]
  );
  
  if (existingColdChain) {
    throw new Error('该出库记录已有冷链运输记录');
  }
  
  const id = generateId();
  const now = getCurrentTime();
  
  await runQuery(
    `INSERT INTO cold_chain_records (id, batch_id, store_id, outbound_record_id, transport_start_time, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, coldChainData.batch_id, coldChainData.store_id, coldChainData.outbound_record_id, 
     coldChainData.transport_start_time, COLD_CHAIN_STATUS.IN_TRANSIT, now, now]
  );
  
  const newStatus = BATCH_STATUS.IN_TRANSIT;
  await runQuery(
    `UPDATE batches SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, coldChainData.batch_id]
  );
  
  await addStatusHistory('BATCH', coldChainData.batch_id, batch.status, newStatus, 'START_COLD_CHAIN', operator, null,
    { status: batch.status },
    { status: newStatus, transport_start_time: coldChainData.transport_start_time }
  );
  
  const result = {
    id,
    batch_id: coldChainData.batch_id,
    store_id: coldChainData.store_id,
    outbound_record_id: coldChainData.outbound_record_id,
    transport_start_time: coldChainData.transport_start_time,
    status: COLD_CHAIN_STATUS.IN_TRANSIT,
    created_at: now,
    updated_at: now
  };
  
  await saveIdempotencyResult('COLD_CHAIN_START', idempotencyKey, result);
  
  return result;
};

// 冷链运输完成
const completeColdChain = async (coldChainId, completeData, operator) => {
  const idempotencyKey = `COLD_CHAIN_COMPLETE_${coldChainId}`;
  const existingRecord = await checkIdempotency('COLD_CHAIN_COMPLETE', idempotencyKey);
  
  if (existingRecord) {
    return JSON.parse(existingRecord.result);
  }

  const coldChain = await getQuery(
    `SELECT * FROM cold_chain_records WHERE id = ?`,
    [coldChainId]
  );
  
  if (!coldChain) {
    throw new Error('冷链记录不存在');
  }
  
  if (coldChain.status !== COLD_CHAIN_STATUS.IN_TRANSIT) {
    throw new Error(`冷链记录状态异常，当前状态: ${coldChain.status}`);
  }
  
  const batch = await getBatch(coldChain.batch_id);
  
  const now = getCurrentTime();
  let status = COLD_CHAIN_STATUS.COMPLETED;
  let isAbnormal = 0;
  let abnormalReason = null;
  
  // 检查冷链温度是否异常（假设正常范围是 -18 到 -5 度）
  const tempLogs = completeData.temperature_log || [];
  const avgTemp = tempLogs.length > 0 ? tempLogs.reduce((sum, t) => sum + t.temperature, 0) / tempLogs.length : null;
  const minTemp = tempLogs.length > 0 ? Math.min(...tempLogs.map(t => t.temperature)) : null;
  const maxTemp = tempLogs.length > 0 ? Math.max(...tempLogs.map(t => t.temperature)) : null;
  
  // 检查温度异常
  if (maxTemp !== null && maxTemp > -5) {
    status = COLD_CHAIN_STATUS.ABNORMAL;
    isAbnormal = 1;
    abnormalReason = `运输温度过高，最高温度: ${maxTemp}°C，超过安全范围 (-18°C ~ -5°C)`;
  }
  if (minTemp !== null && minTemp < -25) {
    status = COLD_CHAIN_STATUS.ABNORMAL;
    isAbnormal = 1;
    abnormalReason = abnormalReason || `运输温度过低，最低温度: ${minTemp}°C，低于安全范围 (-18°C ~ -5°C)`;
  }
  
  await runQuery(
    `UPDATE cold_chain_records 
     SET transport_end_time = ?, temperature_log = ?, avg_temperature = ?, 
         min_temperature = ?, max_temperature = ?, status = ?, is_abnormal = ?, 
         abnormal_reason = ?, updated_at = ?
     WHERE id = ?`,
    [completeData.transport_end_time, JSON.stringify(tempLogs), avgTemp, 
     minTemp, maxTemp, status, isAbnormal, abnormalReason, now, coldChainId]
  );
  
  // 如果冷链异常，批次状态也标记为异常
  let batchNewStatus = status === COLD_CHAIN_STATUS.ABNORMAL ? BATCH_STATUS.ABNORMAL : batch.status;
  
  if (batchNewStatus !== batch.status) {
    await runQuery(
      `UPDATE batches SET status = ?, updated_at = ? WHERE id = ?`,
      [batchNewStatus, now, coldChain.batch_id]
    );
    
    await addStatusHistory('BATCH', coldChain.batch_id, batch.status, batchNewStatus, 'COLD_CHAIN_ABNORMAL', operator, abnormalReason,
      { status: batch.status },
      { status: batchNewStatus, abnormal_reason: abnormalReason }
    );
  }
  
  await addStatusHistory('COLD_CHAIN', coldChainId, coldChain.status, status, 'COMPLETE_COLD_CHAIN', operator, abnormalReason);
  
  const result = {
    id: coldChainId,
    transport_end_time: completeData.transport_end_time,
    avg_temperature: avgTemp,
    min_temperature: minTemp,
    max_temperature: maxTemp,
    status,
    is_abnormal: isAbnormal,
    abnormal_reason: abnormalReason,
    updated_at: now
  };
  
  await saveIdempotencyResult('COLD_CHAIN_COMPLETE', idempotencyKey, result);
  
  return result;
};

// 门店接收
const receiveBatch = async (receiveData, operator) => {
  const coldChain = await getQuery(
    `SELECT * FROM cold_chain_records WHERE id = ?`,
    [receiveData.cold_chain_record_id]
  );
  
  if (!coldChain) {
    throw new Error('冷链记录不存在');
  }
  
  // 检查是否已接收
  const existingReceive = await getQuery(
    `SELECT * FROM receive_records WHERE cold_chain_record_id = ?`,
    [receiveData.cold_chain_record_id]
  );
  
  if (existingReceive) {
    throw new Error('该冷链运输记录已被接收，禁止重复接收');
  }
  
  const batch = await getBatch(coldChain.batch_id);
  
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (batch.status === BATCH_STATUS.RECALLED) {
    throw new Error('该批次已被召回，禁止接收');
  }
  
  // 获取出库数量作为接收数量
  const outboundRecord = await getQuery(
    `SELECT * FROM outbound_records WHERE id = ?`,
    [coldChain.outbound_record_id]
  );
  
  const receiveQuantity = outboundRecord.quantity;
  const now = getCurrentTime();
  const id = generateId();
  
  await runQuery(
    `INSERT INTO receive_records (id, batch_id, store_id, cold_chain_record_id, quantity, receive_time, operator, remarks, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, coldChain.batch_id, coldChain.store_id, coldChain.id, receiveQuantity, 
     receiveData.receive_time, operator, receiveData.remarks || null, now]
  );
  
  // 检查门店库存是否存在
  let inventory = await getQuery(
    `SELECT * FROM store_inventory WHERE batch_id = ? AND store_id = ?`,
    [coldChain.batch_id, coldChain.store_id]
  );
  
  if (!inventory) {
    const inventoryId = generateId();
    await runQuery(
      `INSERT INTO store_inventory (id, batch_id, store_id, quantity, frozen_quantity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [inventoryId, coldChain.batch_id, coldChain.store_id, receiveQuantity, receiveQuantity, now, now]
    );
  } else {
    throw new Error('该批次在该门店已有库存记录，可能已接收');
  }
  
  // 更新批次状态
  const newStatus = coldChain.status === COLD_CHAIN_STATUS.ABNORMAL ? BATCH_STATUS.ABNORMAL : BATCH_STATUS.RECEIVED;
  await runQuery(
    `UPDATE batches SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, coldChain.batch_id]
  );
  
  await addStatusHistory('BATCH', coldChain.batch_id, batch.status, newStatus, 'RECEIVE', operator, null,
    { status: batch.status },
    { status: newStatus, receive_time: receiveData.receive_time, store_id: coldChain.store_id }
  );
  
  const result = {
    id,
    batch_id: coldChain.batch_id,
    store_id: coldChain.store_id,
    cold_chain_record_id: coldChain.id,
    quantity: receiveQuantity,
    receive_time: receiveData.receive_time,
    operator,
    remarks: receiveData.remarks || null,
    created_at: now
  };
  
  return result;
};

// 解冻
const startThaw = async (thawData, operator) => {
  const idempotencyKey = `THAW_START_${thawData.batch_id}_${thawData.store_id}_${thawData.thaw_start_time}`;
  const existingRecord = await checkIdempotency('THAW_START', idempotencyKey);
  
  if (existingRecord) {
    return JSON.parse(existingRecord.result);
  }

  const batch = await getBatch(thawData.batch_id);
  
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (batch.status === BATCH_STATUS.RECALLED) {
    throw new Error('该批次已被召回，禁止解冻');
  }
  
  if (batch.status === BATCH_STATUS.EXPIRED) {
    throw new Error('该批次已过期，禁止解冻');
  }
  
  const inventory = await getQuery(
    `SELECT * FROM store_inventory WHERE batch_id = ? AND store_id = ?`,
    [thawData.batch_id, thawData.store_id]
  );
  
  if (!inventory) {
    throw new Error('该门店无此批次库存');
  }
  
  if (inventory.frozen_quantity < thawData.quantity) {
    throw new Error(`冷冻库存不足，当前冷冻库存: ${inventory.frozen_quantity}`);
  }
  
  const id = generateId();
  const now = getCurrentTime();
  
  // 检查是否有未完成的解冻
  const pendingThaws = await getAllQuery(
    `SELECT * FROM thaw_records WHERE batch_id = ? AND store_id = ? AND status = ?`,
    [thawData.batch_id, thawData.store_id, THAW_STATUS.THAWING]
  );
  
  if (pendingThaws.length > 0) {
    throw new Error('存在未完成的解冻记录，请先完成或取消');
  }
  
  await runQuery(
    `INSERT INTO thaw_records (id, batch_id, store_id, quantity, thaw_start_time, expected_thaw_time, status, operator, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, thawData.batch_id, thawData.store_id, thawData.quantity, 
     thawData.thaw_start_time, thawData.expected_thaw_time || null, 
     THAW_STATUS.THAWING, operator, now, now]
  );
  
  // 更新库存
  await runQuery(
    `UPDATE store_inventory 
     SET frozen_quantity = frozen_quantity - ?, 
         thawed_quantity = thawed_quantity + ?,
         updated_at = ?
     WHERE batch_id = ? AND store_id = ?`,
    [thawData.quantity, thawData.quantity, now, thawData.batch_id, thawData.store_id]
  );
  
  // 更新批次状态
  const newStatus = BATCH_STATUS.THAWING;
  await runQuery(
    `UPDATE batches SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, thawData.batch_id]
  );
  
  await addStatusHistory('BATCH', thawData.batch_id, batch.status, newStatus, 'START_THAW', operator, null,
    { status: batch.status, frozen_quantity: inventory.frozen_quantity },
    { status: newStatus, thaw_quantity: thawData.quantity, thaw_start_time: thawData.thaw_start_time }
  );
  
  const result = {
    id,
    batch_id: thawData.batch_id,
    store_id: thawData.store_id,
    quantity: thawData.quantity,
    thaw_start_time: thawData.thaw_start_time,
    expected_thaw_time: thawData.expected_thaw_time || null,
    status: THAW_STATUS.THAWING,
    operator,
    created_at: now,
    updated_at: now
  };
  
  await saveIdempotencyResult('THAW_START', idempotencyKey, result);
  
  return result;
};

// 完成解冻
const completeThaw = async (thawId, completeData, operator) => {
  const idempotencyKey = `THAW_COMPLETE_${thawId}`;
  const existingRecord = await checkIdempotency('THAW_COMPLETE', idempotencyKey);
  
  if (existingRecord) {
    return JSON.parse(existingRecord.result);
  }

  const thawRecord = await getQuery(
    `SELECT * FROM thaw_records WHERE id = ?`,
    [thawId]
  );
  
  if (!thawRecord) {
    throw new Error('解冻记录不存在');
  }
  
  if (thawRecord.status !== THAW_STATUS.THAWING) {
    throw new Error(`解冻记录状态异常，当前状态: ${thawRecord.status}`);
  }
  
  const now = getCurrentTime();
  let status = THAW_STATUS.COMPLETED;
  let isOvertime = 0;
  
  // 检查解冻超时
  if (thawRecord.expected_thaw_time) {
    if (isThawOvertime(thawRecord.thaw_start_time, 24)) {
      status = THAW_STATUS.OVERTIME;
      isOvertime = 1;
    }
  }
  
  await runQuery(
    `UPDATE thaw_records 
     SET thaw_end_time = ?, status = ?, is_overtime = ?, updated_at = ?
     WHERE id = ?`,
    [completeData.thaw_end_time, status, isOvertime, now, thawId]
  );
  
  // 更新批次状态
  const batch = await getBatch(thawRecord.batch_id);
  const newStatus = status === THAW_STATUS.OVERTIME ? BATCH_STATUS.ABNORMAL : BATCH_STATUS.THAWED;
  
  await runQuery(
    `UPDATE batches SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, thawRecord.batch_id]
  );
  
  await addStatusHistory('THAW', thawId, thawRecord.status, status, 'COMPLETE_THAW', operator, 
    isOvertime ? '解冻超过24小时' : null,
    { status: thawRecord.status },
    { status, thaw_end_time: completeData.thaw_end_time, is_overtime: isOvertime }
  );
  
  await addStatusHistory('BATCH', thawRecord.batch_id, batch.status, newStatus, 'THAW_COMPLETE', operator,
    isOvertime ? '解冻超时' : null,
    { status: batch.status },
    { status: newStatus }
  );
  
  const result = {
    id: thawId,
    thaw_end_time: completeData.thaw_end_time,
    status,
    is_overtime: isOvertime,
    updated_at: now
  };
  
  await saveIdempotencyResult('THAW_COMPLETE', idempotencyKey, result);
  
  return result;
};

// 销售
const createSale = async (saleData, operator) => {
  const idempotencyKey = `SALE_${saleData.batch_id}_${saleData.store_id}_${saleData.sale_time}_${saleData.quantity}`;
  const existingRecord = await checkIdempotency('SALE', idempotencyKey);
  
  if (existingRecord) {
    return JSON.parse(existingRecord.result);
  }

  const batch = await getBatch(saleData.batch_id);
  
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (batch.status === BATCH_STATUS.RECALLED) {
    throw new Error('该批次已被召回，禁止销售');
  }
  
  if (batch.status === BATCH_STATUS.EXPIRED) {
    throw new Error('该批次已过期，禁止销售');
  }
  
  // 检查是否有活跃的召回记录
  const activeRecall = await getQuery(
    `SELECT * FROM recall_records WHERE batch_id = ? AND status = ?`,
    [saleData.batch_id, 'ACTIVE']
  );
  
  if (activeRecall) {
    throw new Error('该批次正在召回中，禁止销售');
  }
  
  const inventory = await getQuery(
    `SELECT * FROM store_inventory WHERE batch_id = ? AND store_id = ?`,
    [saleData.batch_id, saleData.store_id]
  );
  
  if (!inventory) {
    throw new Error('该门店无此批次库存');
  }
  
  if (inventory.thawed_quantity < saleData.quantity) {
    throw new Error(`解冻库存不足，当前解冻库存: ${inventory.thawed_quantity}`);
  }
  
  const id = generateId();
  const now = getCurrentTime();
  
  await runQuery(
    `INSERT INTO sales_records (id, batch_id, store_id, quantity, sale_time, operator, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, saleData.batch_id, saleData.store_id, saleData.quantity, 
     saleData.sale_time, operator, now]
  );
  
  // 更新库存
  await runQuery(
    `UPDATE store_inventory 
     SET thawed_quantity = thawed_quantity - ?, 
         sold_quantity = sold_quantity + ?,
         quantity = quantity - ?,
         updated_at = ?
     WHERE batch_id = ? AND store_id = ?`,
    [saleData.quantity, saleData.quantity, saleData.quantity, now, saleData.batch_id, saleData.store_id]
  );
  
  // 更新批次状态
  const newInventory = await getQuery(
    `SELECT * FROM store_inventory WHERE batch_id = ? AND store_id = ?`,
    [saleData.batch_id, saleData.store_id]
  );
  
  const totalRemaining = newInventory.frozen_quantity + newInventory.thawed_quantity;
  const newStatus = totalRemaining === 0 ? BATCH_STATUS.SOLD : BATCH_STATUS.PARTIAL_SOLD;
  
  await runQuery(
    `UPDATE batches SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, saleData.batch_id]
  );
  
  await addStatusHistory('BATCH', saleData.batch_id, batch.status, newStatus, 'SALE', operator, null,
    { status: batch.status, thawed_quantity: inventory.thawed_quantity },
    { status: newStatus, sold_quantity: saleData.quantity, sale_time: saleData.sale_time }
  );
  
  const result = {
    id,
    batch_id: saleData.batch_id,
    store_id: saleData.store_id,
    quantity: saleData.quantity,
    sale_time: saleData.sale_time,
    operator,
    created_at: now
  };
  
  await saveIdempotencyResult('SALE', idempotencyKey, result);
  
  return result;
};

// 召回
const createRecall = async (recallData, operator) => {
  const idempotencyKey = `RECALL_${recallData.batch_id}`;
  const existingRecord = await checkIdempotency('RECALL', idempotencyKey);
  
  if (existingRecord) {
    return JSON.parse(existingRecord.result);
  }

  const batch = await getBatch(recallData.batch_id);
  
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (batch.status === BATCH_STATUS.RECALLED) {
    throw new Error('该批次已被召回');
  }
  
  const id = generateId();
  const now = getCurrentTime();
  
  await runQuery(
    `INSERT INTO recall_records (id, batch_id, recall_reason, recall_time, operator, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, recallData.batch_id, recallData.recall_reason, recallData.recall_time, operator, 'ACTIVE', now]
  );
  
  // 更新批次状态
  const oldStatus = batch.status;
  await runQuery(
    `UPDATE batches SET status = ?, updated_at = ? WHERE id = ?`,
    [BATCH_STATUS.RECALLED, now, recallData.batch_id]
  );
  
  await addStatusHistory('BATCH', recallData.batch_id, oldStatus, BATCH_STATUS.RECALLED, 'RECALL', operator, recallData.recall_reason,
    { status: oldStatus },
    { status: BATCH_STATUS.RECALLED, recall_time: recallData.recall_time, recall_reason: recallData.recall_reason }
  );
  
  const result = {
    id,
    batch_id: recallData.batch_id,
    recall_reason: recallData.recall_reason,
    recall_time: recallData.recall_time,
    operator,
    status: 'ACTIVE',
    created_at: now
  };
  
  await saveIdempotencyResult('RECALL', idempotencyKey, result);
  
  return result;
};

// 报损
const createDamage = async (damageData, operator) => {
  const idempotencyKey = `DAMAGE_${damageData.batch_id}_${damageData.store_id}_${damageData.damage_time}_${damageData.quantity}`;
  const existingRecord = await checkIdempotency('DAMAGE', idempotencyKey);
  
  if (existingRecord) {
    return JSON.parse(existingRecord.result);
  }

  const batch = await getBatch(damageData.batch_id);
  
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  const inventory = await getQuery(
    `SELECT * FROM store_inventory WHERE batch_id = ? AND store_id = ?`,
    [damageData.batch_id, damageData.store_id]
  );
  
  if (!inventory) {
    throw new Error('该门店无此批次库存');
  }
  
  // 确定从哪个库存扣减
  let deductFromFrozen = 0;
  let deductFromThawed = 0;
  
  if (damageData.damage_type === 'frozen') {
    if (inventory.frozen_quantity < damageData.quantity) {
      throw new Error(`冷冻库存不足，当前冷冻库存: ${inventory.frozen_quantity}`);
    }
    deductFromFrozen = damageData.quantity;
  } else if (damageData.damage_type === 'thawed') {
    if (inventory.thawed_quantity < damageData.quantity) {
      throw new Error(`解冻库存不足，当前解冻库存: ${inventory.thawed_quantity}`);
    }
    deductFromThawed = damageData.quantity;
  } else {
    throw new Error('请指定报损类型: frozen 或 thawed');
  }
  
  const id = generateId();
  const now = getCurrentTime();
  
  await runQuery(
    `INSERT INTO damage_records (id, batch_id, store_id, quantity, damage_reason, damage_time, operator, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, damageData.batch_id, damageData.store_id, damageData.quantity, 
     damageData.damage_reason, damageData.damage_time, operator, now]
  );
  
  // 更新库存
  await runQuery(
    `UPDATE store_inventory 
     SET frozen_quantity = frozen_quantity - ?, 
         thawed_quantity = thawed_quantity - ?,
         damaged_quantity = damaged_quantity + ?,
         quantity = quantity - ?,
         updated_at = ?
     WHERE batch_id = ? AND store_id = ?`,
    [deductFromFrozen, deductFromThawed, damageData.quantity, damageData.quantity, 
     now, damageData.batch_id, damageData.store_id]
  );
  
  await addStatusHistory('BATCH', damageData.batch_id, batch.status, batch.status, 'DAMAGE', operator, damageData.damage_reason,
    { frozen_quantity: inventory.frozen_quantity, thawed_quantity: inventory.thawed_quantity },
    { 
      frozen_quantity: inventory.frozen_quantity - deductFromFrozen, 
      thawed_quantity: inventory.thawed_quantity - deductFromThawed,
      damaged_quantity: (inventory.damaged_quantity || 0) + damageData.quantity
    }
  );
  
  const result = {
    id,
    batch_id: damageData.batch_id,
    store_id: damageData.store_id,
    quantity: damageData.quantity,
    damage_reason: damageData.damage_reason,
    damage_time: damageData.damage_time,
    operator,
    created_at: now
  };
  
  await saveIdempotencyResult('DAMAGE', idempotencyKey, result);
  
  return result;
};

// 获取批次详情（包含历史）
const getBatchDetail = async (batchId) => {
  const batch = await getBatch(batchId);
  
  if (!batch) {
    return null;
  }
  
  const history = await getStatusHistory('BATCH', batchId);
  
  const outboundRecords = await getAllQuery(
    `SELECT * FROM outbound_records WHERE batch_id = ? ORDER BY created_at DESC`,
    [batchId]
  );
  
  const coldChainRecords = await getAllQuery(
    `SELECT * FROM cold_chain_records WHERE batch_id = ? ORDER BY created_at DESC`,
    [batchId]
  );
  
  const receiveRecords = await getAllQuery(
    `SELECT * FROM receive_records WHERE batch_id = ? ORDER BY created_at DESC`,
    [batchId]
  );
  
  const thawRecords = await getAllQuery(
    `SELECT * FROM thaw_records WHERE batch_id = ? ORDER BY created_at DESC`,
    [batchId]
  );
  
  const saleRecords = await getAllQuery(
    `SELECT * FROM sales_records WHERE batch_id = ? ORDER BY created_at DESC`,
    [batchId]
  );
  
  const recallRecords = await getAllQuery(
    `SELECT * FROM recall_records WHERE batch_id = ? ORDER BY created_at DESC`,
    [batchId]
  );
  
  const damageRecords = await getAllQuery(
    `SELECT * FROM damage_records WHERE batch_id = ? ORDER BY created_at DESC`,
    [batchId]
  );
  
  const inventoryRecords = await getAllQuery(
    `SELECT si.*, s.store_name, s.store_code 
     FROM store_inventory si 
     JOIN stores s ON si.store_id = s.id 
     WHERE si.batch_id = ?`,
    [batchId]
  );
  
  return {
    batch,
    history,
    outbound_records: outboundRecords,
    cold_chain_records: coldChainRecords,
    receive_records: receiveRecords,
    thaw_records: thawRecords,
    sale_records: saleRecords,
    recall_records: recallRecords,
    damage_records: damageRecords,
    inventory_records: inventoryRecords
  };
};

// 获取门店库存
const getStoreInventory = async (storeId = null) => {
  let sql = `
    SELECT si.*, b.product_name, b.product_code, b.production_date, b.expiry_date, 
           b.status as batch_status, s.store_name, s.store_code
    FROM store_inventory si
    JOIN batches b ON si.batch_id = b.id
    JOIN stores s ON si.store_id = s.id
    WHERE 1=1
  `;
  const params = [];
  
  if (storeId) {
    sql += ` AND si.store_id = ?`;
    params.push(storeId);
  }
  
  sql += ` ORDER BY si.updated_at DESC`;
  
  return getAllQuery(sql, params);
};

// 人工修正
const manualCorrection = async (correctionData, operator) => {
  const { entity_type, entity_id, corrections, reason } = correctionData;
  
  const now = getCurrentTime();
  
  // 获取修正前的数据
  let beforeData = null;
  
  if (entity_type === 'STORE_INVENTORY') {
    const inventory = await getQuery(
      `SELECT * FROM store_inventory WHERE id = ?`,
      [entity_id]
    );
    
    if (!inventory) {
      throw new Error('库存记录不存在');
    }
    
    beforeData = { ...inventory };
    
    // 构建更新语句
    let updateFields = [];
    let updateParams = [];
    
    if (corrections.frozen_quantity !== undefined) {
      updateFields.push('frozen_quantity = ?');
      updateParams.push(corrections.frozen_quantity);
    }
    if (corrections.thawed_quantity !== undefined) {
      updateFields.push('thawed_quantity = ?');
      updateParams.push(corrections.thawed_quantity);
    }
    
    updateFields.push('updated_at = ?');
    updateParams.push(now);
    updateParams.push(entity_id);
    
    await runQuery(
      `UPDATE store_inventory SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );
  } else {
    throw new Error(`不支持的实体类型: ${entity_type}`);
  }
  
  // 获取修正后的数据
  let afterData = null;
  if (entity_type === 'STORE_INVENTORY') {
    afterData = await getQuery(
      `SELECT * FROM store_inventory WHERE id = ?`,
      [entity_id]
    );
  }
  
  // 记录状态历史
  await addStatusHistory(entity_type, entity_id, null, null, 'MANUAL_CORRECTION', operator, reason, beforeData, afterData);
  
  return {
    entity_type,
    entity_id,
    before_data: beforeData,
    after_data: afterData,
    reason,
    operator,
    corrected_at: now
  };
};

module.exports = {
  // 状态常量
  BATCH_STATUS,
  COLD_CHAIN_STATUS,
  THAW_STATUS,
  
  // 门店管理
  createStore,
  getStores,
  
  // 批次管理
  createBatch,
  getBatch,
  getBatches,
  getBatchDetail,
  
  // 业务流程
  createOutbound,
  startColdChain,
  completeColdChain,
  receiveBatch,
  startThaw,
  completeThaw,
  createSale,
  createRecall,
  createDamage,
  
  // 查询
  getStoreInventory,
  
  // 人工修正
  manualCorrection,
  
  // 数据库工具
  runQuery,
  getQuery,
  getAllQuery
};
