const pool = require('../database/pool');
const { ApiError } = require('../utils/response');
const OperationLogService = require('./operationLogService');

class SeizedItemService {
  static async create(req, data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const requiredFields = ['case_number', 'case_name', 'seized_date', 'item_name', 'quantity', 'seized_by'];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        throw new ApiError(`缺少必要字段: ${missingFields.join(', ')}`, 400, 'MISSING_REQUIRED_FIELDS');
      }

      const existingItem = await client.query(
        'SELECT id FROM seized_items WHERE case_number = $1 AND is_deleted = FALSE',
        [data.case_number]
      );

      if (existingItem.rows.length > 0) {
        throw new ApiError('该案件编号已存在', 409, 'CASE_NUMBER_EXISTS');
      }

      const result = await client.query(
        `INSERT INTO seized_items 
         (case_number, case_name, seized_date, item_name, item_description, 
          quantity, unit, estimated_value, seized_location, seized_by, 
          seized_department, item_owner_name, item_owner_id_card, 
          item_owner_phone, item_owner_address, photo_required, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING *`,
        [
          data.case_number, data.case_name, data.seized_date, data.item_name,
          data.item_description, data.quantity, data.unit, data.estimated_value,
          data.seized_location, data.seized_by, data.seized_department,
          data.item_owner_name, data.item_owner_id_card, data.item_owner_phone,
          data.item_owner_address, data.photo_required || 0, req.operator.id
        ]
      );

      const item = result.rows[0];

      await OperationLogService.log(
        req,
        'create',
        'seized_item',
        item.id,
        null,
        { 
          case_number: item.case_number, 
          item_name: item.item_name, 
          quantity: item.quantity 
        },
        '创建扣押清单'
      );

      await client.query('COMMIT');
      
      return item;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async update(req, id, data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        'SELECT * FROM seized_items WHERE id = $1 AND is_deleted = FALSE',
        [id]
      );

      if (existingResult.rows.length === 0) {
        throw new ApiError('扣押清单不存在', 404, 'ITEM_NOT_FOUND');
      }

      const oldItem = existingResult.rows[0];

      if (oldItem.current_status === 'returned') {
        throw new ApiError('已退还的物品不能修改', 400, 'ITEM_ALREADY_RETURNED');
      }

      if (data.quantity !== undefined && oldItem.photo_uploaded > 0) {
        if (data.quantity < oldItem.quantity) {
          throw new ApiError('已上传照片后不能减少数量，如需修改请先删除相关照片', 400, 'QUANTITY_CANNOT_REDUCE');
        }
      }

      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      const updatableFields = [
        'case_name', 'seized_date', 'item_name', 'item_description',
        'quantity', 'unit', 'estimated_value', 'seized_location',
        'seized_by', 'seized_department', 'item_owner_name',
        'item_owner_id_card', 'item_owner_phone', 'item_owner_address',
        'photo_required'
      ];

      for (const field of updatableFields) {
        if (data[field] !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          updateValues.push(data[field]);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        return oldItem;
      }

      updateFields.push(`last_updated_by = $${paramIndex}`);
      updateValues.push(req.operator.id);
      paramIndex++;

      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      updateValues.push(id);

      const result = await client.query(
        `UPDATE seized_items 
         SET ${updateFields.join(', ')} 
         WHERE id = $${paramIndex}
         RETURNING *`,
        updateValues
      );

      const updatedItem = result.rows[0];

      const changes = {};
      for (const field of updatableFields) {
        if (data[field] !== undefined && oldItem[field] !== data[field]) {
          changes[field] = {
            old: oldItem[field],
            new: data[field]
          };
        }
      }

      await OperationLogService.log(
        req,
        'update',
        'seized_item',
        id,
        oldItem,
        updatedItem,
        Object.keys(changes).length > 0 ? `修改字段: ${Object.keys(changes).join(', ')}` : '更新扣押清单'
      );

      await client.query('COMMIT');

      return updatedItem;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async delete(req, id) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        'SELECT * FROM seized_items WHERE id = $1 AND is_deleted = FALSE',
        [id]
      );

      if (existingResult.rows.length === 0) {
        throw new ApiError('扣押清单不存在', 404, 'ITEM_NOT_FOUND');
      }

      const item = existingResult.rows[0];

      if (item.current_status !== 'seized' && item.current_status !== 'returned') {
        throw new ApiError('只有扣押中或已退还的物品可以删除', 400, 'INVALID_STATUS_FOR_DELETE');
      }

