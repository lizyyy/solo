const db = require('./database');
const { v4: uuidv4 } = require('uuid');

const STATUS = {
  PENDING_SIGN: 'pending_sign',
  RESIGNING: 'resigning',
  EFFECTIVE: 'effective',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  PENDING_MANUAL: 'pending_manual'
};

const recordHistory = (recordId, contractId, signatoryId, signatureNo, resignReason, status, version, operation, operator, remarks) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO signature_history (record_id, contract_id, signatory_id, signature_no, resign_reason, status, version, operation, operator, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recordId, contractId, signatoryId, signatureNo, resignReason, status, version, operation, operator, remarks],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

const createContract = (contractNo, contractName, createdBy) => {
  return new Promise((resolve, reject) => {
    const contractId = uuidv4();
    db.run(
      `INSERT INTO contracts (id, contract_no, contract_name) VALUES (?, ?, ?)`,
      [contractId, contractNo, contractName],
      (err) => {
        if (err) reject(err);
        else resolve({ id: contractId, contract_no: contractNo, contract_name: contractName });
      }
    );
  });
};

const createSignatory = (contractId, signatoryName, signatoryType) => {
  return new Promise((resolve, reject) => {
    const signatoryId = uuidv4();
    db.run(
      `INSERT INTO signatories (id, contract_id, signatory_name, signatory_type) VALUES (?, ?, ?, ?)`,
      [signatoryId, contractId, signatoryName, signatoryType],
      (err) => {
        if (err) reject(err);
        else resolve({ id: signatoryId, contract_id: contractId, signatory_name: signatoryName, signatory_type: signatoryType });
      }
    );
  });
};

