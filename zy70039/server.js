const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const data = {
  balances: new Map(),
  violations: new Map(),
  flows: [],
  processRecords: new Map(),
};

const VIOLATION_STATUS = {
  PENDING: '待处理',
  FROZEN: '已冻结',
  DEDUCTED: '已扣罚',
  APPEALING: '申诉中',
  ROLLED_BACK: '已回滚',
  REJECTED: '已拒绝',
};

function getBalance(riderId) {
  return data.balances.get(riderId) || {
    riderId,
    available: 1000,
    frozen: 0,
    total: 1000,
  };
}

function saveBalance(balance) {
  balance.total = balance.available + balance.frozen;
  data.balances.set(balance.riderId, balance);
  return balance;
}

function addFlow(riderId, type, amount, relatedId, remark) {
  const flow = {
    id: uuidv4(),
    riderId,
    type,
    amount,
    relatedId,
    remark,
    balanceSnapshot: JSON.parse(JSON.stringify(getBalance(riderId))),
    createdAt: new Date().toISOString(),
  };
  data.flows.push(flow);
  return flow;
}

function addProcessRecord(violationId, action, status, remark = '', operator = '系统') {
  const record = {
    id: uuidv4(),
    violationId,
    action,
    status,
    remark,
    operator,
    createdAt: new Date().toISOString(),
  };
  
  if (!data.processRecords.has(violationId)) {
    data.processRecords.set(violationId, []);
  }
  data.processRecords.get(violationId).push(record);
  return record;
}

function getProcessRecords(violationId) {
  return data.processRecords.get(violationId) || [];
}

app.post('/api/violations', (req, res) => {
  const { riderId, violationType, amount, description } = req.body;
  
  if (!riderId || !violationType || amount === undefined || amount === null) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数',
    });
  }
  
  const amountNum = Number(amount);
  
  if (isNaN(amountNum) || !isFinite(amountNum)) {
    return res.status(400).json({
      success: false,
      message: '扣罚金额必须是有效数字',
    });
  }
  
  if (amountNum <= 0) {
    return res.status(400).json({
      success: false,
      message: '扣罚金额必须大于0',
    });
  }
  
  const violation = {
    id: uuidv4(),
    riderId,
    violationType,
    amount: amountNum,
    description,
    status: VIOLATION_STATUS.PENDING,
    currentStep: '创建违规单',
    createdAt: new Date().toISOString(),
  };
  
  data.violations.set(violation.id, violation);
  addProcessRecord(violation.id, '创建违规单', violation.status, description);
  
  res.json({
    success: true,
    data: violation,
  });
});

app.get('/api/violations/:id', (req, res) => {
  const violation = data.violations.get(req.params.id);
  
  if (!violation) {
    return res.status(404).json({
      success: false,
      message: '违规单不存在',
    });
  }
  
  res.json({
    success: true,
    data: violation,
  });
});

app.get('/api/violations', (req, res) => {
  const { riderId, status } = req.query;
  let list = Array.from(data.violations.values());
  
  if (riderId) {
    list = list.filter(v => v.riderId === riderId);
  }
  if (status) {
    list = list.filter(v => v.status === status);
  }
  
  res.json({
    success: true,
    data: list,
  });
});

