const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../config/database');
const { 
  successResponse, 
  errorResponse, 
  batchOperationResponse,
  candidateListResponse
} = require('../utils/response');

async function getSystemSettings(req, res) {
  try {
    const settings = await allQuery('SELECT * FROM system_settings');
    const result = settings.reduce((acc, s) => {
      acc[s.key] = { value: s.value, description: s.description };
      return acc;
    }, {});
    res.json(successResponse(result));
  } catch (error) {
    res.status(500).json(errorResponse('获取系统设置失败', error.message));
  }
}

async function updateSystemSetting(req, res) {
  try {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json(errorResponse('参数key不能为空'));
    }
    
    await runQuery(
      'UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
      [value, key]
    );
    
    const updated = await getQuery('SELECT * FROM system_settings WHERE key = ?', [key]);
    res.json(successResponse(updated, '设置更新成功'));
  } catch (error) {
    res.status(500).json(errorResponse('更新系统设置失败', error.message));
  }
}

async function getBatchDisableCandidates(req, res) {
  try {
    const { status = 'inactive', days_expired = 30 } = req.query;
    
    const candidates = await allQuery(`
      SELECT 
        m.id,
        m.name,
        m.phone,
        m.membership_type,
        m.expire_date,
        m.status,
        julianday('now') - julianday(m.expire_date) as days_expired
      FROM members m
      WHERE m.status = ? 
        AND julianday('now') - julianday(m.expire_date) >= ?
      ORDER BY m.expire_date ASC
    `, [status, parseInt(days_expired)]);
    
    const metadata = {
      filter: { status, days_expired: parseInt(days_expired) },
      estimatedImpact: candidates.length,
      operationType: 'batch_disable',
      requiresConfirmation: true
    };
    
    res.json(candidateListResponse(candidates, metadata));
  } catch (error) {
    res.status(500).json(errorResponse('生成候选清单失败', error.message));
  }
}

async function executeBatchDisable(req, res) {
  try {
    const { member_ids, confirmed = false, operator_id, operator_name } = req.body;
    
    if (!confirmed) {
      return res.status(400).json(errorResponse('请确认后再执行批量禁用操作'));
    }
    
    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return res.status(400).json(errorResponse('请选择要禁用的会员'));
    }
    
    const switchStatus = await getQuery(
      "SELECT value FROM system_settings WHERE key = 'batch_disable_switch'"
    );
    
    if (switchStatus?.value !== 'true') {
      return res.status(403).json(errorResponse('批量禁用开关未开启'));
    }
    
    const details = [];
    let successCount = 0;
    let failedCount = 0;
    
    for (const memberId of member_ids) {
      try {
        const member = await getQuery('SELECT * FROM members WHERE id = ?', [memberId]);
        
        if (!member) {
          details.push({
            id: memberId,
            success: false,
            error: '会员不存在'
          });
          failedCount++;
          continue;
        }
        
        await runQuery(
          "UPDATE members SET status = 'disabled', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [memberId]
        );
        
        details.push({
          id: memberId,
          name: member.name,
          phone: member.phone,
          success: true,
          previousStatus: member.status,
          newStatus: 'disabled'
        });
        successCount++;
      } catch (err) {
        details.push({
          id: memberId,
          success: false,
          error: err.message
        });
        failedCount++;
      }
    }
    
    const batchOperation = {
      id: uuidv4(),
      operation_name: '批量禁用会员',
      operation_type: 'batch_disable',
      total_count: member_ids.length,
      success_count: successCount,
      failed_count: failedCount,
      item_details: JSON.stringify(details),
      candidate_list: JSON.stringify(member_ids),
      status: successCount > 0 ? 'completed' : 'failed',
      operator_id,
      operator_name
    };
    
    await runQuery(
      `INSERT INTO batch_operations 
       (id, operation_name, operation_type, total_count, success_count, 
        failed_count, item_details, candidate_list, status, operator_id, operator_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [batchOperation.id, batchOperation.operation_name, batchOperation.operation_type,
       batchOperation.total_count, batchOperation.success_count, batchOperation.failed_count,
       batchOperation.item_details, batchOperation.candidate_list, batchOperation.status,
       batchOperation.operator_id, batchOperation.operator_name]
    );
    
    const summary = {
      total: member_ids.length,
      success: successCount,
      failed: failedCount,
      batchId: batchOperation.id
    };
    
    res.json(batchOperationResponse(summary, details, 
      successCount === member_ids.length ? '全部禁用成功' : 
      successCount > 0 ? '部分禁用成功' : '全部禁用失败'
    ));
    
  } catch (error) {
    res.status(500).json(errorResponse('批量禁用操作失败', error.message));
  }
}

module.exports = {
  getSystemSettings,
  updateSystemSetting,
  getBatchDisableCandidates,
  executeBatchDisable
};