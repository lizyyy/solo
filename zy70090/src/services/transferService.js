const pool = require('../database/pool');
const { ApiError } = require('../utils/response');
const OperationLogService = require('./operationLogService');

class TransferService {
  static async createTransfer(req, seizedItemId, data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const itemResult = await client.query(
        'SELECT * FROM seized_items WHERE id = $1 AND is_deleted = FALSE',
        [seizedItemId]
      );

      if (itemResult.rows.length === 0) {
        throw new ApiError('扣押清单不存在', 404, 'ITEM_NOT_FOUND');
      }

      const item = itemResult.rows[0];

      if (!['seized', 'sealed'].includes(item.current_status)) {
        throw new ApiError(`当前状态(${item.current_status})不允许移交`, 400, 'INVALID_STATUS_FOR_TRANSFER');
      }

      const requiredFields = ['transfer_number', 'transfer_date', 'transfer_quantity', 'to_department'];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        throw new ApiError(`缺少必要字段: ${missingFields.join(', ')}`, 400, 'MISSING_REQUIRED_FIELDS');
      }

      if (data.transfer_quantity > item.quantity) {
        throw new ApiError(`移交数量(${data.transfer_quantity})不能超过物品总数(${item.quantity})`, 400, 'TRANSFER_QUANTITY_EXCEEDS');
      }

      const existingTransfer = await client.query(
        'SELECT id FROM transfer_records WHERE transfer_number = $1',
        [data.transfer_number]
      );

      if (existingTransfer.rows.length > 0) {
        throw new ApiError('移交编号已存在', 409, 'TRANSFER_NUMBER_EXISTS');
      }

      if (data.photo_required && data.photo_required > 0) {
        const photoCount = await client.query(
          `SELECT COUNT(*) as count FROM item_photos 
           WHERE seized_item_id = $1 AND photo_type = 'transferred' AND is_verified = TRUE`,
          [seizedItemId]
        );

        if (parseInt(photoCount.rows[0].count) < data.photo_required) {
          throw new ApiError(
            `移交照片校验未通过：需要 ${data.photo_required} 张照片，实际只有 ${photoCount.rows[0].count} 张已校验照片`,
            400,
            'PHOTO_VERIFICATION_FAILED'
          );
        }
      }

      const result = await client.query(
        `INSERT INTO transfer_records 
         (seized_item_id, transfer_number, transfer_date, transfer_quantity,
          from_department, from_operator, to_department, to_operator, transfer_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          seizedItemId,
          data.transfer_number,
          data.transfer_date,
          data.transfer_quantity,
          data.from_department || item.seized_department || req.operator.department,
          req.operator.id,
          data.to_department,
          data.to_operator,
          data.transfer_reason
        ]
      );

      const transfer = result.rows[0];

      await OperationLogService.log(
        req,
        'transfer',
        'transfer_record',
        transfer.id,
        { 
          item_status: item.current_status,
          from_department: item.seized_department
        },
        { 
          item_status: 'transferred',
          transfer_number: data.transfer_number,
          transfer_quantity: data.transfer_quantity,
          to_department: data.to_department
        },
        `创建移交记录: 移交编号 ${data.transfer_number}, 移交数量 ${data.transfer_quantity}`
      );

      await client.query('COMMIT');

      return transfer;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async confirmTransfer(req, transferId, data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const transferResult = await client.query(
        'SELECT * FROM transfer_records WHERE id = $1',
        [transferId]
      );

      if (transferResult.rows.length === 0) {
        throw new ApiError('移交记录不存在', 404, 'TRANSFER_NOT_FOUND');
      }

      const transfer = transferResult.rows[0];

      if (transfer.transfer_status === 'completed') {
        throw new ApiError('该移交已确认完成，无需重复确认', 400, 'TRANSFER_ALREADY_COMPLETED');
      }

      if (transfer.transfer_status === 'cancelled') {
        throw new ApiError('该移交已取消，无法确认', 400, 'TRANSFER_ALREADY_CANCELLED');
      }

      const itemResult = await client.query(
        'SELECT * FROM seized_items WHERE id = $1 AND is_deleted = FALSE',
        [transfer.seized_item_id]
      );

      const item = itemResult.rows[0];

      await client.query(
        `UPDATE transfer_records 
         SET transfer_status = 'completed', confirmation_time = CURRENT_TIMESTAMP,
             confirmed_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [req.operator.id, transferId]
      );

      await client.query(
        `UPDATE seized_items 
         SET current_status = 'transferred', last_updated_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [req.operator.id, transfer.seized_item_id]
      );

      await OperationLogService.log(
        req,
        'transfer_confirm',
        'transfer_record',
        transferId,
        { transfer_status: transfer.transfer_status },
        { transfer_status: 'completed' },
        `确认移交: 移交编号 ${transfer.transfer_number}`
      );

      await client.query('COMMIT');

      return { success: true, message: '移交确认成功' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async cancelTransfer(req, transferId, data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const transferResult = await client.query(
        'SELECT * FROM transfer_records WHERE id = $1',
        [transferId]
      );

      if (transferResult.rows.length === 0) {
        throw new ApiError('移交记录不存在', 404, 'TRANSFER_NOT_FOUND');
      }

      const transfer = transferResult.rows[0];

      if (transfer.transfer_status === 'completed') {
        throw new ApiError('已完成的移交无法取消', 400, 'TRANSFER_ALREADY_COMPLETED');
      }

      if (!data || !data.cancel_reason) {
        throw new ApiError('请提供取消原因', 400, 'MISSING_CANCEL_REASON');
      }

      await client.query(
        `UPDATE transfer_records 
         SET transfer_status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [transferId]
      );

