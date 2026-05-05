import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db.js';

const router = Router();

function analyzeBottlenecks(currentResults, baselineResults, monitoringStats) {
  const bottlenecks = [];
  const issues = [];
  
  if (currentResults && currentResults.length > 0) {
    for (const result of currentResults) {
      if (result.error_rate > 5) {
        issues.push({
          type: 'error_rate',
          severity: result.error_rate > 20 ? 'high' : 'medium',
          message: `接口 ${result.interface_name || result.interface_path || '未知'} 错误率 ${result.error_rate.toFixed(2)}%，超过 5% 阈值`,
          interface_name: result.interface_name,
          interface_path: result.interface_path,
          value: result.error_rate,
          threshold: 5
        });
      }
      
      if (result.p95_response_time > 500) {
        issues.push({
          type: 'response_time_p95',
          severity: result.p95_response_time > 1000 ? 'high' : 'medium',
          message: `接口 ${result.interface_name || result.interface_path || '未知'} P95 响应时间 ${result.p95_response_time}ms，超过 500ms 阈值`,
          interface_name: result.interface_name,
          interface_path: result.interface_path,
          value: result.p95_response_time,
          threshold: 500
        });
      }
      
      if (result.p99_response_time > 2000) {
        issues.push({
          type: 'response_time_p99',
          severity: 'high',
          message: `接口 ${result.interface_name || result.interface_path || '未知'} P99 响应时间 ${result.p99_response_time}ms，超过 2s 阈值`,
          interface_name: result.interface_name,
          interface_path: result.interface_path,
          value: result.p99_response_time,
          threshold: 2000
        });
      }
    }
  }
  
  if (baselineResults && currentResults && baselineResults.length > 0 && currentResults.length > 0) {
    const baselineMap = new Map();
    baselineResults.forEach(r => {
      if (r.interface_id) baselineMap.set(r.interface_id, r);
    });
    
    for (const current of currentResults) {
      if (!current.interface_id) continue;
      const baseline = baselineMap.get(current.interface_id);
      if (!baseline) continue;
      
      if (baseline.avg_response_time > 0) {
        const degradation = ((current.avg_response_time - baseline.avg_response_time) / baseline.avg_response_time) * 100;
        if (degradation > 20) {
          issues.push({
            type: 'performance_degradation',
            severity: degradation > 50 ? 'high' : 'medium',
            message: `接口 ${current.interface_name || current.interface_path || '未知'} 响应时间较基线下降 ${degradation.toFixed(1)}%`,
            interface_name: current.interface_name,
            interface_path: current.interface_path,
            baseline_value: baseline.avg_response_time,
            current_value: current.avg_response_time,
            degradation_percent: degradation
          });
        }
      }
      
      if (baseline.qps > 0 && current.qps > 0) {
        const qpsChange = ((current.qps - baseline.qps) / baseline.qps) * 100;
        if (qpsChange < -10) {
          issues.push({
            type: 'throughput_degradation',
            severity: qpsChange < -30 ? 'high' : 'medium',
            message: `接口 ${current.interface_name || current.interface_path || '未知'} QPS 较基线下降 ${Math.abs(qpsChange).toFixed(1)}%`,
            interface_name: current.interface_name,
            interface_path: current.interface_path,
            baseline_value: baseline.qps,
            current_value: current.qps,
            change_percent: qpsChange
          });
        }
      }
    }
  }
  
  if (monitoringStats && monitoringStats.cpu) {
    if (monitoringStats.cpu.max > 90) {
      issues.push({
        type: 'cpu',
        severity: 'high',
        message: `CPU 峰值达到 ${monitoringStats.cpu.max.toFixed(1)}%，超过 90% 阈值，存在 CPU 瓶颈`,
        value: monitoringStats.cpu.max,
        threshold: 90
      });
    } else if (monitoringStats.cpu.avg > 70) {
      issues.push({
        type: 'cpu',
        severity: 'medium',
        message: `CPU 平均使用率 ${monitoringStats.cpu.avg.toFixed(1)}%，超过 70% 建议阈值`,
        value: monitoringStats.cpu.avg,
        threshold: 70
      });
    }
  }
  
  if (monitoringStats && monitoringStats.memory) {
    if (monitoringStats.memory.max > 95) {
      issues.push({
        type: 'memory',
        severity: 'high',
        message: `内存峰值达到 ${monitoringStats.memory.max.toFixed(1)}%，超过 95% 阈值，存在内存瓶颈`,
        value: monitoringStats.memory.max,
        threshold: 95
      });
    } else if (monitoringStats.memory.avg > 85) {
      issues.push({
        type: 'memory',
        severity: 'medium',
        message: `内存平均使用率 ${monitoringStats.memory.avg.toFixed(1)}%，超过 85% 建议阈值`,
        value: monitoringStats.memory.avg,
        threshold: 85
      });
    }
  }
  
  const sortedIssues = issues.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
  });
  
  return {
    issues: sortedIssues,
    has_bottleneck: sortedIssues.length > 0,
    bottleneck_types: [...new Set(sortedIssues.map(i => i.type))]
  };
}