app.post('/api/violations/:id/freeze', (req, res) => {
  const violation = data.violations.get(req.params.id);
  
  if (!violation) {
    return res.status(404).json({
      success: false,
      message: '违规单不存在',
    });
  }
  
  if (violation.status === VIOLATION_STATUS.FROZEN || 
      violation.status === VIOLATION_STATUS.DEDUCTED) {
    const prevRecords = getProcessRecords(violation.id);
    return res.status(400).json({
      success: false,
      message: '该违规单已冻结，请勿重复操作',
      currentStep: violation.currentStep,
      previousRecord: prevRecords[prevRecords.length - 1],
    });
  }
  
  if (violation.status === VIOLATION_STATUS.ROLLED_BACK) {
    const prevRecords = getProcessRecords(violation.id);
    return res.status(400).json({
      success: false,
      message: '该违规单已申诉回滚，不能再次冻结',
      currentStep: violation.currentStep,
      previousRecord: prevRecords[prevRecords.length - 1],
    });
  }
  
  const balance = getBalance(violation.riderId);
  
  if (balance.available < violation.amount) {
    addProcessRecord(violation.id, '冻结申请', VIOLATION_STATUS.REJECTED, 
      `余额不足，可用余额${balance.available}元，需要${violation.amount}元`, '风控系统');
    violation.status = VIOLATION_STATUS.REJECTED;
    violation.currentStep = '冻结申请被拒绝';
    data.violations.set(violation.id, violation);
    
    const prevRecords = getProcessRecords(violation.id);
    return res.status(400).json({
      success: false,
      message: '骑手保证金可用余额不足',
      currentStep: violation.currentStep,
      previousRecord: prevRecords[prevRecords.length - 2],
      currentRecord: prevRecords[prevRecords.length - 1],
    });
  }
  
  balance.available -= violation.amount;
  balance.frozen += violation.amount;
  saveBalance(balance);
  
  violation.status = VIOLATION_STATUS.FROZEN;
  violation.currentStep = '保证金已冻结';
  data.violations.set(violation.id, violation);
  
  addProcessRecord(violation.id, '执行冻结', violation.status, 
    `冻结金额${violation.amount}元`);
  
  res.json({
    success: true,
    data: {
      violation,
      balance: getBalance(violation.riderId),
    },
  });
});

app.post('/api/violations/:id/deduct', (req, res) => {
  const violation = data.violations.get(req.params.id);
  
  if (!violation) {
    return res.status(404).json({
      success: false,
      message: '违规单不存在',
    });
  }
  
  if (violation.status === VIOLATION_STATUS.DEDUCTED) {
    const prevRecords = getProcessRecords(violation.id);
    return res.status(400).json({
      success: false,
      message: '该违规单已扣罚，请勿重复操作',
      currentStep: violation.currentStep,
      previousRecord: prevRecords[prevRecords.length - 1],
    });
  }
  
  if (violation.status !== VIOLATION_STATUS.FROZEN) {
    return res.status(400).json({
      success: false,
      message: '只能对已冻结的违规单执行扣罚',
      currentStep: violation.currentStep,
    });
  }
  
  const balance = getBalance(violation.riderId);
  balance.frozen -= violation.amount;
  saveBalance(balance);
  
  addFlow(violation.riderId, '扣罚', -violation.amount, violation.id,
    `违规单扣罚：${violation.violationType}`);
  
  violation.status = VIOLATION_STATUS.DEDUCTED;
  violation.currentStep = '保证金已扣罚';
  data.violations.set(violation.id, violation);
  
  addProcessRecord(violation.id, '执行扣罚', violation.status,
    `扣罚金额${violation.amount}元`);
  
  res.json({
    success: true,
    data: {
      violation,
      balance: getBalance(violation.riderId),
    },
  });
});

app.post('/api/violations/:id/appeal', (req, res) => {
  const { appealReason } = req.body;
  const violation = data.violations.get(req.params.id);
  
  if (!violation) {
    return res.status(404).json({
      success: false,
      message: '违规单不存在',
    });
  }
  
  if (violation.status === VIOLATION_STATUS.PENDING) {
    return res.status(400).json({
      success: false,
      message: '待处理的违规单无需申诉',
      currentStep: violation.currentStep,
    });
  }
  
  if (violation.status === VIOLATION_STATUS.ROLLED_BACK) {
    const prevRecords = getProcessRecords(violation.id);
    return res.status(400).json({
      success: false,
      message: '该违规单已申诉回滚',
      currentStep: violation.currentStep,
      previousRecord: prevRecords[prevRecords.length - 1],
    });
  }
  
  violation.statusBeforeAppeal = violation.status;
  violation.status = VIOLATION_STATUS.APPEALING;
  violation.currentStep = '申诉审核中';
  data.violations.set(violation.id, violation);
  
  addProcessRecord(violation.id, '提交申诉', violation.status, appealReason || '骑手提交申诉', '骑手');
  
  res.json({
    success: true,
    data: violation,
  });
});