      await client.query(
        `UPDATE seized_items 
         SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, last_updated_by = $1
         WHERE id = $2`,
        [req.operator.id, id]
      );

      await OperationLogService.log(
        req,
        'delete',
        'seized_item',
        id,
        item,
        null,
        '删除扣押清单'
      );

      await client.query('COMMIT');

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getById(id) {
    const result = await pool.query(
      `SELECT si.*, 
              o1.real_name as created_by_name,
              o2.real_name as last_updated_by_name
       FROM seized_items si
       LEFT JOIN operators o1 ON si.created_by = o1.id
       LEFT JOIN operators o2 ON si.last_updated_by = o2.id
       WHERE si.id = $1 AND si.is_deleted = FALSE`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new ApiError('扣押清单不存在', 404, 'ITEM_NOT_FOUND');
    }

    return result.rows[0];
  }

  static async list(filters = {}, page = 1, pageSize = 20) {
    const conditions = ['si.is_deleted = FALSE'];
    const params = [];
    let paramIndex = 1;

    if (filters.case_number) {
      conditions.push(`si.case_number ILIKE $${paramIndex}`);
      params.push(`%${filters.case_number}%`);
      paramIndex++;
    }

    if (filters.case_name) {
      conditions.push(`si.case_name ILIKE $${paramIndex}`);
      params.push(`%${filters.case_name}%`);
      paramIndex++;
    }

    if (filters.item_name) {
      conditions.push(`si.item_name ILIKE $${paramIndex}`);
      params.push(`%${filters.item_name}%`);
      paramIndex++;
    }

    if (filters.current_status) {
      conditions.push(`si.current_status = $${paramIndex}`);
      params.push(filters.current_status);
      paramIndex++;
    }

    if (filters.seized_by) {
      conditions.push(`si.seized_by ILIKE $${paramIndex}`);
      params.push(`%${filters.seized_by}%`);
      paramIndex++;
    }

    if (filters.item_owner_name) {
      conditions.push(`si.item_owner_name ILIKE $${paramIndex}`);
      params.push(`%${filters.item_owner_name}%`);
      paramIndex++;
    }

    if (filters.start_date) {
      conditions.push(`si.seized_date >= $${paramIndex}`);
      params.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      conditions.push(`si.seized_date <= $${paramIndex}`);
      params.push(filters.end_date);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM seized_items si ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * pageSize;
    const itemsResult = await pool.query(
      `SELECT si.id, si.case_number, si.case_name, si.seized_date, si.item_name,
              si.quantity, si.unit, si.current_status, si.is_photo_verified,
              si.photo_required, si.photo_uploaded, si.created_at,
              o1.real_name as created_by_name
       FROM seized_items si
       LEFT JOIN operators o1 ON si.created_by = o1.id
       ${whereClause}
       ORDER BY si.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    return {
      items: itemsResult.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  static async getFullDetails(id) {
    const item = await this.getById(id);

    const [photosResult, sealsResult, transfersResult, approvalsResult, historyResult] = await Promise.all([
      pool.query(
        `SELECT ip.*, o.real_name as uploaded_by_name
         FROM item_photos ip
         LEFT JOIN operators o ON ip.uploaded_by = o.id
         WHERE ip.seized_item_id = $1
         ORDER BY ip.upload_time DESC`,
        [id]
      ),
      pool.query(
        `SELECT sr.*, 
                o1.real_name as sealed_by_name,
                o2.real_name as unsealed_by_name
         FROM seal_records sr
         LEFT JOIN operators o1 ON sr.sealed_by = o1.id
         LEFT JOIN operators o2 ON sr.unsealed_by = o2.id
         WHERE sr.seized_item_id = $1
         ORDER BY sr.seal_date DESC`,
        [id]
      ),
      pool.query(
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
        [id]
      ),
      pool.query(
        `SELECT ra.*,
                o1.real_name as applicant_name,
                o2.real_name as approver_name
         FROM return_approvals ra
         LEFT JOIN operators o1 ON ra.applicant = o1.id
         LEFT JOIN operators o2 ON ra.approver = o2.id
         WHERE ra.seized_item_id = $1
         ORDER BY ra.application_date DESC`,
        [id]
      ),
      OperationLogService.getItemHistory('seized_item', id)
    ]);

    return {
      ...item,
      photos: photosResult.rows,
      seal_records: sealsResult.rows,
      transfer_records: transfersResult.rows,
      return_approvals: approvalsResult.rows,
      operation_history: historyResult
    };
  }
}

module.exports = SeizedItemService;