function generateRecommendations(issues) {
  const recommendations = [];
  
  const errorIssues = issues.filter(i => i.type === 'error_rate');
  if (errorIssues.length > 0) {
    recommendations.push({
      category: '错误率优化',
      priority: 'high',
      items: [
        '检查服务器日志，定位具体错误原因（4xx/5xx）',
        '验证接口参数合法性校验是否完整',
        '检查数据库连接池配置及超时设置',
        '确认依赖服务是否正常响应'
      ]
    });
  }
  
  const rtIssues = issues.filter(i => i.type.startsWith('response_time'));
  if (rtIssues.length > 0) {
    recommendations.push({
      category: '响应时间优化',
      priority: 'high',
      items: [
        '分析慢查询日志，优化数据库查询语句',
        '检查是否存在 N+1 查询问题',
        '评估是否需要添加缓存层（Redis等）',
        '检查网络延迟，确认是否存在跨区域调用'
      ]
    });
  }
  
  const cpuIssues = issues.filter(i => i.type === 'cpu');
  if (cpuIssues.length > 0) {
    recommendations.push({
      category: 'CPU 优化',
      priority: 'high',
      items: [
        '使用 Profiler 工具定位热点代码',
        '检查是否存在死循环或递归过深',
        '评估是否需要增加服务器实例数量',
        '考虑使用异步处理，减少同步阻塞'
      ]
    });
  }
  
  const memoryIssues = issues.filter(i => i.type === 'memory');
  if (memoryIssues.length > 0) {
    recommendations.push({
      category: '内存优化',
      priority: 'high',
      items: [
        '检查是否存在内存泄漏',
        '评估大对象占用情况，考虑分批处理',
        '调整 JVM 或运行时内存参数',
        '确认缓存过期策略是否合理'
      ]
    });
  }
  
  const degradationIssues = issues.filter(i => i.type === 'performance_degradation' || i.type === 'throughput_degradation');
  if (degradationIssues.length > 0) {
    recommendations.push({
      category: '回归验证',
      priority: 'medium',
      items: [
        '对比本次与基线版本的代码变更',
        '检查是否引入了新的依赖或中间件',
        '验证配置文件是否与基线一致',
        '考虑回滚验证或逐步排查变更'
      ]
    });
  }
  
  return recommendations;
}

function generateNextTestPlan(currentResults, issues, baselineExists) {
  const steps = [];
  
  const highPriorityIssues = issues.filter(i => i.severity === 'high');
  
  if (highPriorityIssues.length > 0) {
    steps.push({
      order: 1,
      type: 'fix',
      title: '修复高优先级问题',
      description: `当前存在 ${highPriorityIssues.length} 个高优先级问题需要优先修复：${highPriorityIssues.slice(0, 3).map(i => i.message).join('、')}`
    });
  }
  
  steps.push({
    order: 2,
    type: 'validation',
    title: '问题修复验证',
    description: '针对已修复的问题，使用相同的压测模型进行验证，确认问题已解决'
  });
  
  if (currentResults && currentResults.length > 0) {
    const maxQps = Math.max(...currentResults.map(r => r.qps || 0));
    const errorRate = currentResults.reduce((sum, r) => sum + (r.failed_count || 0), 0) / 
                      Math.max(1, currentResults.reduce((sum, r) => sum + (r.total_requests || 0), 0)) * 100;
    
    if (errorRate < 5 && maxQps > 0) {
      const suggestedQps = Math.floor(maxQps * 1.2);
      steps.push({
        order: 3,
        type: 'explore',
        title: '容量探索测试',
        description: `当前系统运行稳定，建议以 ${suggestedQps} QPS 进行下一轮压测，探索系统容量上限`
      });
    } else if (errorRate >= 5) {
      steps.push({
        order: 3,
        type: 'stabilize',
        title: '稳定性调优',
        description: `当前错误率 ${errorRate.toFixed(2)}% 较高，建议先进行稳定性调优后再增加压力`
      });
    }
  }
  
  if (!baselineExists) {
    steps.push({
      order: 10,
      type: 'baseline',
      title: '建立基线版本',
      description: '建议在系统稳定后，将当前测试结果设为基线版本，用于后续回归对比'
    });
  }
  
  return steps.sort((a, b) => a.order - b.order);
}