const createSignatureRecord = (contractId, signatoryId, signatureNo, resignReason, createdBy) => {
  return new Promise((resolve, reject) => {
    const recordId = uuidv4();
    const status = STATUS.PENDING_SIGN;
    const version = 1;
    
    db.run(
      `INSERT INTO signature_records (id, contract_id, signatory_id, signature_no, resign_reason, status, version, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [recordId, contractId, signatoryId, signatureNo, resignReason, status, version, createdBy],
      async (err) => {
        if (err) reject(err);
        else {
          await recordHistory(recordId, contractId, signatoryId, signatureNo, resignReason, status, version, '创建', createdBy, '创建重签登记');
          resolve({ id: recordId, contract_id: contractId, signatory_id: signatoryId, signature_no: signatureNo, resign_reason: resignReason, status, version });
        }
      }
    );
  });
};

const modifySignatureRecord = (recordId, signatureNo, resignReason, operator) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM signature_records WHERE id = ?`, [recordId], async (err, record) => {
      if (err) return reject(err);
      if (!record) return reject(new Error('记录不存在'));
      if (record.status === STATUS.CANCELLED || record.status === STATUS.EFFECTIVE) {
        return reject(new Error('当前状态不允许修改'));
      }

      const newVersion = record.version + 1;
      db.run(
        `UPDATE signature_records SET signature_no = ?, resign_reason = ?, status = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [signatureNo, resignReason, STATUS.RESIGNING, newVersion, recordId],
        async (err) => {
          if (err) reject(err);
          else {
            await recordHistory(recordId, record.contract_id, record.signatory_id, signatureNo, resignReason, STATUS.RESIGNING, newVersion, '修改', operator, '修改重签信息');
            resolve({ id: recordId, signature_no: signatureNo, resign_reason: resignReason, status: STATUS.RESIGNING, version: newVersion });
          }
        }
      );
    });
  });
};

const auditSignatureRecord = (recordId, approved, operator, remarks) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM signature_records WHERE id = ?`, [recordId], async (err, record) => {
      if (err) return reject(err);
      if (!record) return reject(new Error('记录不存在'));
      if (record.status !== STATUS.RESIGNING && record.status !== STATUS.PENDING_SIGN) {
        return reject(new Error('当前状态不允许审核'));
      }

      const newStatus = approved ? STATUS.EFFECTIVE : STATUS.REJECTED;
      const newVersion = record.version + 1;
      db.run(
        `UPDATE signature_records SET status = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newStatus, newVersion, recordId],
        async (err) => {
          if (err) reject(err);
          else {
            const operation = approved ? '审核通过' : '审核驳回';
            await recordHistory(recordId, record.contract_id, record.signatory_id, record.signature_no, record.resign_reason, newStatus, newVersion, operation, operator, remarks || operation);
            resolve({ id: recordId, status: newStatus, version: newVersion });
          }
        }
      );
    });
  });
};

const withdrawSignatureRecord = (recordId, operator, remarks) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM signature_records WHERE id = ?`, [recordId], async (err, record) => {
      if (err) return reject(err);
      if (!record) return reject(new Error('记录不存在'));
      if (record.status === STATUS.CANCELLED || record.status === STATUS.EFFECTIVE) {
        return reject(new Error('当前状态不允许撤回'));
      }

      const newVersion = record.version + 1;
      db.run(
        `UPDATE signature_records SET status = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [STATUS.CANCELLED, newVersion, recordId],
        async (err) => {
          if (err) reject(err);
          else {
            await recordHistory(recordId, record.contract_id, record.signatory_id, record.signature_no, record.resign_reason, STATUS.CANCELLED, newVersion, '撤回', operator, remarks || '撤回重签申请');
            resolve({ id: recordId, status: STATUS.CANCELLED, version: newVersion });
          }
        }
      );
    });
  });
};

const getSignatureRecord = (recordId) => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT sr.*, c.contract_no, c.contract_name, s.signatory_name, s.signatory_type
       FROM signature_records sr
       JOIN contracts c ON sr.contract_id = c.id
       JOIN signatories s ON sr.signatory_id = s.id
       WHERE sr.id = ?`,
      [recordId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

const listSignatureRecords = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT sr.*, c.contract_no, c.contract_name, s.signatory_name, s.signatory_type
               FROM signature_records sr
               JOIN contracts c ON sr.contract_id = c.id
               JOIN signatories s ON sr.signatory_id = s.id
               WHERE 1=1`;
    const params = [];

    if (filters.status) {
      sql += ` AND sr.status = ?`;
      params.push(filters.status);
    }
    if (filters.contract_no) {
      sql += ` AND c.contract_no LIKE ?`;
      params.push(`%${filters.contract_no}%`);
    }
    if (filters.signatory_name) {
      sql += ` AND s.signatory_name LIKE ?`;
      params.push(`%${filters.signatory_name}%`);
    }

    sql += ` ORDER BY sr.updated_at DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const getSignatureHistory = (recordId) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT sh.*, s.signatory_name, c.contract_no
       FROM signature_history sh
       JOIN signatories s ON sh.signatory_id = s.id
       JOIN contracts c ON sh.contract_id = c.id
       WHERE sh.record_id = ?
       ORDER BY sh.operation_time DESC`,
      [recordId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};

const checkVersionConflict = (recordId, downloadVersion) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM signature_records WHERE id = ?`, [recordId], async (err, record) => {
      if (err) return reject(err);
      if (!record) return reject(new Error('记录不存在'));

      if (downloadVersion < record.version) {
        const conflictId = uuidv4();
        const conflictDescription = `签署方下载的版本(v${downloadVersion})不是当前最新版本(v${record.version})，可能存在重签后另一方仍使用旧版本的风险`;
        
        db.run(
          `INSERT INTO pending_manual_process (id, record_id, conflict_type, conflict_description, download_version, current_version, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [conflictId, recordId, 'version_conflict', conflictDescription, downloadVersion, record.version, 'pending'],
          async (err) => {
            if (err) reject(err);
            else {
              const newVersion = record.version + 1;
              db.run(
                `UPDATE signature_records SET status = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [STATUS.PENDING_MANUAL, newVersion, recordId]
              );
              await recordHistory(recordId, record.contract_id, record.signatory_id, record.signature_no, record.resign_reason, STATUS.PENDING_MANUAL, newVersion, '冲突检测', 'system', conflictDescription);
              resolve({
                has_conflict: true,
                conflict_id: conflictId,
                conflict_description: conflictDescription,
                current_version: record.version,
                download_version: downloadVersion
              });
            }
          }
        );
      } else {
        resolve({ has_conflict: false });
      }
    });
  });
};

const getPendingManualProcess = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT pmp.*, c.contract_no, c.contract_name, s.signatory_name, sr.signature_no
       FROM pending_manual_process pmp
       JOIN signature_records sr ON pmp.record_id = sr.id
       JOIN contracts c ON sr.contract_id = c.id
       JOIN signatories s ON sr.signatory_id = s.id
       ORDER BY pmp.created_at DESC`,
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};

const importRecords = (records, batchNo) => {
  return new Promise(async (resolve, reject) => {
    const results = [];
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const importId = uuidv4();
      
      try {
        if (!record.contract_no || !record.contract_name || !record.signatory_name || !record.signatory_type) {
          throw new Error('缺少必填字段');
        }

        let contract = await new Promise((res, rej) => {
          db.get(`SELECT * FROM contracts WHERE contract_no = ?`, [record.contract_no], (err, row) => {
            if (err) rej(err);
            else res(row);
          });
        });

        if (!contract) {
          contract = await createContract(record.contract_no, record.contract_name, 'import');
        }

        const signatory = await createSignatory(contract.id, record.signatory_name, record.signatory_type);
        await createSignatureRecord(contract.id, signatory.id, record.signature_no, record.resign_reason, 'import');

        db.run(
          `INSERT INTO import_records (id, batch_no, row_data, status) VALUES (?, ?, ?, ?)`,
          [importId, batchNo, JSON.stringify(record), 'success']
        );
        results.push({ row: i + 1, status: 'success', data: record });
      } catch (error) {
        db.run(
          `INSERT INTO import_records (id, batch_no, row_data, status, error_message) VALUES (?, ?, ?, ?, ?)`,
          [importId, batchNo, JSON.stringify(record), 'failed', error.message]
        );
        results.push({ row: i + 1, status: 'failed', data: record, error: error.message });
      }
    }
    resolve(results);
  });
};

const getAllDataForExport = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT sr.id, c.contract_no, c.contract_name, s.signatory_name, s.signatory_type,
              sr.signature_no, sr.resign_reason, sr.status, sr.version, sr.created_at, sr.updated_at
       FROM signature_records sr
       JOIN contracts c ON sr.contract_id = c.id
       JOIN signatories s ON sr.signatory_id = s.id
       ORDER BY sr.updated_at DESC`,
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};

module.exports = {
  STATUS,
  createContract,
  createSignatory,
  createSignatureRecord,
  modifySignatureRecord,
  auditSignatureRecord,
  withdrawSignatureRecord,
  getSignatureRecord,
  listSignatureRecords,
  getSignatureHistory,
  checkVersionConflict,
  getPendingManualProcess,
  importRecords,
  getAllDataForExport
};
