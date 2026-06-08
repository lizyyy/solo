const UnifiedEvidenceStore = require('../models/UnifiedEvidenceStore');
const BoundaryRuleEngine = require('../engine/BoundaryRuleEngine');
const UnifiedResultExporter = require('../output/UnifiedResultExporter');

class ThreeStepWorkflow {
  constructor() {
    this.store = new UnifiedEvidenceStore();
    this.ruleEngine = new BoundaryRuleEngine();
    this.exporter = new UnifiedResultExporter();
    this.currentStep = 0;
    this.workflowSteps = [
      { id: 1, name: '边界值说明第一次导入', completed: false },
      { id: 2, name: '运营规划阿岚补看评分权重表', completed: false },
      { id: 3, name: '课堂演示结果更新（含复核/改动/回滚）', completed: false }
    ];
  }

  async executeStep1(boundaryDataList, operator = 'import_operator') {
    console.log(`\n========== 步骤1: 边界值说明第一次导入 ==========`);

    boundaryDataList.forEach((data, index) => {
      const recordId = `EXP-${String(index + 1).padStart(3, '0')}`;
      this.store.addBoundaryRecord(recordId, {
        ...data,
        lineNumber: data.lineNumber || (index + 2),
        operator,
        rawData: data.rawData || data
      });
      const rec = this.store.getRecord(recordId);
      const eval_ = this.ruleEngine.evaluate(rec);
      const tag = eval_.reviewRequired ? ' ⚠需复核' : '';
      console.log(`  ✓ ${recordId} 行号${rec.boundaryEvidence.originalLineNumber} | ${eval_.displayValue}${tag}`);
    });

    this.workflowSteps[0].completed = true;
    this.currentStep = 1;

    const needsReview = this.store.getRecordsForReview();
    console.log(`\n  步骤1完成！共导入 ${boundaryDataList.length} 条，其中 ${needsReview.length} 条需复核`);
    return { step: 1, success: true, needsReviewCount: needsReview.length };
  }

  async executeStep2(scoringDataList, operator = '阿岚') {
    if (!this.workflowSteps[0].completed) throw new Error('请先完成步骤1');
    console.log(`\n========== 步骤2: 运营规划阿岚补看评分权重表 ==========`);

    scoringDataList.forEach((data) => {
      const recordId = data.recordId;
      try {
        this.store.addScoringRecord(recordId, {
          ...data,
          operator,
          rawData: data.rawData || data
        });
        const rec = this.store.getRecord(recordId);
        console.log(`  ✓ ${recordId} | 现场说法:${rec.scoringEvidence.rawData.sceneStatement || 'N/A'} 权重:${rec.scoringEvidence.rawData.weight || 'N/A'}`);
      } catch (e) {
        console.log(`  ✗ ${recordId}: ${e.message}`);
      }
    });

    this.workflowSteps[1].completed = true;
    this.currentStep = 2;
    const unified = this.store.getAllRecords().filter(r => r.boundaryEvidence && r.scoringEvidence).length;
    console.log(`\n  步骤2完成！共补 ${scoringDataList.length} 条，已齐证据 ${unified} 条`);
    return { step: 2, success: true, unifiedCount: unified };
  }

  applyManualFix(recordId, payload, operator) {
    const { field, oldValue, newValue, reason, nextHandler } = payload;
    const before = this._getCurrentSnapshot(recordId);
    const result = this.store.applyManualChange(
      recordId, field, oldValue, newValue, operator, reason, nextHandler
    );
    const after = this._getCurrentSnapshot(recordId);
    console.log(`  🔧 人工改动 ${recordId}`);
    console.log(`     字段: ${field}`);
    console.log(`     ${JSON.stringify(before.displayValue)} → ${JSON.stringify(after.displayValue)}`);
    console.log(`     原因: ${reason}`);
    if (nextHandler) console.log(`     下一步: ${nextHandler}`);
    return {
      changeIndex: result.changeIndex,
      before,
      after,
      valuesChanged: before.displayValue !== after.displayValue
    };
  }

  rollbackManualFix(recordId, changeIndex, operator = 'system') {
    const before = this._getCurrentSnapshot(recordId);
    const { change, record } = this.store.rollbackChange(recordId, changeIndex, operator);
    const after = this._getCurrentSnapshot(recordId);
    console.log(`  ↩️  回滚 ${recordId} 变更#${changeIndex}`);
    console.log(`     字段: ${change.field}`);
    console.log(`     ${JSON.stringify(before.displayValue)} → ${JSON.stringify(after.displayValue)}`);
    console.log(`     值: ${JSON.stringify(change.newValue)} → ${JSON.stringify(change.oldValue)}`);
    return { change, before, after, valuesRestored: before.displayValue !== after.displayValue };
  }

  updateReview(recordId, status, reviewer, comment = '', nextHandler = null) {
    const record = this.store.updateReviewStatus(recordId, status, reviewer, comment, nextHandler);
    const eval_ = this.ruleEngine.evaluate(record);
    console.log(`  ✅ 复核 ${recordId} → ${status}`);
    console.log(`     复核人: ${reviewer}`);
    console.log(`     备注: ${comment}`);
    if (nextHandler) console.log(`     移交: ${nextHandler}`);
    console.log(`     结果值: ${eval_.displayValue}`);
    return { record, evaluation: eval_ };
  }