function calculateCapacityMetrics(results, monitoringStats) {
  if (!results || results.length === 0) {
    return {
      max_qps: 0,
      safe_qps: 0,
      breaking_point_qps: 0,
      capacity_water_level: 0
    };
  }
  
  const totalQps = results.reduce((sum, r) => sum + (r.qps || 0), 0);
  const totalRequests = results.reduce((sum, r) => sum + (r.total_requests || 0), 0);
  const totalFailed = results.reduce((sum, r) => sum + (r.failed_count || 0), 0);
  const errorRate = totalRequests > 0 ? (totalFailed / totalRequests) : 0;
  
  let capacityWaterLevel = 0;
  let breakingPointQps = totalQps * 1.2;
  let safeQps = totalQps * 0.7;
  
  if (monitoringStats) {
    const cpuUtil = monitoringStats.cpu?.avg || 0;
    const memUtil = monitoringStats.memory?.avg || 0;
    capacityWaterLevel = Math.max(cpuUtil, memUtil) / 100;
    
    if (cpuUtil > 90 || memUtil > 90) {
      safeQps = totalQps * 0.5;
      breakingPointQps = totalQps * 1.1;
    } else if (cpuUtil > 70 || memUtil > 70) {
      safeQps = totalQps * 0.6;
    }
  }
  
  if (errorRate > 0.05) {
    safeQps = totalQps * 0.5;
    breakingPointQps = totalQps * 0.9;
  }
  
  capacityWaterLevel = Math.min(1, Math.max(capacityWaterLevel, totalQps / (totalQps * 1.4)));
  
  return {
    max_qps: parseFloat(totalQps.toFixed(2)),
    safe_qps: parseFloat(safeQps.toFixed(2)),
    breaking_point_qps: parseFloat(breakingPointQps.toFixed(2)),
    capacity_water_level: parseFloat(capacityWaterLevel.toFixed(2))
  };
}

