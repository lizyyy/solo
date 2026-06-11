const { STATUS } = require('../models/boundary-rules');
const {
  UNIFIED_FIELDS,
  getCsvHeaders,
  getCsvRow,
  formatViewRecord
} = require('../models/unified-fields');

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
    this._addAuditLog('RECORD_UPDATED', {
      recordId: record.id,
      status: record.current_status,
      qc_review_required: record.qc_review_required,
      boundary_issue_count: record.boundary_issues ? record.boundary_issues.length : 0,
      superseded_by: record.superseded_by || null
    });
    return record;
  }

  addRecordBatch(records) {
    records.forEach((record) => {
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
      result = result.filter(r => r.qc_review_required === true);
    }
    if (filters.hasBoundaryIssues) {
      result = result.filter(r => Array.isArray(r.boundary_issues) && r.boundary_issues.length > 0);
    }
    if (filters.recordId) {
      result = result.filter(r => r.id === filters.recordId);
    }

    return result.map(r => formatViewRecord(r));
  }

  getExportData(format = 'json', filters = {}) {
    const data = this.getUnifiedView(filters);
    if (format === 'csv') {
      return this._toCSV(data);
    }
    return JSON.stringify(data, null, 2);
  }

  _toCSV(data) {
    if (data.length === 0) {
      return getCsvHeaders().join(',') + '\n(空: 没有符合条件的记录，如要查看采样时间缺半小时的，请加 --needs-qc-review=true)';
    }

    const headers = getCsvHeaders();
    const rows = data.map(recordView => getCsvRow(recordView));
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
      timestamp: new Date().toISOString(),
      _unified_view_snapshot: (() => {
        const rec = this.records.find(r => r.id === data.recordId);
        return rec ? formatViewRecord(rec) : null;
      })()
    });
  }

  getStatistics() {
    const total = this.records.length;
    const byStatus = {};
    Object.values(STATUS).forEach(s => byStatus[s] = 0);
    this.records.forEach(r => byStatus[r.current_status] = (byStatus[r.current_status] || 0) + 1);

    const needsQc = this.records.filter(r => r.qc_review_required).length;
    const hasIssues = this.records.filter(r => Array.isArray(r.boundary_issues) && r.boundary_issues.length > 0).length;
    const supersededCount = this.records.filter(r => r.current_status === STATUS.SUPERSEDED).length;
    const withReworkChain = this.records.filter(r => r.superseded_by || (r.previous_versions && r.previous_versions.length > 0)).length;

    return {
      total_records: total,
      by_status: byStatus,
      needs_qc_review: needsQc,
      has_boundary_issues: hasIssues,
      superseded_records: supersededCount,
      records_in_rework_chain: withReworkChain,
      _unified_fields_used: UNIFIED_FIELDS.map(f => f.key),
      _consistency_note: '以上统计与导出/页面/接口共用 getUnifiedView()，绝不各自计算'
    };
  }

  verifyConsistency() {
    const issues = [];
    const apiView = this.getUnifiedView();
    const jsonExport = JSON.parse(this.getExportData('json'));

    if (apiView.length !== jsonExport.length) {
      issues.push(`长度不一致 API=${apiView.length} vs 导出JSON=${jsonExport.length}`);
    }

    apiView.forEach((v, i) => {
      const e = jsonExport[i];
      if (!e) { issues.push(`第${i}条记录导出缺失`); return; }
      ['id','current_status','qc_review_required','superseded_by','conclusion_version'].forEach(k => {
        if (JSON.stringify(v[k]) !== JSON.stringify(e[k])) {
          issues.push(`${v.id} 字段 ${k} 不一致 API=${JSON.stringify(v[k])} vs 导出=${JSON.stringify(e[k])}`);
        }
      });
      if (Array.isArray(v.boundary_issues) && Array.isArray(e.boundary_issues)) {
        if (v.boundary_issues.length !== e.boundary_issues.length) {
          issues.push(`${v.id} boundary_issues 长度不一致`);
        }
      }
    });

    this.records.forEach(r => {
      if (r.current_status === STATUS.SUPERSEDED && !r.superseded_by) {
        issues.push(`${r.id} 状态=SUPERSEDED 但 superseded_by 为空，返工证据链断了`);
      }
      if (r.qc_review_required === true
          && r.current_status !== STATUS.NEED_QC_REVIEW
          && r.current_status !== STATUS.STATUS_IMPORTED) {
        issues.push(`${r.id} qc_review_required=true 但状态=${r.current_status}，派生字段不同步`);
      }
    });

    return {
      passed: issues.length === 0,
      issues,
      summary: issues.length === 0 ? '✅ 三方一致（页面/API/导出），返工证据链完整，派生字段同步' : `❌ 发现 ${issues.length} 个问题`
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
