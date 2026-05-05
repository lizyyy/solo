import { Router } from 'express';
import db from '../database/db.js';

const router = Router();

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function generateMarkdownReport(batch, results, monitoringStats, assessment, tasks) {
  const now = new Date().toISOString().split('T')[0];
  
  let md = `# 压测报告 - ${batch.name}\n\n`;
  md += `> 生成时间: ${new Date().toLocaleString()}\n\n`;
  md += `---\n\n`;
  
  md += `## 一、压测基本信息\n\n`;
  md += `| 项目 | 内容 |\n`;
  md += `|------|------|\n`;
  md += `| 批次名称 | ${batch.name} |\n`;
  md += `| 批次编号 | ${batch.batch_number} |\n`;
  md += `| 是否基线 | ${batch.is_baseline ? '是' : '否'} |\n`;
  md += `| 开始时间 | ${batch.start_time || '-'} |\n`;
  md += `| 结束时间 | ${batch.end_time || '-'} |\n`;
  md += `| 持续时间 | ${formatDuration(batch.duration_seconds)} |\n`;
  md += `| 状态 | ${batch.status} |\n`;
  md += `\n`;
  
  if (batch.notes) {
    md += `**备注**: ${batch.notes}\n\n`;
  }
  
  md += `## 二、核心性能指标汇总\n\n`;
  
  if (results && results.length > 0) {
    const totalRequests = results.reduce((sum, r) => sum + (r.total_requests || 0), 0);
    const totalSuccess = results.reduce((sum, r) => sum + (r.success_count || 0), 0);
    const totalFailed = results.reduce((sum, r) => sum + (r.failed_count || 0), 0);
    const totalQps = results.reduce((sum, r) => sum + (r.qps || 0), 0);
    const overallErrorRate = totalRequests > 0 ? ((totalFailed / totalRequests) * 100).toFixed(2) : 0;
    
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| **总请求数** | ${totalRequests.toLocaleString()} |\n`;
    md += `| **成功请求** | ${totalSuccess.toLocaleString()} |\n`;
    md += `| **失败请求** | ${totalFailed.toLocaleString()} |\n`;
    md += `| **总 QPS** | ${totalQps.toFixed(2)} |\n`;
    md += `| **错误率** | ${overallErrorRate}% |\n`;
    md += `\n`;
    
    md += `## 三、接口详情\n\n`;
    md += `| 接口名称 | 方法 | QPS | 平均响应时间 | P95 | P99 | 错误率 |\n`;
    md += `|----------|------|-----|--------------|-----|-----|--------|\n`;
    
    for (const r of results) {
      const name = r.interface_name || (r.interface_path ? `${r.interface_method} ${r.interface_path}` : '全局统计');
      md += `| ${name} | ${r.interface_method || '-'} | ${r.qps?.toFixed(2) || 0} | ${r.avg_response_time?.toFixed(2) || 0}ms | ${r.p95_response_time || 0}ms | ${r.p99_response_time || 0}ms | ${r.error_rate?.toFixed(2) || 0}% |\n`;
    }
    md += `\n`;
  } else {
    md += `> 暂无压测结果数据\n\n`;
  }
  
  if (monitoringStats && monitoringStats.snapshot_count > 0) {
    md += `## 四、系统资源监控\n\n`;
    md += `| 资源类型 | 最小值 | 最大值 | 平均值 |\n`;
    md += `|----------|--------|--------|--------|\n`;
    md += `| **CPU使用率** | ${monitoringStats.cpu?.min?.toFixed(1) || 0}% | ${monitoringStats.cpu?.max?.toFixed(1) || 0}% | ${monitoringStats.cpu?.avg?.toFixed(1) || 0}% |\n`;
    md += `| **内存使用率** | ${monitoringStats.memory?.min?.toFixed(1) || 0}% | ${monitoringStats.memory?.max?.toFixed(1) || 0}% | ${monitoringStats.memory?.avg?.toFixed(1) || 0}% |\n`;
    md += `\n`;
  }
  
  if (assessment) {
    md += `## 五、容量评估\n\n`;
    
    md += `### 5.1 容量指标\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 最大 QPS | ${assessment.max_qps?.toFixed(2) || '-'} |\n`;
    md += `| 安全 QPS (建议) | ${assessment.safe_qps?.toFixed(2) || '-'} |\n`;
    md += `| 断点 QPS | ${assessment.breaking_point_qps?.toFixed(2) || '-'} |\n`;
    md += `| 容量水位 | ${assessment.capacity_water_level ? (assessment.capacity_water_level * 100).toFixed(0) + '%' : '-'} |\n`;
    md += `\n`;
    
    if (assessment.bottleneck_analysis) {
      md += `### 5.2 瓶颈分析\n\n`;
      md += `${assessment.bottleneck_analysis}\n\n`;
    }
    
    if (assessment.recommendations) {
      md += `### 5.3 优化建议\n\n`;
      md += `${assessment.recommendations}\n\n`;
    }
    
    if (assessment.next_test_plan) {
      md += `### 5.4 下一轮压测方案\n\n`;
      md += `${assessment.next_test_plan}\n\n`;
    }
  }
  
  if (tasks && tasks.length > 0) {
    md += `## 六、待处理任务\n\n`;
    
    const statusMap = { 'todo': '待处理', 'in_progress': '进行中', 'done': '已完成' };
    const priorityMap = { 'high': '高', 'medium': '中', 'low': '低' };
    
    md += `| 任务标题 | 优先级 | 状态 | 瓶颈类型 | 负责人 |\n`;
    md += `|----------|--------|------|----------|--------|\n`;
    
    for (const t of tasks) {
      md += `| ${t.title} | ${priorityMap[t.priority] || t.priority} | ${statusMap[t.status] || t.status} | ${t.bottleneck_type || '-'} | ${t.assignee || '-'} |\n`;
    }
    md += `\n`;
  }
  
  md += `---\n\n`;
  md += `*此报告由压测复盘看板自动生成*\n`;
  
  return md;
}

