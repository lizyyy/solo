const express = require('express');
const app = express();
app.use(express.json());

const config = {
  maxRenewals: 3,
  defaultLeaseDays: 7,
  renewalDays: 7,
  dailyCost: 100
};

const data = {
  environments: [
    { id: 'env-001', name: '测试环境-A', status: 'available' },
    { id: 'env-002', name: '测试环境-B', status: 'available' },
    { id: 'env-003', name: '测试环境-C', status: 'available' }
  ],
  teams: [
    { id: 'team-001', name: '平台组' },
    { id: 'team-002', name: '电商项目组' },
    { id: 'team-003', name: '支付项目组' }
  ],
  leases: [],
  tasks: [],
  auditLogs: []
};

let nextLeaseId = 1;
let nextTaskId = 1;
let nextAuditId = 1;

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysBetween(start, end) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((end - start) / oneDay);
}

function getToday() {
  return new Date();
}

function addAuditLog(leaseId, action, actor, details) {
  const log = {
    id: `audit-${nextAuditId++}`,
    leaseId,
    action,
    actor,
    timestamp: new Date().toISOString(),
    details
  };
  data.auditLogs.push(log);
  return log;
}

function getTeamActiveLease(teamId) {
  return data.leases.find(l => 
    l.teamId === teamId && 
    (l.status === 'active' || l.status === 'approved')
  );
}

function getAvailableEnvironment() {
  return data.environments.find(e => e.status === 'available');
}

function calculateCost(lease) {
  const start = new Date(lease.startDate);
  const end = lease.releasedAt ? new Date(lease.releasedAt) : getToday();
  const days = Math.max(1, daysBetween(start, end) + 1);
  return days * config.dailyCost;
}

function checkExpiredLeases() {
  const today = formatDate(getToday());
  data.leases.forEach(lease => {
    if ((lease.status === 'active' || lease.status === 'approved') && lease.endDate < today) {
      lease.status = 'expired';
      if (lease.environmentId) {
        const env = data.environments.find(e => e.id === lease.environmentId);
        if (env) env.status = 'available';
      }
      data.tasks.forEach(task => {
        if (task.leaseId === lease.id && task.status === 'pending') {
          task.status = 'cancelled';
        }
      });
      addAuditLog(lease.id, 'expire', 'system', {
        reason: '到期自动释放',
        environmentId: lease.environmentId,
        finalCost: calculateCost(lease)
      });
    }
  });
}

setInterval(checkExpiredLeases, 60000);

app.post('/api/leases/apply', (req, res) => {
  const { teamId, requester, reason, days } = req.body;
  if (!teamId || !requester) {
    return res.status(400).json({ error: 'teamId 和 requester 为必填项' });
  }

  const team = data.teams.find(t => t.id === teamId);
  if (!team) {
    return res.status(404).json({ error: '团队不存在' });
  }

  checkExpiredLeases();
  if (getTeamActiveLease(teamId)) {
    return res.status(409).json({ 
      error: '同团队已有活跃环境',
      message: '每个团队只能同时占用一个环境'
    });
  }

  const leaseDays = days || config.defaultLeaseDays;
  const today = getToday();
  const lease = {
    id: `lease-${nextLeaseId++}`,
    teamId,
    teamName: team.name,
    requester,
    reason: reason || '',
    status: 'pending',
    renewalCount: 0,
    maxRenewals: config.maxRenewals,
    startDate: formatDate(today),
    endDate: formatDate(addDays(today, leaseDays - 1)),
    dailyCost: config.dailyCost,
    environmentId: null,
    environmentName: null,
    approver: null,
    approvedAt: null,
    releasedAt: null,
    createdAt: new Date().toISOString()
  };

  data.leases.push(lease);
  addAuditLog(lease.id, 'apply', requester, { teamId, reason, days: leaseDays });

  res.status(201).json(lease);
});

