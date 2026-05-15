const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../config/database');
const { successResponse, errorResponse, batchOperationResponse } = require('../utils/response');

async function getMembers(req, res) {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    
    let sql = 'SELECT * FROM members WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM members WHERE 1=1';
    const params = [];
    const countParams = [];
    
    if (status) {
      sql += ' AND status = ?';
      countSql += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    
    const [members, countResult] = await Promise.all([
      allQuery(sql, params),
      getQuery(countSql, countParams)
    ]);
    
    res.json(successResponse({
      list: members,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult.total
      }
    }));
  } catch (error) {
    res.status(500).json(errorResponse('获取会员列表失败', error.message));
  }
}

async function getRenewalTransactions(req, res) {
  try {
    const { member_id, status, has_boundary_input, review_required, page = 1, pageSize = 50 } = req.query;
    
    let sql = `
      SELECT 
        rt.*,
        m.name as member_name,
        m.phone as member_phone
      FROM renewal_transactions rt
      LEFT JOIN members m ON rt.member_id = m.id
      WHERE 1=1
    `;
    const params = [];
    
    if (member_id) {
      sql += ' AND rt.member_id = ?';
      params.push(member_id);
    }
    
    if (status) {
      sql += ' AND rt.status = ?';
      params.push(status);
    }
    
    if (has_boundary_input === 'true') {
      sql += ' AND rt.boundary_input IS NOT NULL';
    }
    
    if (review_required === 'true') {
      sql += " AND rt.processed_result LIKE '%reviewRequired%true%'";
    }
    
    sql += ' ORDER BY rt.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    
    const transactions = await allQuery(sql, params);
    
    const parsedTransactions = transactions.map(t => ({
      ...t,
      boundary_input: t.boundary_input ? JSON.parse(t.boundary_input) : null,
      processed_result: t.processed_result ? JSON.parse(t.processed_result) : null
    }));
    
    res.json(successResponse({
      list: parsedTransactions,
      pagination: { page: parseInt(page), pageSize: parseInt(pageSize) }
    }));
  } catch (error) {
    res.status(500).json(errorResponse('获取续费流水失败', error.message));
  }
}

async function updateTransactionProcessedResult(req, res) {
  try {
    const { id } = req.params;
    const { processed_result, boundary_input } = req.body;
    
    const transaction = await getQuery('SELECT * FROM renewal_transactions WHERE id = ?', [id]);
    if (!transaction) {
      return res.status(404).json(errorResponse('流水记录不存在'));
    }
    
    const updates = [];
    const params = [];
    
    if (processed_result !== undefined) {
      updates.push('processed_result = ?');
      params.push(typeof processed_result === 'string' ? processed_result : JSON.stringify(processed_result));
    }
    
    if (boundary_input !== undefined) {
      updates.push('boundary_input = ?');
      params.push(typeof boundary_input === 'string' ? boundary_input : JSON.stringify(boundary_input));
    }
    
    if (updates.length > 0) {
      params.push(id);
      await runQuery(
        `UPDATE renewal_transactions SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }
    
    const updated = await getQuery('SELECT * FROM renewal_transactions WHERE id = ?', [id]);
    res.json(successResponse({
      ...updated,
      boundary_input: updated.boundary_input ? JSON.parse(updated.boundary_input) : null,
      processed_result: updated.processed_result ? JSON.parse(updated.processed_result) : null
    }, '处理结果更新成功'));
  } catch (error) {
    res.status(500).json(errorResponse('更新处理结果失败', error.message));
  }
}

async function getRollbackReviewList(req, res) {
  try {
    const transactions = await allQuery(`
      SELECT 
        rt.*,
        m.name as member_name,
        m.phone as member_phone
      FROM renewal_transactions rt
      LEFT JOIN members m ON rt.member_id = m.id
      WHERE rt.status = 'rolled_back'
        AND rt.rollback_evidence IS NULL
      ORDER BY rt.created_at DESC
    `);
    
    const result = transactions.map(t => ({
      ...t,
      boundary_input: t.boundary_input ? JSON.parse(t.boundary_input) : null,
      processed_result: t.processed_result ? JSON.parse(t.processed_result) : null,
      reviewFlag: 'NO_ROLLBACK_EVIDENCE'
    }));
    
    res.json(successResponse(result, '获取回滚复核列表成功（无证据记录）'));
  } catch (error) {
    res.status(500).json(errorResponse('获取回滚复核列表失败', error.message));
  }
}

module.exports = {
  getMembers,
  getRenewalTransactions,
  updateTransactionProcessedResult,
  getRollbackReviewList
};