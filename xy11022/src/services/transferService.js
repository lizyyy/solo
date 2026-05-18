const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const {
  validateTransferData,
  validateTransferUpdate,
  validateQuery,
  isValidStatusTransition,
  generateTransferNo
} = require('../utils/validation');

class TransferService {
  async createTransfer(data) {
    const validation = validateTransferData(data);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const existingConflict = await this.checkTimeConflict(
        data.assignee_id,
        data.scheduled_class_time,
        data.coach_id
      );

      if (existingConflict) {
        return {
          success: false,
          error: '受让人已有同时间课程安排',
          conflict: existingConflict
        };
      }

      const id = uuidv4();
      const transferNo = generateTransferNo();
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO class_transfers (
          id, transfer_no, transfer_date, store_id, store_name,
          assignor_id, assignor_name, assignor_phone,
          assignee_id, assignee_name, assignee_phone,
          coach_id, coach_name, class_package_id, class_package_name,
          transfer_class_count, remaining_class_count, original_unit_price,
          transfer_fee, total_amount, scheduled_class_time,
          status, handler_id, handler_name, remark, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await new Promise((resolve, reject) => {
        stmt.run(
          id, transferNo, data.transfer_date, data.store_id, data.store_name,
          data.assignor_id, data.assignor_name, data.assignor_phone,
          data.assignee_id, data.assignee_name, data.assignee_phone,
          data.coach_id, data.coach_name, data.class_package_id, data.class_package_name,
          data.transfer_class_count, data.remaining_class_count, data.original_unit_price,
          data.transfer_fee, data.total_amount, data.scheduled_class_time || null,
          'pending', data.handler_id || null, data.handler_name || null, data.remark || null,
          now, now,
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      stmt.finalize();

      await this.createAuditLog(id, null, 'pending', data.handler_id, data.handler_name, '创建转让申请');

      return { success: true, data: { id, transfer_no: transferNo } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateTransfer(id, updateData) {
    const validation = validateTransferUpdate(updateData);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const transfer = await this.getTransferById(id);
      if (!transfer) {
        return { success: false, error: '转让记录不存在' };
      }

      if (!isValidStatusTransition(transfer.status, updateData.status)) {
        return {
          success: false,
          error: `状态不允许从 ${transfer.status} 变更为 ${updateData.status}`
        };
      }

      const now = new Date().toISOString();
      const stmt = db.prepare(`
        UPDATE class_transfers
        SET status = ?, handler_id = ?, handler_name = ?,
            approved_at = ?, reject_reason = ?, remark = ?, updated_at = ?
        WHERE id = ?
      `);

      await new Promise((resolve, reject) => {
        stmt.run(
          updateData.status,
          updateData.handler_id,
          updateData.handler_name,
          updateData.status === 'approved' ? now : null,
          updateData.reject_reason || null,
          updateData.remark || null,
          now,
          id,
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      stmt.finalize();

      await this.createAuditLog(
        id,
        transfer.status,
        updateData.status,
        updateData.handler_id,
        updateData.handler_name,
        updateData.reject_reason || updateData.remark || '状态变更'
      );

      return { success: true, data: { id, status: updateData.status } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getTransferById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM class_transfers WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getTransfers(query) {
    const validation = validateQuery(query);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const { start_date, end_date, status, handler_id, store_id, page, page_size } = validation.value;

      let sql = 'SELECT * FROM class_transfers WHERE 1=1';
      let countSql = 'SELECT COUNT(*) as total FROM class_transfers WHERE 1=1';
      const params = [];
      const countParams = [];

      if (start_date) {
        sql += ' AND transfer_date >= ?';
        countSql += ' AND transfer_date >= ?';
        params.push(start_date);
        countParams.push(start_date);
      }
      if (end_date) {
        sql += ' AND transfer_date <= ?';
        countSql += ' AND transfer_date <= ?';
        params.push(end_date);
        countParams.push(end_date);
      }
      if (status) {
        sql += ' AND status = ?';
        countSql += ' AND status = ?';
        params.push(status);
        countParams.push(status);
      }
      if (handler_id) {
        sql += ' AND handler_id = ?';
        countSql += ' AND handler_id = ?';
        params.push(handler_id);
        countParams.push(handler_id);
      }
      if (store_id) {
        sql += ' AND store_id = ?';
        countSql += ' AND store_id = ?';
        params.push(store_id);
        countParams.push(store_id);
      }

      sql += ' ORDER BY transfer_date DESC, created_at DESC';
      sql += ' LIMIT ? OFFSET ?';
      params.push(page_size);
      params.push((page - 1) * page_size);

      const rows = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const countResult = await new Promise((resolve, reject) => {
        db.get(countSql, countParams, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      return {
        success: true,
        data: {
          list: rows,
          pagination: {
            page,
            page_size,
            total: countResult.total,
            total_pages: Math.ceil(countResult.total / page_size)
          }
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async batchImport(transfers) {
    const results = [];
    
    for (let i = 0; i < transfers.length; i++) {
      const transfer = transfers[i];
      const result = await this.createTransfer(transfer);
      results.push({
        row_index: i + 1,
        success: result.success,
        transfer_no: result.data?.transfer_no,
        error: result.error || null,
        conflict: result.conflict || null
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return {
      success: true,
      data: {
        total: transfers.length,
        success_count: successCount,
        fail_count: failCount,
        results
      }
    };
  }

  async exportTransfers(query) {
    const result = await this.getTransfers({ ...query, page_size: 1000 });
    if (!result.success) {
      return result;
    }
    return { success: true, data: result.data.list };
  }

  async checkTimeConflict(assigneeId, scheduledTime, coachId) {
    if (!scheduledTime) return null;

    return new Promise((resolve, reject) => {
      db.get(
        `SELECT transfer_no, assignee_name, scheduled_class_time, coach_name
         FROM class_transfers
         WHERE assignee_id = ? 
           AND scheduled_class_time = ?
           AND coach_id = ?
           AND status NOT IN ('rejected', 'cancelled')
         LIMIT 1`,
        [assigneeId, scheduledTime, coachId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async createAuditLog(transferId, previousStatus, newStatus, operatorId, operatorName, remark) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO class_transfer_audit (
        id, transfer_id, previous_status, new_status,
        operator_id, operator_name, operation_remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    return new Promise((resolve, reject) => {
      stmt.run(
        id, transferId, previousStatus, newStatus,
        operatorId || null, operatorName || null, remark,
        function(err) {
          stmt.finalize();
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}

module.exports = new TransferService();