router.get('/compare/:currentBatchId/:baselineBatchId', (req, res) => {
  const { currentBatchId, baselineBatchId } = req.params;
  
  const currentBatch = db.prepare(`
    SELECT * FROM test_batches WHERE id = ?
  `).get(currentBatchId);
  
  const baselineBatch = db.prepare(`
    SELECT * FROM test_batches WHERE id = ?
  `).get(baselineBatchId);
  
  if (!currentBatch) {
    return res.status(404).json({ error: '当前批次不存在' });
  }
  
  if (!baselineBatch) {
    return res.status(404).json({ error: '基线批次不存在' });
  }
  
  const currentResults = db.prepare(`
    SELECT tr.*, ai.name as interface_name, ai.path as interface_path, ai.method as interface_method
    FROM test_results tr
    LEFT JOIN api_interfaces ai ON tr.interface_id = ai.id
    WHERE tr.batch_id = ?
  `).all(currentBatchId);
  
  const baselineResults = db.prepare(`
    SELECT tr.*, ai.name as interface_name, ai.path as interface_path, ai.method as interface_method
    FROM test_results tr
    LEFT JOIN api_interfaces ai ON tr.interface_id = ai.id
    WHERE tr.batch_id = ?
  `).all(baselineBatchId);
  
  const currentSnapshots = db.prepare(`
    SELECT * FROM monitoring_snapshots WHERE batch_id = ?
  `).all(currentBatchId);
  
  let currentMonitoringStats = { snapshot_count: currentSnapshots.length };
  if (currentSnapshots.length > 0) {
    const cpuValues = currentSnapshots.map(s => s.cpu_usage).filter(v => v !== null);
    const memValues = currentSnapshots.map(s => s.memory_usage).filter(v => v !== null);
    
    currentMonitoringStats.cpu = {
      min: cpuValues.length > 0 ? Math.min(...cpuValues) : 0,
      max: cpuValues.length > 0 ? Math.max(...cpuValues) : 0,
      avg: cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : 0
    };
    currentMonitoringStats.memory = {
      min: memValues.length > 0 ? Math.min(...memValues) : 0,
      max: memValues.length > 0 ? Math.max(...memValues) : 0,
      avg: memValues.length > 0 ? memValues.reduce((a, b) => a + b, 0) / memValues.length : 0
    };
  }
  
  const bottleneckAnalysis = analyzeBottlenecks(currentResults, baselineResults, currentMonitoringStats);
  const recommendations = generateRecommendations(bottleneckAnalysis.issues);
  const nextTestPlan = generateNextTestPlan(currentResults, bottleneckAnalysis.issues, true);
  const capacityMetrics = calculateCapacityMetrics(currentResults, currentMonitoringStats);
  
  const interfaceComparisons = [];
  const baselineMap = new Map();
  const currentMap = new Map();
  
  baselineResults.forEach(r => {
    const key = r.interface_id || r.interface_path || r.id;
    baselineMap.set(key, r);
  });
  
  currentResults.forEach(r => {
    const key = r.interface_id || r.interface_path || r.id;
    currentMap.set(key, r);
  });
  
  const allKeys = new Set([...baselineMap.keys(), ...currentMap.keys()]);
  
  for (const key of allKeys) {
    const current = currentMap.get(key);
    const baseline = baselineMap.get(key);
    
    if (!current || !baseline) continue;
    
    const qpsChange = baseline.qps > 0 ? ((current.qps - baseline.qps) / baseline.qps) * 100 : 0;
    const rtChange = baseline.avg_response_time > 0 ? ((current.avg_response_time - baseline.avg_response_time) / baseline.avg_response_time) * 100 : 0;
    const errorRateChange = current.error_rate - baseline.error_rate;
    
    interfaceComparisons.push({
      interface_name: current.interface_name || current.interface_path || '未知',
      baseline: {
        qps: baseline.qps,
        avg_response_time: baseline.avg_response_time,
        p95_response_time: baseline.p95_response_time,
        p99_response_time: baseline.p99_response_time,
        error_rate: baseline.error_rate
      },
      current: {
        qps: current.qps,
        avg_response_time: current.avg_response_time,
        p95_response_time: current.p95_response_time,
        p99_response_time: current.p99_response_time,
        error_rate: current.error_rate
      },
      changes: {
        qps_percent: parseFloat(qpsChange.toFixed(2)),
        response_time_percent: parseFloat(rtChange.toFixed(2)),
        error_rate_diff: parseFloat(errorRateChange.toFixed(2))
      },
      is_degraded: qpsChange < -10 || rtChange > 20 || errorRateChange > 2,
      is_improved: qpsChange > 10 || (rtChange < -10 && rtChange < 0)
    });
  }
  
  const comparison = {
    current_batch: currentBatch,
    baseline_batch: baselineBatch,
    interface_comparisons: interfaceComparisons,
    bottleneck_analysis: bottleneckAnalysis,
    recommendations: recommendations,
    next_test_plan: nextTestPlan,
    capacity_metrics: capacityMetrics
  };
  
  res.json({ data: comparison });
});