router.get('/batch/:batchId/markdown', (req, res) => {
  const { batchId } = req.params;
  
  const batch = db.prepare(`
    SELECT * FROM test_batches WHERE id = ?
  `).get(batchId);
  
  if (!batch) {
    return res.status(404).json({ error: '压测批次不存在' });
  }
  
  const results = db.prepare(`
    SELECT tr.*, ai.name as interface_name, ai.path as interface_path, ai.method as interface_method
    FROM test_results tr
    LEFT JOIN api_interfaces ai ON tr.interface_id = ai.id
    WHERE tr.batch_id = ?
    ORDER BY tr.qps DESC
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
  
  const assessment = db.prepare(`
    SELECT * FROM capacity_assessments WHERE batch_id = ?
  `).get(batchId);
  
  const tasks = db.prepare(`
    SELECT * FROM tasks WHERE batch_id = ? ORDER BY priority = 'high' DESC, created_at DESC
  `).all(batchId);
  
  const markdown = generateMarkdownReport(batch, results, monitoringStats, assessment, tasks);
  
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="load-test-report-${batch.batch_number}.md"`);
  res.send(markdown);
});

router.get('/batch/:batchId/json', (req, res) => {
  const { batchId } = req.params;
  
  const batch = db.prepare(`
    SELECT * FROM test_batches WHERE id = ?
  `).get(batchId);
  
  if (!batch) {
    return res.status(404).json({ error: '压测批次不存在' });
  }
  
  const results = db.prepare(`
    SELECT tr.*, ai.name as interface_name, ai.path as interface_path, ai.method as interface_method
    FROM test_results tr
    LEFT JOIN api_interfaces ai ON tr.interface_id = ai.id
    WHERE tr.batch_id = ?
    ORDER BY tr.qps DESC
  `).all(batchId);
  
  const monitoringStats = db.prepare(`
    SELECT * FROM monitoring_snapshots WHERE batch_id = ?
  `).all(batchId);
  
  const assessment = db.prepare(`
    SELECT * FROM capacity_assessments WHERE batch_id = ?
  `).get(batchId);
  
  const tasks = db.prepare(`
    SELECT * FROM tasks WHERE batch_id = ? ORDER BY priority = 'high' DESC, created_at DESC
  `).all(batchId);
  
  const report = {
    meta: {
      generated_at: new Date().toISOString(),
      version: '1.0'
    },
    batch: batch,
    results: results,
    monitoring: monitoringStats,
    capacity_assessment: assessment,
    tasks: tasks
  };
  
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="load-test-report-${batch.batch_number}.json"`);
  res.send(JSON.stringify(report, null, 2));
});

export default router;