app.put('/api/leases/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approver } = req.body;
  const lease = data.leases.find(l => l.id === id);

  if (!lease) return res.status(404).json({ error: '申请不存在' });
  if (lease.status !== 'pending') return res.status(400).json({ error: '申请状态不允许审批' });
  if (!approver) return res.status(400).json({ error: 'approver 为必填项' });

  checkExpiredLeases();
  if (getTeamActiveLease(lease.teamId)) {
    return res.status(409).json({ error: '该团队已有活跃环境，无法审批通过' });
  }

  const env = getAvailableEnvironment();
  if (!env) {
    return res.status(400).json({ error: '暂无可用环境资源' });
  }

  lease.status = 'approved';
  lease.environmentId = env.id;
  lease.environmentName = env.name;
  lease.approver = approver;
  lease.approvedAt = new Date().toISOString();
  env.status = 'occupied';

  const task1 = {
    id: `task-${nextTaskId++}`,
    leaseId: lease.id,
    description: '部署应用服务',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  const task2 = {
    id: `task-${nextTaskId++}`,
    leaseId: lease.id,
    description: '初始化测试数据',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  data.tasks.push(task1, task2);

  addAuditLog(lease.id, 'approve', approver, {
    environmentId: env.id,
    environmentName: env.name
  });

  res.json(lease);
});

app.post('/api/leases/:id/renew', (req, res) => {
  const { id } = req.params;
  const { days } = req.body;
  const lease = data.leases.find(l => l.id === id);

  if (!lease) return res.status(404).json({ error: '租期不存在' });
  if (lease.status !== 'active' && lease.status !== 'approved') {
    return res.status(400).json({ error: '租期状态不允许续期' });
  }
  if (lease.renewalCount >= lease.maxRenewals) {
    return res.status(409).json({ 
      error: '续期次数已达上限',
      maxRenewals: lease.maxRenewals
    });
  }

  checkExpiredLeases();
  const today = formatDate(getToday());
  if (lease.endDate < today) {
    return res.status(400).json({ error: '租期已到期，无法续期' });
  }

  const renewalDays = days || config.renewalDays;
  const currentEnd = new Date(lease.endDate);
  lease.endDate = formatDate(addDays(currentEnd, renewalDays));
  lease.renewalCount += 1;
  if (lease.status === 'approved') {
    lease.status = 'active';
  }

  addAuditLog(lease.id, 'renew', lease.requester, {
    previousEndDate: formatDate(currentEnd),
    newEndDate: lease.endDate,
    renewalCount: lease.renewalCount,
    daysAdded: renewalDays
  });

  res.json(lease);
});

app.post('/api/leases/:id/release', (req, res) => {
  const { id } = req.params;
  const { actor } = req.body;
  const lease = data.leases.find(l => l.id === id);

  if (!lease) return res.status(404).json({ error: '租期不存在' });
  if (lease.status === 'released' || lease.status === 'expired') {
    return res.status(400).json({ error: '租期已释放或到期' });
  }

  const pendingTasks = data.tasks.filter(
    t => t.leaseId === lease.id && t.status === 'pending'
  );
  pendingTasks.forEach(t => { t.status = 'cancelled'; });

  if (lease.environmentId) {
    const env = data.environments.find(e => e.id === lease.environmentId);
    if (env) env.status = 'available';
  }

  lease.status = 'released';
  lease.releasedAt = new Date().toISOString();

  addAuditLog(lease.id, 'release', actor || lease.requester, {
    environmentId: lease.environmentId,
    cancelledTasks: pendingTasks.length,
    finalCost: calculateCost(lease)
  });

  res.json({
    ...lease,
    finalCost: calculateCost(lease),
    cancelledTasks: pendingTasks.length
  });
});

app.get('/api/environments', (req, res) => {
  checkExpiredLeases();
  const today = getToday();

  const environments = data.environments.map(env => {
    const lease = data.leases.find(
      l => l.environmentId === env.id && 
      (l.status === 'active' || l.status === 'approved' || l.status === 'expired')
    );

    let remainingDays = null;
    let currentCost = null;
    let teamName = null;

    if (lease && (lease.status === 'active' || lease.status === 'approved')) {
      const endDate = new Date(lease.endDate);
      remainingDays = daysBetween(today, endDate);
      currentCost = calculateCost(lease);
      teamName = lease.teamName;
    }

    return {
      ...env,
      currentLease: lease ? {
        id: lease.id,
        teamId: lease.teamId,
        teamName,
        requester: lease.requester,
        startDate: lease.startDate,
        endDate: lease.endDate,
        remainingDays,
        renewalCount: lease.renewalCount,
        maxRenewals: lease.maxRenewals,
        dailyCost: lease.dailyCost,
        currentCost
      } : null
    };
  });

  res.json(environments);
});

app.get('/api/leases/expiring', (req, res) => {
  checkExpiredLeases();
  const today = getToday();
  const daysAhead = parseInt(req.query.days) || 3;
  const thresholdDate = formatDate(addDays(today, daysAhead));

  const expiring = data.leases
    .filter(l => (l.status === 'active' || l.status === 'approved') && l.endDate <= thresholdDate)
    .map(l => {
      const remainingDays = daysBetween(today, new Date(l.endDate));
      return {
        id: l.id,
        teamId: l.teamId,
        teamName: l.teamName,
        environmentId: l.environmentId,
        environmentName: l.environmentName,
        requester: l.requester,
        endDate: l.endDate,
        remainingDays,
        renewalCount: l.renewalCount,
        canRenew: l.renewalCount < l.maxRenewals && remainingDays >= 0
      };
    })
    .sort((a, b) => a.remainingDays - b.remainingDays);

  res.json({
    thresholdDays: daysAhead,
    count: expiring.length,
    leases: expiring
  });
});

app.get('/api/statistics/cost', (req, res) => {
  checkExpiredLeases();
  const teamCosts = {};

  data.teams.forEach(team => {
    teamCosts[team.id] = {
      teamId: team.id,
      teamName: team.name,
      totalCost: 0,
      activeLeases: 0,
      completedLeases: 0,
      details: []
    };
  });

  data.leases.forEach(lease => {
    const cost = calculateCost(lease);
    const teamStat = teamCosts[lease.teamId];
    if (teamStat) {
      teamStat.totalCost += cost;
      if (lease.status === 'active' || lease.status === 'approved') {
        teamStat.activeLeases += 1;
      } else if (lease.status === 'released' || lease.status === 'expired') {
        teamStat.completedLeases += 1;
      }
      teamStat.details.push({
        leaseId: lease.id,
        environmentName: lease.environmentName,
        startDate: lease.startDate,
        endDate: lease.endDate,
        status: lease.status,
        cost
      });
    }
  });

  const totalCost = Object.values(teamCosts).reduce((sum, t) => sum + t.totalCost, 0);

  res.json({
    totalCost,
    teamBreakdown: Object.values(teamCosts)
  });
});

app.get('/api/audit-logs', (req, res) => {
  let logs = [...data.auditLogs].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  if (req.query.leaseId) {
    logs = logs.filter(l => l.leaseId === req.query.leaseId);
  }
  if (req.query.action) {
    logs = logs.filter(l => l.action === req.query.action);
  }
  if (req.query.limit) {
    logs = logs.slice(0, parseInt(req.query.limit));
  }

  res.json({
    total: logs.length,
    logs
  });
});

app.get('/api/leases/:id', (req, res) => {
  const lease = data.leases.find(l => l.id === req.params.id);
  if (!lease) return res.status(404).json({ error: '租期不存在' });

  checkExpiredLeases();
  const tasks = data.tasks.filter(t => t.leaseId === lease.id);
  const logs = data.auditLogs.filter(l => l.leaseId === lease.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json({
    ...lease,
    currentCost: calculateCost(lease),
    tasks,
    auditLogs: logs
  });
});

app.get('/api/teams', (req, res) => {
  res.json(data.teams);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`研发环境租期 API 运行在 http://localhost:${PORT}`);
  console.log('可用接口:');
  console.log('  POST /api/leases/apply      - 申请环境');
  console.log('  PUT  /api/leases/:id/approve - 审批申请');
  console.log('  POST /api/leases/:id/renew   - 续期');
  console.log('  POST /api/leases/:id/release - 主动释放');
  console.log('  GET  /api/environments       - 查询所有环境状态');
  console.log('  GET  /api/leases/expiring    - 查询即将到期');
  console.log('  GET  /api/statistics/cost    - 费用归属统计');
  console.log('  GET  /api/audit-logs         - 审计记录');
  console.log('  GET  /api/leases/:id         - 租期详情');
});