  async executeStep3(operations = [], operator = 'classroom_demo') {
    if (!this.workflowSteps[1].completed) throw new Error('请先完成步骤2');
    console.log(`\n========== 步骤3: 课堂演示结果更新 ==========`);
    console.log(`  本次操作 ${operations.length} 项...\n`);

    const results = [];
    operations.forEach((op, idx) => {
      console.log(`  ── 操作 ${idx + 1} / ${operations.length} ──`);
      if (op.type === 'manual_fix') {
        results.push({ type: op.type, result: this.applyManualFix(op.recordId, op.payload, op.operator || operator) });
      } else if (op.type === 'rollback') {
        results.push({ type: op.type, result: this.rollbackManualFix(op.recordId, op.changeIndex, op.operator || operator) });
      } else if (op.type === 'review') {
        results.push({
          type: op.type,
          result: this.updateReview(op.recordId, op.status, op.reviewer, op.comment || '', op.nextHandler || null)
        });
      } else {
        console.log(`  ⚠ 未知操作类型: ${op.type}`);
      }
      console.log();
    });

    this.workflowSteps[2].completed = true;
    this.currentStep = 3;
    console.log(`  步骤3完成！\n`);
    return { step: 3, success: true, operations: results };
  }

  _getCurrentSnapshot(recordId) {
    const record = this.store.getRecord(recordId);
    if (!record) return null;
    const eval_ = this.ruleEngine.evaluate(record);
    return {
      denominator: record.boundaryEvidence?.rawData?.denominator,
      numerator: record.boundaryEvidence?.rawData?.numerator,
      displayValue: eval_.displayValue,
      ruleId: eval_.ruleId,
      reviewRequired: eval_.reviewRequired
    };
  }

  getWorkflowStatus() {
    return {
      currentStep: this.currentStep,
      steps: this.workflowSteps.map(s => ({ ...s })),
      allCompleted: this.workflowSteps.every(s => s.completed)
    };
  }

  getUnifiedRecords() {
    return this.store.exportUnifiedResults();
  }

  getRecordDetail(recordId) {
    const record = this.store.getRecord(recordId);
    if (!record) return null;
    return this.exporter.formatForPageDetail(this._wrapForExport(record));
  }

  _wrapForExport(record) {
    return {
      ...record,
      _meta: {
        hasBothEvidence: !!(record.boundaryEvidence && record.scoringEvidence),
        needsReview: (() => {
          if (!record.boundaryEvidence) return false;
          const raw = record.boundaryEvidence.rawData || {};
          return raw.denominator === '' || raw.denominator === 0;
        })(),
        changeCount: record.manualChanges?.length || 0,
        hasPendingRollbacks: (record.manualChanges || []).some(c => c.canRollback),
        originalBoundaryValues: record.boundaryEvidence ? record.boundaryEvidence.originalRawData : null
      }
    };
  }

  export_ListCSV() { return this.exporter.exportCSVContent(this.getUnifiedRecords()); }
  export_ListPage() { return this.exporter.formatForPageList(this.getUnifiedRecords()); }
  export_ListAPI() { return this.exporter.formatForAPI(this.getUnifiedRecords()); }
  export_DetailPage(recordId) { return this.getRecordDetail(recordId); }
  export_DetailAPI(recordId) {
    const record = this.store.getRecord(recordId);
    if (!record) return { code: 404, message: 'not found' };
    return this.exporter.formatForAPI_Detail(this._wrapForExport(record));
  }
  export_Summary(format = 'text') { return this.exporter.exportSummaryReport(this.getUnifiedRecords(), format); }

  getFullTraceability(recordId) { return this.store.getFullTraceability(recordId); }
  getAuditTrail(recordId) {
    const r = this.store.getRecord(recordId);
    return r ? r.auditTrail : null;
  }
  getRuleExplanations() {
    return this.ruleEngine.getAllRules().map(r => ({
      ...r, explanation: this.ruleEngine.explainRule(r.id)
    }));
  }

  crossValidateOutputs(recordId) {
    const list = this.getUnifiedRecords().filter(r => r.recordId === recordId)[0];
    if (!list) return null;
    const csv = this.exporter.formatForCSV([list]).rows[0];
    const page = this.exporter.formatForPageList([list]).data[0];
    const api = this.exporter.formatForAPI([list]).data.records[0].attributes;

    const fields = ['displayValue', 'denominator', 'numerator', 'reviewStatus', 'severity', 'nextHandler'];
    const diffs = [];
    fields.forEach(f => {
      const values = {
        csv: csv[f],
        page: page[f],
        api: api[f],
        list: list._meta ? (f === 'displayValue' ? list.evaluation?.displayValue : list.boundaryEvidence?.rawData?.[f]) : undefined
      };
      const unique = [...new Set(fields.includes(f) ? [
        String(values.csv), String(values.page), String(values.api)
      ] : [])];
      if (unique.length > 1) diffs.push({ field: f, values });
    });

    const listEval = this.ruleEngine.evaluate(list);
    const eval_consistent = listEval.displayValue === csv.displayValue
      && listEval.displayValue === page.displayValue
      && listEval.displayValue === api.displayValue;

    return { recordId, eval_consistent, diffs, checkValues: { list: listEval.displayValue, csv: csv.displayValue, page: page.displayValue, api: api.displayValue } };
  }
}

module.exports = ThreeStepWorkflow;
