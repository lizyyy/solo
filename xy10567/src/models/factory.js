const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const WORKFLOW_STATUS = {
  CREATED: 'created',
  DATA_AGGREGATED: 'data_aggregated',
  HEALTH_CHECKED: 'health_checked',
  TICKETS_CHECKED: 'tickets_checked',
  QUOTE_PREPARED: 'quote_prepared',
  DISCOUNT_APPROVED: 'discount_approved',
  READY_FOR_CSM: 'ready_for_csm',
  CUSTOMER_ACCEPTED: 'customer_accepted',
  COMPLETED: 'completed',
  AT_RISK: 'at_risk',
  BLOCKED: 'blocked',
  FAILED: 'failed'
};

const HEALTH_LEVEL = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  CRITICAL: 'critical'
};

const TICKET_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

const TICKET_SEVERITY = {
  MINOR: 'minor',
  MODERATE: 'moderate',
  MAJOR: 'major',
  SEVERE: 'severe'
};

const QUOTE_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SENT: 'sent',
  ACCEPTED: 'accepted'
};

function createCustomer(data) {
  return {
    id: uuidv4(),
    name: data.name,
    email: data.email,
    industry: data.industry,
    tier: data.tier || 'standard',
    currentContract: {
      startDate: data.currentContract?.startDate || dayjs().subtract(11, 'month').format('YYYY-MM-DD'),
      endDate: data.currentContract?.endDate || dayjs().add(1, 'month').format('YYYY-MM-DD'),
      annualValue: data.currentContract?.annualValue || 50000,
      productIds: data.currentContract?.productIds || []
    },
    csmId: data.csmId || uuidv4(),
    createdAt: new Date().toISOString(),
    ...data
  };
}

function createUsageMetric(data) {
  return {
    id: uuidv4(),
    customerId: data.customerId,
    productId: data.productId,
    period: data.period || 'last_30_days',
    usage: data.usage || {},
    trend: data.trend || 'stable',
    comparedToLastPeriod: data.comparedToLastPeriod || 0,
    recordedAt: new Date().toISOString(),
    ...data
  };
}

function createHealthScore(data) {
  const score = data.score;
  let level = HEALTH_LEVEL.FAIR;
  if (score >= 85) level = HEALTH_LEVEL.EXCELLENT;
  else if (score >= 70) level = HEALTH_LEVEL.GOOD;
  else if (score >= 50) level = HEALTH_LEVEL.FAIR;
  else if (score >= 30) level = HEALTH_LEVEL.POOR;
  else level = HEALTH_LEVEL.CRITICAL;

  return {
    id: uuidv4(),
    customerId: data.customerId,
    score: score,
    level: level,
    factors: data.factors || [],
    risks: data.risks || [],
    evaluatedAt: new Date().toISOString(),
    ...data
  };
}

function createTicket(data) {
  return {
    id: uuidv4(),
    customerId: data.customerId,
    title: data.title,
    description: data.description,
    priority: data.priority || TICKET_PRIORITY.MEDIUM,
    severity: data.severity || TICKET_SEVERITY.MODERATE,
    status: data.status || 'open',
    assignee: data.assignee,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
    slaBreached: data.slaBreached || false,
    slaDueDate: data.slaDueDate,
    ...data
  };
}

function createQuote(data, existingQuotes = []) {
  const version = existingQuotes.length > 0 ? Math.max(...existingQuotes.map(q => q.version)) + 1 : 1;
  
  return {
    id: uuidv4(),
    customerId: data.customerId,
    workflowId: data.workflowId,
    version: version,
    productLines: data.productLines || [],
    baseTotal: data.baseTotal || 0,
    discountPercent: data.discountPercent || 0,
    discountAmount: data.discountAmount || 0,
    finalTotal: data.finalTotal || 0,
    terms: data.terms || { months: 12, startDate: dayjs().format('YYYY-MM-DD') },
    status: data.status || QUOTE_STATUS.DRAFT,
    approvalRequired: data.approvalRequired || false,
    approvalWorkflowId: data.approvalWorkflowId,
    createdBy: data.createdBy,
    createdAt: new Date().toISOString(),
    ...data
  };
}

function createRenewalWorkflow(data) {
  return {
    id: uuidv4(),
    customerId: data.customerId,
    requestId: data.requestId || uuidv4(),
    status: WORKFLOW_STATUS.CREATED,
    data: {
      customerProfile: null,
      usageMetrics: [],
      healthScore: null,
      openTickets: [],
      quotes: [],
      discountApproval: null
    },
    riskFlags: [],
    alerts: [],
    notes: [],
    assignee: data.assignee,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    ...data
  };
}

function createHistory(data) {
  return {
    id: uuidv4(),
    entityType: data.entityType,
    entityId: data.entityId,
    action: data.action,
    previousState: data.previousState,
    newState: data.newState,
    changes: data.changes || {},
    operator: data.operator,
    reason: data.reason,
    timestamp: new Date().toISOString(),
    ...data
  };
}

function createAlert(data) {
  return {
    id: uuidv4(),
    workflowId: data.workflowId,
    type: data.type,
    severity: data.severity || 'warning',
    message: data.message,
    details: data.details || {},
    status: 'active',
    createdAt: new Date().toISOString(),
    ...data
  };
}

module.exports = {
  WORKFLOW_STATUS,
  HEALTH_LEVEL,
  TICKET_PRIORITY,
  TICKET_SEVERITY,
  QUOTE_STATUS,
  createCustomer,
  createUsageMetric,
  createHealthScore,
  createTicket,
  createQuote,
  createRenewalWorkflow,
  createHistory,
  createAlert
};
