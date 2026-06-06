const { STATUS } = require('../models/boundary-rules');
const { runBoundaryChecksOnRecord } = require('../models/sensor-record');

class DataStore {
  constructor() {
    this.records = [];
    this.auditLog = [];
    this.importBatches = [];
  }
  
  addRecord(record) {
    const existingIndex = this.records.findIndex(r => r.id === record.id);
    if (existingIndex >= 0) {
      this.records[existingIndex] = record;
    } else {
      this.records.push(record);
    }
    this._addAuditLog('RECORD_UPDATED', { recordId: record.id, status: record.current_status });
    return record;
  }
  
  addRecordBatch(records) {
    records.forEach((record, index) => {
      const prevRecord = index > 0 ? records[index - 1] : null;
      runBoundaryChecksOnRecord(record, prevRecord);
      this.addRecord(record);
    });
    return records;
  }
  
  getRecordById(id) {
    return this.records.find(r => r.id === id);
  }
  
  getUnifiedView(filters = {}) {
    let result = [...this.records];
    
    if (filters.status) {
      result = result.filter(r => r.current_status === filters.status);
    }
    if (filters.turbineId) {
      result = result.filter(r => r.turbine_id === filters.turbineId);
    }
    if (filters.needsQcReview) {
      result = result.filter(r => r.qc_review_required);
    }
    
    return result.map(r => this._formatForView(r));
  }
  
  _formatForView(record) {
    return {
      id: record.id,
      original_line_no: record.original_line_no,
      import_batch_id: record.import_batch_id,
      sensor_id: record.sensor_id,
      sensor_name: record.sensor_name,
      turbine_id: record.turbine_id,
      sampling_time: record.sampling_time,
      sampling_start_time: record.sampling_start_time,
      sampling_end_time: record.sampling_end_time,
      efficiency: record.efficiency,
      flow_rate: record.flow_rate,
      head: record.head,
      power: record.power,
      current_status: record.current_status,
      qc_review_required: record.qc_review_required,
      boundary_issues: record.boundary_issues,
      status_history: record.status_history,
      manual_changes: record.manual_changes,
      work_condition_photos: record.work_condition_photos,
      conclusion: record.conclusion,
      conclusion_version: record.conclusion_version,
      previous_versions: record.previous_versions,
      created_at: record.created_at,
      updated_at: record.updated_at
    };
  }
  
  getExportData(format = 'json') {
    const data = this.getUnifiedView();
    if (format === 'csv') {
      return this._toCSV(data);
    }
    return JSON.stringify(data, null, 2);
  }
  
  _toCSV(data) {
    if (data.length === 0) return '';
    
    const headers = [
      '记录ID', '原始行号', '导入批次', '传感器编号', '传感器名称', '水轮机编号',
      '采样时间', '采样开始', '采样结束', '效率(%)', '流量(m³/s)', '水头(m)', '功率(kW)',
      '当前状态', '需QC复核', '边界问题', '结论', '结论版本', '创建时间', '更新时间'
    ];
    
    const rows = data.map(r => [
      r.id,
      r.original_line_no,
      r.import_batch_id,
      r.sensor_id,
      r.sensor_name,
      r.turbine_id,
      r.sampling_time,
      r.sampling_start_time,
      r.sampling_end_time,
      r.efficiency,
      r.flow_rate,
      r.head,
      r.power,
      r.current_status,
      r.qc_review_required ? '是' : '否',
      r.boundary_issues.map(i => i.message).join('; '),
      r.conclusion || '',
      r.conclusion_version,
      r.created_at,
      r.updated_at
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
  
  getAuditLog(recordId = null) {
    if (recordId) {
      return this.auditLog.filter(log => log.data.recordId === recordId);
    }
    return this.auditLog;
  }
  
  _addAuditLog(action, data) {
    this.auditLog.push({
      id: `AUD-${String(this.auditLog.length + 1).padStart(5, '0')}`,
      action,
      data,
      timestamp: new Date().toISOString()
    });
  }
  
  getStatistics() {
    const total = this.records.length;
    const byStatus = {};
    Object.values(STATUS).forEach(s => byStatus[s] = 0);
    this.records.forEach(r => byStatus[r.current_status] = (byStatus[r.current_status] || 0) + 1);
    
    const needsQc = this.records.filter(r => r.qc_review_required).length;
    const hasIssues = this.records.filter(r => r.boundary_issues.length > 0).length;
    
    return {
      total_records: total,
      by_status: byStatus,
      needs_qc_review: needsQc,
      has_boundary_issues: hasIssues
    };
  }
  
  clear() {
    this.records = [];
    this.auditLog = [];
    this.importBatches = [];
  }
}

const dataStore = new DataStore();

module.exports = dataStore;
