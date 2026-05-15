const { Parser } = require('json2csv');
const { allQuery } = require('../database');

const exportDeletionRequests = async (filters = {}) => {
  let sql = `SELECT dr.id, dr.request_no, dr.customer_id, dr.customer_name, 
             dr.reason, dr.requested_by, dr.status, dr.requested_at,
             dr.approved_by, dr.approved_at, dr.executed_by, dr.executed_at,
             dr.completed_at, dr.created_at
             FROM deletion_requests dr WHERE 1=1`;
  let params = [];

  if (filters.status) {
    sql += ' AND dr.status = ?';
    params.push(filters.status);
  }
  if (filters.startDate) {
    sql += ' AND dr.created_at >= ?';
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    sql += ' AND dr.created_at <= ?';
    params.push(filters.endDate);
  }

  sql += ' ORDER BY dr.created_at DESC';

  const requests = await allQuery(sql, params);

  const fields = [
    { label: '申请ID', value: 'request_no' },
    { label: '客户ID', value: 'customer_id' },
    { label: '客户名称', value: 'customer_name' },
    { label: '删除原因', value: 'reason' },
    { label: '申请人', value: 'requested_by' },
    { label: '状态', value: 'status' },
    { label: '申请时间', value: 'requested_at' },
    { label: '审批人', value: 'approved_by' },
    { label: '审批时间', value: 'approved_at' },
    { label: '执行人', value: 'executed_by' },
    { label: '执行时间', value: 'executed_at' },
    { label: '完成时间', value: 'completed_at' },
    { label: '创建时间', value: 'created_at' }
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(requests);

  return {
    filename: `deletion_requests_${new Date().toISOString().split('T')[0]}.csv`,
    data: csv,
    contentType: 'text/csv'
  };
};

const exportExecutionTasks = async (requestId = null) => {
  let sql = `SELECT et.id, dr.request_no, dd.name as domain_name, 
             et.status, et.total_records, et.processed_records,
             et.failed_records, et.retry_count, et.started_at,
             et.completed_at, et.error_message
             FROM execution_tasks et
             JOIN deletion_requests dr ON et.request_id = dr.id
             JOIN data_domains dd ON et.domain_id = dd.id
             WHERE 1=1`;
  let params = [];

  if (requestId) {
    sql += ' AND et.request_id = ?';
    params.push(requestId);
  }

  sql += ' ORDER BY et.created_at DESC';

  const tasks = await allQuery(sql, params);

  const fields = [
    { label: '申请编号', value: 'request_no' },
    { label: '数据域', value: 'domain_name' },
    { label: '任务状态', value: 'status' },
    { label: '总记录数', value: 'total_records' },
    { label: '已处理', value: 'processed_records' },
    { label: '失败数', value: 'failed_records' },
    { label: '重试次数', value: 'retry_count' },
    { label: '开始时间', value: 'started_at' },
    { label: '完成时间', value: 'completed_at' },
    { label: '错误信息', value: 'error_message' }
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(tasks);

  return {
    filename: `execution_tasks_${new Date().toISOString().split('T')[0]}.csv`,
    data: csv,
    contentType: 'text/csv'
  };
};

const exportFailedItems = async () => {
  const sql = `SELECT fi.id, dr.request_no, dd.name as domain_name,
               fi.record_id, fi.record_type, fi.error_code,
               fi.error_message, fi.status, fi.failed_at, fi.resolved_at
               FROM failed_items fi
               JOIN execution_tasks et ON fi.task_id = et.id
               JOIN deletion_requests dr ON et.request_id = dr.id
               JOIN data_domains dd ON et.domain_id = dd.id
               ORDER BY fi.failed_at DESC`;

  const items = await allQuery(sql);

  const fields = [
    { label: '申请编号', value: 'request_no' },
    { label: '数据域', value: 'domain_name' },
    { label: '记录ID', value: 'record_id' },
    { label: '记录类型', value: 'record_type' },
    { label: '错误代码', value: 'error_code' },
    { label: '错误信息', value: 'error_message' },
    { label: '状态', value: 'status' },
    { label: '失败时间', value: 'failed_at' },
    { label: '解决时间', value: 'resolved_at' }
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(items);

  return {
    filename: `failed_items_${new Date().toISOString().split('T')[0]}.csv`,
    data: csv,
    contentType: 'text/csv'
  };
};

const exportAuditLogs = async (requestId = null) => {
  let sql = `SELECT al.id, al.request_id, al.task_id, al.action,
             al.actor, al.details, al.created_at
             FROM audit_logs al WHERE 1=1`;
  let params = [];

  if (requestId) {
    sql += ' AND al.request_id = ?';
    params.push(requestId);
  }

  sql += ' ORDER BY al.created_at DESC';

  const logs = await allQuery(sql, params);

  const fields = [
    { label: '动作', value: 'action' },
    { label: '操作者', value: 'actor' },
    { label: '详情', value: 'details' },
    { label: '时间', value: 'created_at' }
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(logs);

  return {
    filename: `audit_logs_${new Date().toISOString().split('T')[0]}.csv`,
    data: csv,
    contentType: 'text/csv'
  };
};

module.exports = {
  exportDeletionRequests,
  exportExecutionTasks,
  exportFailedItems,
  exportAuditLogs
};
