const db = require('../db/connection');
const config = require('../config');
const { generateUUID, getTimestamp } = require('../utils/ticketGenerator');
const { updateStatus } = require('../utils/statusManager');
const { getRequestDetail } = require('./requestController');

async function startExecution(req, res) {
  try {
    const { request_id } = req.params;
    const { executor_id, executor_name } = req.body;

    if (!executor_id || !executor_name) {
      return res.status(400).json({ error: 'Missing required fields: executor_id, executor_name' });
    }

    const request = await db.get(
      'SELECT current_status FROM repair_requests WHERE id = ? AND is_deleted = 0',
      [request_id]
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.current_status !== config.status.REVIEW_APPROVED) {
      return res.status(400).json({ 
        error: `Request is not approved. Current status: ${request.current_status}` 
      });
    }

    await updateStatus(
      request_id, 
      config.status.EXECUTING, 
      { id: executor_id, name: executor_name },
      'Starting execution'
    );

    const result = await getRequestDetail(request_id);
    res.json({
      message: 'Execution started',
      request: result
    });
  } catch (error) {
    console.error('Error starting execution:', error);
    res.status(500).json({ error: error.message });
  }
}

async function completeExecution(req, res) {
  try {
    const { request_id } = req.params;
    const { 
      executor_id, 
      executor_name, 
      execution_status, 
      affected_rows, 
      execution_log, 
      error_message,
      rollback_sql
    } = req.body;

    if (!executor_id || !executor_name || !execution_status) {
      return res.status(400).json({ error: 'Missing required fields: executor_id, executor_name, execution_status' });
    }

    if (!['success', 'failed'].includes(execution_status)) {
      return res.status(400).json({ error: 'Invalid execution_status. Must be "success" or "failed"' });
    }

    const request = await db.get(
      'SELECT current_status FROM repair_requests WHERE id = ? AND is_deleted = 0',
      [request_id]
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.current_status !== config.status.EXECUTING) {
      return res.status(400).json({ 
        error: `Execution not in progress. Current status: ${request.current_status}` 
      });
    }

    const executionId = generateUUID();
    const timestamp = getTimestamp();
    const newStatus = execution_status === 'success' 
      ? config.status.EXECUTION_SUCCESS 
      : config.status.EXECUTION_FAILED;

    const queries = [
      {
        sql: `INSERT INTO execution_results 
              (id, request_id, executor_id, executor_name, execution_status, 
               execution_start_at, execution_end_at, affected_rows, execution_log, 
               error_message, created_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          executionId, request_id, executor_id, executor_name, execution_status,
          timestamp, timestamp, affected_rows || null,
          execution_log || null, error_message || null, timestamp
        ]
      }
    ];

    if (execution_status === 'success' && rollback_sql) {
      queries.push({
        sql: `INSERT INTO rollback_scripts 
              (id, request_id, rollback_sql, script_type, generated_at, 
               generated_by, is_approved, created_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          generateUUID(), request_id, rollback_sql, 'auto-generated',
          timestamp, executor_name, 0, timestamp
        ]
      });
    }

    await db.runTransaction(queries);

    await updateStatus(
      request_id, 
      newStatus, 
      { id: executor_id, name: executor_name },
      error_message || `Execution ${execution_status}`
    );

    const result = await getRequestDetail(request_id);
    const executionResult = await db.get('SELECT * FROM execution_results WHERE id = ?', [executionId]);

    res.json({
      message: `Execution ${execution_status}`,
      execution: executionResult,
      request: result
    });
  } catch (error) {
    console.error('Error completing execution:', error);
    res.status(500).json({ error: error.message });
  }
}

