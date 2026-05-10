const db = require('../db/connection');
const config = require('../config');
const { generateUUID, generateTicketNo, getTimestamp } = require('../utils/ticketGenerator');
const { updateStatus, getStatusHistory, getStatusAtTime } = require('../utils/statusManager');

async function createRequest(req, res) {
  try {
    const {
      title,
      description,
      business_type,
      applicant_id,
      applicant_name,
      department,
      urgency = 'normal',
      risk_level = 'medium',
      sql_contents,
      impact_estimation
    } = req.body;

    if (!title || !applicant_id || !applicant_name) {
      return res.status(400).json({ error: 'Missing required fields: title, applicant_id, applicant_name' });
    }

    const requestId = generateUUID();
    const ticketNo = generateTicketNo(business_type);
    const timestamp = getTimestamp();

    const queries = [
      {
        sql: `INSERT INTO repair_requests 
              (id, ticket_no, title, description, business_type, applicant_id, applicant_name, 
               department, urgency, risk_level, current_status, created_at, updated_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          requestId, ticketNo, title, description, business_type, 
          applicant_id, applicant_name, department, urgency, risk_level,
          config.status.DRAFT, timestamp, timestamp
        ]
      },
      {
        sql: `INSERT INTO status_history 
              (id, request_id, old_status, new_status, operator_id, operator_name, reason, created_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          generateUUID(), requestId, null, config.status.DRAFT,
          applicant_id, applicant_name, 'Request created', timestamp
        ]
      }
    ];

    if (sql_contents && sql_contents.length > 0) {
      for (const sql of sql_contents) {
        queries.push({
          sql: `INSERT INTO sql_contents 
                (id, request_id, sql_text, sql_type, target_table, target_database, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [
            generateUUID(), requestId, sql.sql_text, sql.sql_type,
            sql.target_table, sql.target_database, timestamp
          ]
        });
      }
    }

    if (impact_estimation) {
      queries.push({
        sql: `INSERT INTO impact_estimations 
              (id, request_id, estimated_rows, affected_tables, affected_indexes, 
               backup_strategy, rollback_plan, risk_assessment, created_at, updated_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          generateUUID(), requestId,
          impact_estimation.estimated_rows || null,
          impact_estimation.affected_tables || null,
          impact_estimation.affected_indexes || null,
          impact_estimation.backup_strategy || null,
          impact_estimation.rollback_plan || null,
          impact_estimation.risk_assessment || null,
          timestamp, timestamp
        ]
      });
    }

    await db.runTransaction(queries);

    const result = await getRequestDetail(requestId);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getRequestDetail(requestId) {
  const request = await db.get(
    `SELECT id, ticket_no, title, description, business_type, applicant_id, applicant_name,
            department, urgency, risk_level, current_status, created_at, updated_at
     FROM repair_requests 
     WHERE id = ? AND is_deleted = 0`,
    [requestId]
  );

  if (!request) return null;

  const [sqlContents, impactEstimation, statusHistory] = await Promise.all([
    db.all(
      'SELECT id, sql_text, sql_type, target_table, target_database, created_at FROM sql_contents WHERE request_id = ?',
      [requestId]
    ),
    db.get(
      `SELECT id, estimated_rows, affected_tables, affected_indexes, backup_strategy, 
              rollback_plan, risk_assessment, created_at, updated_at 
       FROM impact_estimations WHERE request_id = ?`,
      [requestId]
    ),
    getStatusHistory(requestId)
  ]);

  return {
    ...request,
    sql_contents: sqlContents,
    impact_estimation: impactEstimation,
    status_history: statusHistory
  };
}

async function getRequest(req, res) {
  try {
    const { id } = req.params;
    const result = await getRequestDetail(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error getting request:', error);
    res.status(500).json({ error: error.message });
  }
}

async function listRequests(req, res) {
  try {
    const {
      status,
      applicant_id,
      business_type,
      start_time,
      end_time,
      page = 1,
      page_size = 20
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const params = [];
    const conditions = ['is_deleted = 0'];

    if (status) {
      conditions.push('current_status = ?');
      params.push(status);
    }
    if (applicant_id) {
      conditions.push('applicant_id = ?');
      params.push(applicant_id);
    }
    if (business_type) {
      conditions.push('business_type = ?');
      params.push(business_type);
    }
    if (start_time) {
      conditions.push('created_at >= ?');
      params.push(parseInt(start_time));
    }
    if (end_time) {
      conditions.push('created_at <= ?');
      params.push(parseInt(end_time));
    }

    const whereClause = conditions.join(' AND ');
    
    const [countResult, requests] = await Promise.all([
      db.get(`SELECT COUNT(*) as total FROM repair_requests WHERE ${whereClause}`, params),
      db.all(
        `SELECT id, ticket_no, title, business_type, applicant_id, applicant_name,
                department, urgency, risk_level, current_status, created_at, updated_at
         FROM repair_requests 
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(page_size), offset]
      )
    ]);

    res.json({
      total: countResult.total,
      page: parseInt(page),
      page_size: parseInt(page_size),
      data: requests
    });
  } catch (error) {
    console.error('Error listing requests:', error);
    res.status(500).json({ error: error.message });
  }
}

async function submitForReview(req, res) {
  try {
    const { id } = req.params;
    const { operator_id, operator_name } = req.body;

    if (!operator_id || !operator_name) {
      return res.status(400).json({ error: 'Missing operator information' });
    }

    const sqlContents = await db.all(
      'SELECT id FROM sql_contents WHERE request_id = ?',
      [id]
    );

    if (sqlContents.length === 0) {
      return res.status(400).json({ error: 'No SQL content found. Please add SQL before submitting.' });
    }

    await updateStatus(id, config.status.PENDING_REVIEW, { id: operator_id, name: operator_name }, 'Submit for review');

    const result = await getRequestDetail(id);
    res.json(result);
  } catch (error) {
    console.error('Error submitting for review:', error);
    res.status(500).json({ error: error.message });
  }
}

async function updateRequest(req, res) {
  try {
    const { id } = req.params;
    const { title, description, business_type, urgency, risk_level } = req.body;

    const current = await db.get(
      'SELECT current_status FROM repair_requests WHERE id = ? AND is_deleted = 0',
      [id]
    );

    if (!current) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (current.current_status !== config.status.DRAFT && 
        current.current_status !== config.status.REVIEW_REJECTED) {
      return res.status(400).json({ 
        error: `Cannot update request in status: ${current.current_status}` 
      });
    }

    const updates = [];
    const params = [];

    if (title) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (business_type) { updates.push('business_type = ?'); params.push(business_type); }
    if (urgency) { updates.push('urgency = ?'); params.push(urgency); }
    if (risk_level) { updates.push('risk_level = ?'); params.push(risk_level); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = ?');
    params.push(getTimestamp());
    params.push(id);

    await db.run(
      `UPDATE repair_requests SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const result = await getRequestDetail(id);
    res.json(result);
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({ error: error.message });
  }
}

async function manualStatusCorrection(req, res) {
  try {
    const { id } = req.params;
    const { new_status, operator_id, operator_name, reason } = req.body;

    if (!new_status || !operator_id || !operator_name) {
      return res.status(400).json({ error: 'Missing required fields: new_status, operator_id, operator_name' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Reason is required for manual status correction' });
    }

    await updateStatus(
      id, 
      new_status, 
      { id: operator_id, name: operator_name }, 
      reason, 
      true
    );

    const result = await getRequestDetail(id);
    res.json({
      message: 'Status manually corrected',
      data: result
    });
  } catch (error) {
    console.error('Error correcting status:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  createRequest,
  getRequest,
  listRequests,
  submitForReview,
  updateRequest,
  manualStatusCorrection,
  getRequestDetail
};