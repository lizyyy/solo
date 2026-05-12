const { v4: uuidv4 } = require('uuid');

const storage = {
  templates: {},
  processes: {},
  nodes: {},
  histories: {},
  compensations: {}
};

const TEMPLATE_TYPES = {
  PURCHASE: 'purchase',
  REFUND: 'refund',
  PERMISSION: 'permission'
};

const NODE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  TRANSFERRED: 'transferred',
  SKIPPED: 'skipped',
  ESCALATED: 'escalated'
};

const PROCESS_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  COMPLETED: 'completed'
};

const ACTION_TYPES = {
  APPROVE: 'approve',
  REJECT: 'reject',
  TRANSFER: 'transfer',
  WITHDRAW: 'withdraw',
  ESCALATE: 'escalate',
  AUTO_ESCALATE: 'auto_escalate',
  AUTO_ESCALATE_FAILED: 'auto_escalate_failed',
  CREATE: 'create',
  START: 'start'
};

const ACTION_SOURCES = {
  HUMAN: 'human',
  AUTO: 'auto'
};

const COMPENSATION_STATUS = {
  PENDING: 'pending',
  PROCESSED: 'processed',
  SKIPPED: 'skipped'
};

function now() {
  return new Date();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function createTemplate(templateData) {
  const templateId = uuidv4();
  const template = {
    id: templateId,
    name: templateData.name,
    type: templateData.type,
    description: templateData.description || '',
    nodes: templateData.nodes,
    timeoutRules: templateData.timeoutRules,
    escalationChain: templateData.escalationChain,
    createdAt: now(),
    updatedAt: now()
  };
  storage.templates[templateId] = template;
  return template;
}

function getTemplate(templateId) {
  return storage.templates[templateId];
}

function getTemplateByType(type) {
  return Object.values(storage.templates).find(t => t.type === type);
}

function listTemplates() {
  return Object.values(storage.templates);
}

function createProcess(templateId, applicant, formData) {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error('Template not found');
  }
  
  const processId = uuidv4();
  const process = {
    id: processId,
    templateId: templateId,
    templateName: template.name,
    applicant: applicant,
    formData: formData,
    status: PROCESS_STATUS.PENDING,
    currentNodeIndex: 0,
    createdAt: now(),
    updatedAt: now()
  };
  
  storage.processes[processId] = process;
  
  template.nodes.forEach((nodeConfig, index) => {
    const nodeId = uuidv4();
    const node = {
      id: nodeId,
      processId: processId,
      nodeIndex: index,
      name: nodeConfig.name,
      approvers: [...nodeConfig.approvers],
      originalApprovers: [...nodeConfig.approvers],
      status: index === 0 ? NODE_STATUS.PENDING : NODE_STATUS.PENDING,
      escalated: false,
      processedAt: null,
      assignee: index === 0 ? nodeConfig.approvers[0] : null,
      originalAssignee: index === 0 ? nodeConfig.approvers[0] : null,
      timeoutAt: index === 0 ? calculateTimeout(template, formData) : null,
      createdAt: now(),
      updatedAt: now()
    };
    
    if (!storage.nodes[processId]) {
      storage.nodes[processId] = [];
    }
    storage.nodes[processId].push(node);
  });
  
  addHistory(processId, ACTION_TYPES.START, applicant, {
    templateName: template.name,
    formData: formData
  }, ACTION_SOURCES.HUMAN);
  
  return {
    process,
    nodes: storage.nodes[processId]
  };
}

function calculateTimeout(template, formData) {
  const rules = template.timeoutRules;
  if (!rules || rules.length === 0) {
    return addMinutes(now(), 60);
  }
  
  let timeoutMinutes = 60;
  
  for (const rule of rules) {
    if (rule.conditionType === 'amount') {
      const amount = formData.amount || 0;
      if (amount >= rule.min && amount <= rule.max) {
        timeoutMinutes = rule.timeoutMinutes;
        break;
      }
    } else if (rule.conditionType === 'risk_level') {
      const riskLevel = formData.riskLevel || 'medium';
      if (riskLevel === rule.riskLevel) {
        timeoutMinutes = rule.timeoutMinutes;
        break;
      }
    }
  }
  
  return addMinutes(now(), timeoutMinutes);
}

