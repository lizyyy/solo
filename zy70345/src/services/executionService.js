const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const prepareDeletionPlan = (requestId) => {
  const deletableItems = db.prepare(`
    SELECT sr.* FROM scan_results sr
    WHERE sr.request_id = ? AND sr.can_delete = 1
  `).all(requestId);

  const retainedItems = db.prepare(`
    SELECT sr.* FROM scan_results sr
    WHERE sr.request_id = ? AND sr.can_delete = 0
  `).all(requestId);

  const executionPlans = [];

  deletableItems.forEach(item => {
    executionPlans.push({
      scan_result_id: item.id,
      data_type: item.data_type,
      record_id: item.record_id,
      action: 'physical_delete'
    });
  });

  retainedItems.forEach(item => {
    executionPlans.push({
      scan_result_id: item.id,
      data_type: item.data_type,
      record_id: item.record_id,
      action: 'retain_with_anonymization'
    });
  });

  return executionPlans;
};

const createExecutionRecords = (requestId, plans) => {
  const insertExecution = db.prepare(`
    INSERT INTO deletion_executions (
      id, request_id, scan_result_id, data_type, record_id, action, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((items) => {
    for (const item of items) {
      insertExecution.run(
        uuidv4(),
        requestId,
        item.scan_result_id,
        item.data_type,
        item.record_id,
        item.action,
        'pending'
      );
    }
  });

  transaction(plans);

  return db.prepare(`SELECT COUNT(*) as count FROM deletion_executions WHERE request_id = ?`).get(requestId);
};

const executePhysicalDelete = (dataType, recordId) => {
  try {
    switch (dataType) {
      case 'user_profile':
        db.prepare(`DELETE FROM mock_user_profiles WHERE id = ?`).run(recordId);
        break;
      case 'order':
        db.prepare(`DELETE FROM mock_orders WHERE id = ?`).run(recordId);
        break;
      case 'ticket':
        db.prepare(`DELETE FROM mock_support_tickets WHERE id = ?`).run(recordId);
        break;
      case 'marketing':
        db.prepare(`DELETE FROM mock_marketing_records WHERE id = ?`).run(recordId);
        break;
      case 'log':
        db.prepare(`DELETE FROM mock_log_indexes WHERE id = ?`).run(recordId);
        break;
      default:
        break;
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const executeAnonymization = (dataType, recordId) => {
  try {
    switch (dataType) {
      case 'user_profile':
        db.prepare(`
          UPDATE mock_user_profiles 
          SET name = '已删除', email = 'deleted@example.com', phone = NULL, address = NULL
          WHERE id = ?
        `).run(recordId);
        break;
      case 'order':
        db.prepare(`
          UPDATE mock_orders 
          SET order_number = 'MASKED-' || SUBSTR(order_number, 1, 5)
          WHERE id = ?
        `).run(recordId);
        break;
      case 'ticket':
        db.prepare(`
          UPDATE mock_support_tickets 
          SET subject = '已脱敏'
          WHERE id = ?
        `).run(recordId);
        break;
      case 'log':
        db.prepare(`
          UPDATE mock_log_indexes 
          SET log_content = '[已脱敏，保留用于合规审计]'
          WHERE id = ?
        `).run(recordId);
        break;
      default:
        break;
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const executeAll = (requestId) => {
  const executions = db.prepare(`
    SELECT * FROM deletion_executions WHERE request_id = ?
  `).all(requestId);

  const results = [];
  let allSuccess = true;

  for (const execution of executions) {
    let result;
    
    if (execution.action === 'physical_delete') {
      result = executePhysicalDelete(execution.data_type, execution.record_id);
    } else if (execution.action === 'retain_with_anonymization') {
      result = executeAnonymization(execution.data_type, execution.record_id);
    }

    if (!result.success) {
      allSuccess = false;
    }

    const updateStmt = db.prepare(`
      UPDATE deletion_executions 
      SET status = ?, executed_at = ?, error_message = ?
      WHERE id = ?
    `);

    updateStmt.run(
      result.success ? 'completed' : 'failed',
      moment().toISOString(),
      result.error || null,
      execution.id
    );

    results.push({
      id: execution.id,
      data_type: execution.data_type,
      action: execution.action,
      status: result.success ? 'completed' : 'failed',
      error: result.error
    });
  }

  return {
    allSuccess,
    results
  };
};

const getExecutionResults = (requestId) => {
  return db.prepare(`
    SELECT de.*, sr.record_summary, sr.retention_reason, sr.retention_category
    FROM deletion_executions de
    LEFT JOIN scan_results sr ON de.scan_result_id = sr.id
    WHERE de.request_id = ?
  `).all(requestId);
};

const getFailedExecutions = (requestId) => {
  return db.prepare(`
    SELECT * FROM deletion_executions 
    WHERE request_id = ? AND status = 'failed'
  `).all(requestId);
};

const retryFailedExecutions = (requestId) => {
  const failedExecutions = getFailedExecutions(requestId);
  const results = [];
  let allSuccess = true;

  for (const execution of failedExecutions) {
    let result;
    
    if (execution.action === 'physical_delete') {
      result = executePhysicalDelete(execution.data_type, execution.record_id);
    } else if (execution.action === 'retain_with_anonymization') {
      result = executeAnonymization(execution.data_type, execution.record_id);
    }

    if (!result.success) {
      allSuccess = false;
    }

    const updateStmt = db.prepare(`
      UPDATE deletion_executions 
      SET status = ?, executed_at = ?, error_message = ?
      WHERE id = ?
    `);

    updateStmt.run(
      result.success ? 'completed' : 'failed',
      moment().toISOString(),
      result.error || null,
      execution.id
    );

    results.push({
      id: execution.id,
      data_type: execution.data_type,
      action: execution.action,
      status: result.success ? 'completed' : 'failed',
      error: result.error
    });
  }

  return {
    allSuccess,
    retryCount: failedExecutions.length,
    results
  };
};

module.exports = {
  prepareDeletionPlan,
  createExecutionRecords,
  executeAll,
  getExecutionResults,
  getFailedExecutions,
  retryFailedExecutions
};
