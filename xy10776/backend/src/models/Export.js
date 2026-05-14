const XLSX = require('xlsx');
const db = require('../database/db');
const moment = require('moment');

class ExportModel {
  static async generateInsightExport(annotationId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM annotation_events WHERE id = ?', [annotationId], (err, annotation) => {
        if (err) return reject(err);
        if (!annotation) return reject(new Error('注释事件不存在'));

        Promise.all([
          this.getApprovalTimeline(annotationId),
          this.getScopeDefinitions(annotationId),
          this.getVersionHistory(annotationId),
          this.getRecalculationRecords(annotationId)
        ]).then(([timeline, scopes, versions, recalculations]) => {
          const exportData = {
            '注释概览': [
              { '注释标题': annotation.title, '事件类型': this.translateEventType(annotation.event_type) },
              { '影响程度': this.translateImpactLevel(annotation.impact_level), '事件日期': annotation.event_date },
              { '当前状态': this.translateStatus(annotation.status), '创建人': annotation.created_by },
              { '当前版本': `v${annotation.version}`, '重试次数': `${annotation.retry_count}/${annotation.max_retries}` },
              { '详细描述': annotation.description, '': '' }
            ],
            '审批时间线': timeline.map(t => ({
              '状态': this.translateStatus(t.status),
              '审批人': t.approver || '系统',
              '审批意见': t.comment || '无',
              '操作时间': moment(t.created_at).format('YYYY-MM-DD HH:mm:ss')
            })),
            '生效范围': scopes.map(s => ({
              '范围类型': this.translateScopeType(s.scope_type),
              '范围值': s.scope_value
            })),
            '版本历史': versions.map(v => ({
              '版本号': `v${v.version_number}`,
              '创建人': v.created_by,
              '创建时间': moment(v.created_at).format('YYYY-MM-DD HH:mm:ss'),
              '快照说明': '状态快照，用于版本回溯'
            })),
            '重新计算记录': recalculations.map(r => ({
              '计算时间': moment(r.recalculated_at).format('YYYY-MM-DD HH:mm:ss'),
              '操作人': r.recalculated_by,
              '影响指标': r.affected_metrics ? JSON.parse(r.affected_metrics).join('、') : '无',
              '备注': r.notes || ''
            }))
          };

          resolve(exportData);
        }).catch(reject);
      });
    });
  }

  static translateEventType(type) {
    const map = {
      'bug': '系统异常',
      'feature': '新功能上线',
      'marketing': '营销活动',
      'operation': '运营调整',
      'incident': '重大事件'
    };
    return map[type] || type;
  }

  static translateImpactLevel(level) {
    const map = {
      'low': '低影响',
      'medium': '中等影响',
      'high': '高影响',
      'critical': '严重影响'
    };
    return map[level] || level;
  }

  static translateStatus(status) {
    const map = {
      'draft': '草稿',
      'pending_approval': '待审批',
      'approved': '已通过',
      'rejected': '已驳回',
      'published': '已发布',
      'revoked': '已撤销',
      'archived': '已归档',
      'cancelled': '已取消',
      'recalled': '已召回',
      'correction_pending': '待修正'
    };
    return map[status] || status;
  }

  static translateScopeType(type) {
    const map = {
      'chart': '指定图表',
      'metric': '指定指标',
      'dimension': '指定维度',
      'date_range': '日期范围',
      'global': '全局生效'
    };
    return map[type] || type;
  }

  static getApprovalTimeline(annotationId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM approval_status_logs WHERE annotation_id = ? ORDER BY created_at ASC', [annotationId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static getScopeDefinitions(annotationId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM scope_definitions WHERE annotation_id = ?', [annotationId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static getVersionHistory(annotationId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM versions WHERE annotation_id = ? ORDER BY version_number DESC', [annotationId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static getRecalculationRecords(annotationId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM timeline_recalculation_records WHERE annotation_id = ? ORDER BY recalculated_at DESC', [annotationId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async exportToExcel(annotationId) {
    const data = await this.generateInsightExport(annotationId);
    const wb = XLSX.utils.book_new();

    Object.entries(data).forEach(([sheetName, sheetData]) => {
      const ws = XLSX.utils.json_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    return wb;
  }
}

module.exports = ExportModel;