function getProcess(processId) {
  return storage.processes[processId];
}

function getProcessNodes(processId) {
  return storage.nodes[processId] || [];
}

function getCurrentNode(processId) {
  const process = getProcess(processId);
  if (!process) return null;
  
  const nodes = getProcessNodes(processId);
  return nodes.find(n => n.nodeIndex === process.currentNodeIndex);
}

function getNodeByIndex(processId, nodeIndex) {
  const nodes = getProcessNodes(processId);
  return nodes.find(n => n.nodeIndex === nodeIndex);
}

function addHistory(processId, actionType, operator, details, source) {
  const historyId = uuidv4();
  const history = {
    id: historyId,
    processId: processId,
    actionType: actionType,
    operator: operator,
    details: details,
    source: source,
    createdAt: now()
  };
  
  if (!storage.histories[processId]) {
    storage.histories[processId] = [];
  }
  storage.histories[processId].push(history);
  
  return history;
}

function getProcessHistories(processId) {
  return storage.histories[processId] || [];
}

function approveNode(processId, approver, comment) {
  const process = getProcess(processId);
  if (!process) {
    throw new Error('Process not found');
  }
  
  if (process.status === PROCESS_STATUS.WITHDRAWN) {
    throw new Error('Process has been withdrawn');
  }
  
  if (process.status === PROCESS_STATUS.REJECTED) {
    throw new Error('Process has been rejected');
  }
  
  const currentNode = getCurrentNode(processId);
  if (!currentNode) {
    throw new Error('No active node found');
  }
  
  if (currentNode.status !== NODE_STATUS.PENDING) {
    throw new Error('Node is not pending');
  }
  
  if (currentNode.assignee !== approver && !currentNode.approvers.includes(approver)) {
    throw new Error('Not authorized to approve this node');
  }
  
  currentNode.status = NODE_STATUS.APPROVED;
  currentNode.processedAt = now();
  currentNode.updatedAt = now();
  
  addHistory(processId, ACTION_TYPES.APPROVE, approver, {
    nodeName: currentNode.name,
    nodeIndex: currentNode.nodeIndex,
    comment: comment
  }, ACTION_SOURCES.HUMAN);
  
  process.updatedAt = now();
  
  if (process.currentNodeIndex >= getProcessNodes(processId).length - 1) {
    process.status = PROCESS_STATUS.APPROVED;
    return {
      success: true,
      process: process,
      completed: true
    };
  }
  
  process.currentNodeIndex += 1;
  const nextNode = getNodeByIndex(processId, process.currentNodeIndex);
  
  if (nextNode) {
    nextNode.assignee = nextNode.approvers[0];
    nextNode.originalAssignee = nextNode.approvers[0];
    nextNode.timeoutAt = calculateTimeout(getTemplate(process.templateId), process.formData);
    nextNode.updatedAt = now();
  }
  
  return {
    success: true,
    process: process,
    nextNode: nextNode,
    completed: false
  };
}

