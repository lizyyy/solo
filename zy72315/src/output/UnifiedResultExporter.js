const BoundaryRuleEngine = require('../engine/BoundaryRuleEngine');

class UnifiedResultExporter {
  constructor() {
    this.ruleEngine = new BoundaryRuleEngine();
  }

  formatForCSV(records) {
    const rows = records.map((record) => this._formatRecord(record));
    return {
      headers: this._getCSVHeaders(),
      rows,
      filename: `ab_experiment_results_${new Date().toISOString().slice(0, 10)}.csv`
    };
  }

  formatForPageDisplay(records) {
    return {
      columns: this._getPageColumns(),
      data: records.map((record) => this._formatPageRecord(record)),
      filters: this._getFilters(),
      statistics: this._calculateStatistics(records)
    };
  }

  formatForAPI(records) {
    return {
      code: 0,
      message: 'success',
      data: {
        records: records.map((record) => this._formatAPIRecord(record)),
        pagination: {
          total: records.length
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  _formatRecord(record) {
    const evaluation = this.ruleEngine.evaluate(record);
    return {
      recordId: record.recordId,
      mainProcess: record.boundaryEvidence?.rawData?.mainProcess || '',
      sceneStatement: record.scoringEvidence?.rawData?.sceneStatement || '',
      numerator: record.boundaryEvidence?.rawData?.numerator ?? '',
      denominator: record.boundaryEvidence?.rawData?.denominator ?? '',
      displayValue: evaluation.displayValue,
      reviewStatus: record.reviewStatus,
      currentStatus: record.currentStatus,
      boundaryLineNumber: record.boundaryEvidence?.originalLineNumber || '',
      scoringLineNumber: record.scoringEvidence?.originalLineNumber || '',
      manualChangeCount: record.manualChanges?.length || 0,
      hasBothEvidence: !!(record.boundaryEvidence && record.scoringEvidence),
      reviewRequired: evaluation.reviewRequired ? '是' : '否',
      severity: evaluation.severity,
      reviewer: record.reviewer || '',
      lastUpdated: record.boundaryEvidence?.importTimestamp || ''
    };
  }

  _formatPageRecord(record) {
    const evaluation = this.ruleEngine.evaluate(record);
    return {
      ...this._formatRecord(record),
      display: {
        showAlert: evaluation.severity === 'needs_review',
        alertType: evaluation.severity === 'needs_review' ? 'warning' : evaluation.severity,
        canEdit: record.reviewStatus !== 'approved',
        hasAuditTrail: true,
        auditTrail: record.auditTrail || []
      }
    };
  }

  _formatAPIRecord(record) {
    const evaluation = this.ruleEngine.evaluate(record);
    return {
      id: record.recordId,
      attributes: this._formatRecord(record),
      evaluation: {
        ruleId: evaluation.ruleId,
        ruleDescription: evaluation.ruleDescription,
        severity: evaluation.severity,
        notes: evaluation.notes,
        rawInputs: evaluation.rawInputs
      },
      relationships: {
        boundaryEvidence: record.boundaryEvidence
          ? {
              id: record.boundaryEvidence.originalLineNumber,
              source: 'boundary_value_spec'
            }
          : null,
        scoringEvidence: record.scoringEvidence
          ? {
              id: record.scoringEvidence.originalLineNumber,
              source: 'scoring_weight_table'
            }
          : null,
        manualChanges: record.manualChanges || []
      }
    };
  }

  _getCSVHeaders() {
    return [
      '实验记录ID',
      '主流程（来自边界值说明）',
      '现场说法（来自评分权重表）',
      '分子',
      '分母',
      '结果展示',
      '复核状态',
      '处理状态',
      '边界值说明行号',
      '评分权重表行号',
      '人工变更次数',
      '两边证据齐全',
      '需要复核',
      '严重程度',
      '复核人',
      '最后更新时间'
    ].join(',');
  }

  _getPageColumns() {
    return [
      { key: 'recordId', title: '实验ID', width: 100 },
      { key: 'mainProcess', title: '主流程', width: 150 },
      { key: 'sceneStatement', title: '现场说法', width: 150 },
      { key: 'numerator', title: '分子', width: 80 },
      { key: 'denominator', title: '分母', width: 80 },
      { key: 'displayValue', title: '计算结果', width: 150 },
      { key: 'reviewStatus', title: '复核状态', width: 100 },
      { key: 'severity', title: '状态', width: 100 },
      { key: 'boundaryLineNumber', title: '边界值行号', width: 100 },
      { key: 'scoringLineNumber', title: '评分表行号', width: 100 },
      { key: 'actions', title: '操作', width: 120 }
    ];
  }

  _getFilters() {
    return [
      { key: 'reviewStatus', label: '复核状态', options: ['pending', 'approved', 'rejected'] },
      { key: 'severity', label: '严重程度', options: ['normal', 'warning', 'needs_review'] },
      { key: 'hasBothEvidence', label: '证据齐全', options: [true, false] }
    ];
  }

  _calculateStatistics(records) {
    return {
      total: records.length,
      needsReview: records.filter((r) => {
        const eval_ = this.ruleEngine.evaluate(r);
        return eval_.reviewRequired;
      }).length,
      approved: records.filter((r) => r.reviewStatus === 'approved').length,
      withBothEvidence: records.filter((r) => r.boundaryEvidence && r.scoringEvidence).length
    };
  }

  exportCSVContent(records) {
    const { headers, rows } = this.formatForCSV(records);
    const csvRows = rows.map((row) =>
      Object.values(row).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    return [headers, ...csvRows].join('\n');
  }
}

module.exports = UnifiedResultExporter;
