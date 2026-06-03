const { ValuationAnomaly, SOURCE_TYPE, STATUS } = require('../models/ValuationAnomaly');

class WorkflowService {
  constructor(dataStore, selfCheckService) {
    this.dataStore = dataStore;
    this.selfCheckService = selfCheckService;
  }

  async step1_importEmail(emailData, operator) {
    const anomaly = new ValuationAnomaly({
      ...emailData,
      source: {
        type: SOURCE_TYPE.EMAIL,
        ...emailData,
        importedBy: operator
      }
    });

    this.dataStore.add(anomaly);

    await this.selfCheckService.runAllChecks(anomaly.id);

    return {
      anomaly: anomaly.toJSON(),
      workflowStep: 1,
      nextStep: 'step2_importBatch',
      message: '客户经理补充邮件导入成功，请支付平台产品阿南补看清算批次号'
    };
  }

  async step2_importBatch(anomalyId, batchData, operator) {
    const anomaly = this.dataStore.getById(anomalyId);
    if (!anomaly) {
      throw new Error('异常记录不存在');
    }

    if (anomaly.workflowStep !== 1) {
      throw new Error(`当前流程步骤为 ${anomaly.workflowStep}，不能执行步骤2`);
    }

    const addResult = anomaly.addSource({
      type: SOURCE_TYPE.BATCH,
      ...batchData,
      importedBy: operator
    });

    if (addResult.duplicate) {
      return {
        duplicate: true,
        message: '该批次号已存在，请确认是否重复导入'
      };
    }

    const conflicts = anomaly.checkConflicts();
    anomaly.advanceWorkflow({ batchNo: batchData.batchNo, conflicts }, operator);

    await this.selfCheckService.runAllChecks(anomalyId);

    this.dataStore.update(anomaly);

    if (conflicts.length > 0) {
      return {
        anomaly: anomaly.toJSON(),
        workflowStep: 2,
        hasConflicts: true,
        conflicts: conflicts.map(c => ({
          type: c.type,
          description: c.description,
          emailValue: c.emailValue,
          batchValue: c.batchValue,
          actionRequired: '请支付平台产品阿南选择确认或驳回，不要自动拍板'
        })),
        message: '清算批次号导入完成，检测到邮件与批次数据存在冲突，请人工确认',
        nextStep: 'resolve_conflicts'
      };
    }

    return {
      anomaly: anomaly.toJSON(),
      workflowStep: 2,
      hasConflicts: false,
      nextStep: 'step3_generateSummary',
      message: '清算批次号导入完成，未发现冲突，可继续生成摘要'
    };
  }

  async resolveConflict(anomalyId, conflictType, resolution, operator) {
    const anomaly = this.dataStore.getById(anomalyId);
    if (!anomaly) {
      throw new Error('异常记录不存在');
    }

    const conflict = anomaly.conflicts.find(c => c.type === conflictType);
    if (!conflict) {
      throw new Error('冲突类型不存在');
    }

    anomaly.resolveConflict(conflictType, resolution, operator);

    await this.selfCheckService.runAllChecks(anomalyId);

    this.dataStore.update(anomaly);

    const unresolvedConflicts = anomaly.conflicts.filter(c => !c.resolution);

    if (unresolvedConflicts.length === 0) {
      return {
        anomaly: anomaly.toJSON(),
        allConflictsResolved: true,
        nextStep: 'step3_generateSummary',
        message: anomaly.isZeroWithReversal 
          ? '冲突已解决，但该记录金额为0且备注已冲正，请风控同事复核后再确定最终状态' 
          : '所有冲突已解决，可继续生成负责人摘要'
      };
    }

    return {
      anomaly: anomaly.toJSON(),
      allConflictsResolved: false,
      remainingConflicts: unresolvedConflicts.length,
      message: `当前冲突已解决，还剩 ${unresolvedConflicts.length} 个冲突待处理`
    };
  }

  async step3_generateSummary(anomalyId, summaryData, operator) {
    const anomaly = this.dataStore.getById(anomalyId);
    if (!anomaly) {
      throw new Error('异常记录不存在');
    }

    const unresolvedConflicts = anomaly.conflicts.filter(c => !c.resolution);
    if (unresolvedConflicts.length > 0) {
      throw new Error(`还有 ${unresolvedConflicts.length} 个冲突未解决，无法生成摘要`);
    }

    if (anomaly.isZeroWithReversal && anomaly.status !== STATUS.CONFIRMED) {
      return {
        anomaly: anomaly.toJSON(),
        warning: '该记录金额为0且备注已冲正，需风控复核确认后才能生成最终摘要',
        requiresRiskReview: true
      };
    }

    anomaly.advanceWorkflow(summaryData, operator);

    if (anomaly.isZeroWithReversal) {
      anomaly.status = STATUS.AWAITING_RISK_REVIEW;
    } else {
      anomaly.status = STATUS.CONFIRMED;
    }

    await this.selfCheckService.runAllChecks(anomalyId);

    this.dataStore.update(anomaly);

    return {
      anomaly: anomaly.toJSON(),
      workflowStep: 3,
      completed: true,
      message: anomaly.isZeroWithReversal 
        ? '摘要已生成，但需风控同事最终复核确认' 
        : '三步流程已完成，摘要已生成'
    };
  }

  async confirmByRisk(anomalyId, decision, operator) {
    const anomaly = this.dataStore.getById(anomalyId);
    if (!anomaly) {
      throw new Error('异常记录不存在');
    }

    if (!anomaly.isZeroWithReversal) {
      throw new Error('该记录不需要风控复核');
    }

    anomaly.status = decision === 'confirm' ? STATUS.NORMAL : STATUS.CONFIRMED;
    
    anomaly.workflowHistory.push({
      action: 'risk_review',
      decision,
      operator,
      timestamp: new Date()
    });

    await this.selfCheckService.runAllChecks(anomalyId);

    this.dataStore.update(anomaly);

    return {
      anomaly: anomaly.toJSON(),
      message: decision === 'confirm' 
        ? '风控已确认，冲正有效，记录归为正常' 
        : '风控已驳回，冲正无效，记录保持异常状态'
    };
  }

  getWorkflowStatus(anomalyId) {
    const anomaly = this.dataStore.getById(anomalyId);
    if (!anomaly) {
      throw new Error('异常记录不存在');
    }

    const stepDescriptions = {
      1: '客户经理补充邮件导入',
      2: '支付平台产品补看清算批次号',
      3: '生成负责人摘要'
    };

    return {
      currentStep: anomaly.workflowStep,
      currentStepDescription: stepDescriptions[anomaly.workflowStep],
      status: anomaly.status,
      statusText: anomaly.getStatusText(),
      hasConflicts: anomaly.conflicts.length > 0,
      unresolvedConflicts: anomaly.conflicts.filter(c => !c.resolution).length,
      requiresRiskReview: anomaly.isZeroWithReversal,
      history: anomaly.workflowHistory
    };
  }
}

module.exports = WorkflowService;