function rejectNode(processId, approver, comment) {
  const process = getProcess(processId);
  if (!process) {
    throw new Error('Process not found');
  }
  
  if (process.status === PROCESS_STATUS.WITHDRAWN) {
    throw new Error('Process has been withdrawn');
  }
  
  if (process.status === PROCESS_STATUS.REJECTED) {
    throw new Error('Process has been rejected');
  }
  
  const currentNode = getCurrentNode(processId);
  if (!currentNode) {
    throw new Error('No active node found');
  }
  
  if (currentNode.status !== NODE_STATUS.PENDING) {
    throw new Error('Node is not pending');
  }
  
  if (currentNode.assignee !== approver && !currentNode.approvers.includes(approver)) {
    throw new Error('Not authorized to reject this node');
  }
  
  currentNode.status = NODE_STATUS.REJECTED;
  currentNode.processedAt = now();
  currentNode.updatedAt = now();
  
  process.status = PROCESS_STATUS.REJECTED;
  process.updatedAt = now();
  
  addHistory(processId, ACTION_TYPES.REJECT, approver, {
    nodeName: currentNode.name,
    nodeIndex: currentNode.nodeIndex,
    comment: comment
  }, ACTION_SOURCES.HUMAN);
  
  return {
    success: true,
    process: process,
    rejected: true
  };
}

function withdrawProcess(processId, applicant) {
  const process = getProcess(processId);
  if (!process) {
    throw new Error('Process not found');
  }
  
  if (process.applicant !== applicant) {
    throw new Error('Only applicant can withdraw the process');
  }
  
  if (process.status === PROCESS_STATUS.APPROVED || process.status === PROCESS_STATUS.COMPLETED) {
    throw new Error('Cannot withdraw completed process');
  }
  
  if (process.status === PROCESS_STATUS.WITHDRAWN) {
    throw new Error('Process is already withdrawn');
  }
  
  process.status = PROCESS_STATUS.WITHDRAWN;
  process.updatedAt = now();
  
  const currentNode = getCurrentNode(processId);
  if (currentNode) {
    currentNode.status = NODE_STATUS.SKIPPED;
    currentNode.updatedAt = now();
  }
  
  addHistory(processId, ACTION_TYPES.WITHDRAW, applicant, {
    processId: processId,
    currentNodeName: currentNode ? currentNode.name : null
  }, ACTION_SOURCES.HUMAN);
  
  return {
    success: true,
    process: process
  };
}

function transferNode(processId, currentApprover, newApprover, reason) {
  const process = getProcess(processId);
  if (!process) {
    throw new Error('Process not found');
  }
  
  if (process.status === PROCESS_STATUS.WITHDRAWN) {
    throw new Error('Process has been withdrawn');
  }
  
  if (process.status === PROCESS_STATUS.REJECTED) {
    throw new Error('Process has been rejected');
  }
  
  const currentNode = getCurrentNode(processId);
  if (!currentNode) {
    throw new Error('No active node found');
  }
  
  if (currentNode.status !== NODE_STATUS.PENDING) {
    throw new Error('Node is not pending');
  }
  
  if (currentNode.assignee !== currentApprover) {
    throw new Error('Only current assignee can transfer');
  }
  
  if (!currentNode.approvers.includes(newApprover)) {
    currentNode.approvers.push(newApprover);
  }
  
  currentNode.assignee = newApprover;
  currentNode.updatedAt = now();
  
  addHistory(processId, ACTION_TYPES.TRANSFER, currentApprover, {
    nodeName: currentNode.name,
    nodeIndex: currentNode.nodeIndex,
    from: currentApprover,
    to: newApprover,
    reason: reason,
    originalApprovers: currentNode.originalApprovers
  }, ACTION_SOURCES.HUMAN);
  
  return {
    success: true,
    node: currentNode
  };
}

function getOverdueProcesses() {
  const currentTime = now();
  const overdue = [];
  
  Object.values(storage.processes).forEach(process => {
    if (process.status !== PROCESS_STATUS.PENDING) {
      return;
    }
    
    const currentNode = getCurrentNode(process.id);
    if (!currentNode || !currentNode.timeoutAt) {
      return;
    }
    
    if (currentNode.status === NODE_STATUS.APPROVED || 
        currentNode.status === NODE_STATUS.REJECTED ||
        currentNode.status === NODE_STATUS.SKIPPED ||
        currentNode.escalated) {
      return;
    }
    
    if (currentTime >= currentNode.timeoutAt) {
      overdue.push({
        process: process,
        node: currentNode
      });
    }
  });
  
  return overdue;
}

