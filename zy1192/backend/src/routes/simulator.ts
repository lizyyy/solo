import { Router, Request, Response } from 'express';
import { SimulationConfig, SimulationResult, Example } from '../types';
import { SimulationEngine } from '../simulator/simulation-engine';

const router = Router();
const simulator = new SimulationEngine();

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

router.get('/examples', (_req: Request, res: Response) => {
  const examples = simulator.getExamples();
  res.json({
    success: true,
    data: examples,
  });
});

router.get('/examples/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const examples = simulator.getExamples();
  const example = examples.find((e) => e.id === id);

  if (!example) {
    res.status(404).json({
      success: false,
      error: `Example with id "${id}" not found`,
    });
    return;
  }

  res.json({
    success: true,
    data: example,
  });
});

router.post('/simulate', (req: Request, res: Response) => {
  try {
    const config = req.body as SimulationConfig;

    if (!config.threadCount || config.threadCount < 1) {
      res.status(400).json({
        success: false,
        error: 'threadCount must be at least 1',
      });
      return;
    }

    if (!config.lockType) {
      res.status(400).json({
        success: false,
        error: 'lockType is required',
      });
      return;
    }

    const validLockTypes = ['mutex', 'rwlock', 'spinlock', 'cas', 'lock-free-queue'];
    if (!validLockTypes.includes(config.lockType)) {
      res.status(400).json({
        success: false,
        error: `Invalid lockType. Must be one of: ${validLockTypes.join(', ')}`,
      });
      return;
    }

    if (config.contentionLevel && !['low', 'medium', 'high'].includes(config.contentionLevel)) {
      res.status(400).json({
        success: false,
        error: 'contentionLevel must be one of: low, medium, high',
      });
      return;
    }

    if (config.duration !== undefined && (config.duration < 1 || config.duration > 100)) {
      res.status(400).json({
        success: false,
        error: 'duration must be between 1 and 100',
      });
      return;
    }

    const result: SimulationResult = simulator.run(config);

    const lockStatesObj: Record<string, unknown> = {};
    for (const [key, value] of result.lockStates.entries()) {
      lockStatesObj[key] = value;
    }

    res.json({
      success: true,
      data: {
        ...result,
        lockStates: lockStatesObj,
      },
    });
  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during simulation',
    });
  }
});

router.post('/simulate/aba-demo', (req: Request, res: Response) => {
  try {
    const { mode } = req.body as { mode?: string };

    if (!mode || !['cas', 'queue', 'version-tagged'].includes(mode)) {
      res.status(400).json({
        success: false,
        error: 'mode must be one of: cas, queue, version-tagged',
      });
      return;
    }

    const result = simulator.runABADemo(mode as 'cas' | 'queue' | 'version-tagged');

    const lockStatesObj: Record<string, unknown> = {};
    for (const [key, value] of result.lockStates.entries()) {
      lockStatesObj[key] = value;
    }

    res.json({
      success: true,
      data: {
        ...result,
        lockStates: lockStatesObj,
      },
    });
  } catch (error) {
    console.error('ABA demo error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during ABA demo',
    });
  }
});

router.post('/export/markdown', (req: Request, res: Response) => {
  try {
    const result = req.body as SimulationResult;

    if (!result || !result.config) {
      res.status(400).json({
        success: false,
        error: 'Invalid simulation result',
      });
      return;
    }

    const markdown = generateMarkdownReport(result);

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename=simulation-report.md');
    res.send(markdown);
  } catch (error) {
    console.error('Markdown export error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during export',
    });
  }
});

router.post('/export/json', (req: Request, res: Response) => {
  try {
    const result = req.body as SimulationResult;

    if (!result || !result.config) {
      res.status(400).json({
        success: false,
        error: 'Invalid simulation result',
      });
      return;
    }

    const lockStatesObj: Record<string, unknown> = {};
    for (const [key, value] of result.lockStates.entries()) {
      lockStatesObj[key] = value;
    }

    const exportData = {
      ...result,
      lockStates: lockStatesObj,
      exportTime: new Date().toISOString(),
      version: '1.0.0',
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=simulation-report.json');
    res.json(exportData);
  } catch (error) {
    console.error('JSON export error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during export',
    });
  }
});

