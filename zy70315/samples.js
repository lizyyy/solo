const storage = require('./storage');

const purchaseTemplateData = {
  name: '采购审批流程',
  type: 'purchase',
  description: '采购审批流程，根据金额不同有不同的审批节点和超时时间',
  nodes: [
    {
      name: '部门经理审批',
      approvers: ['dept_manager_a', 'dept_manager_b']
    },
    {
      name: '财务审核',
      approvers: ['finance_staff_a', 'finance_staff_b']
    },
    {
      name: '总监审批',
      approvers: ['director_a', 'director_b']
    }
  ],
  timeoutRules: [
    {
      conditionType: 'amount',
      min: 0,
      max: 10000,
      timeoutMinutes: 60
    },
    {
      conditionType: 'amount',
      min: 10001,
      max: 100000,
      timeoutMinutes: 30
    },
    {
      conditionType: 'amount',
      min: 100001,
      max: Infinity,
      timeoutMinutes: 15
    }
  ],
  escalationChain: ['dept_manager_a', 'director_a', 'ceo_a']
};

const refundTemplateData = {
  name: '退款审批流程',
  type: 'refund',
  description: '退款审批流程，根据金额不同有不同的审批节点和超时时间',
  nodes: [
    {
      name: '客服主管审核',
      approvers: ['cs_supervisor_a', 'cs_supervisor_b']
    },
    {
      name: '财务审核',
      approvers: ['finance_staff_a', 'finance_staff_b']
    },
    {
      name: '财务经理审批',
      approvers: ['finance_manager_a', 'finance_manager_b']
    }
  ],
  timeoutRules: [
    {
      conditionType: 'amount',
      min: 0,
      max: 5000,
      timeoutMinutes: 120
    },
    {
      conditionType: 'amount',
      min: 5001,
      max: 50000,
      timeoutMinutes: 60
    },
    {
      conditionType: 'amount',
      min: 50001,
      max: Infinity,
      timeoutMinutes: 30
    }
  ],
  escalationChain: ['cs_supervisor_a', 'finance_manager_a', 'cfo_a']
};

const permissionTemplateData = {
  name: '权限申请流程',
  type: 'permission',
  description: '权限申请流程，根据风险等级不同有不同的审批节点和超时时间',
  nodes: [
    {
      name: '部门经理审批',
      approvers: ['dept_manager_a', 'dept_manager_b']
    },
    {
      name: 'IT安全审核',
      approvers: ['it_security_a', 'it_security_b']
    },
    {
      name: 'CTO审批',
      approvers: ['cto_a']
    }
  ],
  timeoutRules: [
    {
      conditionType: 'risk_level',
      riskLevel: 'low',
      timeoutMinutes: 120
    },
    {
      conditionType: 'risk_level',
      riskLevel: 'medium',
      timeoutMinutes: 60
    },
    {
      conditionType: 'risk_level',
      riskLevel: 'high',
      timeoutMinutes: 30
    }
  ],
  escalationChain: ['dept_manager_a', 'it_security_a', 'cto_a']
};

function initSamples() {
  const templates = [];
  
  if (!storage.getTemplateByType('purchase')) {
    templates.push(storage.createTemplate(purchaseTemplateData));
  }
  
  if (!storage.getTemplateByType('refund')) {
    templates.push(storage.createTemplate(refundTemplateData));
  }
  
  if (!storage.getTemplateByType('permission')) {
    templates.push(storage.createTemplate(permissionTemplateData));
  }
  
  return templates;
}

module.exports = {
  initSamples,
  purchaseTemplateData,
  refundTemplateData,
  permissionTemplateData
};