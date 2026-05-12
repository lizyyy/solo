const store = require('../models/store');
const { 
  WORKFLOW_STATUS, 
  createRenewalWorkflow, 
  createQuote, 
  createHistory,
  createAlert 
} = require('../models/factory');
const { evaluateAllRules, checkDiscountApprovalRule } = require('./rules');

class RenewalWorkflowService {
  constructor() {
    this.STATUS_TRANSITIONS = {
      [WORKFLOW_STATUS.CREATED]: [WORKFLOW_STATUS.DATA_AGGREGATED, WORKFLOW_STATUS.FAILED],
      [WORKFLOW_STATUS.DATA_AGGREGATED]: [WORKFLOW_STATUS.HEALTH_CHECKED, WORKFLOW_STATUS.FAILED, WORKFLOW_STATUS.AT_RISK],
      [WORKFLOW_STATUS.HEALTH_CHECKED]: [WORKFLOW_STATUS.TICKETS_CHECKED, WORKFLOW_STATUS.FAILED, WORKFLOW_STATUS.AT_RISK, WORKFLOW_STATUS.BLOCKED],
      [WORKFLOW_STATUS.TICKETS_CHECKED]: [WORKFLOW_STATUS.QUOTE_PREPARED, WORKFLOW_STATUS.FAILED, WORKFLOW_STATUS.BLOCKED],
      [WORKFLOW_STATUS.QUOTE_PREPARED]: [WORKFLOW_STATUS.DISCOUNT_APPROVED, WORKFLOW_STATUS.READY_FOR_CSM, WORKFLOW_STATUS.FAILED, WORKFLOW_STATUS.BLOCKED],
      [WORKFLOW_STATUS.DISCOUNT_APPROVED]: [WORKFLOW_STATUS.READY_FOR_CSM, WORKFLOW_STATUS.FAILED],
      [WORKFLOW_STATUS.READY_FOR_CSM]: [WORKFLOW_STATUS.CUSTOMER_ACCEPTED, WORKFLOW_STATUS.AT_RISK, WORKFLOW_STATUS.FAILED],
      [WORKFLOW_STATUS.CUSTOMER_ACCEPTED]: [WORKFLOW_STATUS.COMPLETED, WORKFLOW_STATUS.FAILED],
      [WORKFLOW_STATUS.AT_RISK]: [WORKFLOW_STATUS.TICKETS_CHECKED, WORKFLOW_STATUS.READY_FOR_CSM, WORKFLOW_STATUS.FAILED],
      [WORKFLOW_STATUS.BLOCKED]: [WORKFLOW_STATUS.QUOTE_PREPARED, WORKFLOW_STATUS.READY_FOR_CSM, WORKFLOW_STATUS.FAILED]
    };
  }

