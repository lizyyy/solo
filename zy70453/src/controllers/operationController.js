const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../config/database');
const { successResponse, errorResponse, candidateListResponse, batchOperationResponse } = require('../utils/response');

async function getRollbackCandidates(req, res) {
  try {
    const { days_ago = 7, status = 'completed' } = req.query;
    
    const candidates = await allQuery(`
      SELECT 
        rt.id,
        rt.member_id,
        m.name as member_name,
        m.phone as member_phone,
        rt.amount,
        rt.plan_months,
        rt.payment_method,
        rt.status,
        rt.rollback_evidence,
        rt.created_at,
        julianday('now') - julianday(rt.created_at) as days_ago
      FROM renewal_transactions rt
      LEFT JOIN members m ON rt.member_id = m.id
      WHERE rt.status = ?
        AND julianday('now') - julianday(rt.created_at) <= ?
      ORDER BY rt.created_at DESC
    `, [status, parseInt(days_ago)]);
    
    const metadata = {
      filter: { status, days_ago: parseInt(days_ago) },
      operationType: 'rollback',
      requiresConfirmation: true,
      warning: '回滚操作不可逆，请确认后执行',
      evidenceRequired: true
    };
    
    res.json(candidateListResponse(candidates, metadata));
  } catch (error) {
    res.status(500).json(errorResponse('生成回滚候选清单失败', error.message));
  }
}

async function executeRollback(req, res) {
  try {
    const { transaction_ids, confirmed = false, rollback_evidence, operator_id, operator_name } = req.body;
    
    if (!confirmed) {
      return res.status(400).json(errorResponse('请确认后再执行回滚操作'));
    }
    
    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json(errorResponse('请选择要回滚的记录'));
    }
    
    const details = [];
    let successCount = 0;
    let failedCount = 0;
    
    for (const txId of transaction_ids) {
      try {
        const transaction = await getQuery('SELECT * FROM renewal_transactions WHERE id = ?', [txId]);
        
        if (!transaction) {
          details.push({
            id: txId,
            success: false,
            error: '记录不存在'
          });
          failedCount++;
          continue;
        }
        
        if (transaction.status === 'rolled_back') {
          details.push({
            id: txId,
            success: false,
            error: '记录已回滚'
          });
          failedCount++;
          continue;
        }
        
        const processedResult = {
          reviewRequired: !rollback_evidence,
          rollbackEvidence: rollback_evidence || null,
          rollbackTime: new Date().toISOString(),
          operatorId: operator_id,
          boundaryFlag: !rollback_evidence ? 'ROLLBACK_NO_EVIDENCE' : 'NORMAL'
        };
        
        await runQuery(
          `UPDATE renewal_transactions 
           SET status = 'rolled_back', 
               rollback_evidence = ?,
               processed_result = ?
           WHERE id = ?`,
          [rollback_evidence, JSON.stringify(processedResult), txId]
        );
        
        details.push({
          id: txId,
          member_id: transaction.member_id,
          amount: transaction.amount,
          success: true,
          previousStatus: transaction.status,
          newStatus: 'rolled_back',
          hasEvidence: !!rollback_evidence,
          reviewRequired: !rollback_evidence
        });
        successCount++;
      } catch (err) {
        details.push({
          id: txId,
          success: false,
          error: err.message
        });
        failedCount++;
      }
    }
    
    const batchOperation = {
      id: uuidv4(),
      operation_name: '批量回滚续费记录',
      operation_type: 'batch_rollback',
      total_count: transaction_ids.length,
      success_count: successCount,
      failed_count: failedCount,
      item_details: JSON.stringify(details),
      candidate_list: JSON.stringify(transaction_ids),
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
      total: transaction_ids.length,
      success: successCount,
      failed: failedCount,
      noEvidenceCount: details.filter(d => d.success && !d.hasEvidence).length,
      batchId: batchOperation.id
    };
    
    res.json(batchOperationResponse(summary, details, 
      successCount === transaction_ids.length ? '全部回滚成功' : 
      successCount > 0 ? '部分回滚成功' : '全部回滚失败'
    ));
    
  } catch (error) {
    res.status(500).json(errorResponse('批量回滚操作失败', error.message));
  }
}

async function getCleanupCandidates(req, res) {
  try {
    const { table = 'all', days_old = 180, status } = req.query;
    
    let candidates = [];
    
    if (table === 'all' || table === 'transactions') {
      const txCandidates = await allQuery(`
        SELECT 
          id,
          'renewal_transaction' as record_type,
          member_id,
          amount,
          status,
          created_at
        FROM renewal_transactions
        WHERE julianday('now') - julianday(created_at) >= ?
        ORDER BY created_at ASC
      `, [parseInt(days_old)]);
      candidates = [...candidates, ...txCandidates];
    }
    
    if (table === 'all' || table === 'samples') {
      const sampleCandidates = await allQuery(`
        SELECT 
          id,
          'lab_sample' as record_type,
          member_id,
          sample_type,
          status,
          created_at
        FROM lab_samples
        WHERE julianday('now') - julianday(created_at) >= ?
        ORDER BY created_at ASC
      `, [parseInt(days_old)]);
      candidates = [...candidates, ...sampleCandidates];
    }
    
    const metadata = {
      filter: { table, days_old: parseInt(days_old), status },
      operationType: 'cleanup',
      requiresConfirmation: true,
      warning: '清理操作不可逆，请仔细核对候选清单',
      totalAffected: candidates.length
    };
    
    res.json(candidateListResponse(candidates, metadata));
  } catch (error) {
    res.status(500).json(errorResponse('生成清理候选清单失败', error.message));
  }
}

module.exports = {
  getRollbackCandidates,
  executeRollback,
  getCleanupCandidates
};