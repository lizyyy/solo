const { runQuery, runExecute } = require('../database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

async function getLicenses(filters = {}) {
  let sql = `
    SELECT l.*, c.name as company_name, lt.name as license_type_name
    FROM licenses l
    JOIN companies c ON l.company_id = c.id
    JOIN license_types lt ON l.license_type_id = lt.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.company_id) {
    sql += ' AND l.company_id = ?';
    params.push(filters.company_id);
  }
  if (filters.license_type_id) {
    sql += ' AND l.license_type_id = ?';
    params.push(filters.license_type_id);
  }
  if (filters.status) {
    sql += ' AND l.status = ?';
    params.push(filters.status);
  }
  if (filters.risk_level) {
    sql += ' AND l.risk_level = ?';
    params.push(filters.risk_level);
  }
  if (filters.responsible_person) {
    sql += ' AND l.responsible_person LIKE ?';
    params.push(`%${filters.responsible_person}%`);
  }
  if (filters.deadline_from) {
    sql += ' AND l.annual_check_deadline >= ?';
    params.push(filters.deadline_from);
  }
  if (filters.deadline_to) {
    sql += ' AND l.annual_check_deadline <= ?';
    params.push(filters.deadline_to);
  }

  sql += ' ORDER BY l.annual_check_deadline ASC';

  const licenses = await runQuery(sql, params);
  return licenses;
}

async function getLicenseById(id) {
  const licenses = await runQuery(`
    SELECT l.*, c.name as company_name, lt.name as license_type_name
    FROM licenses l
    JOIN companies c ON l.company_id = c.id
    JOIN license_types lt ON l.license_type_id = lt.id
    WHERE l.id = ?
  `, [id]);
  
  if (licenses.length === 0) {
    throw new Error('证照不存在');
  }

  const attachments = await runQuery('SELECT * FROM attachments WHERE license_id = ? ORDER BY created_at DESC', [id]);
  const logs = await runQuery('SELECT * FROM operation_logs WHERE license_id = ? ORDER BY created_at DESC', [id]);

  return { ...licenses[0], attachments, logs };
}

async function checkIdempotency(requestId) {
  if (!requestId) return null;
  const existing = await runQuery('SELECT * FROM operation_logs WHERE request_id = ?', [requestId]);
  return existing.length > 0 ? existing[0] : null;
}

async function createLicense(data, requestId) {
  const idempotent = await checkIdempotency(requestId);
  if (idempotent) {
    return { idempotent: true, message: '重复请求，使用已有结果', data: idempotent };
  }

  const id = uuidv4();
  await runExecute(
    `INSERT INTO licenses (id, company_id, license_type_id, license_number, issue_date, 
     expiry_date, annual_check_deadline, responsible_person, responsible_phone, status, risk_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.company_id, data.license_type_id, data.license_number, data.issue_date,
     data.expiry_date, data.annual_check_deadline, data.responsible_person, data.responsible_phone,
     data.status || 'pending', data.risk_level || 'low']
  );

  await logOperation(id, 'create', 'success', data.operator || 'system', '创建证照记录', null, requestId);
  return await getLicenseById(id);
}

async function updateLicense(id, data, requestId) {
  const idempotent = await checkIdempotency(requestId);
  if (idempotent) {
    return { idempotent: true, message: '重复请求，使用已有结果' };
  }

  const existing = await runQuery('SELECT * FROM licenses WHERE id = ?', [id]);
  if (existing.length === 0) {
    throw new Error('证照不存在');
  }

  const changes = [];
  const params = [];

  if (data.annual_check_deadline && data.annual_check_deadline !== existing[0].annual_check_deadline) {
    changes.push('年检截止日期变更');
  }
  if (data.responsible_person && data.responsible_person !== existing[0].responsible_person) {
    changes.push('负责人变更');
  }

  let sql = 'UPDATE licenses SET updated_at = CURRENT_TIMESTAMP';
  const updateParams = [];

  Object.keys(data).forEach(key => {
    if (['company_id', 'license_type_id', 'license_number', 'issue_date', 'expiry_date',
         'annual_check_deadline', 'responsible_person', 'responsible_phone', 'status', 'risk_level'].includes(key)) {
      sql += `, ${key} = ?`;
      updateParams.push(data[key]);
    }
  });

  sql += ' WHERE id = ?';
  updateParams.push(id);

  await runExecute(sql, updateParams);

  await logOperation(id, 'update', 'success', data.operator || 'system',
    changes.length > 0 ? changes.join('; ') : '更新证照信息', null, requestId);

  return await getLicenseById(id);
}

async function submitAnnualCheck(id, data, requestId) {
  const idempotent = await checkIdempotency(requestId);
  if (idempotent) {
    return { idempotent: true, message: '重复提交，请求已处理', status: idempotent.operation_status };
  }

  const license = await runQuery('SELECT * FROM licenses WHERE id = ?', [id]);
  if (license.length === 0) {
    throw new Error('证照不存在');
  }

  if (!data.responsible_person) {
    await logOperation(id, 'submit', 'blocked', data.operator || 'system',
      '提交年检被拦截', '负责人信息缺失', requestId);
    throw new Error('负责人信息缺失，提交被拦截');
  }

  const attachments = await runQuery('SELECT * FROM attachments WHERE license_id = ? AND status = ?', [id, 'approved']);
  if (attachments.length === 0) {
    await logOperation(id, 'submit', 'manual', data.operator || 'system',
      '需要人工复核', '缺少已审核的材料附件', requestId);
    await runExecute('UPDATE licenses SET status = ? WHERE id = ?', ['reviewing', id]);
    return { status: 'manual', message: '需要人工复核材料附件' };
  }

  await runExecute('UPDATE licenses SET status = ? WHERE id = ?', ['completed', id]);
  await logOperation(id, 'submit', 'success', data.operator || 'system',
    '年检提交成功', null, requestId);

  return { status: 'success', message: '年检提交成功' };
}

async function reviewLicense(id, data) {
  await runExecute('UPDATE licenses SET status = ? WHERE id = ?', [data.status || 'completed', id]);
  await logOperation(id, 'review', 'success', data.reviewer || 'system',
    `人工复核完成，状态改为: ${data.status || 'completed'}`, null, null);
  return { message: '复核完成' };
}

async function addAttachment(licenseId, file, uploader) {
  const id = uuidv4();
  await runExecute(
    'INSERT INTO attachments (id, license_id, file_name, file_path, file_size, uploader) VALUES (?, ?, ?, ?, ?, ?)',
    [id, licenseId, file.originalname, file.path, file.size, uploader || 'system']
  );
  await logOperation(licenseId, 'attachment', 'success', uploader || 'system',
    `上传附件: ${file.originalname}`, null, null);
  return { id, file_name: file.originalname };
}

async function getLicenseTimeline(id) {
  const logs = await runQuery(`
    SELECT * FROM operation_logs 
    WHERE license_id = ? 
    ORDER BY created_at ASC
  `, [id]);
  return logs;
}

async function logOperation(licenseId, operationType, operationStatus, operator, details, failureReason, requestId) {
  const id = uuidv4();
  await runExecute(
    `INSERT INTO operation_logs (id, license_id, operation_type, operation_status, operator, details, failure_reason, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, licenseId, operationType, operationStatus, operator, details, failureReason, requestId]
  );
}

module.exports = {
  getLicenses,
  getLicenseById,
  createLicense,
  updateLicense,
  submitAnnualCheck,
  reviewLicense,
  addAttachment,
  getLicenseTimeline,
  logOperation
};