app.post('/api/violations/:id/review', (req, res) => {
  const { approved, rejectReason } = req.body;
  const violation = data.violations.get(req.params.id);
  
  if (!violation) {
    return res.status(404).json({
      success: false,
      message: '违规单不存在',
    });
  }
  
  if (violation.status !== VIOLATION_STATUS.APPEALING) {
    return res.status(400).json({
      success: false,
      message: '只有申诉中的违规单才能审核',
      currentStep: violation.currentStep,
    });
  }
  
  if (approved) {
    const balance = getBalance(violation.riderId);
    
    if (violation.statusBeforeAppeal === VIOLATION_STATUS.FROZEN) {
      balance.frozen -= violation.amount;
      balance.available += violation.amount;
      saveBalance(balance);
    } else if (violation.statusBeforeAppeal === VIOLATION_STATUS.DEDUCTED) {
      balance.available += violation.amount;
      saveBalance(balance);
      addFlow(violation.riderId, '回滚', violation.amount, violation.id,
        `申诉回滚：${violation.violationType}`);
    }
    
    violation.status = VIOLATION_STATUS.ROLLED_BACK;
    violation.currentStep = '申诉成功，已回滚';
    data.violations.set(violation.id, violation);
    
    addProcessRecord(violation.id, '申诉审核通过', violation.status,
      '申诉成功，保证金已回滚', '审核员');
    
    res.json({
      success: true,
      data: {
        violation,
        balance: getBalance(violation.riderId),
      },
    });
  } else {
    violation.status = violation.statusBeforeAppeal || VIOLATION_STATUS.FROZEN;
    violation.currentStep = `申诉被驳回：${rejectReason || '申诉不成立'}`;
    data.violations.set(violation.id, violation);
    
    addProcessRecord(violation.id, '申诉审核驳回', violation.status,
      rejectReason || '申诉不成立', '审核员');
    
    const records = getProcessRecords(violation.id);
    res.json({
      success: true,
      data: {
        violation,
        currentStep: violation.currentStep,
        previousRecord: records[records.length - 2],
      },
    });
  }
});

app.get('/api/flows', (req, res) => {
  const { riderId, type, startDate, endDate } = req.query;
  let list = [...data.flows];
  
  if (riderId) {
    list = list.filter(f => f.riderId === riderId);
  }
  if (type) {
    list = list.filter(f => f.type === type);
  }
  
  res.json({
    success: true,
    data: list,
  });
});

app.get('/api/balances/:riderId', (req, res) => {
  res.json({
    success: true,
    data: getBalance(req.params.riderId),
  });
});

app.post('/api/reconcile', (req, res) => {
  const { riderId, externalBalance } = req.body;
  
  const balance = getBalance(riderId);
  const flows = data.flows.filter(f => f.riderId === riderId);
  
  let flowSum = 0;
  flows.forEach(f => {
    if (f.type === '冻结' || f.type === '扣罚') {
      flowSum += f.amount;
    } else if (f.type === '回滚') {
      flowSum += f.amount;
    }
  });
  
  const expectedBalance = 1000 + flowSum;
  const matchesInternal = Math.abs(expectedBalance - balance.total) < 0.01;
  const matchesExternal = externalBalance === undefined ? true : 
    Math.abs(externalBalance - balance.total) < 0.01;
  
  res.json({
    success: true,
    data: {
      riderId,
      currentBalance: balance,
      flowCount: flows.length,
      flowSum,
      expectedFromFlows: expectedBalance,
      internalConsistent: matchesInternal,
      externalConsistent: matchesExternal,
      difference: externalBalance !== undefined ? 
        (balance.total - externalBalance).toFixed(2) : null,
    },
  });
});

app.get('/api/violations/:id/trace', (req, res) => {
  const violation = data.violations.get(req.params.id);
  
  if (!violation) {
    return res.status(404).json({
      success: false,
      message: '违规单不存在',
    });
  }
  
  const records = getProcessRecords(req.params.id);
  
  res.json({
    success: true,
    data: {
      violation,
      currentStep: violation.currentStep,
      totalSteps: records.length,
      history: records,
      previousRecord: records.length >= 2 ? records[records.length - 2] : null,
      lastRecord: records[records.length - 1] || null,
    },
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    stats: {
      violations: data.violations.size,
      flows: data.flows.length,
      riders: data.balances.size,
    },
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`骑手保证金扣罚 API 服务已启动，端口：${PORT}`);
  console.log('健康检查：http://localhost:3000/api/health');
});

module.exports = app;
