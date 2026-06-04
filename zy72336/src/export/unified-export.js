const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const _ = require('lodash');

class UnifiedExporter {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  getConsolidatedData() {
    const unified = this.dataManager.getUnifiedResults();
    return {
      ...unified,
      exportTimestamp: new Date().toISOString(),
      exportVersion: '1.0.0'
    };
  }

  exportJSON(filePath) {
    const data = this.getConsolidatedData();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return { filePath, recordCount: data.summary.totalRecords };
  }

  exportDetailedCSV(filePath) {
    const unified = this.getConsolidatedData();
    const records = unified.rawRecords.map(r => ({
      ..._.omit(r, '_meta'),
      originalLineNumber: r._meta.originalLineNumber,
      sourceFile: r._meta.filePath,
      importTimestamp: r._meta.importTimestamp,
      status: r._meta.status,
      issueCount: r._meta.issues.length,
      issueTypes: r._meta.issues.map(i => i.type).join(';'),
      manualEditCount: r._meta.manualEdits.length
    }));

    const parser = new Parser();
    const csv = parser.parse(records);
    fs.writeFileSync(filePath, csv);
    
    return { filePath, recordCount: records.length };
  }

  exportBoundaryCasesCSV(filePath) {
    const unified = this.getConsolidatedData();
    const records = unified.boundaryCases.map(r => ({
      ..._.omit(r, '_meta'),
      originalLineNumber: r._meta.originalLineNumber,
      status: r._meta.status,
      issues: JSON.stringify(r._meta.issues),
      manualEdits: JSON.stringify(r._meta.manualEdits)
    }));

    const parser = new Parser();
    const csv = parser.parse(records);
    fs.writeFileSync(filePath, csv);
    
    return { filePath, recordCount: records.length };
  }

  exportManualCalculationAuditCSV(filePath) {
    const examples = this.dataManager.getManualCalculationExamples();
    const records = examples.map(ex => ({
      originalLineNumber: ex.originalLineNumber,
      currentStatus: ex.currentStatus,
      issueCount: ex.issues.length,
      issueDetails: ex.issues.map(i => `${i.field}: ${i.message}`).join(' | '),
      manualEditCount: ex.manualEdits.length,
      editDetails: ex.manualEdits.map(e => `${e.field}: ${e.oldValue} → ${e.newValue} (${e.reason})`).join(' | '),
      rawData: JSON.stringify(ex.rawData)
    }));

    const parser = new Parser();
    const csv = parser.parse(records);
    fs.writeFileSync(filePath, csv);
    
    return { filePath, recordCount: records.length };
  }

  exportPeakResultsCSV(filePath) {
    const unified = this.getConsolidatedData();
    if (!unified.calculationResults) {
      throw new Error('未找到计算结果，请先运行分析');
    }

    const peaks = unified.calculationResults.peaks.map((p, idx) => ({
      peakRank: idx + 1,
      position: p.position,
      density: p.density,
      relativeHeight: p.relativeHeight,
      isDominant: idx === 0 ? '是' : '否'
    }));

    const parser = new Parser();
    const csv = parser.parse(peaks);
    fs.writeFileSync(filePath, csv);
    
    return { filePath, recordCount: peaks.length };
  }

  exportAll(exportDir) {
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const results = {};

    results.detailed = this.exportDetailedCSV(
      path.join(exportDir, `detailed-records-${timestamp}.csv`)
    );

    results.boundary = this.exportBoundaryCasesCSV(
      path.join(exportDir, `boundary-cases-${timestamp}.csv`)
    );

    results.audit = this.exportManualCalculationAuditCSV(
      path.join(exportDir, `manual-calculation-audit-${timestamp}.csv`)
    );

    if (this.dataManager.calculationResults) {
      results.peaks = this.exportPeakResultsCSV(
        path.join(exportDir, `peak-results-${timestamp}.csv`)
      );
    }

    results.json = this.exportJSON(
      path.join(exportDir, `full-export-${timestamp}.json`)
    );

    return results;
  }

