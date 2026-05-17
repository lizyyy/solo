const { run, get, all, generateId, now } = require('../db');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

function recordBadRow(batchId, rowNumber, rowData, errorMessage) {
  const id = generateId();
  run(`
    INSERT INTO import_bad_rows (
      id, import_batch_id, row_number, row_data,
      error_message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    id,
    batchId,
    rowNumber,
    JSON.stringify(rowData),
    errorMessage,
    now()
  ]);
  return id;
}

function validateRow(row, rowNumber) {
  const errors = [];
  
  if (!row.claim_no || row.claim_no.trim() === '') {
    errors.push('理赔单号不能为空');
  }
  if (!row.customer_name || row.customer_name.trim() === '') {
    errors.push('客户姓名不能为空');
  }
  if (!row.material_code || row.material_code.trim() === '') {
    errors.push('材料编码不能为空');
  }
  if (!row.material_name || row.material_name.trim() === '') {
    errors.push('材料名称不能为空');
  }
  if (!row.deadline) {
    errors.push('截止日期不能为空');
  } else {
    const date = new Date(row.deadline);
    if (isNaN(date.getTime())) {
      errors.push('截止日期格式无效');
    }
  }
  if (row.channel && !['SMS', 'EMAIL', 'APP', 'WECHAT'].includes(row.channel)) {
    errors.push('通知渠道无效');
  }

  return {
    valid: errors.length === 0,
    errors: errors.join('; ')
  };
}

function importFromCsv(filePath, batchId, operatorId) {
  return new Promise((resolve) => {
    const results = {
      success: 0,
      failed: 0,
      badRows: []
    };
    let rowNumber = 0;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        rowNumber++;
        const validation = validateRow(row, rowNumber);
        
        if (!validation.valid) {
          results.failed++;
          recordBadRow(batchId, rowNumber, row, validation.errors);
          results.badRows.push({
            rowNumber,
            rowData: row,
            error: validation.errors
          });
          return;
        }

        try {
          let claim = get('SELECT * FROM claims WHERE claim_no = ?', [row.claim_no]);
          
          if (!claim) {
            const claimId = generateId();
            run(`
              INSERT INTO claims (
                id, claim_no, customer_name, customer_phone,
                policy_no, incident_type, incident_date,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              claimId,
              row.claim_no,
              row.customer_name,
              row.customer_phone || null,
              row.policy_no || null,
              row.incident_type || null,
              row.incident_date || null,
              now(),
              now()
            ]);
            claim = { id: claimId };
          }

          const noticeId = generateId();
          run(`
            INSERT INTO notice_records (
              id, claim_id, channel, deadline, status,
              flow_type, operator_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            noticeId,
            claim.id,
            row.channel || 'SMS',
            row.deadline,
            'PENDING',
            row.flow_type || 'NORMAL',
            operatorId,
            now(),
            now()
          ]);

          const materialId = generateId();
          run(`
            INSERT INTO material_items (
              id, claim_id, material_code, material_name,
              quantity, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            materialId,
            claim.id,
            row.material_code,
            row.material_name,
            parseInt(row.quantity) || 1,
            'PENDING',
            now(),
            now()
          ]);

          results.success++;
        } catch (error) {
          results.failed++;
          recordBadRow(batchId, rowNumber, row, error.message);
          results.badRows.push({
            rowNumber,
            rowData: row,
            error: error.message
          });
        }
      })
      .on('end', () => {
        resolve(results);
      });
  });
}

function exportToCsv(params = {}) {
  const notices = all(`
    SELECT 
      nr.id,
      c.claim_no,
      c.customer_name,
      c.customer_phone,
      nr.channel,
      nr.deadline,
      nr.status,
      nr.flow_type,
      nr.remark,
      nr.created_at,
      nr.updated_at
    FROM notice_records nr
    LEFT JOIN claims c ON nr.claim_id = c.id
    ORDER BY nr.created_at DESC
  `);

  const materials = all(`
    SELECT claim_id, material_name FROM material_items
  `);

  const materialMap = {};
  materials.forEach(m => {
    if (!materialMap[m.claim_id]) {
      materialMap[m.claim_id] = [];
    }
    materialMap[m.claim_id].push(m.material_name);
  });

  notices.forEach(n => {
    n.materials = materialMap[n.id] ? materialMap[n.id].join(', ') : '';
  });

  const fields = [
    'id', 'claim_no', 'customer_name', 'customer_phone',
    'channel', 'deadline', 'status', 'flow_type',
    'materials', 'remark', 'created_at', 'updated_at'
  ];

  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(notices);
}

function getBadRows(batchId = null) {
  let sql = 'SELECT * FROM import_bad_rows';
  const params = [];
  
  if (batchId) {
    sql += ' WHERE import_batch_id = ?';
    params.push(batchId);
  }
  sql += ' ORDER BY row_number';
  
  return all(sql, params).map(row => ({
    ...row,
    row_data: JSON.parse(row.row_data)
  }));
}

module.exports = {
  importFromCsv,
  exportToCsv,
  getBadRows,
  recordBadRow
};
