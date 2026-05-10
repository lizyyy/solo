const db = require('../db/connection');
const config = require('../config');
const { generateUUID, getTimestamp } = require('../utils/ticketGenerator');
const { getStatusHistory } = require('../utils/statusManager');

async function generateAuditReport(req, res) {
  try {
    const { request_id } = req.params;
    const { generated_by } = req.body;

    const request = await db.get(
      `SELECT id, ticket_no, title, description, business_type, applicant_id, applicant_name,
              department, urgency, risk_level, current_status, created_at, updated_at
       FROM repair_requests 
       WHERE id = ? AND is_deleted = 0`,
      [request_id]
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const [sqlContents, impactEstimation, reviews, executions, rollbackScripts, statusHistory] = await Promise.all([
      db.all('SELECT * FROM sql_contents WHERE request_id = ?', [request_id]),
      db.get('SELECT * FROM impact_estimations WHERE request_id = ?', [request_id]),
      db.all('SELECT * FROM sql_reviews WHERE request_id = ? ORDER BY created_at ASC', [request_id]),
      db.all('SELECT * FROM execution_results WHERE request_id = ? ORDER BY created_at ASC', [request_id]),
      db.all('SELECT * FROM rollback_scripts WHERE request_id = ? ORDER BY created_at ASC', [request_id]),
      getStatusHistory(request_id)
    ]);

    const report = {
      basic_info: {
        ticket_no: request.ticket_no,
        title: request.title,
        description: request.description,
        business_type: request.business_type,
        applicant: {
          id: request.applicant_id,
          name: request.applicant_name,
          department: request.department
        },
        urgency: request.urgency,
        risk_level: request.risk_level,
        current_status: request.current_status,
        created_at: request.created_at,
        updated_at: request.updated_at
      },
      sql_contents: sqlContents.map(s => ({
        sql_text: s.sql_text,
        sql_type: s.sql_type,
        target_database: s.target_database,
        target_table: s.target_table
      })),
      impact_estimation: impactEstimation ? {
        estimated_rows: impactEstimation.estimated_rows,
        affected_tables: impactEstimation.affected_tables,
        affected_indexes: impactEstimation.affected_indexes,
        backup_strategy: impactEstimation.backup_strategy,
        rollback_plan: impactEstimation.rollback_plan,
        risk_assessment: impactEstimation.risk_assessment
      } : null,
      review_history: reviews.map(r => ({
        reviewer: { id: r.reviewer_id, name: r.reviewer_name },
        result: r.review_result,
        comments: r.review_comments,
        suggestions: r.sql_suggestions,
        reviewed_at: r.approved_at || r.rejected_at
      })),
      execution_history: executions.map(e => ({
        executor: { id: e.executor_id, name: e.executor_name },
        status: e.execution_status,
        affected_rows: e.affected_rows,
        start_at: e.execution_start_at,
        end_at: e.execution_end_at,
        log: e.execution_log,
        error: e.error_message
      })),
      rollback_scripts: rollbackScripts.map(r => ({
        sql: r.rollback_sql,
        type: r.script_type,
        generated_by: r.generated_by,
        generated_at: r.generated_at,
        is_approved: r.is_approved,
        executed_at: r.executed_at,
        execution_result: r.execution_result
      })),
      status_timeline: statusHistory.map(s => ({
        old_status: s.old_status,
        new_status: s.new_status,
        operator: { id: s.operator_id, name: s.operator_name },
        reason: s.reason,
        is_manual_correction: s.is_manual_correction === 1,
        changed_at: s.created_at
      })),
      report_summary: {
        total_reviews: reviews.length,
        total_executions: executions.length,
        total_rollback_scripts: rollbackScripts.length,
        has_manual_corrections: statusHistory.some(s => s.is_manual_correction === 1),
        final_status: request.current_status,
        generated_at: getTimestamp()
      }
    };

    const reportId = generateUUID();
    const timestamp = getTimestamp();

    await db.run(
      `INSERT INTO audit_reports (id, request_id, report_content, generated_at, generated_by, report_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [reportId, request_id, JSON.stringify(report), timestamp, generated_by || 'system', 'full']
    );

    res.status(201).json({
      id: reportId,
      ...report
    });
  } catch (error) {
    console.error('Error generating audit report:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getAuditReports(req, res) {
  try {
    const { request_id } = req.params;
    
    const reports = await db.all(
      `SELECT id, generated_at, generated_by, report_type
       FROM audit_reports 
       WHERE request_id = ? 
       ORDER BY generated_at DESC`,
      [request_id]
    );

    res.json(reports);
  } catch (error) {
    console.error('Error getting audit reports:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getAuditReportDetail(req, res) {
  try {
    const { id } = req.params;
    
    const report = await db.get(
      'SELECT * FROM audit_reports WHERE id = ?',
      [id]
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({
      id: report.id,
      request_id: report.request_id,
      generated_at: report.generated_at,
      generated_by: report.generated_by,
      report_type: report.report_type,
      ...JSON.parse(report.report_content)
    });
  } catch (error) {
    console.error('Error getting audit report detail:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  generateAuditReport,
  getAuditReports,
  getAuditReportDetail
};