const express = require('express');
const app = express();
app.use(express.json());

const contracts = new Map();
let contractIdCounter = 1;
let clauseIdCounter = 1;
let deliveryIdCounter = 1;
let inspectionIdCounter = 1;
let paymentIdCounter = 1;

const CONTRACT_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CLOSED: 'closed'
};

const DELIVERY_STATUS = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  DELIVERED: 'delivered'
};

const INSPECTION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  TRIGGERED: 'triggered',
  PAID: 'paid',
  SUSPENDED: 'suspended'
};

function generateId(prefix, counter) {
  return `${prefix}-${String(counter).padStart(4, '0')}`;
}

function calculateContractStats(contract) {
  let totalDelivered = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let totalDeduction = 0;
  const pendingInspections = [];
  const deductionReasons = [];

  contract.clauses.forEach(clause => {
    clause.deliveries.forEach(delivery => {
      totalDelivered += delivery.quantity;
      
      delivery.inspections.forEach(inspection => {
        if (inspection.status === INSPECTION_STATUS.APPROVED) {
          totalAccepted += inspection.approvedQuantity;
        } else if (inspection.status === INSPECTION_STATUS.REJECTED) {
          totalRejected += inspection.rejectedQuantity;
          if (inspection.deduction > 0) {
            totalDeduction += inspection.deduction;
            if (inspection.reason) {
              deductionReasons.push({
                clause: clause.name,
                batchNo: delivery.batchNo,
                reason: inspection.reason,
                deduction: inspection.deduction
              });
            }
          }
        } else if (inspection.status === INSPECTION_STATUS.PENDING) {
          pendingInspections.push({
            clauseId: clause.id,
            clauseName: clause.name,
            deliveryId: delivery.id,
            batchNo: delivery.batchNo,
            deliveredDate: delivery.deliveredDate,
            quantity: delivery.quantity
          });
        }
      });
    });
  });

  const totalQuantity = contract.clauses.reduce((sum, c) => sum + c.quantity, 0);
  const totalAmount = contract.clauses.reduce((sum, c) => sum + c.totalAmount, 0);
  const completionRate = totalQuantity > 0 ? (totalAccepted / totalQuantity * 100).toFixed(2) : 0;
  const payableAmount = totalAmount - totalDeduction;

  return {
    totalQuantity,
    totalAmount,
    totalDelivered,
    totalAccepted,
    totalRejected,
    completionRate: `${completionRate}%`,
    totalDeduction,
    payableAmount,
    pendingInspections,
    deductionReasons
  };
}

app.post('/api/contracts', (req, res) => {
  const { contractNo, supplier, contractDate, clauses, paymentTerms } = req.body;
  
  if (!contractNo || !supplier || !contractDate || !clauses || clauses.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少必要参数：合同编号、供应商、合同日期、条款' 
    });
  }

  const contractId = generateId('CT', contractIdCounter++);
  const contract = {
    id: contractId,
    contractNo,
    supplier,
    contractDate,
    status: CONTRACT_STATUS.ACTIVE,
    clauses: clauses.map(clause => ({
      id: generateId('CL', clauseIdCounter++),
      name: clause.name,
      product: clause.product,
      quantity: clause.quantity,
      unitPrice: clause.unitPrice,
      totalAmount: clause.quantity * clause.unitPrice,
      unit: clause.unit || '个',
      deliveryDeadline: clause.deliveryDeadline,
      deliveries: []
    })),
    paymentTerms: paymentTerms || [],
    payments: [],
    createdAt: new Date().toISOString(),
    closedAt: null
  };

  contracts.set(contractId, contract);
  res.status(201).json({ success: true, data: contract });
});

app.post('/api/contracts/:contractId/deliveries', (req, res) => {
  const { contractId } = req.params;
  const { clauseId, batchNo, quantity, deliveredDate, deliveryNote } = req.body;

  const contract = contracts.get(contractId);
  if (!contract) {
    return res.status(404).json({ success: false, message: '合同不存在' });
  }

  if (contract.status === CONTRACT_STATUS.CLOSED) {
    return res.status(400).json({ success: false, message: '合同已关闭，无法登记交付' });
  }

  const clause = contract.clauses.find(c => c.id === clauseId);
  if (!clause) {
    return res.status(404).json({ success: false, message: '条款不存在' });
  }

  const totalDelivered = clause.deliveries.reduce((sum, d) => sum + d.quantity, 0);
  if (totalDelivered + quantity > clause.quantity) {
    return res.status(400).json({ 
      success: false, 
      message: `交付数量超过合同约定：条款 ${clause.name} 合同数量 ${clause.quantity}，已交付 ${totalDelivered}，本次申请 ${quantity}，超限 ${(totalDelivered + quantity - clause.quantity)}` 
    });
  }

  const deliveryId = generateId('DL', deliveryIdCounter++);
  const delivery = {
    id: deliveryId,
    clauseId,
    batchNo: batchNo || `BATCH-${deliveryIdCounter}`,
    quantity,
    deliveredDate: deliveredDate || new Date().toISOString(),
    deliveryNote: deliveryNote || '',
    inspections: [{
      id: generateId('IN', inspectionIdCounter++),
      status: INSPECTION_STATUS.PENDING,
      approvedQuantity: 0,
      rejectedQuantity: 0,
      inspectedBy: null,
      inspectedAt: null,
      reason: null,
      deduction: 0
    }]
  };

  clause.deliveries.push(delivery);
  contracts.set(contractId, contract);
  
  res.status(201).json({ success: true, data: delivery });
});

