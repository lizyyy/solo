const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const TRANSFER_STATUS = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  TRANSFERRED: 'transferred',
  CONFLICT_PENDING: 'conflict_pending',
  ARCHIVED: 'archived'
};

const OPERATION_TYPE = {
  CREATE: 'create',
  UPDATE_STATUS: 'update_status',
  RESOLVE_CONFLICT: 'resolve_conflict',
  ARCHIVE: 'archive',
  UPDATE: 'update'
};

const generateTransferNo = () => {
  const dateStr = moment().format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TR${dateStr}${random}`;
};

const createHistoryRecord = (transferId, operationType, oldStatus, newStatus, operatorId, operatorName, operationFrom, note = null, changedFields = null) => {
  return new Promise((resolve, reject) => {
    const historyId = uuidv4();
    const sql = `
      INSERT INTO transfer_history (
        id, transfer_id, operation_type, old_status, new_status,
        operator_id, operator_name, operation_from, note, changed_fields
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(sql, [
      historyId, transferId, operationType, oldStatus, newStatus,
      operatorId, operatorName, operationFrom, note, changedFields ? JSON.stringify(changedFields) : null
    ], function(err) {
      if (err) reject(err);
      else resolve(historyId);
    });
  });
};

const checkTimeConflict = (employeeId, shiftDate, startTime, endTime, excludeTransferId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT ts.*, s.name as shift_name
      FROM transfer_shifts ts
      WHERE ts.employee_id = ?
        AND ts.shift_date = ?
        AND ts.status != ?
        AND (
          (ts.shift_start_time <= ? AND ts.shift_end_time > ?)
          OR (ts.shift_start_time < ? AND ts.shift_end_time >= ?)
          OR (? <= ts.shift_start_time AND ? > ts.shift_start_time)
        )
    `;
    const params = [employeeId, shiftDate, TRANSFER_STATUS.ARCHIVED, startTime, startTime, endTime, endTime, startTime, endTime];
    
    if (excludeTransferId) {
      sql += ` AND ts.id != ?`;
      params.push(excludeTransferId);
    }
    
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const createTransfer = (data, operatorId, operatorName, operationFrom) => {
  return new Promise(async (resolve, reject) => {
    try {
      const transferId = uuidv4();
      const transferNo = generateTransferNo();
      
      const conflicts = await checkTimeConflict(
        data.employee_id,
        data.shift_date,
        data.shift_start_time,
        data.shift_end_time
      );
      
      const initialStatus = conflicts.length > 0 ? TRANSFER_STATUS.CONFLICT_PENDING : TRANSFER_STATUS.PENDING_CONFIRMATION;
      const conflictNote = conflicts.length > 0 
        ? `检测到时间冲突：与 ${conflicts.map(c => `${c.shift_template_name}(${c.shift_start_time}-${c.shift_end_time})`).join(', ')} 重叠` 
        : null;

      const sql = `
        INSERT INTO transfer_shifts (
          id, transfer_no, employee_id, employee_code, employee_name,
          original_store_id, original_store_code, original_store_name,
          target_store_id, target_store_code, target_store_name,
          shift_date, shift_template_id, shift_template_name,
          shift_start_time, shift_end_time, status, conflict_note,
          remark, created_by, created_by_name, created_from
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(sql, [
        transferId, transferNo,
        data.employee_id, data.employee_code, data.employee_name,
        data.original_store_id, data.original_store_code, data.original_store_name,
        data.target_store_id, data.target_store_code, data.target_store_name,
        data.shift_date, data.shift_template_id, data.shift_template_name,
        data.shift_start_time, data.shift_end_time, initialStatus, conflictNote,
        data.remark || null, operatorId, operatorName, operationFrom
      ], async function(err) {
        if (err) {
          reject(err);
          return;
        }

        await createHistoryRecord(
          transferId,
          OPERATION_TYPE.CREATE,
          null,
          initialStatus,
          operatorId,
          operatorName,
          operationFrom,
          conflicts.length > 0 ? `创建时检测到冲突: ${conflictNote}` : '创建借调记录'
        );

        resolve({ id: transferId, transfer_no: transferNo, status: initialStatus, has_conflict: conflicts.length > 0 });
      });
    } catch (err) {
      reject(err);
    }
  });
};