  async createWorkflow(customerId, requestId, operator) {
    if (requestId && store.isRequestProcessed(requestId)) {
      const existing = store.getRenewalWorkflows().find(w => w.requestId === requestId);
      return {
        workflow: existing,
        history: store.getHistory('renewal', existing.id),
        isIdempotent: true
      };
    }

    const customer = store.getCustomer(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const workflow = createRenewalWorkflow({
      customerId,
      requestId,
      assignee: operator
    });

    store.saveRenewalWorkflow(workflow);
    if (requestId) store.markRequestProcessed(requestId);

    store.addHistory(createHistory({
      entityType: 'renewal',
      entityId: workflow.id,
      action: 'create',
      previousState: null,
      newState: workflow.status,
      operator,
      reason: '创建续约流程'
    }));

    return {
      workflow,
      history: store.getHistory('renewal', workflow.id),
      isIdempotent: false
    };
  }

  async aggregateData(workflowId, operator) {
    const workflow = this._getWorkflowOrThrow(workflowId);
    this._validateTransition(workflow.status, WORKFLOW_STATUS.DATA_AGGREGATED);

    try {
      const customer = store.getCustomer(workflow.customerId);
      const usageMetrics = store.getUsageMetricsByCustomer(workflow.customerId);
      const healthScore = store.getLatestHealthScore(workflow.customerId);
      const openTickets = store.getOpenTickets(workflow.customerId);

      workflow.data.customerProfile = customer;
      workflow.data.usageMetrics = usageMetrics;
      workflow.data.healthScore = healthScore;
      workflow.data.openTickets = openTickets;

      this._transitionStatus(workflow, WORKFLOW_STATUS.DATA_AGGREGATED, operator, '数据汇总完成');

      store.addHistory(createHistory({
        entityType: 'renewal',
        entityId: workflow.id,
        action: 'aggregate_data',
        previousState: WORKFLOW_STATUS.CREATED,
        newState: WORKFLOW_STATUS.DATA_AGGREGATED,
        operator,
        reason: '汇总客户档案、使用量、健康分和工单数据'
      }));

      return { workflow, history: store.getHistory('renewal', workflow.id) };
    } catch (error) {
      this._handleError(workflow, error, operator, '数据汇总失败');
      throw error;
    }
  }

  async checkHealth(workflowId, operator) {
    const workflow = this._getWorkflowOrThrow(workflowId);
    this._validateTransition(workflow.status, WORKFLOW_STATUS.HEALTH_CHECKED);

    const evaluation = evaluateAllRules(workflow.data);
    workflow.riskFlags = evaluation.riskFlags;

    if (evaluation.blockingRules.includes('health_score') || 
        evaluation.riskFlags.some(r => r.level === 'critical')) {
      this._transitionStatus(workflow, WORKFLOW_STATUS.AT_RISK, operator, '健康分过低');
      workflow.alerts.push(createAlert({
        workflowId,
        type: 'health_score',
        severity: 'critical',
        message: evaluation.results.healthScore.reason,
        details: evaluation.results.healthScore.details
      }));

      store.addHistory(createHistory({
        entityType: 'renewal',
        entityId: workflow.id,
        action: 'health_check_failed',
        previousState: WORKFLOW_STATUS.DATA_AGGREGATED,
        newState: WORKFLOW_STATUS.AT_RISK,
        operator,
        reason: evaluation.results.healthScore.reason,
        changes: { riskFlags: evaluation.riskFlags }
      }));

      return { 
        workflow, 
        history: store.getHistory('renewal', workflow.id),
        riskFlags: evaluation.riskFlags,
        canProceed: false
      };
    }

    this._transitionStatus(workflow, WORKFLOW_STATUS.HEALTH_CHECKED, operator, '健康检查通过');

    store.addHistory(createHistory({
      entityType: 'renewal',
      entityId: workflow.id,
      action: 'health_check',
      previousState: WORKFLOW_STATUS.DATA_AGGREGATED,
      newState: WORKFLOW_STATUS.HEALTH_CHECKED,
      operator,
      reason: evaluation.results.healthScore.reason
    }));

    return { 
      workflow, 
      history: store.getHistory('renewal', workflow.id),
      canProceed: true
    };
  }

  async checkTickets(workflowId, operator) {
    const workflow = this._getWorkflowOrThrow(workflowId);
    
    const validFromStates = [WORKFLOW_STATUS.HEALTH_CHECKED, WORKFLOW_STATUS.AT_RISK];
    if (!validFromStates.includes(workflow.status)) {
      throw new Error(`Cannot transition from ${workflow.status} to ${WORKFLOW_STATUS.TICKETS_CHECKED}`);
    }

    const evaluation = evaluateAllRules(workflow.data);

    if (evaluation.blockingRules.includes('open_tickets')) {
      this._transitionStatus(workflow, WORKFLOW_STATUS.BLOCKED, operator, '重大工单未结');
      workflow.alerts.push(createAlert({
        workflowId,
        type: 'open_tickets',
        severity: 'high',
        message: evaluation.results.tickets.reason,
        details: evaluation.results.tickets.details
      }));

      store.addHistory(createHistory({
        entityType: 'renewal',
        entityId: workflow.id,
        action: 'ticket_check_blocked',
        previousState: workflow.status,
        newState: WORKFLOW_STATUS.BLOCKED,
        operator,
        reason: evaluation.results.tickets.reason,
        changes: { alerts: workflow.alerts }
      }));

      return {
        workflow,
        history: store.getHistory('renewal', workflow.id),
        riskFlags: evaluation.riskFlags,
        canProceed: false,
        blockingTickets: evaluation.results.tickets.details.criticalOrHighTickets
      };
    }

    this._transitionStatus(workflow, WORKFLOW_STATUS.TICKETS_CHECKED, operator, '工单检查通过');

    store.addHistory(createHistory({
      entityType: 'renewal',
      entityId: workflow.id,
      action: 'ticket_check',
      previousState: validFromStates[0],
      newState: WORKFLOW_STATUS.TICKETS_CHECKED,
      operator,
      reason: evaluation.results.tickets.reason
    }));

    return {
      workflow,
      history: store.getHistory('renewal', workflow.id),
      canProceed: true
    };
  }

  async prepareQuote(workflowId, quoteData, operator) {
    const workflow = this._getWorkflowOrThrow(workflowId);
    
    const validFromStates = [WORKFLOW_STATUS.TICKETS_CHECKED, WORKFLOW_STATUS.BLOCKED, WORKFLOW_STATUS.QUOTE_PREPARED];
    const isNewVersion = workflow.status === WORKFLOW_STATUS.QUOTE_PREPARED;
    
    if (!validFromStates.includes(workflow.status)) {
      throw new Error(`Cannot transition from ${workflow.status} to ${WORKFLOW_STATUS.QUOTE_PREPARED}`);
    }

    const existingQuotes = store.getQuotes(workflow.customerId)
      .filter(q => q.workflowId === workflowId);

    const discountCheck = checkDiscountApprovalRule(
      quoteData.discountPercent || 0,
      workflow.data.customerProfile?.tier || 'standard',
      quoteData.baseTotal || 0
    );

    const quote = createQuote({
      customerId: workflow.customerId,
      workflowId,
      ...quoteData,
      approvalRequired: discountCheck.approvalRequired,
      createdBy: operator
    }, existingQuotes);

    if (existingQuotes.length > 0) {
      const previousQuote = existingQuotes[0];
      store.addHistory(createHistory({
        entityType: 'quote',
        entityId: quote.id,
        action: 'new_version',
        previousState: { version: previousQuote.version, status: previousQuote.status },
        newState: { version: quote.version, status: quote.status },
        operator,
        reason: '创建新版本报价',
        changes: {
          from: {
            discountPercent: previousQuote.discountPercent,
            finalTotal: previousQuote.finalTotal
          },
          to: {
            discountPercent: quote.discountPercent,
            finalTotal: quote.finalTotal
          }
        }
      }));
    }

    store.saveQuote(quote);
    workflow.data.quotes.push(quote);

    const previousState = workflow.status;
    if (!isNewVersion) {
      this._transitionStatus(workflow, WORKFLOW_STATUS.QUOTE_PREPARED, operator, '报价准备完成');
    }

    store.addHistory(createHistory({
      entityType: 'renewal',
      entityId: workflow.id,
      action: isNewVersion ? 'quote_new_version' : 'prepare_quote',
      previousState: previousState,
      newState: workflow.status,
      operator,
      reason: isNewVersion ? `创建报价新版本 v${quote.version}` : `创建报价 v${quote.version}`,
      changes: { 
        quoteId: quote.id, 
        version: quote.version,
        isNewVersion: isNewVersion
      }
    }));

    if (discountCheck.approvalRequired) {
      return {
        workflow,
        quote,
        history: store.getHistory('renewal', workflow.id),
        approvalRequired: true,
        approvalInfo: discountCheck.requiredApproval,
        canProceed: false
      };
    }

    return {
      workflow,
      quote,
      history: store.getHistory('renewal', workflow.id),
      canProceed: true
    };
  }

  async approveDiscount(workflowId, quoteId, approval, operator) {
    const workflow = this._getWorkflowOrThrow(workflowId);
    this._validateTransition(workflow.status, WORKFLOW_STATUS.DISCOUNT_APPROVED);

    const quote = store.getQuotes(workflow.customerId).find(q => q.id === quoteId);
    if (!quote) {
      throw new Error(`Quote not found: ${quoteId}`);
    }

    if (approval.approved) {
      quote.status = 'approved';
      workflow.data.discountApproval = {
        approved: true,
        approver: operator,
        level: approval.level,
        approvedAt: new Date().toISOString(),
        comments: approval.comments
      };

      this._transitionStatus(workflow, WORKFLOW_STATUS.DISCOUNT_APPROVED, operator, '折扣审批通过');

      store.addHistory(createHistory({
        entityType: 'renewal',
        entityId: workflow.id,
        action: 'discount_approved',
        previousState: WORKFLOW_STATUS.QUOTE_PREPARED,
        newState: WORKFLOW_STATUS.DISCOUNT_APPROVED,
        operator,
        reason: `折扣审批通过，级别: ${approval.level}`,
        changes: { approvalComments: approval.comments }
      }));

      store.addHistory(createHistory({
        entityType: 'quote',
        entityId: quoteId,
        action: 'approve',
        previousState: quote.status,
        newState: 'approved',
        operator,
        reason: approval.comments
      }));
    } else {
      quote.status = 'rejected';
      this._transitionStatus(workflow, WORKFLOW_STATUS.BLOCKED, operator, '折扣审批被拒');

      store.addHistory(createHistory({
        entityType: 'renewal',
        entityId: workflow.id,
        action: 'discount_rejected',
        previousState: WORKFLOW_STATUS.QUOTE_PREPARED,
        newState: WORKFLOW_STATUS.BLOCKED,
        operator,
        reason: approval.reason || '折扣审批被拒绝',
        changes: { rejectionReason: approval.reason }
      }));
    }

    store.saveQuote(quote);

    return {
      workflow,
      quote,
      history: store.getHistory('renewal', workflow.id)
    };
  }

  async markReadyForCSM(workflowId, operator) {
    const workflow = this._getWorkflowOrThrow(workflowId);
    this._validateTransition(workflow.status, WORKFLOW_STATUS.READY_FOR_CSM);

    this._transitionStatus(workflow, WORKFLOW_STATUS.READY_FOR_CSM, operator, '就绪等待客户成功经理跟进');

    store.addHistory(createHistory({
      entityType: 'renewal',
      entityId: workflow.id,
      action: 'ready_for_csm',
      previousState: WORKFLOW_STATUS.DISCOUNT_APPROVED,
      newState: WORKFLOW_STATUS.READY_FOR_CSM,
      operator,
      reason: '流程就绪，等待客户沟通'
    }));

    return {
      workflow,
      history: store.getHistory('renewal', workflow.id)
    };
  }

  async customerAccept(workflowId, operator, customerFeedback) {
    const workflow = this._getWorkflowOrThrow(workflowId);
    this._validateTransition(workflow.status, WORKFLOW_STATUS.CUSTOMER_ACCEPTED);

    this._transitionStatus(workflow, WORKFLOW_STATUS.CUSTOMER_ACCEPTED, operator, '客户已接受报价');

    store.addHistory(createHistory({
      entityType: 'renewal',
      entityId: workflow.id,
      action: 'customer_accept',
      previousState: WORKFLOW_STATUS.READY_FOR_CSM,
      newState: WORKFLOW_STATUS.CUSTOMER_ACCEPTED,
      operator,
      reason: customerFeedback?.reason || '客户确认接受',
      changes: { customerFeedback }
    }));

    return {
      workflow,
      history: store.getHistory('renewal', workflow.id)
    };
  }

  async complete(workflowId, operator, notes) {
    const workflow = this._getWorkflowOrThrow(workflowId);
    this._validateTransition(workflow.status, WORKFLOW_STATUS.COMPLETED);

    this._transitionStatus(workflow, WORKFLOW_STATUS.COMPLETED, operator, '续约流程完成');
    workflow.completedAt = new Date().toISOString();
    workflow.notes.push({ operator, content: notes, timestamp: new Date().toISOString() });

    store.addHistory(createHistory({
      entityType: 'renewal',
      entityId: workflow.id,
      action: 'complete',
      previousState: WORKFLOW_STATUS.CUSTOMER_ACCEPTED,
      newState: WORKFLOW_STATUS.COMPLETED,
      operator,
      reason: notes || '续约成功完成'
    }));

    return {
      workflow,
      history: store.getHistory('renewal', workflow.id)
    };
  }

  async manualCorrection(workflowId, correction, operator) {
    const workflow = this._getWorkflowOrThrow(workflowId);
    const previousState = JSON.parse(JSON.stringify(workflow));

    if (correction.status) {
      workflow.status = correction.status;
    }

    if (correction.riskFlags) {
      workflow.riskFlags = correction.riskFlags;
    }

    if (correction.notes) {
      workflow.notes.push({ 
        operator, 
        content: correction.notes, 
        timestamp: new Date().toISOString(),
        type: 'manual_correction'
      });
    }

    const changes = this._calculateChanges(previousState, workflow);

    store.addHistory(createHistory({
      entityType: 'renewal',
      entityId: workflow.id,
      action: 'manual_correction',
      previousState: previousState.status,
      newState: workflow.status,
      operator,
      reason: correction.reason || '人工修正',
      changes: {
        before: changes.before,
        after: changes.after,
        correctionNotes: correction.notes
      }
    }));

    workflow.updatedAt = new Date().toISOString();
    store.saveRenewalWorkflow(workflow);

    return {
      workflow,
      history: store.getHistory('renewal', workflow.id),
      changes
    };
  }

  async handleException(workflowId, exception, operator) {
    const workflow = this._getWorkflowOrThrow(workflowId);
    const previousStatus = workflow.status;

    workflow.status = WORKFLOW_STATUS.FAILED;
    workflow.alerts.push(createAlert({
      workflowId,
      type: 'exception',
      severity: 'critical',
      message: exception.message,
      details: exception.details || {}
    }));

    store.addHistory(createHistory({
      entityType: 'renewal',
      entityId: workflow.id,
      action: 'exception',
      previousState: previousStatus,
      newState: WORKFLOW_STATUS.FAILED,
      operator,
      reason: exception.message,
      changes: { errorDetails: exception.details }
    }));

    workflow.updatedAt = new Date().toISOString();
    store.saveRenewalWorkflow(workflow);

    return {
      workflow,
      history: store.getHistory('renewal', workflow.id)
    };
  }

  getWorkflow(workflowId) {
    return this._getWorkflowOrThrow(workflowId);
  }

  getWorkflowWithHistory(workflowId) {
    const workflow = this._getWorkflowOrThrow(workflowId);
    return {
      workflow,
      history: store.getHistory('renewal', workflowId)
    };
  }

  getAllWorkflows(filters = {}) {
    let workflows = store.getRenewalWorkflows();
    
    if (filters.status) {
      workflows = workflows.filter(w => w.status === filters.status);
    }
    if (filters.customerId) {
      workflows = workflows.filter(w => w.customerId === filters.customerId);
    }
    
    return workflows;
  }

  _getWorkflowOrThrow(workflowId) {
    const workflow = store.getRenewalWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    return workflow;
  }

  _validateTransition(currentStatus, targetStatus) {
    const validTransitions = this.STATUS_TRANSITIONS[currentStatus] || [];
    if (!validTransitions.includes(targetStatus) && 
        targetStatus !== WORKFLOW_STATUS.FAILED &&
        targetStatus !== currentStatus) {
      throw new Error(`Invalid transition: ${currentStatus} -> ${targetStatus}`);
    }
  }

  _transitionStatus(workflow, newStatus, operator, reason) {
    const previousStatus = workflow.status;
    workflow.status = newStatus;
    workflow.updatedAt = new Date().toISOString();
    store.saveRenewalWorkflow(workflow);
  }

  _handleError(workflow, error, operator, reason) {
    workflow.status = WORKFLOW_STATUS.FAILED;
    workflow.updatedAt = new Date().toISOString();
    
    store.addHistory(createHistory({
      entityType: 'renewal',
      entityId: workflow.id,
      action: 'fail',
      previousState: workflow.status,
      newState: WORKFLOW_STATUS.FAILED,
      operator,
      reason: `${reason}: ${error.message}`
    }));
    
    store.saveRenewalWorkflow(workflow);
  }

  _calculateChanges(before, after) {
    const changes = { before: {}, after: {} };
    
    if (before.status !== after.status) {
      changes.before.status = before.status;
      changes.after.status = after.status;
    }
    
    if (JSON.stringify(before.riskFlags) !== JSON.stringify(after.riskFlags)) {
      changes.before.riskFlags = before.riskFlags;
      changes.after.riskFlags = after.riskFlags;
    }
    
    return changes;
  }
}

module.exports = new RenewalWorkflowService();
