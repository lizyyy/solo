const db = require('../utils/database');
const { generateId } = require('../utils/common');
const { checkBlacklist } = require('./blacklist');
const { getVisitorsByIdCardOrPhone } = require('./visitor');
const { getLicensePlatesByPlateNumber } = require('./licensePlate');

async function createGateRecord(data) {
  const recordId = data.record_id || generateId('g');

  const sql = `
    INSERT INTO gate_records (
      record_id, gate_no, check_type, subject_type, subject_id,
      subject_name, plate_number, id_card, check_result, reject_reason,
      operator, check_time, visitor_record_id, plate_record_id, blacklist_record_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.run(sql, [
    recordId,
    data.gate_no,
    data.check_type,
    data.subject_type,
    data.subject_id || null,
    data.subject_name || null,
    data.plate_number || null,
    data.id_card || null,
    data.check_result,
    data.reject_reason || null,
    data.operator || null,
    data.check_time || new Date().toISOString(),
    data.visitor_record_id || null,
    data.plate_record_id || null,
    data.blacklist_record_id || null
  ]);

  return await getGateRecordByRecordId(recordId);
}

async function getGateRecordByRecordId(recordId) {
  return await db.get(
    `SELECT * FROM gate_records WHERE record_id = ?`,
    [recordId]
  );
}

async function getGateRecordById(id) {
  return await db.get(
    `SELECT * FROM gate_records WHERE id = ?`,
    [id]
  );
}

async function getGateRecords(filters = {}, page = 1, pageSize = 20) {
  let sql = `SELECT * FROM gate_records WHERE 1=1`;
  const params = [];
  const countParams = [];

  if (filters.gate_no) {
    sql += ` AND gate_no = ?`;
    params.push(filters.gate_no);
    countParams.push(filters.gate_no);
  }

  if (filters.check_type) {
    sql += ` AND check_type = ?`;
    params.push(filters.check_type);
    countParams.push(filters.check_type);
  }

  if (filters.subject_type) {
    sql += ` AND subject_type = ?`;
    params.push(filters.subject_type);
    countParams.push(filters.subject_type);
  }

  if (filters.check_result) {
    sql += ` AND check_result = ?`;
    params.push(filters.check_result);
    countParams.push(filters.check_result);
  }

  if (filters.plate_number) {
    sql += ` AND plate_number LIKE ?`;
    const likePattern = `%${filters.plate_number}%`;
    params.push(likePattern);
    countParams.push(likePattern);
  }

  if (filters.subject_name) {
    sql += ` AND subject_name LIKE ?`;
    const likePattern = `%${filters.subject_name}%`;
    params.push(likePattern);
    countParams.push(likePattern);
  }

  if (filters.start_time) {
    sql += ` AND check_time >= ?`;
    params.push(filters.start_time);
    countParams.push(filters.start_time);
  }

  if (filters.end_time) {
    sql += ` AND check_time <= ?`;
    params.push(filters.end_time);
    countParams.push(filters.end_time);
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await db.get(countSql, countParams);

  sql += ` ORDER BY check_time DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, (page - 1) * pageSize);

  const list = await db.all(sql, params);

  return {
    list,
    pagination: {
      page,
      pageSize,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / pageSize)
    }
  };
}