app.post('/api/contracts/:contractId/inspections', (req, res) => {
  const { contractId } = req.params;
  const { deliveryId, status, approvedQuantity, rejectedQuantity, inspectedBy, reason, deduction } = req.body;

  const contract = contracts.get(contractId);
  if (!contract) {
    return res.status(404).json({ success: false, message: '合同不存在' });
  }

  if (contract.status === CONTRACT_STATUS.CLOSED) {
    return res.status(400).json({ success: false, message: '合同已关闭，无法验收' });
  }

  let targetDelivery = null;
  let targetClause = null;

  for (const clause of contract.clauses) {
    const delivery = clause.deliveries.find(d => d.id === deliveryId);
    if (delivery) {
      targetDelivery = delivery;
      targetClause = clause;
      break;
    }
  }

  if (!targetDelivery) {
    return res.status(404).json({ success: false, message: '交付批次不存在' });
  }

  const pendingInspection = targetDelivery.inspections.find(i => i.status === INSPECTION_STATUS.PENDING);
  if (!pendingInspection) {
    return res.status(400).json({ success: false, message: '该批次已完成验收，无法重复操作' });
  }

  if (status === INSPECTION_STATUS.REJECTED && rejectedQuantity <= 0) {
    return res.status(400).json({ success: false, message: '驳回验收必须指定驳回数量' });
  }

  if (status === INSPECTION_STATUS.APPROVED && approvedQuantity <= 0) {
    return res.status(400).json({ success: false, message: '通过验收必须指定通过数量' });
  }

  const totalCheckQuantity = (approvedQuantity || 0) + (rejectedQuantity || 0);
  if (totalCheckQuantity > targetDelivery.quantity) {
    return res.status(400).json({ 
      success: false, 
      message: `验收数量超限：交付数量 ${targetDelivery.quantity}，本次验收 ${totalCheckQuantity}` 
    });
  }

  let remainingQuantity = targetDelivery.quantity - totalCheckQuantity;

  pendingInspection.status = status;
  pendingInspection.approvedQuantity = approvedQuantity || 0;
  pendingInspection.rejectedQuantity = rejectedQuantity || 0;
  pendingInspection.inspectedBy = inspectedBy || '系统';
  pendingInspection.inspectedAt = new Date().toISOString();
  pendingInspection.reason = reason || null;
  pendingInspection.deduction = deduction || 0;

  if (remainingQuantity > 0) {
    targetDelivery.inspections.push({
      id: generateId('IN', inspectionIdCounter++),
      status: INSPECTION_STATUS.PENDING,
      approvedQuantity: 0,
      rejectedQuantity: 0,
      inspectedBy: null,
      inspectedAt: null,
      reason: null,
      deduction: 0
    });
  }

  contracts.set(contractId, contract);
  
  res.json({ 
    success: true, 
    data: { 
      inspection: pendingInspection,
      message: remainingQuantity > 0 ? `还有 ${remainingQuantity} 待验收` : '该批次验收完成'
    }
  });
});