function escalateNode(processId, nodeId, escalateTo) {
  const process = getProcess(processId);
  if (!process) {
    throw new Error('Process not found');
  }
  
  if (process.status === PROCESS_STATUS.WITHDRAWN) {
    throw new Error('Process has been withdrawn');
  }
  
  if (process.status !== PROCESS_STATUS.PENDING) {
    throw new Error('Process is not pending');
  }
  
  const nodes = getProcessNodes(processId);
  const node = nodes.find(n => n.id === nodeId);
  if (!node) {
    throw new Error('Node not found');
  }
  
  if (node.escalated) {
    return {
      success: false,
      reason: 'Node already escalated',
      alreadyEscalated: true
    };
  }
  
  if (node.status === NODE_STATUS.APPROVED || 
      node.status === NODE_STATUS.REJECTED ||
      node.status === NODE_STATUS.SKIPPED) {
    return {
      success: false,
      reason: 'Node already processed',
      alreadyProcessed: true
    };
  }
  
  node.escalated = true;
  node.status = NODE_STATUS.ESCALATED;
  
  if (node.approvers.indexOf(escalateTo) === -1) {
    node.approvers.push(escalateTo);
  }
  
  node.assignee = escalateTo;
  node.timeoutAt = addMinutes(now(), 30);
  node.updatedAt = now();
  
  addHistory(processId, ACTION_TYPES.AUTO_ESCALATE, 'system', {
    nodeName: node.name,
    nodeIndex: node.nodeIndex,
    from: node.originalAssignee,
    to: escalateTo,
    reason: 'Timeout escalation',
    originalTimeoutAt: node.timeoutAt
  }, ACTION_SOURCES.AUTO);
  
  return {
    success: true,
    node: node
  };
}

function createCompensation(processId, nodeId, reason) {
  const compensationId = uuidv4();
  const compensation = {
    id: compensationId,
    processId: processId,
    nodeId: nodeId,
    reason: reason,
    status: COMPENSATION_STATUS.PENDING,
    createdAt: now(),
    processedAt: null
  };
  
  storage.compensations[compensationId] = compensation;
  return compensation;
}

function scanAndEscalate() {
  const scanId = uuidv4();
  const results = {
    scanId: scanId,
    scanTime: now(),
    totalScanned: 0,
    overdueCount: 0,
    escalatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    compensationsCreated: []
  };
  
  const overdueProcesses = getOverdueProcesses();
  results.totalScanned = Object.keys(storage.processes).length;
  results.overdueCount = overdueProcesses.length;
  
  for (const item of overdueProcesses) {
    const { process, node } = item;
    const template = getTemplate(process.templateId);
    
    if (!template || !template.escalationChain) {
      results.skippedCount++;
      continue;
    }
    
    const currentAssigneeIndex = template.escalationChain.indexOf(node.assignee);
    let nextEscalateTo = null;
    
    if (currentAssigneeIndex !== -1 && currentAssigneeIndex < template.escalationChain.length - 1) {
      nextEscalateTo = template.escalationChain[currentAssigneeIndex + 1];
    } else {
      nextEscalateTo = template.escalationChain[template.escalationChain.length - 1];
    }
    
    try {
      const escalateResult = escalateNode(process.id, node.id, nextEscalateTo);
      
      if (escalateResult.success) {
        results.escalatedCount++;
      } else if (escalateResult.alreadyEscalated || escalateResult.alreadyProcessed) {
        results.skippedCount++;
      } else {
        results.failedCount++;
        const compensation = createCompensation(process.id, node.id, 'Auto escalation failed');
        results.compensationsCreated.push(compensation);
        
        addHistory(process.id, ACTION_TYPES.AUTO_ESCALATE_FAILED, 'system', {
          nodeName: node.name,
          nodeIndex: node.nodeIndex,
          reason: 'Auto escalation failed, manual compensation needed',
          compensationId: compensation.id
        }, ACTION_SOURCES.AUTO);
      }
    } catch (error) {
      results.failedCount++;
      const compensation = createCompensation(process.id, node.id, error.message);
      results.compensationsCreated.push(compensation);
      
      addHistory(process.id, ACTION_TYPES.AUTO_ESCALATE_FAILED, 'system', {
        nodeName: node.name,
        nodeIndex: node.nodeIndex,
        reason: error.message,
        compensationId: compensation.id
      }, ACTION_SOURCES.AUTO);
    }
  }
  
  return results;
}

