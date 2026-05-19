const { Parser } = require('json2csv');
const { db } = require('../database');

const exportDeletionRequests = (filters = {}) => {
  let requests = [...db.deletion_requests];

  if (filters.status) {
    requests = requests.filter(r => r.status === filters.status);
  }
  if (filters.startDate) {
    requests = requests.filter(r => r.created_at >= filters.startDate);
  }
  if (filters.endDate) {
    requests = requests.filter(r => r.created_at <= filters.endDate);
  }

  const fields = [
    { label: '申请编号', value: 'request_no' },
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

const exportExecutionTasks = (requestId = null) => {
  let tasks = [...db.execution_tasks];
  if (requestId) {
    tasks = tasks.filter(t => t.request_id === requestId);
  }

  const domainMap = {};
  db.data_domains.forEach(d => { domainMap[d.id] = d.name; });

  const tasksWithDomain = tasks.map(t => ({
    ...t,
    domain_name: domainMap[t.domain_id] || t.domain_id
  }));

  const fields = [
    { label: '申请ID', value: 'request_id' },
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
  const csv = json2csvParser.parse(tasksWithDomain);

  return {
    filename: `execution_tasks_${new Date().toISOString().split('T')[0]}.csv`,
    data: csv,
    contentType: 'text/csv'
  };
};

const exportFailedItems = () => {
  const domainMap = {};
  db.data_domains.forEach(d => { domainMap[d.id] = d.name; });

  const itemsWithDomain = db.failed_items.map(f => {
    const task = db.execution_tasks.find(t => t.id === f.task_id);
    return {
      ...f,
      domain_name: task ? domainMap[task.domain_id] || task.domain_id : f.task_id
    };
  });

  const fields = [
    { label: '任务ID', value: 'task_id' },
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
  const csv = json2csvParser.parse(itemsWithDomain);

  return {
    filename: `failed_items_${new Date().toISOString().split('T')[0]}.csv`,
    data: csv,
    contentType: 'text/csv'
  };
};

const exportAuditLogs = (requestId = null) => {
  let logs = [...db.audit_logs];
  if (requestId) {
    logs = logs.filter(l => l.request_id === requestId);
  }

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

const exportRequestData = (requestId) => {
  const request = db.deletion_requests.find(r => r.id === requestId);
  if (!request) {
    throw new Error('删除申请不存在');
  }

  const tasks = db.execution_tasks.filter(t => t.request_id === requestId);
  const domainMap = {};
  db.data_domains.forEach(d => { domainMap[d.id] = d.name; });

  const tasksWithDomain = tasks.map(t => ({
    ...t,
    domain_name: domainMap[t.domain_id] || t.domain_id
  }));

  const failedItems = db.failed_items.filter(f => {
    const task = db.execution_tasks.find(t => t.id === f.task_id);
    return task && task.request_id === requestId;
  });

  const audits = db.audit_logs.filter(a => a.request_id === requestId);

  return {
    request,
    tasks: tasksWithDomain,
    failedItems,
    audits,
    summary: {
      totalTasks: tasks.length,
      totalRecords: tasks.reduce((sum, t) => sum + (t.total_records || 0), 0),
      processedRecords: tasks.reduce((sum, t) => sum + (t.processed_records || 0), 0),
      failedRecords: tasks.reduce((sum, t) => sum + (t.failed_records || 0), 0),
      totalFailedItems: failedItems.length,
      totalAudits: audits.length
    }
  };
};

module.exports = {
  exportDeletionRequests,
  exportExecutionTasks,
  exportFailedItems,
  exportAuditLogs,
  exportRequestData
};