app.post('/api/contracts/:contractId/payments', (req, res) => {
  const { contractId } = req.params;
  const { paymentTermId, triggerReason, amount, requestedBy } = req.body;

  const contract = contracts.get(contractId);
  if (!contract) {
    return res.status(404).json({ success: false, message: '合同不存在' });
  }

  if (contract.status === CONTRACT_STATUS.CLOSED) {
    return res.status(400).json({ success: false, message: '合同已关闭' });
  }

  const existingPayment = contract.payments.find(p => p.paymentTermId === paymentTermId && p.status !== PAYMENT_STATUS.SUSPENDED);
  if (existingPayment) {
    return res.status(400).json({ 
      success: false, 
      message: '该付款节点已触发，无法重复操作' 
    });
  }

  const stats = calculateContractStats(contract);
  
  if (stats.pendingInspections.length > 0) {
    return res.status(400).json({ 
      success: false, 
      message: `存在 ${stats.pendingInspections.length} 个待验收批次，请先完成验收再申请付款`,
      pendingInspections: stats.pendingInspections
    });
  }

  const paymentTerm = contract.paymentTerms.find(pt => pt.id === paymentTermId);
  if (!paymentTerm) {
    return res.status(404).json({ success: false, message: '付款条款不存在' });
  }

  const paymentId = generateId('PY', paymentIdCounter++);
  const payment = {
    id: paymentId,
    paymentTermId,
    paymentTermName: paymentTerm.name,
    amount: amount || stats.payableAmount * (paymentTerm.percentage / 100),
    status: PAYMENT_STATUS.TRIGGERED,
    triggerReason: triggerReason || '合同履约达标',
    triggeredBy: requestedBy || '系统',
    triggeredAt: new Date().toISOString(),
    auditInfo: {
      completionRate: stats.completionRate,
      totalAccepted: stats.totalAccepted,
      totalRejected: stats.totalRejected,
      totalDeduction: stats.totalDeduction,
      deductibleAmount: amount || stats.payableAmount * (paymentTerm.percentage / 100)
    }
  };

  contract.payments.push(payment);
  contracts.set(contractId, contract);
  
  res.status(201).json({ success: true, data: payment });
});

app.post('/api/contracts/:contractId/payments/:paymentId/suspend', (req, res) => {
  const { contractId, paymentId } = req.params;
  const { reason, suspendedBy } = req.body;

  const contract = contracts.get(contractId);
  if (!contract) {
    return res.status(404).json({ success: false, message: '合同不存在' });
  }

  const payment = contract.payments.find(p => p.id === paymentId);
  if (!payment) {
    return res.status(404).json({ success: false, message: '付款记录不存在' });
  }

  if (payment.status === PAYMENT_STATUS.PAID) {
    return res.status(400).json({ success: false, message: '付款已完成，无法暂缓' });
  }

  payment.status = PAYMENT_STATUS.SUSPENDED;
  payment.suspendedBy = suspendedBy || '系统';
  payment.suspendedAt = new Date().toISOString();
  payment.suspendReason = reason || '暂缓';

  contracts.set(contractId, contract);
  
  res.json({ success: true, data: payment });
});

app.get('/api/contracts/:contractId', (req, res) => {
  const { contractId } = req.params;
  const contract = contracts.get(contractId);
  
  if (!contract) {
    return res.status(404).json({ success: false, message: '合同不存在' });
  }

  const stats = calculateContractStats(contract);
  
  res.json({
    success: true,
    data: {
      contract,
      stats: {
        completionRate: stats.completionRate,
        totalAmount: stats.totalAmount,
        totalDeduction: stats.totalDeduction,
        payableAmount: stats.payableAmount,
        deductionReasons: stats.deductionReasons,
        pendingInspections: stats.pendingInspections
      },
      payments: contract.payments.map(p => ({
        ...p,
        auditInfo: p.auditInfo
      }))
    }
  });
});

app.post('/api/contracts/:contractId/close', (req, res) => {
  const { contractId } = req.params;
  const { reason, closedBy } = req.body;

  const contract = contracts.get(contractId);
  if (!contract) {
    return res.status(404).json({ success: false, message: '合同不存在' });
  }

  if (contract.status === CONTRACT_STATUS.CLOSED) {
    return res.status(400).json({ success: false, message: '合同已关闭' });
  }

  contract.status = CONTRACT_STATUS.CLOSED;
  contract.closedAt = new Date().toISOString();
  contract.closedReason = reason || '合同完成';
  contract.closedBy = closedBy || '系统';

  contracts.set(contractId, contract);
  
  res.json({ success: true, data: contract });
});

app.get('/api/contracts', (req, res) => {
  const contractList = Array.from(contracts.values()).map(c => {
    const stats = calculateContractStats(c);
    return {
      id: c.id,
      contractNo: c.contractNo,
      supplier: c.supplier,
      status: c.status,
      completionRate: stats.completionRate,
      payableAmount: stats.payableAmount,
      pendingInspectionsCount: stats.pendingInspections.length,
      createdAt: c.createdAt
    };
  });
  
  res.json({ success: true, data: contractList });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`采购合同履约 API 已启动: http://localhost:${PORT}`);
  console.log('\nAPI 端点:');
  console.log('POST /api/contracts              - 创建合同');
  console.log('POST /api/contracts/:id/deliveries - 登记交付');
  console.log('POST /api/contracts/:id/inspections - 验收');
  console.log('POST /api/contracts/:id/payments - 触发付款');
  console.log('POST /api/contracts/:id/payments/:pid/suspend - 暂缓付款');
  console.log('GET  /api/contracts/:id          - 查询合同详情');
  console.log('GET  /api/contracts              - 查询合同列表');
  console.log('POST /api/contracts/:id/close    - 关闭合同');
});

module.exports = app;
