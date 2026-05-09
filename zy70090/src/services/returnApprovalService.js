const pool = require('../database/pool');
const { ApiError } = require('../utils/response');
const OperationLogService = require('./operationLogService');

class ReturnApprovalService {
  static async applyForReturn(req, seizedItemId, data) {
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

      if (item.current_status === 'returned') {
        throw new ApiError('该物品已退还', 400, 'ITEM_ALREADY_RETURNED');
      }

      if (item.current_status === 'returned_pending') {
        throw new ApiError('该物品已有退还申请待审批', 400, 'PENDING_APPROVAL_EXISTS');
      }

      if (!['seized', 'sealed', 'transferred'].includes(item.current_status)) {
        throw new ApiError(`当前状态(${item.current_status})不允许申请退还`, 400, 'INVALID_STATUS_FOR_RETURN');
      }

      const requiredFields = ['approval_number', 'return_quantity', 'return_reason', 'recipient_name'];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        throw new ApiError(`缺少必要字段: ${missingFields.join(', ')}`, 400, 'MISSING_REQUIRED_FIELDS');
      }

      if (data.return_quantity > item.quantity) {
        throw new ApiError(`退还数量(${data.return_quantity})不能超过物品总数(${item.quantity})`, 400, 'RETURN_QUANTITY_EXCEEDS');
      }

      const existingApproval = await client.query(
        'SELECT id FROM return_approvals WHERE approval_number = $1',
        [data.approval_number]
      );

      if (existingApproval.rows.length > 0) {
        throw new ApiError('审批编号已存在', 409, 'APPROVAL_NUMBER_EXISTS');
      }

      if (item.current_status === 'sealed') {
        const activeSeal = await client.query(
          `SELECT id, seal_number FROM seal_records 
           WHERE seized_item_id = $1 AND seal_status = 'sealed'`,
          [seizedItemId]
        );

        if (activeSeal.rows.length > 0) {
          throw new ApiError(
            `物品当前处于封存状态(封条编号: ${activeSeal.rows[0].seal_number})，请先解封后再申请退还`,
            400,
            'ITEM_SEALED'
          );
        }
      }

      if (data.photo_required && data.photo_required > 0) {
        const photoCount = await client.query(
          `SELECT COUNT(*) as count FROM item_photos 
           WHERE seized_item_id = $1 AND photo_type = 'returned' AND is_verified = TRUE`,
          [seizedItemId]
        );

        if (parseInt(photoCount.rows[0].count) < data.photo_required) {
          throw new ApiError(
            `退还照片校验未通过：需要 ${data.photo_required} 张照片，实际只有 ${photoCount.rows[0].count} 张已校验照片`,
            400,
            'PHOTO_VERIFICATION_FAILED'
          );
        }
      }

      const result = await client.query(
        `INSERT INTO return_approvals 
         (seized_item_id, approval_number, applicant, return_quantity,
          return_reason, recipient_name, recipient_id_card, recipient_phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          seizedItemId,
          data.approval_number,
          req.operator.id,
          data.return_quantity,
          data.return_reason,
          data.recipient_name,
          data.recipient_id_card,
          data.recipient_phone
        ]
      );

      const approval = result.rows[0];

      await client.query(
        `UPDATE seized_items 
         SET current_status = 'returned_pending', last_updated_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [req.operator.id, seizedItemId]
      );

      await OperationLogService.log(
        req,
        'return_apply',
        'return_approval',
        approval.id,
        { item_status: item.current_status },
        { 
          item_status: 'returned_pending',
          approval_number: data.approval_number,
          return_quantity: data.return_quantity
        },
        `申请退还: 审批编号 ${data.approval_number}, 退还数量 ${data.return_quantity}`
      );

      await client.query('COMMIT');