function getProcessDetail(processId) {
  const process = getProcess(processId);
  if (!process) {
    return null;
  }
  
  const nodes = getProcessNodes(processId);
  const histories = getProcessHistories(processId);
  const currentNode = getCurrentNode(processId);
  const template = getTemplate(process.templateId);
  
  const humanHistories = histories.filter(h => h.source === ACTION_SOURCES.HUMAN);
  const autoHistories = histories.filter(h => h.source === ACTION_SOURCES.AUTO);
  
  let timeoutReason = null;
  let compensationAction = null;
  
  if (currentNode && currentNode.timeoutAt) {
    const nowTime = now();
    if (nowTime >= currentNode.timeoutAt) {
      timeoutReason = {
        isOverdue: true,
        timeoutAt: currentNode.timeoutAt,
        overdueMinutes: Math.floor((nowTime - currentNode.timeoutAt) / 60000),
        nodeName: currentNode.name,
        assignee: currentNode.assignee,
        originalAssignee: currentNode.originalAssignee
      };
      
      if (currentNode.escalated) {
        compensationAction = {
          action: 'escalted',
          escalatedTo: currentNode.assignee,
          originalAssignee: currentNode.originalAssignee
        };
      }
    }
  }
  
  const compensations = Object.values(storage.compensations).filter(c => c.processId === processId);
  
  return {
    process: {
      ...process,
      template: {
        id: template.id,
        name: template.name,
        type: template.type
      }
    },
    currentNode: currentNode,
    nodes: nodes,
    timeoutReason: timeoutReason,
    compensationAction: compensationAction,
    compensations: compensations,
    histories: {
      all: histories,
      human: humanHistories,
      auto: autoHistories
    }
  };
}

function listCompensations(status) {
  let compensations = Object.values(storage.compensations);
  if (status) {
    compensations = compensations.filter(c => c.status === status);
  }
  return compensations;
}

function processCompensation(compensationId, processedBy) {
  const compensation = storage.compensations[compensationId];
  if (!compensation) {
    throw new Error('Compensation not found');
  }
  
  compensation.status = COMPENSATION_STATUS.PROCESSED;
  compensation.processedAt = now();
  compensation.processedBy = processedBy;
  
  addHistory(compensation.processId, ACTION_TYPES.AUTO_ESCALATE_FAILED, processedBy, {
    compensationId: compensationId,
    action: 'Manual compensation processed',
    reason: compensation.reason
  }, ACTION_SOURCES.HUMAN);
  
  return compensation;
}

module.exports = {
  storage,
  TEMPLATE_TYPES,
  NODE_STATUS,
  PROCESS_STATUS,
  ACTION_TYPES,
  ACTION_SOURCES,
  COMPENSATION_STATUS,
  now,
  addMinutes,
  createTemplate,
  getTemplate,
  getTemplateByType,
  listTemplates,
  createProcess,
  getProcess,
  getProcessNodes,
  getCurrentNode,
  getNodeByIndex,
  approveNode,
  rejectNode,
  withdrawProcess,
  transferNode,
  getOverdueProcesses,
  escalateNode,
  scanAndEscalate,
  getProcessDetail,
  listCompensations,
  processCompensation,
  createCompensation
};