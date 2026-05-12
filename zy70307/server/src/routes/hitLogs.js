const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { Parser } = require('json2csv');
const { loadData, saveData, generateId } = require('../utils/dataStore');
const { evaluateRequest, generateMockRequests } = require('../services/rateLimitEngine');

router.get('/', (req, res) => {
  const data = loadData();
  const { releaseId, decision, tenantId, limit = 100, offset = 0 } = req.query;
  
  let logs = data.hitLogs;
  
  if (releaseId) {
    logs = logs.filter(l => l.releaseId === releaseId);
  }
  if (decision) {
    logs = logs.filter(l => l.decision === decision);
  }
  if (tenantId) {
    logs = logs.filter(l => l.tenantId === tenantId);
  }
  
  logs = logs.sort((a, b) => new Date(b.hitAt) - new Date(a.hitAt));
  
  const paginated = logs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({ 
    success: true, 
    data: paginated,
    total: logs.length,
  });
});

router.get('/stats', (req, res) => {
  const data = loadData();
  const { releaseId, startDate, endDate } = req.query;
  
  let logs = data.hitLogs;
  
  if (releaseId) {
    logs = logs.filter(l => l.releaseId === releaseId);
  }
  if (startDate) {
    logs = logs.filter(l => new Date(l.hitAt) >= new Date(startDate));
  }
  if (endDate) {
    logs = logs.filter(l => new Date(l.hitAt) <= new Date(endDate));
  }
  
  const stats = {
    totalRequests: logs.length,
    allowed: logs.filter(l => l.decision === 'ALLOW').length,
    rateLimited: logs.filter(l => l.decision === 'RATE_LIMITED').length,
    rejected: logs.filter(l => l.decision === 'REJECTED').length,
    vipExempted: logs.filter(l => l.vipExempted).length,
    byRule: {},
    byRegion: {},
    byTenant: {},
    byHour: {},
    topBlockedTenants: [],
    releaseComparison: [],
  };
  
  logs.forEach(log => {
    if (log.ruleName) {
      stats.byRule[log.ruleName] = (stats.byRule[log.ruleName] || 0) + 1;
    }
    if (log.region) {
      stats.byRegion[log.region] = (stats.byRegion[log.region] || 0) + 1;
    }
    if (log.tenantName) {
      stats.byTenant[log.tenantName] = (stats.byTenant[log.tenantName] || 0) + 1;
    }
    const hour = dayjs(log.hitAt).format('YYYY-MM-DD HH:00');
    stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
  });
  
  const blockedByTenant = {};
  logs.filter(l => l.decision !== 'ALLOW').forEach(log => {
    if (log.tenantName) {
      blockedByTenant[log.tenantName] = (blockedByTenant[log.tenantName] || 0) + 1;
    }
  });
  stats.topBlockedTenants = Object.entries(blockedByTenant)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));
  
  const releaseGroups = {};
  logs.forEach(log => {
    if (!releaseGroups[log.releaseId]) {
      releaseGroups[log.releaseId] = {
        releaseId: log.releaseId,
        releaseName: log.releaseName,
        releaseVersion: log.releaseVersion,
        total: 0,
        allowed: 0,
        blocked: 0,
      };
    }
    releaseGroups[log.releaseId].total++;
    if (log.decision === 'ALLOW') {
      releaseGroups[log.releaseId].allowed++;
    } else {
      releaseGroups[log.releaseId].blocked++;
    }
  });
  stats.releaseComparison = Object.values(releaseGroups).map(g => ({
    ...g,
    blockRate: g.total > 0 ? ((g.blocked / g.total) * 100).toFixed(2) : 0,
  }));
  
  res.json({ success: true, data: stats });
});

router.get('/export', (req, res) => {
  const data = loadData();
  const { releaseId, format = 'csv' } = req.query;
  
  let logs = data.hitLogs;
  if (releaseId) {
    logs = logs.filter(l => l.releaseId === releaseId);
  }
  
  const exportData = logs.map(log => ({
    命中时间: dayjs(log.hitAt).format('YYYY-MM-DD HH:mm:ss'),
    发布批次: log.releaseName || '-',
    版本: log.releaseVersion || '-',
    租户: log.tenantName || log.tenantId || '-',
    地区: log.region || '-',
    接口路径: log.path || '-',
    决策: log.decision === 'ALLOW' ? '放行' : log.decision === 'RATE_LIMITED' ? '限速' : '拒绝',
    命中规则: log.ruleName || '-',
    规则优先级: log.rulePriority || '-',
    VIP豁免: log.vipExempted ? '是' : '否',
    说明: log.explanation || '-',
  }));
  
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=rate-limit-report-${dayjs().format('YYYYMMDDHHmmss')}.json`);
    res.json(exportData);
  } else {
    const parser = new Parser();
    const csv = parser.parse(exportData);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=rate-limit-report-${dayjs().format('YYYYMMDDHHmmss')}.csv`);
    res.send('\uFEFF' + csv);
  }
});

router.post('/simulate', (req, res) => {
  const data = loadData();
  const { count = 20 } = req.body;
  
  const activeRules = data.rules.filter(r => r.status === 'ACTIVE');
  const mockRequests = generateMockRequests(count);
  
  const newLogs = mockRequests.map((req, idx) => {
    const result = evaluateRequest(
      { ...req, simulateIndex: idx },
      activeRules,
      data.tenants,
      data.interfaceGroups,
      data.regions
    );
    
    const tenant = data.tenants.find(t => t.id === req.tenantId);
    const region = data.regions.find(r => r.code === req.regionCode);
    const matchedRule = result.matchedRules[0];
    
    return {
      id: generateId(),
      releaseId: data.currentRelease?.id || null,
      releaseName: data.currentRelease?.name || '未激活',
      releaseVersion: data.currentRelease?.version || '-',
      tenantId: req.tenantId,
      tenantName: tenant?.name || req.tenantId,
      regionCode: req.regionCode,
      region: region?.name || req.regionCode,
      path: req.path,
      decision: result.decision,
      ruleId: matchedRule?.ruleId || null,
      ruleName: matchedRule?.ruleName || null,
      rulePriority: matchedRule?.priority || null,
      vipExempted: result.vipExempted,
      explanation: result.explanations[result.explanations.length - 1] || '',
      hitAt: dayjs().subtract(Math.floor(Math.random() * 300), 'second').toISOString(),
    };
  });
  
  data.hitLogs = [...newLogs, ...data.hitLogs].slice(0, 5000);
  saveData(data);
  
  res.json({ success: true, data: newLogs });
});

module.exports = router;
