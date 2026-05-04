const express = require('express');
const router = express.Router();
const ExperimentService = require('../services/ExperimentService');
const RateLimiterSimulator = require('../services/RateLimiterSimulator');

const experimentService = new ExperimentService();
const simulator = new RateLimiterSimulator();

router.get('/', (req, res) => {
  try {
    const experiments = experimentService.getAllExperiments();
    res.json({ success: true, data: experiments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const experiment = experimentService.getExperiment(req.params.id);
    if (!experiment) {
      return res.status(404).json({ success: false, error: '实验不存在' });
    }
    res.json({ success: true, data: experiment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const config = req.body;
    const result = simulator.runSimulation(config);
    const experiment = experimentService.createExperiment(config, result);
    res.json({ success: true, data: experiment });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/export/markdown', (req, res) => {
  try {
    const experiment = experimentService.getExperiment(req.params.id);
    if (!experiment) {
      return res.status(404).json({ success: false, error: '实验不存在' });
    }
    const markdown = generateMarkdownReport(experiment);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${experiment.name}.md"`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/export/json', (req, res) => {
  try {
    const experiment = experimentService.getExperiment(req.params.id);
    if (!experiment) {
      return res.status(404).json({ success: false, error: '实验不存在' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${experiment.name}.json"`);
    res.json(experiment);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function generateMarkdownReport(experiment) {
  const { config, result, createdAt, id } = experiment;
  const { tokenBucket, leakyBucket } = result;
  
  return `# 限流算法实验报告

## 基本信息
- **实验名称**: ${experiment.name}
- **实验ID**: ${id}
- **创建时间**: ${new Date(createdAt).toLocaleString()}
- **种子(Seed)**: ${config.seed || '随机'}

## 实验配置

### 流量配置
- **总请求数**: ${config.totalRequests}
- **突刺持续时间(秒)**: ${config.burstDuration}
- **突刺请求速率(RPS)**: ${config.burstRate}
- **平稳期持续时间(秒)**: ${config.steadyDuration}
- **平稳期请求速率(RPS)**: ${config.steadyRate}

### 令牌桶配置
- **令牌生成速率**: ${config.tokenRate} 个/秒
- **桶容量**: ${config.tokenCapacity} 个

### 漏桶配置
- **漏出速率**: ${config.leakRate} 个/秒
- **桶容量**: ${config.leakCapacity} 个
- **队列长度**: ${config.queueLength} 个
- **超时时间(毫秒)**: ${config.timeout}

## 实验结果对比

| 指标 | 令牌桶 | 漏桶 |
|------|--------|------|
| 总请求数 | ${tokenBucket.stats.total} | ${leakyBucket.stats.total} |
| 放行数 | ${tokenBucket.stats.allowed} | ${leakyBucket.stats.allowed} |
| 放行率 | ${(tokenBucket.stats.allowed / tokenBucket.stats.total * 100).toFixed(2)}% | ${(leakyBucket.stats.allowed / leakyBucket.stats.total * 100).toFixed(2)}% |
| 排队数 | ${tokenBucket.stats.queued} | ${leakyBucket.stats.queued} |
| 拒绝数 | ${tokenBucket.stats.rejected} | ${leakyBucket.stats.rejected} |
| 超时数 | ${tokenBucket.stats.timeout} | ${leakyBucket.stats.timeout} |
| 平均延迟(ms) | ${tokenBucket.stats.avgLatency.toFixed(2)} | ${leakyBucket.stats.avgLatency.toFixed(2)} |
| 最大延迟(ms) | ${tokenBucket.stats.maxLatency} | ${leakyBucket.stats.maxLatency} |

## 算法分析

### 令牌桶特点
1. **允许突发流量**: 当桶中有足够令牌时，可以瞬间处理大量请求
2. **平滑输出**: 令牌以恒定速率生成，长期来看流量被平滑
3. **适用场景**: 适用于需要允许一定突发流量的场景

### 漏桶特点
1. **严格限流**: 输出速率恒定，无论输入流量如何变化
2. **流量整形**: 可以将突发流量整形成恒定速率
3. **适用场景**: 适用于需要严格控制输出速率的场景

## 详细数据

### 令牌桶延迟分布
${generateLatencyDistributionMarkdown(tokenBucket.latencyDistribution)}

### 漏桶延迟分布
${generateLatencyDistributionMarkdown(leakyBucket.latencyDistribution)}

---
*报告由限流实验台自动生成*
`;
}

function generateLatencyDistributionMarkdown(distribution) {
  if (!distribution || distribution.length === 0) {
    return '无数据';
  }
  
  let markdown = '\n| 延迟范围(ms) | 请求数 | 占比 |\n';
  markdown += '|---------------|--------|------|\n';
  
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  
  for (const d of distribution) {
    const percentage = total > 0 ? (d.count / total * 100).toFixed(2) : '0.00';
    markdown += `| ${d.range} | ${d.count} | ${percentage}% |\n`;
  }
  
  return markdown;
}

module.exports = router;