      await OperationLogService.log(
        req,
        'transfer_cancel',
        'transfer_record',
        transferId,
        { transfer_status: transfer.transfer_status },
        { transfer_status: 'cancelled', cancel_reason: data.cancel_reason },
        `取消移交: 移交编号 ${transfer.transfer_number}, 原因: ${data.cancel_reason}`
      );

      await client.query('COMMIT');

      return { success: true, message: '移交取消成功' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async retryFailedTransfer(req, transferId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const transferResult = await client.query(
        'SELECT * FROM transfer_records WHERE id = $1',
        [transferId]
      );

      if (transferResult.rows.length === 0) {
        throw new ApiError('移交记录不存在', 404, 'TRANSFER_NOT_FOUND');
      }

      const transfer = transferResult.rows[0];

      if (transfer.transfer_status !== 'failed') {
        throw new ApiError('只有失败的移交才能重试', 400, 'ONLY_FAILED_CAN_RETRY');
      }

      await client.query(
        `UPDATE transfer_records 
         SET transfer_status = 'in_progress', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [transferId]
      );

      await OperationLogService.log(
        req,
        'transfer_retry',
        'transfer_record',
        transferId,
        { transfer_status: 'failed' },
        { transfer_status: 'in_progress' },
        `重试移交: 移交编号 ${transfer.transfer_number}`
      );

      await client.query('COMMIT');

      return { success: true, message: '移交重试成功，请继续完成移交确认' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getById(transferId) {
    const result = await pool.query(
      `SELECT tr.*,
              si.case_number, si.item_name, si.quantity as total_quantity,
              o1.real_name as from_operator_name,
              o2.real_name as to_operator_name,
              o3.real_name as confirmed_by_name
       FROM transfer_records tr
       JOIN seized_items si ON tr.seized_item_id = si.id
       LEFT JOIN operators o1 ON tr.from_operator = o1.id
       LEFT JOIN operators o2 ON tr.to_operator = o2.id
       LEFT JOIN operators o3 ON tr.confirmed_by = o3.id
       WHERE tr.id = $1`,
      [transferId]
    );

    if (result.rows.length === 0) {
      throw new ApiError('移交记录不存在', 404, 'TRANSFER_NOT_FOUND');
    }

    return result.rows[0];
  }

  static async getByItemId(seizedItemId) {
    const result = await pool.query(
      `SELECT tr.*,
              o1.real_name as from_operator_name,
              o2.real_name as to_operator_name,
              o3.real_name as confirmed_by_name
       FROM transfer_records tr
       LEFT JOIN operators o1 ON tr.from_operator = o1.id
       LEFT JOIN operators o2 ON tr.to_operator = o2.id
       LEFT JOIN operators o3 ON tr.confirmed_by = o3.id
       WHERE tr.seized_item_id = $1
       ORDER BY tr.transfer_date DESC`,
      [seizedItemId]
    );

    return result.rows;
  }

  static async list(filters = {}, page = 1, pageSize = 20) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.transfer_number) {
      conditions.push(`tr.transfer_number ILIKE $${paramIndex}`);
      params.push(`%${filters.transfer_number}%`);
      paramIndex++;
    }

    if (filters.transfer_status) {
      conditions.push(`tr.transfer_status = $${paramIndex}`);
      params.push(filters.transfer_status);
      paramIndex++;
    }

    if (filters.seized_item_id) {
      conditions.push(`tr.seized_item_id = $${paramIndex}`);
      params.push(filters.seized_item_id);
      paramIndex++;
    }

    if (filters.from_department) {
      conditions.push(`tr.from_department ILIKE $${paramIndex}`);
      params.push(`%${filters.from_department}%`);
      paramIndex++;
    }

    if (filters.to_department) {
      conditions.push(`tr.to_department ILIKE $${paramIndex}`);
      params.push(`%${filters.to_department}%`);
      paramIndex++;
    }

    if (filters.start_date) {
      conditions.push(`tr.transfer_date >= $${paramIndex}`);
      params.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      conditions.push(`tr.transfer_date <= $${paramIndex}`);
      params.push(filters.end_date);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM transfer_records tr ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * pageSize;
    const transfersResult = await pool.query(
      `SELECT tr.id, tr.transfer_number, tr.transfer_date, tr.transfer_quantity,
              tr.transfer_status, tr.from_department, tr.to_department,
              si.case_number, si.item_name,
              o1.real_name as from_operator_name,
              o2.real_name as to_operator_name,
              tr.created_at
       FROM transfer_records tr
       JOIN seized_items si ON tr.seized_item_id = si.id
       LEFT JOIN operators o1 ON tr.from_operator = o1.id
       LEFT JOIN operators o2 ON tr.to_operator = o2.id
       ${whereClause}
       ORDER BY tr.transfer_date DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    return {
      transfers: transfersResult.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }
}

module.exports = TransferService;
