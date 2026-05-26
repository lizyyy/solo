const { RecordModel, AuditLogModel, ExceptionModel, RectificationModel } = require('../models');
const { getDb } = require('../db');

const db = getDb();

function queryHistory(filters) {
  const records = RecordModel.query(filters);

  if (records.length === 0) {
    return { count: 0, records: [] };
  }

  const recordIds = records.map(r => r.id);
  const auditLogs = AuditLogModel.findByRecords(recordIds);

  const auditMap = {};
  auditLogs.forEach(log => {
    if (!auditMap[log.record_id]) auditMap[log.record_id] = [];
    auditMap[log.record_id].push({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    });
  });

  const enriched = records.map(r => ({
    id: r.id,
    batch_id: r.batch_id,
    site_node: r.site_node,
    supervisor_signature: r.supervisor_signature,
    rectification_count: r.rectification_count,
    status: r.status,
    current_remark: r.current_remark,
    created_at: r.created_at,
    updated_at: r.updated_at,
    audit_logs: auditMap[r.id] || []
  }));

  return { count: enriched.length, records: enriched };
}

function exportDetails(filters) {
  const result = queryHistory(filters);
  const { count, records } = result;

  const exportData = records.map(r => {
    const latestLog = r.audit_logs.length > 0 ? r.audit_logs[r.audit_logs.length - 1] : null;
    return {
      记录ID: r.id,
      批次ID: r.batch_id,
      工地节点: r.site_node,
      监理签字: r.supervisor_signature || '-',
      整改次数: r.rectification_count,
      当前状态: r.status,
      备注: r.current_remark || '-',
      最近处理人: latestLog ? latestLog.handler : '-',
      最近处理时间: latestLog ? latestLog.timestamp : r.created_at,
      创建时间: r.created_at,
      更新时间: r.updated_at
    };
  });

  return {
    count,
    query_count: count,
    export_count: exportData.length,
    data: exportData
  };
}

function getRectificationTrace(recordId) {
  const record = RecordModel.findById(recordId);
  if (!record) {
    throw new Error(`记录不存在: ${recordId}`);
  }

  const rectifications = RectificationModel.findByRecord(recordId);

  const visitedRecords = new Set([recordId]);
  const sourceRecords = [];

  for (const rect of rectifications) {
    if (rect.source_record_id && !visitedRecords.has(rect.source_record_id)) {
      visitedRecords.add(rect.source_record_id);
      const srcRec = RecordModel.findById(rect.source_record_id);
      if (srcRec) {
        sourceRecords.push({
          id: srcRec.id,
          site_node: srcRec.site_node,
          supervisor_signature: srcRec.supervisor_signature,
          rectification_count: srcRec.rectification_count,
          status: srcRec.status,
          created_at: srcRec.created_at,
          linked_by_rectification_id: rect.id
        });
      }
    }
  }

  const sourceChains = [];
  for (const srcRec of sourceRecords) {
    const srcRects = RectificationModel.findByRecord(srcRec.id);
    sourceChains.push({
      source_record: srcRec,
      rectifications: srcRects.map(r => ({
        id: r.id,
        rectification_no: r.rectification_no,
        rectification_count: r.rectification_count,
        handler: r.handler,
        created_at: r.created_at,
        rectification_form_data: r.rectification_form_data ? JSON.parse(r.rectification_form_data) : null,
        source_rectification_id: r.source_rectification_id,
        source_record_id: r.source_record_id
      }))
    });
  }

  return {
    record: {
      id: record.id,
      site_node: record.site_node,
      supervisor_signature: record.supervisor_signature,
      rectification_count: record.rectification_count,
      status: record.status,
      current_remark: record.current_remark
    },
    rectifications: rectifications.map(r => ({
      id: r.id,
      rectification_no: r.rectification_no,
      rectification_count: r.rectification_count,
      handler: r.handler,
      created_at: r.created_at,
      rectification_form_data: r.rectification_form_data ? JSON.parse(r.rectification_form_data) : null,
      source_rectification_id: r.source_rectification_id,
      source_record_id: r.source_record_id
    })),
    source_records: sourceRecords,
    source_chains: sourceChains
  };
}

module.exports = { queryHistory, exportDetails, getRectificationTrace };