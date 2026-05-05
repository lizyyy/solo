const express = require('express');
const router = express.Router();
const { Experiment, Policy, TrafficTrace, DecisionLog, DependencyHealth } = require('../models');
const { ProtectionEngine } = require('../protections');
const { Op } = require('sequelize');

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (status) {
      where.status = status;
    }
    
    const { count, rows } = await Experiment.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('获取实验列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const experiment = await Experiment.findByPk(req.params.id);
    
    if (!experiment) {
      return res.status(404).json({ success: false, message: '实验不存在' });
    }
    
    res.json({ success: true, data: experiment });
  } catch (error) {
    console.error('获取实验详情失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, config } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: '实验名称不能为空' });
    }
    
    const experiment = await Experiment.create({
      name,
      description,
      status: 'draft',
      config: config || {}
    });
    
    res.status(201).json({ success: true, data: experiment });
  } catch (error) {
    console.error('创建实验失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const experiment = await Experiment.findByPk(req.params.id);
    
    if (!experiment) {
      return res.status(404).json({ success: false, message: '实验不存在' });
    }
    
    if (experiment.status === 'running') {
      return res.status(400).json({ success: false, message: '实验运行中，无法修改' });
    }
    
    const { name, description, config } = req.body;
    await experiment.update({ name, description, config });
    
    res.json({ success: true, data: experiment });
  } catch (error) {
    console.error('更新实验失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const experiment = await Experiment.findByPk(req.params.id);
    
    if (!experiment) {
      return res.status(404).json({ success: false, message: '实验不存在' });
    }
    
    await DecisionLog.destroy({ where: { experimentId: req.params.id } });
    await DependencyHealth.destroy({ where: { experimentId: req.params.id } });
    await experiment.destroy();
    
    res.json({ success: true, message: '实验已删除' });
  } catch (error) {
    console.error('删除实验失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/run', async (req, res) => {
  try {
    const experiment = await Experiment.findByPk(req.params.id);
    
    if (!experiment) {
      return res.status(404).json({ success: false, message: '实验不存在' });
    }
    
    if (experiment.status === 'running') {
      return res.status(400).json({ success: false, message: '实验已在运行中' });
    }
    
    const { config } = experiment;
    const { policyIds, trafficTraceId } = config;
    
    if (!policyIds || policyIds.length === 0) {
      return res.status(400).json({ success: false, message: '请配置策略' });
    }
    
    if (!trafficTraceId) {
      return res.status(400).json({ success: false, message: '请选择流量追踪' });
    }
    
    const policies = await Policy.findAll({
      where: { id: { [Op.in]: policyIds }, isActive: true }
    });
    
    const trafficTrace = await TrafficTrace.findByPk(trafficTraceId);
    if (!trafficTrace) {
      return res.status(404).json({ success: false, message: '流量追踪不存在' });
    }
    
    await experiment.update({ status: 'running', startTime: new Date() });
    
    runExperimentAsync(experiment, policies, trafficTrace);
    
    res.json({ success: true, message: '实验已启动', data: experiment });
  } catch (error) {
    console.error('启动实验失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

async function runExperimentAsync(experiment, policies, trafficTrace) {
  try {
    const engine = new ProtectionEngine();
    
    for (const policy of policies) {
      switch (policy.type) {
        case 'rate_limit':
          engine.addRateLimiter(policy.name, policy.rateLimitType, policy.config);
          break;
        case 'circuit_breaker':
          engine.addCircuitBreaker(policy.name, policy.config);
          break;
        case 'overload_protection':
          engine.addOverloadProtection(policy.name, policy.config);
          break;
      }
    }
    
    const requests = trafficTrace.data || [];
    const decisionLogs = [];
    const dependencyHealths = [];
    
    const protectionConfigs = policies.map(p => ({
      type: p.type,
      name: p.name,
      ...p.config
    }));
    
    let stats = {
      allow: 0,
      queue: 0,
      reject: 0,
      fallback: 0,
      totalLatency: 0,
      errorCount: 0
    };
    
    for (const request of requests) {
      const result = engine.evaluateRequest(request, protectionConfigs);
      
      const log = {
        experimentId: experiment.id,
        requestId: request.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: request.timestamp || new Date(),
        action: result.finalAction,
        policyType: result.triggeredPolicy?.type,
        policyId: result.triggeredPolicy?.id,
        reason: result.finalReason,
        requestInfo: request,
        responseInfo: request.responseInfo || {},
        latency: request.latency || 0
      };
      
      decisionLogs.push(log);
      
      stats[result.finalAction]++;
      stats.totalLatency += request.latency || 0;
      if (request.responseInfo?.statusCode >= 400) {
        stats.errorCount++;
      }
    }
    
    if (decisionLogs.length > 0) {
      await DecisionLog.bulkCreate(decisionLogs);
    }
    
    const result = {
      totalRequests: requests.length,
      allowCount: stats.allow,
      queueCount: stats.queue,
      rejectCount: stats.reject,
      fallbackCount: stats.fallback,
      errorRate: requests.length > 0 ? stats.errorCount / requests.length : 0,
      averageLatency: requests.length > 0 ? Math.round(stats.totalLatency / requests.length) : 0,
      protectionStats: engine.getStats()
    };
    
    await experiment.update({
      status: 'completed',
      endTime: new Date(),
      result
    });
    
    console.log(`实验 ${experiment.id} 执行完成`);
  } catch (error) {
    console.error('实验执行失败:', error);
    await experiment.update({
      status: 'failed',
      endTime: new Date(),
      result: { error: error.message }
    });
  }
}

router.get('/:id/result', async (req, res) => {
  try {
    const experiment = await Experiment.findByPk(req.params.id);
    
    if (!experiment) {
      return res.status(404).json({ success: false, message: '实验不存在' });
    }
    
    const decisionLogs = await DecisionLog.findAll({
      where: { experimentId: req.params.id },
      order: [['timestamp', 'ASC']]
    });
    
    const stats = {
      allow: 0,
      queue: 0,
      reject: 0,
      fallback: 0,
      totalLatency: 0,
      errorCount: 0
    };
    
    for (const log of decisionLogs) {
      stats[log.action]++;
      stats.totalLatency += log.latency || 0;
      if (log.responseInfo?.statusCode >= 400) {
        stats.errorCount++;
      }
    }
    
    const timeline = decisionLogs.map(log => ({
      timestamp: log.timestamp,
      action: log.action,
      reason: log.reason,
      policyType: log.policyType
    }));
    
    res.json({
      success: true,
      data: {
        experiment,
        stats: {
          ...stats,
          totalRequests: decisionLogs.length,
          errorRate: decisionLogs.length > 0 ? stats.errorCount / decisionLogs.length : 0,
          averageLatency: decisionLogs.length > 0 ? Math.round(stats.totalLatency / decisionLogs.length) : 0
        },
        timeline,
        decisionLogs
      }
    });
  } catch (error) {
    console.error('获取实验结果失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/export/:format', async (req, res) => {
  try {
    const { id, format } = req.params;
    const experiment = await Experiment.findByPk(id);
    
    if (!experiment) {
      return res.status(404).json({ success: false, message: '实验不存在' });
    }
    
    const decisionLogs = await DecisionLog.findAll({
      where: { experimentId: id },
      order: [['timestamp', 'ASC']]
    });
    
    let content, contentType, filename;
    
    if (format === 'markdown') {
      content = generateMarkdownReport(experiment, decisionLogs);
      contentType = 'text/markdown';
      filename = `experiment-${id}.md`;
    } else if (format === 'json') {
      content = JSON.stringify({
        experiment: experiment.toJSON(),
        decisionLogs: decisionLogs.map(log => log.toJSON())
      }, null, 2);
      contentType = 'application/json';
      filename = `experiment-${id}.json`;
    } else {
      return res.status(400).json({ success: false, message: '不支持的导出格式' });
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error('导出报告失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

function generateMarkdownReport(experiment, decisionLogs) {
  const stats = {
    allow: 0,
    queue: 0,
    reject: 0,
    fallback: 0,
    totalLatency: 0,
    errorCount: 0
  };
  
  for (const log of decisionLogs) {
    stats[log.action]++;
    stats.totalLatency += log.latency || 0;
    if (log.responseInfo?.statusCode >= 400) {
      stats.errorCount++;
    }
  }
  
  const totalRequests = decisionLogs.length;
  const errorRate = totalRequests > 0 ? (stats.errorCount / totalRequests * 100).toFixed(2) : '0';
  const avgLatency = totalRequests > 0 ? Math.round(stats.totalLatency / totalRequests) : 0;
  
  return `# 接口保护策略实验报告

## 实验基本信息

| 项目 | 内容 |
|------|------|
| 实验名称 | ${experiment.name} |
| 实验描述 | ${experiment.description || '无'} |
| 实验状态 | ${experiment.status} |
| 开始时间 | ${experiment.startTime || '未开始'} |
| 结束时间 | ${experiment.endTime || '未结束'} |

## 实验结果统计

| 指标 | 数值 | 占比 |
|------|------|------|
| 总请求数 | ${totalRequests} | 100% |
| 放行请求 | ${stats.allow} | ${totalRequests > 0 ? ((stats.allow / totalRequests) * 100).toFixed(2) : 0}% |
| 排队请求 | ${stats.queue} | ${totalRequests > 0 ? ((stats.queue / totalRequests) * 100).toFixed(2) : 0}% |
| 拒绝请求 | ${stats.reject} | ${totalRequests > 0 ? ((stats.reject / totalRequests) * 100).toFixed(2) : 0}% |
| 降级请求 | ${stats.fallback} | ${totalRequests > 0 ? ((stats.fallback / totalRequests) * 100).toFixed(2) : 0}% |
| 错误率 | ${errorRate}% | - |
| 平均延迟 | ${avgLatency}ms | - |

## 实验配置

\`\`\`json
${JSON.stringify(experiment.config, null, 2)}
\`\`\`

## 实验结果摘要

\`\`\`json
${JSON.stringify(experiment.result || {}, null, 2)}
\`\`\`

---
*报告生成时间: ${new Date().toISOString()}*
`;
}

module.exports = router;