const getTransferList = (params = {}) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT * FROM transfer_shifts WHERE 1=1`;
    const countSql = `SELECT COUNT(*) as total FROM transfer_shifts WHERE 1=1`;
    const queryParams = [];
    const countParams = [];

    if (params.status) {
      sql += ` AND status = ?`;
      countSql += ` AND status = ?`;
      queryParams.push(params.status);
      countParams.push(params.status);
    }
    if (params.employee_name) {
      sql += ` AND employee_name LIKE ?`;
      countSql += ` AND employee_name LIKE ?`;
      queryParams.push(`%${params.employee_name}%`);
      countParams.push(`%${params.employee_name}%`);
    }
    if (params.shift_date_start) {
      sql += ` AND shift_date >= ?`;
      countSql += ` AND shift_date >= ?`;
      queryParams.push(params.shift_date_start);
      countParams.push(params.shift_date_start);
    }
    if (params.shift_date_end) {
      sql += ` AND shift_date <= ?`;
      countSql += ` AND shift_date <= ?`;
      queryParams.push(params.shift_date_end);
      countParams.push(params.shift_date_end);
    }

    sql += ` ORDER BY created_at DESC`;

    if (params.page && params.page_size) {
      const offset = (params.page - 1) * params.page_size;
      sql += ` LIMIT ? OFFSET ?`;
      queryParams.push(params.page_size, offset);
    }

    db.all(sql, queryParams, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      db.get(countSql, countParams, (err, countResult) => {
        if (err) reject(err);
        else resolve({ list: rows, total: countResult.total });
      });
    });
  });
};

const getTransferDetail = (transferId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM transfer_shifts WHERE id = ?`;
    db.get(sql, [transferId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getTransferHistory = (transferId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM transfer_history
      WHERE transfer_id = ?
      ORDER BY created_at DESC
    `;
    db.all(sql, [transferId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const updateTransferStatus = (transferId, newStatus, operatorId, operatorName, operationFrom, note = null) => {
  return new Promise(async (resolve, reject) => {
    try {
      const transfer = await getTransferDetail(transferId);
      if (!transfer) {
        reject(new Error('借调记录不存在'));
        return;
      }

      const oldStatus = transfer.status;

      const sql = `
        UPDATE transfer_shifts
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      db.run(sql, [newStatus, transferId], async function(err) {
        if (err) {
          reject(err);
          return;
        }

        await createHistoryRecord(
          transferId,
          OPERATION_TYPE.UPDATE_STATUS,
          oldStatus,
          newStatus,
          operatorId,
          operatorName,
          operationFrom,
          note
        );

        resolve({ success: true });
      });
    } catch (err) {
      reject(err);
    }
  });
};

const resolveConflict = (transferId, operatorId, operatorName, operationFrom, resolveNote) => {
  return new Promise(async (resolve, reject) => {
    try {
      const transfer = await getTransferDetail(transferId);
      if (!transfer) {
        reject(new Error('借调记录不存在'));
        return;
      }

      if (transfer.status !== TRANSFER_STATUS.CONFLICT_PENDING) {
        reject(new Error('当前状态不是冲突待判，无需处理'));
        return;
      }

      const oldStatus = transfer.status;
      const newStatus = TRANSFER_STATUS.PENDING_CONFIRMATION;

      const sql = `
        UPDATE transfer_shifts
        SET status = ?,
            conflict_resolved_at = CURRENT_TIMESTAMP,
            conflict_resolved_by = ?,
            conflict_resolved_note = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      db.run(sql, [newStatus, operatorId, resolveNote, transferId], async function(err) {
        if (err) {
          reject(err);
          return;
        }

        await createHistoryRecord(
          transferId,
          OPERATION_TYPE.RESOLVE_CONFLICT,
          oldStatus,
          newStatus,
          operatorId,
          operatorName,
          operationFrom,
          resolveNote
        );

        resolve({ success: true });
      });
    } catch (err) {
      reject(err);
    }
  });
};

const archiveTransfer = (transferId, operatorId, operatorName, operationFrom, note = null) => {
  return new Promise(async (resolve, reject) => {
    try {
      const transfer = await getTransferDetail(transferId);
      if (!transfer) {
        reject(new Error('借调记录不存在'));
        return;
      }

      const oldStatus = transfer.status;

      const sql = `
        UPDATE transfer_shifts
        SET status = ?, archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      db.run(sql, [TRANSFER_STATUS.ARCHIVED, transferId], async function(err) {
        if (err) {
          reject(err);
          return;
        }

        await createHistoryRecord(
          transferId,
          OPERATION_TYPE.ARCHIVE,
          oldStatus,
          TRANSFER_STATUS.ARCHIVED,
          operatorId,
          operatorName,
          operationFrom,
          note
        );

        resolve({ success: true });
      });
    } catch (err) {
      reject(err);
    }
  });
};

const getAllTransfersForExport = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        transfer_no as '借调单号',
        employee_name as '员工姓名',
        employee_code as '员工工号',
        original_store_name as '原门店',
        target_store_name as '目标门店',
        shift_date as '班次日期',
        shift_template_name as '班次名称',
        shift_start_time as '开始时间',
        shift_end_time as '结束时间',
        CASE status
          WHEN 'pending_confirmation' THEN '待确认'
          WHEN 'transferred' THEN '已借调'
          WHEN 'conflict_pending' THEN '冲突待判'
          WHEN 'archived' THEN '已归档'
          ELSE status
        END as '状态',
        conflict_note as '冲突备注',
        created_by_name as '创建人',
        created_at as '创建时间'
      FROM transfer_shifts
      ORDER BY created_at DESC
    `;
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  TRANSFER_STATUS,
  OPERATION_TYPE,
  createTransfer,
  getTransferList,
  getTransferDetail,
  getTransferHistory,
  updateTransferStatus,
  resolveConflict,
  archiveTransfer,
  getAllTransfersForExport,
  checkTimeConflict
};
