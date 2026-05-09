const pool = require('../database/pool');
const { ApiError } = require('../utils/response');
const OperationLogService = require('./operationLogService');

class SealService {
  static async createSeal(req, seizedItemId, data) {
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

      if (!['seized', 'unsealed'].includes(item.current_status)) {
        throw new ApiError(`当前状态(${item.current_status})不允许封存`, 400, 'INVALID_STATUS_FOR_SEAL');
      }

      const requiredFields = ['seal_number', 'seal_date', 'seal_quantity'];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        throw new ApiError(`缺少必要字段: ${missingFields.join(', ')}`, 400, 'MISSING_REQUIRED_FIELDS');
      }

      if (data.seal_quantity > item.quantity) {
        throw new ApiError(`封存数量(${data.seal_quantity})不能超过物品总数(${item.quantity})`, 400, 'SEAL_QUANTITY_EXCEEDS');
      }

      const existingSeal = await client.query(
        'SELECT id FROM seal_records WHERE seal_number = $1',
        [data.seal_number]
      );

      if (existingSeal.rows.length > 0) {
        throw new ApiError('封条编号已存在', 409, 'SEAL_NUMBER_EXISTS');
      }

      if (data.photo_required && data.photo_required > 0) {
        const photoCount = await client.query(
          `SELECT COUNT(*) as count FROM item_photos 
           WHERE seized_item_id = $1 AND photo_type = 'sealed' AND is_verified = TRUE`,
          [seizedItemId]
        );

        if (parseInt(photoCount.rows[0].count) < data.photo_required) {
          throw new ApiError(
            `封存照片校验未通过：需要 ${data.photo_required} 张照片，实际只有 ${photoCount.rows[0].count} 张已校验照片`,
            400,
            'PHOTO_VERIFICATION_FAILED'
          );
        }
      }

      const result = await client.query(
        `INSERT INTO seal_records 
         (seized_item_id, seal_number, seal_date, seal_location, sealed_by, 
          sealed_department, seal_quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          seizedItemId,
          data.seal_number,
          data.seal_date,
          data.seal_location,
          req.operator.id,
          data.sealed_department || req.operator.department,
          data.seal_quantity
        ]
      );

      const seal = result.rows[0];

      await client.query(
        `UPDATE seized_items 
         SET current_status = 'sealed', last_updated_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [req.operator.id, seizedItemId]
      );

      await OperationLogService.log(
        req,
        'seal',
        'seal_record',
        seal.id,
        { item_status: item.current_status },
        { item_status: 'sealed', seal_number: data.seal_number, seal_quantity: data.seal_quantity },
        `封存物品: 封条编号 ${data.seal_number}, 封存数量 ${data.seal_quantity}`
      );

      await client.query('COMMIT');

      return seal;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async unseal(req, sealId, data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const sealResult = await client.query(
        'SELECT * FROM seal_records WHERE id = $1',
        [sealId]
      );

      if (sealResult.rows.length === 0) {
        throw new ApiError('封存记录不存在', 404, 'SEAL_NOT_FOUND');
      }

      const seal = sealResult.rows[0];

      if (seal.seal_status !== 'sealed') {
        throw new ApiError(`当前封存状态(${seal.seal_status})不允许解封`, 400, 'INVALID_STATUS_FOR_UNSEAL');
      }

      const itemResult = await client.query(
        'SELECT * FROM seized_items WHERE id = $1 AND is_deleted = FALSE',
        [seal.seized_item_id]
      );

      const item = itemResult.rows[0];

      if (!data || !data.unseal_reason) {
        throw new ApiError('请提供解封原因', 400, 'MISSING_UNSEAL_REASON');
      }

      await client.query(
        `UPDATE seal_records 
         SET seal_status = 'unsealed', unseal_date = CURRENT_TIMESTAMP, 
             unsealed_by = $1, unseal_reason = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [req.operator.id, data.unseal_reason, sealId]
      );

      await client.query(
        `UPDATE seized_items 
         SET current_status = 'seized', last_updated_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [req.operator.id, seal.seized_item_id]
      );

      await OperationLogService.log(
        req,
        'unseal',
        'seal_record',
        sealId,
        { seal_status: 'sealed' },
        { seal_status: 'unsealed', unseal_reason: data.unseal_reason },
        `解封物品: 封条编号 ${seal.seal_number}, 解封原因: ${data.unseal_reason}`
      );

      await client.query('COMMIT');

      return { success: true, message: '解封成功' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getByItemId(seizedItemId) {
    const result = await pool.query(
      `SELECT sr.*,
              o1.real_name as sealed_by_name,
              o2.real_name as unsealed_by_name
       FROM seal_records sr
       LEFT JOIN operators o1 ON sr.sealed_by = o1.id
       LEFT JOIN operators o2 ON sr.unsealed_by = o2.id
       WHERE sr.seized_item_id = $1
       ORDER BY sr.seal_date DESC`,
      [seizedItemId]
    );

    return result.rows;
  }

  static async getById(sealId) {
    const result = await pool.query(
      `SELECT sr.*,
              si.case_number,
              si.item_name,
              si.quantity as total_quantity,
              o1.real_name as sealed_by_name,
              o2.real_name as unsealed_by_name
       FROM seal_records sr
       JOIN seized_items si ON sr.seized_item_id = si.id
       LEFT JOIN operators o1 ON sr.sealed_by = o1.id
       LEFT JOIN operators o2 ON sr.unsealed_by = o2.id
       WHERE sr.id = $1`,
      [sealId]
    );

    if (result.rows.length === 0) {
      throw new ApiError('封存记录不存在', 404, 'SEAL_NOT_FOUND');
    }

    return result.rows[0];
  }

  static async list(filters = {}, page = 1, pageSize = 20) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.seal_number) {
      conditions.push(`sr.seal_number ILIKE $${paramIndex}`);
      params.push(`%${filters.seal_number}%`);
      paramIndex++;
    }

    if (filters.seal_status) {
      conditions.push(`sr.seal_status = $${paramIndex}`);
      params.push(filters.seal_status);
      paramIndex++;
    }

    if (filters.seized_item_id) {
      conditions.push(`sr.seized_item_id = $${paramIndex}`);
      params.push(filters.seized_item_id);
      paramIndex++;
    }

    if (filters.start_date) {
      conditions.push(`sr.seal_date >= $${paramIndex}`);
      params.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      conditions.push(`sr.seal_date <= $${paramIndex}`);
      params.push(filters.end_date);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM seal_records sr ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * pageSize;
    const sealsResult = await pool.query(
      `SELECT sr.id, sr.seal_number, sr.seal_date, sr.seal_quantity, sr.seal_status,
              si.case_number, si.item_name,
              o1.real_name as sealed_by_name,
              sr.created_at
       FROM seal_records sr
       JOIN seized_items si ON sr.seized_item_id = si.id
       LEFT JOIN operators o1 ON sr.sealed_by = o1.id
       ${whereClause}
       ORDER BY sr.seal_date DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    return {
      seals: sealsResult.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }
}

module.exports = SealService;