router.post('/assess/:batchId', (req, res) => {
  const { batchId } = req.params;
  const { manual_notes } = req.body;
  
  const batch = db.prepare('SELECT * FROM test_batches WHERE id = ?').get(batchId);
  
  if (!batch) {
    return res.status(404).json({ error: '压测批次不存在' });
  }
  
  const results = db.prepare(`
    SELECT tr.*, ai.name as interface_name, ai.path as interface_path, ai.method as interface_method
    FROM test_results tr
    LEFT JOIN api_interfaces ai ON tr.interface_id = ai.id
    WHERE tr.batch_id = ?
  `).all(batchId);
  
  const snapshots = db.prepare(`
    SELECT * FROM monitoring_snapshots WHERE batch_id = ?
  `).all(batchId);
  
  let monitoringStats = { snapshot_count: snapshots.length };
  if (snapshots.length > 0) {
    const cpuValues = snapshots.map(s => s.cpu_usage).filter(v => v !== null);
    const memValues = snapshots.map(s => s.memory_usage).filter(v => v !== null);
    
    monitoringStats.cpu = {
      min: cpuValues.length > 0 ? Math.min(...cpuValues) : 0,
      max: cpuValues.length > 0 ? Math.max(...cpuValues) : 0,
      avg: cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : 0
    };
    monitoringStats.memory = {
      min: memValues.length > 0 ? Math.min(...memValues) : 0,
      max: memValues.length > 0 ? Math.max(...memValues) : 0,
      avg: memValues.length > 0 ? memValues.reduce((a, b) => a + b, 0) / memValues.length : 0
    };
  }
  
  const baselineBatch = db.prepare(`
    SELECT * FROM test_batches WHERE is_baseline = 1 AND id != ?
    ORDER BY created_at DESC LIMIT 1
  `).get(batchId);
  
  let baselineResults = [];
  if (baselineBatch) {
    baselineResults = db.prepare(`
      SELECT tr.* FROM test_results tr WHERE tr.batch_id = ?
    `).all(baselineBatch.id);
  }
  
  const bottleneckAnalysis = analyzeBottlenecks(results, baselineResults, monitoringStats);
  const recommendations = generateRecommendations(bottleneckAnalysis.issues);
  const nextTestPlan = generateNextTestPlan(results, bottleneckAnalysis.issues, !!baselineBatch);
  const capacityMetrics = calculateCapacityMetrics(results, monitoringStats);
  
  let bottleneckText = '';
  if (bottleneckAnalysis.issues.length > 0) {
    bottleneckText = '### 发现的问题\n\n';
    bottleneckAnalysis.issues.forEach((issue, idx) => {
      const severityEmoji = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
      bottleneckText += `${idx + 1}. ${severityEmoji} ${issue.message}\n`;
    });
  } else {
    bottleneckText = '未发现明显的性能瓶颈，系统运行状态良好。';
  }
  
  let recommendationsText = '';
  if (recommendations.length > 0) {
    recommendations.forEach(cat => {
      recommendationsText += `### ${cat.category}\n\n`;
      cat.items.forEach((item, idx) => {
        recommendationsText += `${idx + 1}. ${item}\n`;
      });
      recommendationsText += '\n';
    });
  }
  
  let nextPlanText = '';
  if (nextTestPlan.length > 0) {
    nextPlanText = '### 下一轮压测步骤\n\n';
    nextTestPlan.forEach((step, idx) => {
      const typeEmoji = step.type === 'fix' ? '🔧' : step.type === 'validation' ? '✅' : 
                         step.type === 'explore' ? '📈' : step.type === 'stabilize' ? '⚖️' : '📌';
      nextPlanText += `${idx + 1}. **${step.title}**\n\n`;
      nextPlanText += `   ${step.description}\n\n`;
    });
  }
  
  const existing = db.prepare('SELECT * FROM capacity_assessments WHERE batch_id = ?').get(batchId);
  const now = new Date().toISOString();
  
  if (existing) {
    db.prepare(`
      UPDATE capacity_assessments SET
        max_qps = ?, safe_qps = ?, breaking_point_qps = ?, capacity_water_level = ?,
        bottleneck_analysis = ?, recommendations = ?, next_test_plan = ?, updated_at = ?
      WHERE batch_id = ?
    `).run(
      capacityMetrics.max_qps,
      capacityMetrics.safe_qps,
      capacityMetrics.breaking_point_qps,
      capacityMetrics.capacity_water_level,
      bottleneckText,
      recommendationsText,
      nextPlanText,
      now,
      batchId
    );
  } else {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO capacity_assessments (
        id, batch_id, max_qps, safe_qps, breaking_point_qps, capacity_water_level,
        bottleneck_analysis, recommendations, next_test_plan, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, batchId,
      capacityMetrics.max_qps,
      capacityMetrics.safe_qps,
      capacityMetrics.breaking_point_qps,
      capacityMetrics.capacity_water_level,
      bottleneckText,
      recommendationsText,
      nextPlanText,
      now
    );
  }
  
  const assessment = db.prepare('SELECT * FROM capacity_assessments WHERE batch_id = ?').get(batchId);
  
  res.json({ 
    data: {
      ...assessment,
      raw_analysis: {
        bottleneck_analysis: bottleneckAnalysis,
        recommendations: recommendations,
        next_test_plan: nextTestPlan,
        capacity_metrics: capacityMetrics
      }
    }
  });
});

router.get('/assess/:batchId', (req, res) => {
  const { batchId } = req.params;
  
  const assessment = db.prepare('SELECT * FROM capacity_assessments WHERE batch_id = ?').get(batchId);
  
  if (!assessment) {
    return res.json({ data: null });
  }
  
  res.json({ data: assessment });
});

export default router;