async function addRollbackScript(req, res) {
  try {
    const { request_id } = req.params;
    const { 
      rollback_sql, 
      script_type,
      generated_by 
    } = req.body;

    if (!rollback_sql) {
      return res.status(400).json({ error: 'Missing required field: rollback_sql' });
    }

    const scriptId = generateUUID();
    const timestamp = getTimestamp();

    await db.run(
      `INSERT INTO rollback_scripts 
       (id, request_id, rollback_sql, script_type, generated_at, 
        generated_by, is_approved, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scriptId, request_id, rollback_sql, script_type || 'manual',
        timestamp, generated_by || 'system', 0, timestamp
      ]
    );

    const script = await db.get('SELECT * FROM rollback_scripts WHERE id = ?', [scriptId]);
    res.status(201).json(script);
  } catch (error) {
    console.error('Error adding rollback script:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getRollbackScripts(req, res) {
  try {
    const { request_id } = req.params;
    
    const scripts = await db.all(
      `SELECT id, rollback_sql, script_type, generated_at, generated_by, 
              is_approved, executed_at, execution_result, created_at 
       FROM rollback_scripts 
       WHERE request_id = ? 
       ORDER BY created_at DESC`,
      [request_id]
    );

    res.json(scripts);
  } catch (error) {
    console.error('Error getting rollback scripts:', error);
    res.status(500).json({ error: error.message });
  }
}

async function requestRollback(req, res) {
  try {
    const { request_id } = req.params;
    const { operator_id, operator_name } = req.body;

    if (!operator_id || !operator_name) {
      return res.status(400).json({ error: 'Missing operator information' });
    }

    const request = await db.get(
      'SELECT current_status FROM repair_requests WHERE id = ? AND is_deleted = 0',
      [request_id]
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.current_status !== config.status.EXECUTION_SUCCESS) {
      return res.status(400).json({ 
        error: `Cannot request rollback. Current status: ${request.current_status}` 
      });
    }

    const scripts = await db.all(
      'SELECT id FROM rollback_scripts WHERE request_id = ?',
      [request_id]
    );

    if (scripts.length === 0) {
      return res.status(400).json({ error: 'No rollback scripts available' });
    }

    await updateStatus(
      request_id, 
      config.status.ROLLBACK_REQUESTED, 
      { id: operator_id, name: operator_name },
      'Requesting rollback'
    );

    const result = await getRequestDetail(request_id);
    res.json({
      message: 'Rollback requested',
      request: result
    });
  } catch (error) {
    console.error('Error requesting rollback:', error);
    res.status(500).json({ error: error.message });
  }
}

async function executeRollback(req, res) {
  try {
    const { request_id } = req.params;
    const { 
      executor_id, 
      executor_name, 
      execution_status, 
      execution_log,
      error_message,
      script_id
    } = req.body;

    if (!executor_id || !executor_name || !execution_status) {
      return res.status(400).json({ error: 'Missing required fields: executor_id, executor_name, execution_status' });
    }

    const request = await db.get(
      'SELECT current_status FROM repair_requests WHERE id = ? AND is_deleted = 0',
      [request_id]
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.current_status !== config.status.ROLLBACK_REQUESTED) {
      return res.status(400).json({ 
        error: `Rollback not requested. Current status: ${request.current_status}` 
      });
    }

    const timestamp = getTimestamp();
    const newStatus = execution_status === 'success' 
      ? config.status.ROLLBACK_SUCCESS 
      : config.status.ROLLBACK_FAILED;

    if (script_id) {
      await db.run(
        `UPDATE rollback_scripts 
         SET executed_at = ?, execution_result = ? 
         WHERE id = ?`,
        [timestamp, execution_status, script_id]
      );
    }

    await updateStatus(
      request_id, 
      newStatus, 
      { id: executor_id, name: executor_name },
      error_message || `Rollback ${execution_status}`
    );

    const result = await getRequestDetail(request_id);
    res.json({
      message: `Rollback ${execution_status}`,
      request: result
    });
  } catch (error) {
    console.error('Error executing rollback:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getExecutionHistory(req, res) {
  try {
    const { request_id } = req.params;
    
    const executions = await db.all(
      `SELECT id, executor_id, executor_name, execution_status, 
              execution_start_at, execution_end_at, affected_rows, 
              execution_log, error_message, created_at 
       FROM execution_results 
       WHERE request_id = ? 
       ORDER BY created_at DESC`,
      [request_id]
    );

    res.json(executions);
  } catch (error) {
    console.error('Error getting execution history:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  startExecution,
  completeExecution,
  addRollbackScript,
  getRollbackScripts,
  requestRollback,
  executeRollback,
  getExecutionHistory
};