const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { now, addDays, isExpired, formatDate } = require('../utils/date');

const STATUS = {
  PENDING: 'pending',
  EFFECTIVE: 'effective',
  RENEWAL_APPLY: 'renewal_apply',
  RENEWED: 'renewed',
  SUSPENDED: 'suspended'
};

const CONFLICT_RULES = {
  SAME_SOURCE: 'same_source_ignore',
  DIFFERENT_SOURCE: 'different_source_warning'
};

function createRenewalRecord(data, callback) {
  const { memberId, diseaseId, benefitPackageId, materials, sourceSystem, operator, remark } = data;
  
  db.get(`SELECT * FROM members WHERE id = ?`, [memberId], (err, member) => {
    if (err) return callback(err);
    if (!member) return callback(new Error('会员不存在'));

    const materialsArray = materials ? materials.split(',') : [];
    const missingMaterials = [];
    
    if (isExpired(member.data_expiry_date)) {
      missingMaterials.push('会员资料已过期，请更新会员基本信息');
    }
    if (!materialsArray.includes('diagnosis_proof')) {
      missingMaterials.push('需补充诊断证明');
    }
    if (!materialsArray.includes('medical_record')) {
      missingMaterials.push('需补充病历资料');
    }

    if (missingMaterials.length > 0) {
      return callback(null, {
        success: false,
        blocked: true,
        message: '自动续期被拦截，会员资料不完整',
        missingMaterials: missingMaterials
      });
    }

    checkConflict(memberId, diseaseId, benefitPackageId, sourceSystem, (conflictErr, conflictResult) => {
      if (conflictErr) return callback(conflictErr);

      db.get(`SELECT * FROM benefit_packages WHERE id = ?`, [benefitPackageId], (pkgErr, pkg) => {
        if (pkgErr) return callback(pkgErr);
        if (!pkg) return callback(new Error('权益包不存在'));

        const startDate = formatDate(now());
        const endDate = addDays(startDate, pkg.validity_days);
        const recordId = uuidv4();

        db.run(`INSERT INTO renewal_records (
          id, member_id, disease_id, benefit_package_id, status, materials,
          source_system, operator, start_date, end_date, remark, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          recordId, memberId, diseaseId, benefitPackageId, STATUS.RENEWAL_APPLY,
          materials, sourceSystem, operator, startDate, endDate, remark, now(), now()
        ], (insertErr) => {
          if (insertErr) {
            if (insertErr.message.includes('UNIQUE constraint')) {
              return callback(null, {
                success: false,
                conflict: true,
                message: '存在相同状态的续期记录，冲突规则：同一组合同一状态不允许重复创建'
              });
            }
            return callback(insertErr);
          }

          addHistory(recordId, 'create', null, STATUS.RENEWAL_APPLY, sourceSystem, operator, '创建续期申请', (historyErr) => {
            if (historyErr) return callback(historyErr);

            callback(null, {
              success: true,
              data: { id: recordId, status: STATUS.RENEWAL_APPLY },
              conflict: conflictResult.hasConflict,
              conflictWarning: conflictResult.warning
            });
          });
        });
      });
    });
  });
}

function checkConflict(memberId, diseaseId, benefitPackageId, sourceSystem, callback) {
  db.all(`
    SELECT * FROM renewal_records 
    WHERE member_id = ? AND disease_id = ? AND benefit_package_id = ?
    ORDER BY created_at DESC LIMIT 5
  `, [memberId, diseaseId, benefitPackageId], (err, records) => {
    if (err) return callback(err);

    if (records.length === 0) {
      return callback(null, { hasConflict: false });
    }

    const sameSourceRecords = records.filter(r => r.source_system === sourceSystem);
    const differentSourceRecords = records.filter(r => r.source_system !== sourceSystem);

    if (sameSourceRecords.length > 0) {
      return callback(null, {
        hasConflict: true,
        warning: `来源系统[${sourceSystem}]已有${sameSourceRecords.length}条记录，相同来源重复创建将被忽略`
      });
    }

    if (differentSourceRecords.length > 0) {
      const otherSources = [...new Set(differentSourceRecords.map(r => r.source_system))];
      return callback(null, {
        hasConflict: true,
        warning: `其他系统[${otherSources.join(',')}]已有${differentSourceRecords.length}条记录，请确认是否需要合并`
      });
    }

    callback(null, { hasConflict: false });
  });
}

function updateStatus(recordId, newStatus, sourceSystem, operator, remark, callback) {
  db.get(`SELECT * FROM renewal_records WHERE id = ?`, [recordId], (err, record) => {
    if (err) return callback(err);
    if (!record) return callback(new Error('记录不存在'));

    const oldStatus = record.status;
    
    db.run(`UPDATE renewal_records SET status = ?, updated_at = ?, remark = COALESCE(?, remark) WHERE id = ?`, 
      [newStatus, now(), remark, recordId], (updateErr) => {
      if (updateErr) return callback(updateErr);

      addHistory(recordId, 'status_change', oldStatus, newStatus, sourceSystem, operator, 
        `状态从${oldStatus}变更为${newStatus}`, callback);
    });
  });
}

function addHistory(recordId, action, oldStatus, newStatus, sourceSystem, operator, changeContent, callback) {
  const historyId = uuidv4();
  db.run(`INSERT INTO renewal_history (
    id, renewal_record_id, action, old_status, new_status,
    source_system, operator, change_content, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    historyId, recordId, action, oldStatus, newStatus,
    sourceSystem, operator, changeContent, now()
  ], callback);
}

function getRenewalList(params, callback) {
  const { page = 1, pageSize = 20, memberId, status } = params;
  const offset = (page - 1) * pageSize;
  
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
    SELECT r.*, m.name as member_name, m.member_no, d.name as disease_name, bp.name as package_name
    FROM renewal_records r
    LEFT JOIN members m ON r.member_id = m.id
    LEFT JOIN diseases d ON r.disease_id = d.id
    LEFT JOIN benefit_packages bp ON r.benefit_package_id = bp.id
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `, [...queryParams, pageSize, offset], (err, list) => {
    if (err) return callback(err);
    
    db.get(`SELECT COUNT(*) as total FROM renewal_records r ${whereClause}`, queryParams, (countErr, result) => {
      if (countErr) return callback(countErr);
      callback(null, { list, total: result.total, page, pageSize });
    });
  });
}

function getRenewalDetail(id, callback) {
  db.get(`
    SELECT r.*, m.name as member_name, m.member_no, m.data_expiry_date,
           d.name as disease_name, bp.name as package_name, bp.validity_days
    FROM renewal_records r
    LEFT JOIN members m ON r.member_id = m.id
    LEFT JOIN diseases d ON r.disease_id = d.id
    LEFT JOIN benefit_packages bp ON r.benefit_package_id = bp.id
    WHERE r.id = ?
  `, [id], callback);
}

function getRenewalHistory(recordId, callback) {
  db.all(`
    SELECT * FROM renewal_history 
    WHERE renewal_record_id = ? 
    ORDER BY created_at DESC
  `, [recordId], callback);
}

function approveRenewal(recordId, sourceSystem, operator, callback) {
  updateStatus(recordId, STATUS.EFFECTIVE, sourceSystem, operator, '审核通过', callback);
}

function suspendRenewal(recordId, sourceSystem, operator, reason, callback) {
  updateStatus(recordId, STATUS.SUSPENDED, sourceSystem, operator, `暂停原因: ${reason}`, callback);
}

module.exports = {
  STATUS,
  createRenewalRecord,
  updateStatus,
  getRenewalList,
  getRenewalDetail,
  getRenewalHistory,
  approveRenewal,
  suspendRenewal
};