function generateMarkdownReport(result: SimulationResult): string {
  const { config, metrics, threads, timeline, abaEvents, casOperations } = result;

  const lockTypeNames: Record<string, string> = {
    mutex: '互斥锁 (Mutex)',
    rwlock: '读写锁 (Read-Write Lock)',
    spinlock: '自旋锁 (Spin Lock)',
    cas: '比较并交换 (CAS)',
    'lock-free-queue': '无锁队列 (Lock-Free Queue)',
  };

  const contentionNames: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
  };

  const eventTypeNames: Record<string, string> = {
    lock_acquire_attempt: '尝试获取锁',
    lock_acquire_success: '获取锁成功',
    lock_acquire_failed: '获取锁失败',
    lock_release: '释放锁',
    cas_attempt: 'CAS 尝试',
    cas_success: 'CAS 成功',
    cas_failed: 'CAS 失败',
    enqueue_attempt: '入队尝试',
    enqueue_success: '入队成功',
    dequeue_attempt: '出队尝试',
    dequeue_success: '出队成功',
    spin_start: '自旋开始',
    spin_end: '自旋结束',
    wait_start: '等待开始',
    wait_end: '等待结束',
    thread_start: '线程开始',
    thread_end: '线程结束',
    aba_detected: 'ABA 事件检测',
  };

  let md = `# 并发原语可视化实验台 - 模拟报告

## 模拟配置

| 参数 | 值 |
|------|-----|
| 线程数量 | ${config.threadCount} |
| 锁类型 | ${lockTypeNames[config.lockType] || config.lockType} |
| 竞争强度 | ${contentionNames[config.contentionLevel] || config.contentionLevel} |
| 模拟时长 | ${config.duration} 步 |
| ABA 复现 | ${config.enableABAReproduction ? '已启用' : '未启用'} |

## 性能指标

| 指标 | 值 |
|------|-----|
| 总操作数 | ${metrics.totalOperations} |
| 成功操作数 | ${metrics.successfulOperations} |
| 失败操作数 | ${metrics.failedOperations} |
| 成功率 | ${metrics.totalOperations > 0 ? ((metrics.successfulOperations / metrics.totalOperations) * 100).toFixed(2) : 'N/A'}% |
| 总等待时间 | ${metrics.totalWaitTime.toFixed(2)} 单位 |
| 总自旋时间 | ${metrics.totalSpinTime.toFixed(2)} 单位 |
| 平均等待时间 | ${metrics.avgWaitTime.toFixed(2)} 单位 |
| 平均自旋时间 | ${metrics.avgSpinTime.toFixed(2)} 单位 |
| 吞吐量 | ${metrics.throughput.toFixed(2)} 操作/时间单位 |
| 竞争率 | ${(metrics.contentionRate * 100).toFixed(2)}% |
| ABA 事件数 | ${metrics.abaIncidents} |

## 线程状态

| 线程 ID | 名称 | 状态 | 开始时间 | 结束时间 |
|---------|------|------|----------|----------|
${threads.map((t) => `| ${t.id} | ${t.name} | ${t.state} | ${t.startTime} | ${t.endTime ?? '-'} |`).join('\n')}

## 关键事件时间线

${timeline.length > 0 ? `\`\`\`
${timeline.slice(0, 50).map((e) => `[${e.timestamp.toFixed(2)}] ${e.threadName}: ${eventTypeNames[e.eventType] || e.eventType} - ${JSON.stringify(e.details)}`).join('\n')}
${timeline.length > 50 ? `\n... (共 ${timeline.length} 个事件，显示前 50 个)` : ''}
\`\`\`` : '无事件记录'}
`;

  if (abaEvents.length > 0) {
    md += `

## ABA 事件详情

| 时间戳 | 线程 ID | 类型 | 之前值 | 之后值 | 之前版本 | 之后版本 |
|--------|---------|------|--------|--------|----------|----------|
${abaEvents.map((e) => `| ${e.timestamp.toFixed(2)} | ${e.threadId} | ${e.type} | ${e.beforeValue ?? '-'} | ${e.afterValue ?? '-'} | ${e.beforeVersion} | ${e.afterVersion} |`).join('\n')}
`;
  }

  if (casOperations.length > 0) {
    md += `

## CAS 操作详情

| 时间戳 | 线程 ID | 期望值 | 新值 | 实际值 | 结果 |
|--------|---------|--------|------|--------|------|
${casOperations.map((op) => `| ${op.timestamp.toFixed(2)} | ${op.threadId} | ${op.expected} | ${op.newValue} | ${op.actualValue} | ${op.success ? '✅ 成功' : '❌ 失败'} |`).join('\n')}
`;
  }

  md += `

---
*报告生成时间: ${new Date().toISOString()}*
*版本: 1.0.0*
`;

  return md;
}

export default router;
