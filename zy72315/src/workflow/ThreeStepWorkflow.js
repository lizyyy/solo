const UnifiedEvidenceStore = require('../models/UnifiedEvidenceStore');
const BoundaryRuleEngine = require('../engine/BoundaryRuleEngine');

class ThreeStepWorkflow {
  constructor() {
    this.store = new UnifiedEvidenceStore();
    this.ruleEngine = new BoundaryRuleEngine();
    this.currentStep = 0;
    this.workflowSteps = [
      { id: 1, name: '边界值说明第一次导入', completed: false },
      { id: 2, name: '运营规划阿岚补看评分权重表', completed: false },
      { id: 3, name: '课堂演示结果更新', completed: false }
    ];
  }

  async executeStep1(boundaryDataList, operator = 'import_operator') {
    console.log(`\n========== 执行步骤1: 边界值说明第一次导入 ==========`);
    
    boundaryDataList.forEach((data, index) => {
      const recordId = `EXP-${String(index + 1).padStart(3, '0')}`;
      this.store.addBoundaryRecord(recordId, {
        ...data,
        lineNumber: data.lineNumber || (index + 2),
        operator,
        rawData: data.rawData || data
      });
      console.log(`  ✓ 导入记录 ${recordId}: 行号 ${data.lineNumber || (index + 2)}`);
    });

    this.workflowSteps[0].completed = true;
    this.currentStep = 1;

    const needsReview = this.store.getRecordsForReview();
    console.log(`\n  步骤1完成！共导入 ${boundaryDataList.length} 条记录`);
    console.log(`  其中 ${needsReview.length} 条需要数据复核人复核`);
    
    needsReview.forEach(record => {
      const evaluation = this.ruleEngine.evaluate(record);
      console.log(`    - ${record.recordId}: ${evaluation.displayValue}`);
    });

    return {
      step: 1,
      success: true,
      recordCount: boundaryDataList.length,
      needsReviewCount: needsReview.length,
      records: this.store.getAllRecords()
    };
  }

  async executeStep2(scoringDataList, operator = '阿岚') {
    if (!this.workflowSteps[0].completed) {
      throw new Error('请先完成步骤1：边界值说明第一次导入');
    }

    console.log(`\n========== 执行步骤2: 运营规划阿岚补看评分权重表 ==========`);
    
    scoringDataList.forEach((data, index) => {
      const recordId = data.recordId || `EXP-${String(index + 1).padStart(3, '0')}`;
      try {
        this.store.addScoringRecord(recordId, {
          ...data,
          lineNumber: data.lineNumber || (index + 2),
          operator,
          rawData: data.rawData || data
        });
        console.log(`  ✓ 补充评分数据 ${recordId}: 现场说法权重: ${data.sceneStatement || 'N/A'}`);
      } catch (e) {
        console.log(`  ✗ ${recordId}: ${e.message}`);
      }
    });

    this.workflowSteps[1].completed = true;
    this.currentStep = 2;

    const unifiedCount = this.store.getAllRecords().filter(r => r.boundaryEvidence && r.scoringEvidence).length;
    console.log(`\n  步骤2完成！共补充 ${scoringDataList.length} 条评分数据`);
    console.log(`  已有 ${unifiedCount} 条记录包含两边证据`);

    return {
      step: 2,
      success: true,
      scoringCount: scoringDataList.length,
      unifiedCount,
      records: this.store.getAllRecords()
    };
  }

  async executeStep3(updates = [], operator = 'classroom_demo') {
    if (!this.workflowSteps[1].completed) {
      throw new Error('请先完成步骤2：运营规划阿岚补看评分权重表');
    }

    console.log(`\n========== 执行步骤3: 课堂演示结果更新 ==========`);

    updates.forEach(update => {
      const record = this.store.getRecord(update.recordId);
      if (!record) {
        console.log(`  ✗ 记录 ${update.recordId} 不存在，跳过`);
        return;
      }

      if (update.reviewStatus) {
        this.store.updateReviewStatus(
          update.recordId,
          update.reviewStatus.status,
          update.reviewStatus.reviewer,
          update.reviewStatus.comment
        );
        console.log(`  ✓ ${update.recordId}: 复核状态 → ${update.reviewStatus.status}`);
      }

      if (update.manualChange) {
        this.store.applyManualChange(
          update.recordId,
          update.manualChange.field,
          update.manualChange.oldValue,
          update.manualChange.newValue,
          operator,
          update.manualChange.reason
        );
        console.log(`  ✓ ${update.recordId}: 人工变更已记录`);
      }
    });

    this.workflowSteps[2].completed = true;
    this.currentStep = 3;

    console.log(`\n  步骤3完成！课堂演示结果已更新`);

    return {
      step: 3,
      success: true,
      updateCount: updates.length,
      records: this.store.getAllRecords()
    };
  }

  getWorkflowStatus() {
    return {
      currentStep: this.currentStep,
      steps: this.workflowSteps.map(s => ({ ...s })),
      allCompleted: this.workflowSteps.every(s => s.completed)
    };
  }

  getUnifiedResults(format = 'json') {
    const records = this.store.exportUnifiedResults();
    
    return records.map(record => {
      const evaluation = this.ruleEngine.evaluate(record);
      
      return {
        ...record,
        evaluation,
        displayValue: evaluation.displayValue,
        reviewRequired: evaluation.reviewRequired,
        severity: evaluation.severity,
        evidenceSummary: {
          hasBoundary: !!record.boundaryEvidence,
          hasScoring: !!record.scoringEvidence,
          boundaryLine: record.boundaryEvidence?.originalLineNumber,
          scoringLine: record.scoringEvidence?.originalLineNumber,
          sceneStatement: record.scoringEvidence?.rawData?.sceneStatement || 'N/A',
          mainProcess: record.boundaryEvidence?.rawData?.mainProcess || 'N/A'
        }
      };
    });
  }

  exportDetails() {
    return this.getUnifiedResults();
  }

  getPageDisplayData() {
    return {
      workflow: this.getWorkflowStatus(),
      records: this.getUnifiedResults(),
      summary: {
        total: this.store.getAllRecords().length,
        needsReview: this.store.getRecordsForReview().length,
        withBothEvidence: this.store.getAllRecords().filter(r => r.boundaryEvidence && r.scoringEvidence).length,
        reviewed: this.store.getAllRecords().filter(r => r.reviewStatus === 'approved' || r.reviewStatus === 'rejected').length
      }
    };
  }

  getApiResponse() {
    return this.getPageDisplayData();
  }

  rollbackManualChange(recordId, changeIndex) {
    return this.store.rollbackChange(recordId, changeIndex);
  }

  getAuditTrail(recordId) {
    const record = this.store.getRecord(recordId);
    return record ? record.auditTrail : null;
  }

  getRuleExplanations() {
    return this.ruleEngine.getAllRules().map(rule => ({
      ...rule,
      explanation: this.ruleEngine.explainRule(rule.id)
    }));
  }
}

module.exports = ThreeStepWorkflow;
