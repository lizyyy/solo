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

  formatForPageList(records) {
    return {
      columns: this._getPageListColumns(),
      data: records.map((record) => this._formatPageListRecord(record)),
      filters: this._getFilters(),
      statistics: this._calculateStatistics(records)
    };
  }

  formatForPageDetail(record) {
    const evaluation = this.ruleEngine.evaluate(record);
    return {
      basic: this._formatRecord(record),
      evaluation,
      traceability: {
        originalValues: record._meta?.originalBoundaryValues || null,
        currentValues: record.boundaryEvidence?.rawData || null,
        valueDiff: this._buildValueDiff(record),
        manualChanges: record.manualChanges || [],
        reviewHistory: record.reviewTimeline || [],
        auditTrail: record.auditTrail || [],
        handlers: this._buildHandlerChain(record)
      },
      rollbackOptions: (record.manualChanges || [])
        .map((c, i) => ({ index: i, canRollback: c.canRollback, summary: `${c.field}: ${c.oldValue} → ${c.newValue}` }))
        .filter(o => o.canRollback)
    };
  }

  formatForPageDisplay(records) {
    return {
      ...this.formatForPageList(records),
      detailSample: records.length > 0 ? this.formatForPageDetail(records[0]) : null
    };
  }

  formatForAPI(records) {
    return {
      code: 0,
      message: 'success',
      data: {
        records: records.map((record) => this._formatAPIRecord(record)),
        pagination: { total: records.length },
        statistics: this._calculateStatistics(records)
      },
      timestamp: new Date().toISOString()
    };
  }

  formatForAPI_Detail(record) {
    return {
      code: 0,
      message: 'success',
      data: this.formatForPageDetail(record),
      timestamp: new Date().toISOString()
    };
  }

  formatForSummaryReport(records) {
    const stats = this._calculateStatistics(records);
    const detailRecords = records.map((r) => {
      const eval_ = this.ruleEngine.evaluate(r);
      return {
        id: r.recordId,
        mainProcess: r.boundaryEvidence?.rawData?.mainProcess || '',
        sceneStatement: r.scoringEvidence?.rawData?.sceneStatement || '',
        originalDenominator: r._meta?.originalBoundaryValues?.denominator,
        currentDenominator: r.boundaryEvidence?.rawData?.denominator,
        wasModified: r.manualChanges && r.manualChanges.length > 0,
        result: eval_.displayValue,
        resultSeverity: eval_.severity,
        reviewStatus: r.reviewStatus,
        nextHandler: r.nextHandler,
        changeCount: r.manualChanges?.length || 0
      };
    });
    return {
      generatedAt: new Date().toISOString(),
      statistics: stats,
      records: detailRecords,
      attentionItems: detailRecords.filter(r =>
        r.wasModified || r.resultSeverity === 'needs_review' || r.nextHandler
      )
    };
  }

  _formatRecord(record) {
    const evaluation = this.ruleEngine.evaluate(record);
    const orig = record._meta?.originalBoundaryValues || {};
    const curr = record.boundaryEvidence?.rawData || {};
    const hasChange = record.manualChanges && record.manualChanges.length > 0;

    return {
      recordId: record.recordId,
      mainProcess: curr.mainProcess || '',
      sceneStatement: record.scoringEvidence?.rawData?.sceneStatement || '',
      numerator: curr.numerator ?? '',
      numerator_original: orig.numerator ?? '',
      numerator_changed: hasChange && orig.numerator !== curr.numerator,
      denominator: curr.denominator ?? '',
      denominator_original: orig.denominator ?? '',
      denominator_changed: hasChange && orig.denominator !== curr.denominator,
      displayValue: evaluation.displayValue,
      evaluationRule: evaluation.ruleId,
      evaluationRuleDesc: evaluation.ruleDescription,
      reviewStatus: record.reviewStatus,
      reviewer: record.reviewer || '',
      reviewComment: record.reviewComment || '',
      currentStatus: record.currentStatus,
      boundaryLineNumber: record.boundaryEvidence?.originalLineNumber || '',
      scoringLineNumber: record.scoringEvidence?.originalLineNumber || '',
      manualChangeCount: record.manualChanges?.length || 0,
      hasRollbackPending: (record.manualChanges || []).some(c => c.canRollback),
      hasBothEvidence: !!(record.boundaryEvidence && record.scoringEvidence),
      reviewRequired: evaluation.reviewRequired ? '是' : '否',
      severity: evaluation.severity,
      nextHandler: record.nextHandler || '',
      lastModifiedAt: record.lastModifiedAt || record.boundaryEvidence?.importTimestamp || '',
      lastModifiedBy: record.lastModifiedBy || ''
    };
  }

  _formatPageListRecord(record) {
    const base = this._formatRecord(record);
    const evaluation = this.ruleEngine.evaluate(record);
    return {
      ...base,
      display: {
        showAlert: evaluation.severity === 'needs_review' || base.hasRollbackPending,
        alertType: evaluation.severity === 'needs_review' ? 'warning'
          : base.hasRollbackPending ? 'info' : evaluation.severity,
        showChangeBadge: base.denominator_changed || base.numerator_changed,
        changeBadgeText: base.denominator_changed
          ? `分母: ${JSON.stringify(base.denominator_original)}→${JSON.stringify(base.denominator)}`
          : (base.numerator_changed ? `分子有修改` : '数据已修改'),
        canEdit: record.reviewStatus !== 'approved',
        canRollback: base.hasRollbackPending,
        hasTraceability: true,
        pendingHandler: base.nextHandler
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
      traceability: {
        originalValues: record._meta?.originalBoundaryValues || null,
        currentValues: record.boundaryEvidence?.rawData || null,
        diff: this._buildValueDiff(record),
        manualChanges: record.manualChanges || [],
        reviewHistory: record.reviewTimeline || [],
        nextHandler: record.nextHandler || null
      },
      relationships: {
        boundaryEvidence: record.boundaryEvidence ? {
          id: record.boundaryEvidence.originalLineNumber,
          source: 'boundary_value_spec',
          importedAt: record.boundaryEvidence.importTimestamp
        } : null,
        scoringEvidence: record.scoringEvidence ? {
          id: record.scoringEvidence.originalLineNumber,
          source: 'scoring_weight_table',
          importedAt: record.scoringEvidence.importTimestamp
        } : null
      },
      _links: {
        detail: `/api/records/${record.recordId}`,
        traceability: `/api/records/${record.recordId}/trace`,
        audit: `/api/records/${record.recordId}/audit`
      }
    };
  }

  _buildValueDiff(record) {
    const orig = record._meta?.originalBoundaryValues || {};
    const curr = record.boundaryEvidence?.rawData || {};
    const diff = [];
    ['numerator', 'denominator', 'mainProcess'].forEach(f => {
      if (JSON.stringify(orig[f]) !== JSON.stringify(curr[f])) {
        diff.push({ field: f, original: orig[f], current: curr[f] });
      }
    });
    return diff;
  }

  _buildHandlerChain(record) {
    const chain = [];
    record.auditTrail?.forEach(e => {
      if (e.action === 'handover_assigned' || e.action === 'review_status_updated') {
        chain.push({
          action: e.action,
          operator: e.operator,
          note: e.note,
          timestamp: e.timestamp
        });
      }
    });
    (record.manualChanges || []).forEach(c => {
      if (c.nextHandler) {
        chain.push({
          action: 'manual_handover',
          operator: c.operator,
          nextHandler: c.nextHandler,
          reason: c.reason,
          timestamp: c.timestamp
        });
      }
    });
    return chain.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  _getCSVHeaders() {
    return [
      '实验记录ID',
      '主流程（边界值说明）',
      '现场说法（评分权重表）',
      '分子',
      '分子(原始值)',
      '分子是否改动',
      '分母',
      '分母(原始值)',
      '分母是否改动',
      '结果展示',
      '判定规则',
      '规则说明',
      '复核状态',
      '复核人',
      '复核备注',
      '处理状态',
      '边界值说明行号',
      '评分权重表行号',
      '人工变更次数',
      '有待回滚变更',
      '两边证据齐全',
      '需要复核',
      '严重程度',
      '下一步处理人',
      '最后修改时间',
      '最后修改人'
    ].join(',');
  }

  _getPageListColumns() {
    return [
      { key: 'recordId', title: '实验ID', width: 90 },
      { key: 'mainProcess', title: '主流程', width: 130 },
      { key: 'sceneStatement', title: '现场说法', width: 130 },
      { key: 'displayValue', title: '计算结果', width: 140 },
      { key: 'severity', title: '状态', width: 90 },
      { key: 'denominator_original', title: '原分母', width: 80 },
      { key: 'denominator', title: '当前分母', width: 90 },
      { key: 'denominator_changed', title: '有改动', width: 70 },
      { key: 'reviewStatus', title: '复核', width: 80 },
      { key: 'nextHandler', title: '下一步', width: 100 },
      { key: 'manualChangeCount', title: '变更数', width: 70 },
      { key: 'hasRollbackPending', title: '待回滚', width: 80 },
      { key: 'boundaryLineNumber', title: '边界行号', width: 80 },
      { key: 'scoringLineNumber', title: '评分行号', width: 80 },
      { key: 'actions', title: '操作', width: 140 }
    ];
  }

  _getFilters() {
    return [
      { key: 'reviewStatus', label: '复核状态', options: ['pending', 'approved', 'rejected', 'needs_fix'] },
      { key: 'severity', label: '严重程度', options: ['normal', 'warning', 'needs_review'] },
      { key: 'denominator_changed', label: '数据已改动', options: [true, false] },
      { key: 'hasRollbackPending', label: '有待回滚', options: [true, false] },
      { key: 'hasBothEvidence', label: '证据齐全', options: [true, false] },
      { key: 'nextHandler', label: '有指定处理人', options: ['非空', '空'] }
    ];
  }

  _calculateStatistics(records) {
    const eval_ = r => this.ruleEngine.evaluate(r);
    return {
      total: records.length,
      needsReview: records.filter(r => eval_(r).reviewRequired).length,
      approved: records.filter(r => r.reviewStatus === 'approved').length,
      withBothEvidence: records.filter(r => r.boundaryEvidence && r.scoringEvidence).length,
      modified: records.filter(r => (r.manualChanges || []).length > 0).length,
      withRollbackPending: records.filter(r =>
        (r.manualChanges || []).some(c => c.canRollback)
      ).length,
      withHandler: records.filter(r => r.nextHandler).length
    };
  }

  exportCSVContent(records) {
    const { headers, rows } = this.formatForCSV(records);
    const csvRows = rows.map((row) =>
      Object.values(row).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    return [headers, ...csvRows].join('\n');
  }

  exportSummaryReport(records, format = 'text') {
    const report = this.formatForSummaryReport(records);
    if (format === 'json') return JSON.stringify(report, null, 2);

    const lines = [];
    lines.push('═'.repeat(70));
    lines.push('A/B 实验提前停止判断 - 汇总报告');
    lines.push(`生成时间: ${report.generatedAt}`);
    lines.push('═'.repeat(70));
    lines.push('');
    lines.push('【统计概览】');
    lines.push(`  总记录数:      ${report.statistics.total}`);
    lines.push(`  证据齐全:      ${report.statistics.withBothEvidence}`);
    lines.push(`  需复核:        ${report.statistics.needsReview}`);
    lines.push(`  已复核通过:    ${report.statistics.approved}`);
    lines.push(`  数据已改动:    ${report.statistics.modified}`);
    lines.push(`  待回滚:        ${report.statistics.withRollbackPending}`);
    lines.push(`  指定处理人:    ${report.statistics.withHandler}`);
    lines.push('');
    lines.push('【需关注记录】');
    if (report.attentionItems.length === 0) {
      lines.push('  (无)');
    } else {
      report.attentionItems.forEach((r, i) => {
        lines.push(`  ${i + 1}. ${r.id} - ${r.mainProcess}`);
        lines.push(`     现场说法: ${r.sceneStatement}`);
        lines.push(`     原始分母: ${JSON.stringify(r.originalDenominator)}, 当前分母: ${JSON.stringify(r.currentDenominator)}`);
        lines.push(`     结果: ${r.result} (${r.resultSeverity})`);
        if (r.wasModified) lines.push(`     ⚠ 已改动，变更次数: ${r.changeCount}`);
        if (r.nextHandler) lines.push(`     下一步处理人: ${r.nextHandler}`);
        lines.push('');
      });
    }
    return lines.join('\n');
  }
}

module.exports = UnifiedResultExporter;
