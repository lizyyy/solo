const db = require('../config/database');
const { promisify } = require('util');

const allAsync = promisify(db.all.bind(db));
const runAsync = promisify(db.run.bind(db));
const getAsync = promisify(db.get.bind(db));

const HIGH_RISK_ACTIONS = ['REFUND', 'ROLLBACK_FAILED'];

const REQUIRED_EVIDENCE_BY_TYPE = {
  'INVENTORY_FAILURE': ['PAYMENT', 'INVENTORY'],
  'LOGISTICS_CANCEL': ['PAYMENT', 'LOGISTICS'],
  'DISCOUNT_EXCEPTION': ['PAYMENT', 'DISCOUNT']
};

function getEvidenceGaps(exception, evidences) {
  const requiredTypes = REQUIRED_EVIDENCE_BY_TYPE[exception.exception_type] || [];
  const existingTypes = evidences.filter(e => e.is_valid).map(e => e.evidence_type);
  
  const missing = requiredTypes.filter(type => !existingTypes.includes(type));
  
  return missing.length > 0 ? missing : null;
}

async function canPerformAction(exceptionId, operatorId, actionType) {
  const exception = await getAsync(
    'SELECT * FROM order_exceptions WHERE id = ?',
    [exceptionId]
  );

  if (!exception) {
    return { allowed: false, reason: '异常记录不存在' };
  }

  if (exception.status === 'RESOLVED') {
    return { allowed: false, reason: '订单已完成仲裁，不可执行新动作' };
  }

  if (exception.locked_by && exception.locked_by !== operatorId) {
    return { allowed: false, reason: '订单已被其他客服锁定' };
  }

  const evidences = await allAsync(
    'SELECT * FROM order_evidence WHERE order_exception_id = ?',
    [exceptionId]
  );

  if (HIGH_RISK_ACTIONS.includes(actionType)) {
    const gaps = getEvidenceGaps(exception, evidences);
    if (gaps && gaps.length > 0) {
      return { 
        allowed: false, 
        reason: `证据缺失，无法执行高风险动作。缺少证据类型：${gaps.join(', ')}` 
      };
    }
  }

  if (actionType === 'REFUND') {
    const refundActions = await allAsync(
      `SELECT * FROM arbitration_actions 
       WHERE order_exception_id = ? AND action_type = 'REFUND' AND status = 'SUCCESS'`,
      [exceptionId]
    );
    
    if (refundActions.length > 0) {
      return { allowed: false, reason: '该订单已执行过退款，不可重复退款' };
    }

    const pendingRefunds = await allAsync(
      `SELECT * FROM arbitration_actions 
       WHERE order_exception_id = ? AND action_type = 'REFUND' AND status = 'PENDING'`,
      [exceptionId]
    );
    
    if (pendingRefunds.length > 0) {
      return { allowed: false, reason: '该订单存在待处理的退款记录' };
    }
  }

  return { allowed: true };
}

async function checkConcurrency(exceptionId, operatorId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      db.get('SELECT * FROM order_exceptions WHERE id = ?', [exceptionId], (err, exception) => {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }

        if (!exception) {
          db.run('ROLLBACK');
          return resolve({ success: false, reason: '异常记录不存在' });
        }

        if (exception.locked_by && exception.locked_by !== operatorId) {
          db.run('ROLLBACK');
          return resolve({ success: false, reason: '订单已被其他客服锁定' });
        }

        const now = new Date().toISOString();
        db.run(
          'UPDATE order_exceptions SET locked_by = ?, locked_at = ?, updated_at = ? WHERE id = ?',
          [operatorId, now, now, exceptionId],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            db.run('COMMIT', (err) => {
              if (err) {
                return reject(err);
              }
              resolve({ success: true });
            });
          }
        );
      });
    });
  });
}

async function addTimelineEvent(orderId, eventType, eventData, operator) {
  const id = require('uuid').v4();
  const now = new Date().toISOString();
  
  return runAsync(
    'INSERT INTO order_timeline (id, order_id, event_type, event_data, operator, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, orderId, eventType, JSON.stringify(eventData), operator, now]
  );
}

module.exports = {
  canPerformAction,
  checkConcurrency,
  getEvidenceGaps,
  addTimelineEvent,
  HIGH_RISK_ACTIONS,
  REQUIRED_EVIDENCE_BY_TYPE
};
