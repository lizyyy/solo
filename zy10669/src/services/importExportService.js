const { v4: uuidv4 } = require('uuid');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const db = require('../config/database');
const { now } = require('../utils/date');
const { createRenewalRecord, STATUS } = require('./renewalService');

const fs = require('fs');
const path = require('path');

function importFromCsv(filePath, sourceSystem, operator, callback) {
  const results = [];
  const badRecords = [];
  const batchNo = `BATCH_${Date.now()}`;
  let rowNumber = 0;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => {
      rowNumber++;
      results.push({ ...data, rowNumber });
    })
    .on('end', () => {
      processImportData(results, batchNo, sourceSystem, operator, badRecords, (err, importResult) => {
        if (err) return callback(err);
        
        saveBadRecords(batchNo, badRecords, (saveErr) => {
          if (saveErr) return callback(saveErr);
          
          callback(null, {
            batchNo,
            total: results.length,
            success: importResult.successCount,
            failed: badRecords.length,
            badRecords
          });
        });
      });
    })
    .on('error', callback);
}

function processImportData(rows, batchNo, sourceSystem, operator, badRecords, callback) {
  let successCount = 0;
  let processed = 0;

  if (rows.length === 0) {
    return callback(null, { successCount: 0 });
  }

  rows.forEach((row) => {
    const validation = validateRow(row);
    if (!validation.valid) {
      badRecords.push({
        rowData: JSON.stringify(row),
        errorMessage: validation.error
      });
      processed++;
      if (processed === rows.length) {
        callback(null, { successCount });
      }
      return;
    }

    db.get(`SELECT id FROM members WHERE member_no = ?`, [row.member_no], (err, member) => {
      if (err || !member) {
        badRecords.push({
          rowData: JSON.stringify(row),
          errorMessage: `会员不存在: ${row.member_no}`
        });
        processed++;
        if (processed === rows.length) {
          callback(null, { successCount });
        }
        return;
      }

      db.get(`SELECT id FROM diseases WHERE code = ?`, [row.disease_code], (dErr, disease) => {
        if (dErr || !disease) {
          badRecords.push({
            rowData: JSON.stringify(row),
            errorMessage: `病种不存在: ${row.disease_code}`
          });
          processed++;
          if (processed === rows.length) {
            callback(null, { successCount });
          }
          return;
        }

        db.get(`SELECT id FROM benefit_packages WHERE code = ?`, [row.package_code], (pErr, pkg) => {
          if (pErr || !pkg) {
            badRecords.push({
              rowData: JSON.stringify(row),
              errorMessage: `权益包不存在: ${row.package_code}`
            });
            processed++;
            if (processed === rows.length) {
              callback(null, { successCount });
            }
            return;
          }

          createRenewalRecord({
            memberId: member.id,
            diseaseId: disease.id,
            benefitPackageId: pkg.id,
            materials: row.materials || '',
            sourceSystem,
            operator,
            remark: `批量导入，批次${batchNo}`
          }, (createErr, result) => {
            if (createErr || !result.success) {
              badRecords.push({
                rowData: JSON.stringify(row),
                errorMessage: createErr ? createErr.message : (result.message || '创建失败')
              });
            } else {
              successCount++;
            }
            
            processed++;
            if (processed === rows.length) {
              callback(null, { successCount });
            }
          });
        });
      });
    });
  });
}

function validateRow(row) {
  const required = ['member_no', 'disease_code', 'package_code'];
  const missing = required.filter(field => !row[field]);
  
  if (missing.length > 0) {
    return { valid: false, error: `缺少必填字段: ${missing.join(', ')}` };
  }
  
  return { valid: true };
}

function saveBadRecords(batchNo, badRecords, callback) {
  if (badRecords.length === 0) {
    return callback();
  }

  const stmt = db.prepare(`INSERT INTO import_bad_records 
    (id, import_batch_no, row_data, error_message, created_at) 
    VALUES (?, ?, ?, ?, ?)`);
  
  let completed = 0;
  badRecords.forEach((record) => {
    stmt.run([uuidv4(), batchNo, record.rowData, record.errorMessage, now()], (err) => {
      completed++;
      if (completed === badRecords.length) {
        stmt.finalize();
        callback(err);
      }
    });
  });
}

function exportToCsv(params, callback) {
  const { status, memberId } = params;
  
  let whereClause = 'WHERE 1=1';
  const queryParams = [];
  
  if (memberId) {
    whereClause += ' AND r.member_id = ?';
    queryParams.push(memberId);
  }
  if (status) {
    whereClause += ' AND r.status = ?';
    queryParams.push(status);
  }

  db.all(`
    SELECT 
      r.id,
      m.member_no as 会员编号,
      m.name as 会员姓名,
      d.name as 病种,
      bp.name as 权益包,
      CASE r.status
        WHEN 'pending' THEN '待处理'
        WHEN 'effective' THEN '有效'
        WHEN 'renewal_apply' THEN '续期申请'
        WHEN 'renewed' THEN '已续期'
        WHEN 'suspended' THEN '暂停'
        ELSE r.status
      END as 状态,
      r.materials as 材料,
      r.source_system as 来源系统,
      r.operator as 操作者,
      r.start_date as 开始日期,
      r.end_date as 结束日期,
      r.remark as 备注,
      r.created_at as 创建时间
    FROM renewal_records r
    LEFT JOIN members m ON r.member_id = m.id
    LEFT JOIN diseases d ON r.disease_id = d.id
    LEFT JOIN benefit_packages bp ON r.benefit_package_id = bp.id
    ${whereClause}
    ORDER BY r.created_at DESC
  `, queryParams, (err, data) => {
    if (err) return callback(err);

    try {
      const parser = new Parser();
      const csv = parser.parse(data);
      callback(null, csv);
    } catch (parseErr) {
      callback(parseErr);
    }
  });
}

function getBadRecords(batchNo, callback) {
  if (batchNo) {
    db.all(`
      SELECT * FROM import_bad_records 
      WHERE import_batch_no = ? 
      ORDER BY created_at DESC
    `, [batchNo], callback);
  } else {
    db.all(`
      SELECT * FROM import_bad_records 
      ORDER BY created_at DESC LIMIT 100
    `, callback);
  }
}

module.exports = {
  importFromCsv,
  exportToCsv,
  getBadRecords
};