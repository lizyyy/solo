const db = require('../db/connection');
const config = require('../config');
const { getTimestamp } = require('../utils/ticketGenerator');

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toISOString();
}

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function jsonToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const headerRow = headers.map(h => escapeCSV(h)).join(',');
  
  const rows = data.map(row => {
    return headers.map(h => escapeCSV(row[h])).join(',');
  });
  
  return [headerRow, ...rows].join('\n');
}

async function exportRequests(req, res) {
  try {
    const {
      status,
      applicant_id,
      business_type,
      start_time,
      end_time,
      format = 'json',
      include_details = 'false'
    } = req.query;

    const params = [];
    const conditions = ['r.is_deleted = 0'];

    if (status) {
      conditions.push('r.current_status = ?');
      params.push(status);
    }
    if (applicant_id) {
      conditions.push('r.applicant_id = ?');
      params.push(applicant_id);
    }
    if (business_type) {
      conditions.push('r.business_type = ?');
      params.push(business_type);
    }
    if (start_time) {
      conditions.push('r.created_at >= ?');
      params.push(parseInt(start_time));
    }
    if (end_time) {
      conditions.push('r.created_at <= ?');
      params.push(parseInt(end_time));
    }

    const whereClause = conditions.join(' AND ');

    const requests = await db.all(
      `SELECT r.id, r.ticket_no, r.title, r.description, r.business_type,
              r.applicant_id, r.applicant_name, r.department, r.urgency,
              r.risk_level, r.current_status, r.created_at, r.updated_at
       FROM repair_requests r
       WHERE ${whereClause}
       ORDER BY r.created_at DESC`,
      params
    );

    let resultData = requests;

    if (include_details === 'true') {
      const enrichedRequests = [];
      
      for (const req of requests) {
        const [sqlContents, reviews, executions, rollbackScripts, statusHistory] = await Promise.all([
          db.all('SELECT sql_text, sql_type, target_table, target_database FROM sql_contents WHERE request_id = ?', [req.id]),
          db.all('SELECT reviewer_name, review_result, review_comments FROM sql_reviews WHERE request_id = ?', [req.id]),
          db.all('SELECT executor_name, execution_status, affected_rows, error_message FROM execution_results WHERE request_id = ?', [req.id]),
          db.all('SELECT rollback_sql, script_type, generated_by FROM rollback_scripts WHERE request_id = ?', [req.id]),
          db.all('SELECT old_status, new_status, operator_name, reason, is_manual_correction FROM status_history WHERE request_id = ? ORDER BY created_at', [req.id])
        ]);

        enrichedRequests.push({
          ...req,
          created_at_formatted: formatDate(req.created_at),
          updated_at_formatted: formatDate(req.updated_at),
          sql_count: sqlContents.length,
          review_count: reviews.length,
          execution_count: executions.length,
          rollback_script_count: rollbackScripts.length,
          has_manual_correction: statusHistory.some(s => s.is_manual_correction === 1)
        });
      }
      
      resultData = enrichedRequests;
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="repair-requests-${getTimestamp()}.csv"`);
      res.send(jsonToCSV(resultData));
    } else {
      res.json({
        export_time: getTimestamp(),
        total: resultData.length,
        data: resultData
      });
    }
  } catch (error) {
    console.error('Error exporting requests:', error);
    res.status(500).json({ error: error.message });
  }
}

async function exportRequestDetail(req, res) {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;

    const request = await db.get(
      `SELECT r.* FROM repair_requests r WHERE r.id = ? AND r.is_deleted = 0`,
      [id]
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const [sqlContents, impactEstimation, reviews, executions, rollbackScripts, statusHistory] = await Promise.all([
      db.all('SELECT * FROM sql_contents WHERE request_id = ?', [id]),
      db.get('SELECT * FROM impact_estimations WHERE request_id = ?', [id]),
      db.all('SELECT * FROM sql_reviews WHERE request_id = ? ORDER BY created_at ASC', [id]),
      db.all('SELECT * FROM execution_results WHERE request_id = ? ORDER BY created_at ASC', [id]),
      db.all('SELECT * FROM rollback_scripts WHERE request_id = ? ORDER BY created_at ASC', [id]),
      db.all('SELECT * FROM status_history WHERE request_id = ? ORDER BY created_at ASC', [id])
    ]);

    const detail = {
      basic_info: {
        ticket_no: request.ticket_no,
        title: request.title,
        description: request.description,
        business_type: request.business_type,
        applicant_id: request.applicant_id,
        applicant_name: request.applicant_name,
        department: request.department,
        urgency: request.urgency,
        risk_level: request.risk_level,
        current_status: request.current_status,
        created_at: request.created_at,
        created_at_formatted: formatDate(request.created_at),
        updated_at: request.updated_at,
        updated_at_formatted: formatDate(request.updated_at)
      },
      sql_contents: sqlContents.map((s, i) => ({
        index: i + 1,
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
      reviews: reviews.map((r, i) => ({
        index: i + 1,
        reviewer: r.reviewer_name,
        result: r.review_result,
        comments: r.review_comments,
        suggestions: r.sql_suggestions,
        reviewed_at: r.approved_at || r.rejected_at,
        reviewed_at_formatted: formatDate(r.approved_at || r.rejected_at)
      })),
      executions: executions.map((e, i) => ({
        index: i + 1,
        executor: e.executor_name,
        status: e.execution_status,
        affected_rows: e.affected_rows,
        log: e.execution_log,
        error: e.error_message,
        start_at: e.execution_start_at,
        end_at: e.execution_end_at
      })),
      rollback_scripts: rollbackScripts.map((s, i) => ({
        index: i + 1,
        sql: s.rollback_sql,
        type: s.script_type,
        generated_by: s.generated_by,
        generated_at: s.generated_at,
        is_approved: s.is_approved,
        executed_at: s.executed_at,
        execution_result: s.execution_result
      })),
      status_history: statusHistory.map((s, i) => ({
        index: i + 1,
        old_status: s.old_status,
        new_status: s.new_status,
        operator: s.operator_name,
        reason: s.reason,
        is_manual_correction: s.is_manual_correction === 1,
        changed_at: s.created_at,
        changed_at_formatted: formatDate(s.created_at)
      }))
    };

    if (format === 'csv') {
      const flatData = [
        { category: '基本信息', field: '工单号', value: detail.basic_info.ticket_no },
        { category: '基本信息', field: '标题', value: detail.basic_info.title },
        { category: '基本信息', field: '申请人', value: detail.basic_info.applicant_name },
        { category: '基本信息', field: '当前状态', value: detail.basic_info.current_status },
        { category: '基本信息', field: '创建时间', value: detail.basic_info.created_at_formatted },
        ...detail.sql_contents.map(s => ({ 
          category: 'SQL内容', 
          field: `SQL #${s.index}`, 
          value: s.sql_text 
        })),
        ...detail.reviews.map(r => ({ 
          category: '审核记录', 
          field: `审核 #${r.index} - ${r.reviewer}`, 
          value: `${r.result}: ${r.comments || ''}` 
        })),
        ...detail.executions.map(e => ({ 
          category: '执行记录', 
          field: `执行 #${e.index} - ${e.executor}`, 
          value: `${e.status}, 影响行: ${e.affected_rows || 0}` 
        })),
        ...detail.rollback_scripts.map(s => ({ 
          category: '回滚脚本', 
          field: `脚本 #${s.index}`, 
          value: s.sql 
        })),
        ...detail.status_history.map(s => ({ 
          category: '状态变更', 
          field: `变更 #${s.index}`, 
          value: `${s.old_status || '(初始)'} -> ${s.new_status}${s.is_manual_correction ? ' [人工修正]' : ''}` 
        }))
      ];

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="request-${request.ticket_no}-detail.csv"`);
      res.send(jsonToCSV(flatData));
    } else {
      res.json(detail);
    }
  } catch (error) {
    console.error('Error exporting request detail:', error);
    res.status(500).json({ error: error.message });
  }
}

async function exportStatistics(req, res) {
  try {
    const { format = 'json' } = req.query;

    const [statusStats, executionStats, deptStats, manualCorrections] = await Promise.all([
      db.all(
        `SELECT current_status as status, COUNT(*) as count
         FROM repair_requests 
         WHERE is_deleted = 0
         GROUP BY current_status`,
        []
      ),
      db.get(
        `SELECT 
           SUM(CASE WHEN execution_status = 'success' THEN 1 ELSE 0 END) as success_count,
           SUM(CASE WHEN execution_status = 'failed' THEN 1 ELSE 0 END) as failed_count,
           SUM(affected_rows) as total_affected_rows,
           COUNT(*) as total_executions
         FROM execution_results`,
        []
      ),
      db.all(
        `SELECT department, COUNT(*) as count
         FROM repair_requests
         WHERE is_deleted = 0
         GROUP BY department`,
        []
      ),
      db.get(
        `SELECT COUNT(*) as count FROM status_history WHERE is_manual_correction = 1`,
        []
      )
    ]);

    const stats = {
      export_time: getTimestamp(),
      overview: {
        total_requests: statusStats.reduce((sum, s) => sum + s.count, 0),
        total_executions: executionStats.total_executions || 0,
        execution_success_rate: executionStats.total_executions > 0 
          ? ((executionStats.success_count / executionStats.total_executions) * 100).toFixed(2)
          : '0.00',
        total_affected_rows: executionStats.total_affected_rows || 0,
        manual_corrections: manualCorrections.count || 0
      },
      by_status: statusStats,
      by_department: deptStats
    };

    if (format === 'csv') {
      const flatData = [
        { category: '概览', field: '总工单数', value: stats.overview.total_requests },
        { category: '概览', field: '总执行次数', value: stats.overview.total_executions },
        { category: '概览', field: '执行成功率(%)', value: stats.overview.execution_success_rate },
        { category: '概览', field: '总影响行数', value: stats.overview.total_affected_rows },
        { category: '概览', field: '人工修正次数', value: stats.overview.manual_corrections },
        ...stats.by_status.map(s => ({ 
          category: '按状态统计', 
          field: s.status, 
          value: s.count 
        })),
        ...stats.by_department.map(d => ({ 
          category: '按部门统计', 
          field: d.department || '未指定', 
          value: d.count 
        }))
      ];

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="statistics-${getTimestamp()}.csv"`);
      res.send(jsonToCSV(flatData));
    } else {
      res.json(stats);
    }
  } catch (error) {
    console.error('Error exporting statistics:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  exportRequests,
  exportRequestDetail,
  exportStatistics
};