async function verifyVisitor(data) {
  const { id_card, phone, plate_number, gate_no, operator } = data;
  const checkDate = new Date().toISOString().split('T')[0];

  let blacklistItem = null;
  if (id_card) {
    blacklistItem = await checkBlacklist('id_card', id_card, checkDate);
  }
  if (!blacklistItem && plate_number) {
    blacklistItem = await checkBlacklist('vehicle', plate_number, checkDate);
  }

  if (blacklistItem) {
    const record = await createGateRecord({
      gate_no,
      check_type: 'verify',
      subject_type: 'visitor',
      subject_id: blacklistItem.blacklist_id,
      subject_name: blacklistItem.name,
      plate_number,
      id_card,
      check_result: 'reject',
      reject_reason: `黑名单人员: ${blacklistItem.reason}`,
      operator,
      blacklist_record_id: blacklistItem.id
    });

    return {
      passed: false,
      reason: `黑名单人员: ${blacklistItem.reason}`,
      blacklistItem,
      gateRecord: record
    };
  }

  const visitors = await getVisitorsByIdCardOrPhone(id_card, phone);
  const validVisitor = visitors.find(v => v.visit_date === checkDate && v.status !== 'cancelled');

  if (!validVisitor) {
    const record = await createGateRecord({
      gate_no,
      check_type: 'verify',
      subject_type: 'visitor',
      subject_name: '未知访客',
      plate_number,
      id_card,
      check_result: 'reject',
      reject_reason: '未找到有效预约记录',
      operator
    });

    return {
      passed: false,
      reason: '未找到有效预约记录',
      gateRecord: record
    };
  }

  const record = await createGateRecord({
    gate_no,
    check_type: 'verify',
    subject_type: 'visitor',
    subject_id: validVisitor.visitor_id,
    subject_name: validVisitor.name,
    plate_number,
    id_card,
    check_result: 'pass',
    operator,
    visitor_record_id: validVisitor.id
  });

  return {
    passed: true,
    visitor: validVisitor,
    gateRecord: record
  };
}

async function verifyVehicle(data) {
  const { plate_number, gate_no, operator } = data;
  const checkDate = new Date().toISOString().split('T')[0];

  const blacklistItem = await checkBlacklist('vehicle', plate_number, checkDate);

  if (blacklistItem) {
    const record = await createGateRecord({
      gate_no,
      check_type: 'verify',
      subject_type: 'vehicle',
      subject_id: blacklistItem.blacklist_id,
      plate_number,
      check_result: 'reject',
      reject_reason: `黑名单车辆: ${blacklistItem.reason}`,
      operator,
      blacklist_record_id: blacklistItem.id
    });

    return {
      passed: false,
      reason: `黑名单车辆: ${blacklistItem.reason}`,
      blacklistItem,
      gateRecord: record
    };
  }

  const plates = await getLicensePlatesByPlateNumber(plate_number);
  const validPlate = plates.find(p => {
    const start = new Date(p.valid_start_date);
    const end = new Date(p.valid_end_date);
    const now = new Date();
    return now >= start && now <= end;
  });

  if (!validPlate) {
    const record = await createGateRecord({
      gate_no,
      check_type: 'verify',
      subject_type: 'vehicle',
      plate_number,
      check_result: 'reject',
      reject_reason: '未找到有效车牌授权',
      operator
    });

    return {
      passed: false,
      reason: '未找到有效车牌授权',
      gateRecord: record
    };
  }

  const record = await createGateRecord({
    gate_no,
    check_type: 'verify',
    subject_type: 'vehicle',
    subject_id: validPlate.plate_id,
    subject_name: validPlate.owner_name,
    plate_number,
    check_result: 'pass',
    operator,
    plate_record_id: validPlate.id
  });

  return {
    passed: true,
    plateInfo: validPlate,
    gateRecord: record
  };
}

async function manualPass(data) {
  const { gate_no, subject_type, subject_name, plate_number, id_card, reason, operator } = data;

  const record = await createGateRecord({
    gate_no,
    check_type: 'manual',
    subject_type: subject_type || 'unknown',
    subject_name,
    plate_number,
    id_card,
    check_result: 'pass',
    reject_reason: reason ? `人工放行: ${reason}` : '人工放行',
    operator
  });

  return record;
}

async function manualReject(data) {
  const { gate_no, subject_type, subject_name, plate_number, id_card, reason, operator } = data;

  const record = await createGateRecord({
    gate_no,
    check_type: 'manual',
    subject_type: subject_type || 'unknown',
    subject_name,
    plate_number,
    id_card,
    check_result: 'reject',
    reject_reason: reason || '人工拒绝',
    operator
  });

  return record;
}

module.exports = {
  createGateRecord,
  getGateRecordByRecordId,
  getGateRecordById,
  getGateRecords,
  verifyVisitor,
  verifyVehicle,
  manualPass,
  manualReject
};