  verifyExportConsistency() {
    const unified = this.getConsolidatedData();
    const issues = [];

    const rawCount = unified.rawRecords.length;
    const boundaryCount = unified.boundaryCases.length;
    const negativeCount = unified.negativeSamples.length;

    const countedBoundaryInRaw = unified.rawRecords.filter(
      r => r._meta.status === 'pending_review' || r._meta.status === 'boundary_case'
    ).length;

    if (countedBoundaryInRaw !== boundaryCount) {
      issues.push({
        type: 'count_mismatch',
        message: `边界案例数量不一致: rawRecords统计=${countedBoundaryInRaw}, boundaryCases=${boundaryCount}`
      });
    }

    const countedNegativeInRaw = unified.rawRecords.filter(r =>
      r._meta.issues.some(i => i.type === 'negative_value')
    ).length;

    if (countedNegativeInRaw !== negativeCount) {
      issues.push({
        type: 'count_mismatch',
        message: `负数样本数量不一致: rawRecords统计=${countedNegativeInRaw}, negativeSamples=${negativeCount}`
      });
    }

    const manualExamples = unified.manualCalculationExamples.length;
    const countedExamplesInRaw = unified.rawRecords.filter(r =>
      r._meta.manualEdits.length > 0 ||
      r._meta.status === 'manual_confirmed' ||
      r._meta.issues.length > 0
    ).length;

    if (manualExamples !== countedExamplesInRaw) {
      issues.push({
        type: 'count_mismatch',
        message: `手算反例数量不一致: getManualCalculationExamples=${manualExamples}, raw统计=${countedExamplesInRaw}`
      });
    }

    return {
      consistent: issues.length === 0,
      issues,
      summary: {
        totalRecords: rawCount,
        boundaryCases: boundaryCount,
        negativeSamples: negativeCount,
        manualExamples
      }
    };
  }

  getAPIResponse() {
    const unified = this.getConsolidatedData();
    const consistency = this.verifyExportConsistency();
    
    return {
      success: true,
      data: {
        summary: unified.summary,
        calculationResults: unified.calculationResults,
        boundaryCasesPreview: unified.boundaryCases.slice(0, 10).map(r => ({
          originalLineNumber: r._meta.originalLineNumber,
          status: r._meta.status,
          issues: r._meta.issues
        })),
        manualCalculationExamples: unified.manualCalculationExamples.slice(0, 10),
        consistencyCheck: consistency
      },
      metadata: {
        exportTimestamp: unified.exportTimestamp,
        exportVersion: unified.exportVersion,
        hasMore: {
          boundaryCases: unified.boundaryCases.length > 10,
          manualExamples: unified.manualCalculationExamples.length > 10
        }
      }
    };
  }

  getPageDisplayData() {
    const unified = this.getConsolidatedData();
    const consistency = this.verifyExportConsistency();

    return {
      header: {
        title: '核密度客流峰值分析',
        lastUpdated: unified.exportTimestamp,
        alerts: consistency.issues
      },
      overview: {
        totalRecords: unified.summary.totalRecords,
        peakCount: unified.calculationResults?.peaks?.length || 0,
        boundaryCaseCount: unified.summary.boundaryCaseCount,
        pendingReviewCount: unified.rawRecords.filter(
          r => r._meta.status === 'pending_review'
        ).length
      },
      peaks: unified.calculationResults?.peaks?.map((p, idx) => ({
        rank: idx + 1,
        position: p.position.toFixed(2),
        density: p.density.toFixed(4),
        isDominant: idx === 0
      })) || [],
      boundaryCases: unified.boundaryCases.map(r => ({
        originalLineNumber: r._meta.originalLineNumber,
        status: r._meta.status,
        statusText: this.getStatusText(r._meta.status),
        issues: r._meta.issues.map(i => i.message),
        hasManualEdits: r._meta.manualEdits.length > 0
      })),
      auditTrail: unified.manualEdits.slice(0, 20).map(e => ({
        originalLineNumber: e.originalLineNumber,
        field: e.field,
        change: `${e.oldValue} → ${e.newValue}`,
        reason: e.reason,
        operator: e.operator,
        timestamp: e.timestamp
      }))
    };
  }

  getStatusText(status) {
    const statusMap = {
      'pending_review': '待人工复核',
      'manual_confirmed': '人工已确认',
      'auto_processed': '自动处理',
      'excluded': '已排除',
      'boundary_case': '边界案例'
    };
    return statusMap[status] || status;
  }
}

module.exports = UnifiedExporter;