      return approval;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async approveReturn(req, approvalId, data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const approvalResult = await client.query(
        'SELECT * FROM return_approvals WHERE id = $1',
        [approvalId]
      );

      if (approvalResult.rows.length === 0) {
        throw new ApiError('审批记录不存在', 404, 'APPROVAL_NOT_FOUND');
      }

      const approval = approvalResult.rows[0];

      if (approval.approval_status !== 'pending') {
        throw new ApiError(`当前审批状态(${approval.approval_status})不允许审批`, 400, 'INVALID_STATUS_FOR_APPROVE');
      }

      const itemResult = await client.query(
        'SELECT * FROM seized_items WHERE id = $1 AND is_deleted = FALSE',
        [approval.seized_item_id]
      );

      const item = itemResult.rows[0];

      await client.query(
        `UPDATE return_approvals 
         SET approval_status = 'approved', approver = $1, approval_time = CURRENT_TIMESTAMP,
             approval_notes = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [req.operator.id, data?.approval_notes || null, approvalId]
      );

      await OperationLogService.log(
        req,
        'return_approve',
        'return_approval',
        approvalId,
        { approval_status: 'pending' },
        { approval_status: 'approved' },
        `批准退还: 审批编号 ${approval.approval_number}`
      );

      await client.query('COMMIT');

      return { success: true, message: '审批通过' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async rejectReturn(req, approvalId, data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const approvalResult = await client.query(
        'SELECT * FROM return_approvals WHERE id = $1',
        [approvalId]
      );

      if (approvalResult.rows.length === 0) {
        throw new ApiError('审批记录不存在', 404, 'APPROVAL_NOT_FOUND');
      }

      const approval = approvalResult.rows[0];

      if (approval.approval_status !== 'pending') {
        throw new ApiError(`当前审批状态(${approval.approval_status})不允许拒绝`, 400, 'INVALID_STATUS_FOR_REJECT');
      }

      if (!data || !data.rejection_reason) {
        throw new ApiError('请提供拒绝原因', 400, 'MISSING_REJECTION_REASON');
      }

      await client.query(
        `UPDATE return_approvals 
         SET approval_status = 'rejected', approver = $1, approval_time = CURRENT_TIMESTAMP,
             rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [req.operator.id, data.rejection_reason, approvalId]
      );

      await client.query(
        `UPDATE seized_items 
         SET current_status = 'seized', last_updated_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [req.operator.id, approval.seized_item_id]
      );

      await OperationLogService.log(
        req,
        'return_reject',
        'return_approval',
        approvalId,
        { approval_status: 'pending' },
        { approval_status: 'rejected', rejection_reason: data.rejection_reason },
        `拒绝退还: 审批编号 ${approval.approval_number}, 原因: ${data.rejection_reason}`
      );

      await client.query('COMMIT');

      return { success: true, message: '已拒绝退还申请' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async executeReturn(req, approvalId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const approvalResult = await client.query(
        'SELECT * FROM return_approvals WHERE id = $1',
        [approvalId]
      );

      if (approvalResult.rows.length === 0) {
        throw new ApiError('审批记录不存在', 404, 'APPROVAL_NOT_FOUND');
      }

      const approval = approvalResult.rows[0];

      if (approval.approval_status === 'returned') {
        throw new ApiError('该物品已完成退还', 400, 'ITEM_ALREADY_RETURNED');
      }

      if (approval.approval_status !== 'approved') {
        throw new ApiError(`当前审批状态(${approval.approval_status})不允许执行退还`, 400, 'INVALID_STATUS_FOR_EXECUTE');
      }

      const itemResult = await client.query(
        'SELECT * FROM seized_items WHERE id = $1 AND is_deleted = FALSE',
        [approval.seized_item_id]
      );

      const item = itemResult.rows[0];

      const remainingQuantity = item.quantity - approval.return_quantity;

      await client.query(
        `UPDATE return_approvals 
         SET approval_status = 'returned', actual_return_time = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [approvalId]
      );

      if (remainingQuantity <= 0) {
        await client.query(
          `UPDATE seized_items 
           SET current_status = 'returned', last_updated_by = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [req.operator.id, approval.seized_item_id]
        );
      } else {
        await client.query(
          `UPDATE seized_items 
           SET quantity = $1, last_updated_by = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [remainingQuantity, req.operator.id, approval.seized_item_id]
        );
      }

      await OperationLogService.log(
        req,
        'return_execute',
        'return_approval',
        approvalId,
        { 
          approval_status: 'approved',
          item_quantity: item.quantity
        },
        { 
          approval_status: 'returned',
          item_quantity: Math.max(0, item.quantity - approval.return_quantity)
        },
        `执行退还: 审批编号 ${approval.approval_number}, 退还数量 ${approval.return_quantity}, 剩余数量 ${Math.max(0, item.quantity - approval.return_quantity)}`
      );

      await client.query('COMMIT');

      return { 
        success: true, 
        message: '退还成功',
        remaining_quantity: remainingQuantity
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getById(approvalId) {
    const result = await pool.query(
      `SELECT ra.*,
              si.case_number, si.item_name, si.quantity as total_quantity, si.current_status as item_status,
              o1.real_name as applicant_name,
              o2.real_name as approver_name
       FROM return_approvals ra
       JOIN seized_items si ON ra.seized_item_id = si.id
       LEFT JOIN operators o1 ON ra.applicant = o1.id
       LEFT JOIN operators o2 ON ra.approver = o2.id
       WHERE ra.id = $1`,
      [approvalId]
    );

    if (result.rows.length === 0) {
      throw new ApiError('审批记录不存在', 404, 'APPROVAL_NOT_FOUND');
    }

    return result.rows[0];
  }

  static async getByItemId(seizedItemId) {
    const result = await pool.query(
      `SELECT ra.*,
              o1.real_name as applicant_name,
              o2.real_name as approver_name
       FROM return_approvals ra
       LEFT JOIN operators o1 ON ra.applicant = o1.id
       LEFT JOIN operators o2 ON ra.approver = o2.id
       WHERE ra.seized_item_id = $1
       ORDER BY ra.application_date DESC`,
      [seizedItemId]
    );

    return result.rows;
  }

  static async list(filters = {}, page = 1, pageSize = 20) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.approval_number) {
      conditions.push(`ra.approval_number ILIKE $${paramIndex}`);
      params.push(`%${filters.approval_number}%`);
      paramIndex++;
    }

    if (filters.approval_status) {
      conditions.push(`ra.approval_status = $${paramIndex}`);
      params.push(filters.approval_status);
      paramIndex++;
    }

    if (filters.seized_item_id) {
      conditions.push(`ra.seized_item_id = $${paramIndex}`);
      params.push(filters.seized_item_id);
      paramIndex++;
    }

    if (filters.applicant) {
      conditions.push(`ra.applicant = $${paramIndex}`);
      params.push(filters.applicant);
      paramIndex++;
    }

    if (filters.start_date) {
      conditions.push(`ra.application_date >= $${paramIndex}`);
      params.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      conditions.push(`ra.application_date <= $${paramIndex}`);
      params.push(filters.end_date);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM return_approvals ra ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * pageSize;
    const approvalsResult = await pool.query(
      `SELECT ra.id, ra.approval_number, ra.application_date, ra.return_quantity,
              ra.approval_status, ra.recipient_name,
              si.case_number, si.item_name,
              o1.real_name as applicant_name,
              o2.real_name as approver_name,
              ra.created_at
       FROM return_approvals ra
       JOIN seized_items si ON ra.seized_item_id = si.id
       LEFT JOIN operators o1 ON ra.applicant = o1.id
       LEFT JOIN operators o2 ON ra.approver = o2.id
       ${whereClause}
       ORDER BY ra.application_date DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    return {
      approvals: approvalsResult.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }
}

module.exports = ReturnApprovalService;
