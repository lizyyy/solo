const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const planRepository = require('../repositories/PlanRepository');
const jobRepository = require('../repositories/JobRepository');
const workerRepository = require('../repositories/WorkerRepository');

router.get('/plan/:id/dispatch-table', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const plan = await planRepository.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: '方案不存在'
      });
    }

    const dispatchData = generateDispatchTable(plan);

    if (format === 'csv') {
      const csvFields = [
        'workerId', 'workerName', 'sequence', 'jobId', 'clientName',
        'address', 'serviceType', 'timeWindow', 'eta', 'etd',
        'travelMinutes', 'serviceDuration', 'riskScore'
      ];
      const parser = new Parser({ fields: csvFields });
      const csv = parser.parse(dispatchData.flatMap(worker => worker.jobs));
      
      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.attachment(`dispatch-table-${plan.date}.csv`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: dispatchData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/plan/:id/report', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const plan = await planRepository.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: '方案不存在'
      });
    }

    const report = await generateReport(plan);

    if (format === 'markdown') {
      const markdown = generateMarkdownReport(report);
      res.header('Content-Type', 'text/markdown; charset=utf-8');
      res.attachment(`report-${plan.date}.md`);
      return res.send(markdown);
    }

    if (format === 'html') {
      const html = generateHTMLReport(report);
      res.header('Content-Type', 'text/html; charset=utf-8');
      res.attachment(`report-${plan.date}.html`);
      return res.send(html);
    }

    if (format === 'csv') {
      const csvFields = [
        'metric', 'value', 'unit', 'status'
      ];
      const csvData = [
        { metric: '总任务数', value: report.summary.totalJobs, unit: '个', status: '' },
        { metric: '已分配任务', value: report.summary.assignedJobs, unit: '个', status: '' },
        { metric: '未分配任务', value: report.summary.unassignedJobs, unit: '个', status: report.summary.unassignedJobs > 0 ? '警告' : '' },
        { metric: '总师傅数', value: report.summary.totalWorkers, unit: '位', status: '' },
        { metric: '总里程', value: report.summary.totalDistanceKm.toFixed(1), unit: '公里', status: '' },
        { metric: '总耗时', value: (report.summary.totalDurationMinutes / 60).toFixed(1), unit: '小时', status: '' },
        { metric: '风险评分', value: report.summary.overallRiskScore, unit: '分', status: report.summary.overallRiskScore > 50 ? '高风险' : (report.summary.overallRiskScore > 20 ? '中风险' : '低风险') },
        { metric: '问题数', value: report.summary.issueCount, unit: '个', status: report.summary.issueCount > 0 ? '需处理' : '' },
        { metric: '警告数', value: report.summary.warningCount, unit: '个', status: report.summary.warningCount > 0 ? '需关注' : '' }
      ];
      
      const parser = new Parser({ fields: csvFields });
      const csv = parser.parse(csvData);
      
      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.attachment(`report-summary-${plan.date}.csv`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function generateDispatchTable(plan) {
  const routes = plan.planData?.routes || {};
  const result = [];

  for (const [workerId, route] of Object.entries(routes)) {
    const workerJobs = [];
    let sequence = 1;

    for (const stop of route.stops || []) {
      if (stop.type === 'job') {
        workerJobs.push({
          workerId,
          workerName: route.workerName,
          sequence,
          jobId: stop.jobId,
          clientName: stop.job?.clientName || '',
          address: stop.job?.address || '',
          serviceType: stop.job?.serviceType || '',
          timeWindow: `${stop.job?.timeWindowStart || ''} - ${stop.job?.timeWindowEnd || ''}`,
          eta: stop.eta || '',
          etd: stop.etd || '',
          travelMinutes: stop.travelMinutes || 0,
          serviceDuration: stop.serviceMinutes || stop.job?.serviceDuration || 0,
          riskScore: route.riskScore || 0
        });
        sequence++;
      }
    }

    result.push({
      workerId,
      workerName: route.workerName,
      totalJobs: workerJobs.length,
      totalDistanceKm: route.totalDistanceKm || 0,
      totalDurationMinutes: route.totalDurationMinutes || 0,
      riskScore: route.riskScore || 0,
      jobs: workerJobs
    });
  }

  return result;
}

async function generateReport(plan) {
  const summary = plan.planData?.summary || {};
  const routes = plan.planData?.routes || {};
  
  const workers = await workerRepository.findAll();
  const jobs = await jobRepository.findAll();
  const workerMap = {};
  workers.forEach(w => workerMap[w.id] = w);

  const workerBreakdown = [];
  for (const [workerId, route] of Object.entries(routes)) {
    const worker = workerMap[workerId];
    const issues = route.constraintCheck?.issues || [];
    const warnings = route.constraintCheck?.warnings || [];

    workerBreakdown.push({
      workerId,
      workerName: route.workerName,
      vehicleType: worker?.vehicleType || 'unknown',
      skills: worker?.skills || [],
      jobCount: route.jobCount || 0,
      totalDistanceKm: route.totalDistanceKm || 0,
      totalDurationMinutes: route.totalDurationMinutes || 0,
      totalTravelMinutes: route.totalTravelMinutes || 0,
      totalServiceMinutes: route.totalServiceMinutes || 0,
      riskScore: route.riskScore || 0,
      issues: issues.map(i => ({
        type: i.type,
        severity: i.severity,
        message: i.message
      })),
      warnings: warnings.map(w => ({
        type: w.type,
        message: w.message
      })),
      stops: (route.stops || []).filter(s => s.type === 'job').map(s => ({
        jobId: s.jobId,
        clientName: s.job?.clientName,
        address: s.job?.address,
        serviceType: s.job?.serviceType,
        priority: s.job?.priority,
        eta: s.eta,
        etd: s.etd,
        timeWindow: `${s.job?.timeWindowStart} - ${s.job?.timeWindowEnd}`,
        isLate: s.arrivalMinutes > timeToMinutes(s.job?.timeWindowEnd)
      }))
    });
  }

  const allIssues = summary.issues || [];
  const allWarnings = summary.warnings || [];

  const lateJobs = workerBreakdown.flatMap(w => 
    w.stops.filter(s => s.isLate).map(s => ({
      ...s,
      workerName: w.workerName,
      workerId: w.workerId
    }))
  );

  const skillMismatchJobs = allIssues
    .filter(i => i.type === 'skill_mismatch')
    .map(i => ({
      jobId: i.jobId,
      workerId: i.workerId,
      message: i.message
    }));

  const restrictionViolations = allIssues
    .filter(i => i.type === 'restriction_violation')
    .map(i => ({
      jobId: i.jobId,
      workerId: i.workerId,
      zone: i.zone,
      timeRange: i.timeRange,
      message: i.message
    }));

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      date: plan.date,
      strategy: plan.strategy,
      createdAt: plan.createdAt
    },
    summary: {
      totalJobs: summary.totalJobs || 0,
      assignedJobs: summary.assignedJobs || 0,
      unassignedJobs: summary.unassignedJobs || 0,
      totalWorkers: Object.keys(routes).length,
      totalDistanceKm: summary.totalDistanceKm || 0,
      totalDurationMinutes: summary.totalDurationMinutes || 0,
      overallRiskScore: summary.overallRiskScore || 0,
      issueCount: allIssues.length,
      warningCount: allWarnings.length
    },
    riskAssessment: {
      overallRiskScore: summary.overallRiskScore || 0,
      riskLevel: getRiskLevel(summary.overallRiskScore || 0),
      totalIssues: allIssues.length,
      totalWarnings: allWarnings.length,
      criticalIssues: allIssues.filter(i => i.severity === 'error').length,
      lateJobs: lateJobs.length,
      skillMismatches: skillMismatchJobs.length,
      restrictionViolations: restrictionViolations.length
    },
    workerBreakdown,
    issues: {
      lateJobs,
      skillMismatchJobs,
      restrictionViolations,
      otherIssues: allIssues.filter(i => 
        !['late_risk', 'time_window_violation', 'skill_mismatch', 'restriction_violation'].includes(i.type)
      )
    },
    unassignedJobs: summary.unassignedJobIds || []
  };
}

function getRiskLevel(score) {
  if (score >= 70) return '高风险';
  if (score >= 40) return '中风险';
  if (score >= 20) return '低风险';
  return '无风险';
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function generateMarkdownReport(report) {
  const { plan, summary, riskAssessment, workerBreakdown, issues, unassignedJobs } = report;

  let md = `# 路线规划复盘报告\n\n`;
  md += `## 基本信息\n\n`;
  md += `- **方案名称**: ${plan.name}\n`;
  md += `- **日期**: ${plan.date}\n`;
  md += `- **算法策略**: ${plan.strategy}\n`;
  md += `- **生成时间**: ${new Date(plan.createdAt).toLocaleString()}\n\n`;

  md += `## 概览\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 总任务数 | ${summary.totalJobs} 个 |\n`;
  md += `| 已分配 | ${summary.assignedJobs} 个 |\n`;
  md += `| 未分配 | ${summary.unassignedJobs} 个 |\n`;
  md += `| 师傅数 | ${summary.totalWorkers} 位 |\n`;
  md += `| 总里程 | ${summary.totalDistanceKm.toFixed(1)} 公里 |\n`;
  md += `| 总耗时 | ${(summary.totalDurationMinutes / 60).toFixed(1)} 小时 |\n`;
  md += `| 风险评分 | ${summary.overallRiskScore} 分 (${riskAssessment.riskLevel}) |\n`;
  md += `| 问题数 | ${summary.issueCount} 个 |\n`;
  md += `| 警告数 | ${summary.warningCount} 个 |\n\n`;

  md += `## 风险评估\n\n`;
  md += `- **整体风险级别**: ${riskAssessment.riskLevel}\n`;
  md += `- **风险评分**: ${riskAssessment.overallRiskScore}/100\n`;
  md += `- **严重问题**: ${riskAssessment.criticalIssues} 个\n`;
  md += `- **迟到任务**: ${riskAssessment.lateJobs} 个\n`;
  md += `- **技能不匹配**: ${riskAssessment.skillMismatches} 个\n`;
  md += `- **限行冲突**: ${riskAssessment.restrictionViolations} 个\n\n`;

  if (issues.lateJobs.length > 0) {
    md += `### 迟到任务\n\n`;
    md += `| 任务ID | 客户 | 师傅 | 预计到达 | 时间窗截止 |\n`;
    md += `|--------|------|------|----------|------------|\n`;
    issues.lateJobs.forEach(j => {
      md += `| ${j.jobId} | ${j.clientName} | ${j.workerName} | ${j.eta} | ${j.timeWindow.split(' - ')[1]} |\n`;
    });
    md += `\n`;
  }

  if (issues.skillMismatchJobs.length > 0) {
    md += `### 技能不匹配\n\n`;
    issues.skillMismatchJobs.forEach(i => {
      md += `- ${i.message}\n`;
    });
    md += `\n`;
  }

  if (issues.restrictionViolations.length > 0) {
    md += `### 限行冲突\n\n`;
    issues.restrictionViolations.forEach(i => {
      md += `- ${i.message}\n`;
    });
    md += `\n`;
  }

  md += `## 师傅详情\n\n`;
  workerBreakdown.forEach(w => {
    md += `### ${w.workerName}\n\n`;
    md += `- **任务数**: ${w.jobCount} 个\n`;
    md += `- **里程**: ${w.totalDistanceKm.toFixed(1)} 公里\n`;
    md += `- **耗时**: ${(w.totalDurationMinutes / 60).toFixed(1)} 小时\n`;
    md += `- **风险评分**: ${w.riskScore} 分\n`;
    
    if (w.stops.length > 0) {
      md += `\n#### 任务列表\n\n`;
      md += `| 序号 | 客户 | 服务类型 | 优先级 | 时间窗 | 预计到达 | 预计离开 | 状态 |\n`;
      md += `|------|------|----------|--------|--------|----------|----------|------|\n`;
      w.stops.forEach((s, idx) => {
        const status = s.isLate ? '⚠️ 迟到' : '✅ 正常';
        md += `| ${idx + 1} | ${s.clientName} | ${s.serviceType} | ${s.priority} | ${s.timeWindow} | ${s.eta} | ${s.etd} | ${status} |\n`;
      });
    }
    
    if (w.issues.length > 0 || w.warnings.length > 0) {
      md += `\n#### 问题与警告\n\n`;
      w.issues.forEach(i => {
        md += `- ❌ **${i.severity === 'error' ? '错误' : '问题'}**: ${i.message}\n`;
      });
      w.warnings.forEach(w => {
        md += `- ⚠️ **警告**: ${w.message}\n`;
      });
    }
    
    md += `\n---\n\n`;
  });

  if (unassignedJobs.length > 0) {
    md += `## 未分配任务\n\n`;
    md += `以下任务无法分配，请检查师傅技能和时间窗：\n\n`;
    unassignedJobs.forEach(jobId => {
      md += `- ${jobId}\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;
  md += `*报告生成时间: ${new Date().toLocaleString()}*\n`;

  return md;
}

function generateHTMLReport(report) {
  const { plan, summary, riskAssessment, workerBreakdown, issues, unassignedJobs } = report;
  
  const riskColor = (score) => {
    if (score >= 70) return 'bg-red-100 text-red-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    if (score >= 20) return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  };

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>路线规划复盘报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1, h2, h3 { color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    tr:nth-child(even) { background: #f9fafb; }
    .risk-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: 600; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .metric-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; padding: 20px; text-align: center; }
    .metric-value { font-size: 2rem; font-weight: 700; }
    .metric-label { font-size: 0.9rem; opacity: 0.9; }
    .warning { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 8px 0; }
    .error { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 8px 0; }
  </style>
</head>
<body>
  <h1>🚚 路线规划复盘报告</h1>
  
  <div class="card">
    <h2>📋 基本信息</h2>
    <p><strong>方案名称:</strong> ${plan.name}</p>
    <p><strong>日期:</strong> ${plan.date}</p>
    <p><strong>算法策略:</strong> ${plan.strategy}</p>
    <p><strong>生成时间:</strong> ${new Date(plan.createdAt).toLocaleString()}</p>
  </div>

  <div class="grid">
    <div class="metric-card">
      <div class="metric-value">${summary.totalJobs}</div>
      <div class="metric-label">总任务数</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${summary.assignedJobs}</div>
      <div class="metric-label">已分配</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${summary.totalWorkers}</div>
      <div class="metric-label">师傅数</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${summary.totalDistanceKm.toFixed(1)}</div>
      <div class="metric-label">总里程 (公里)</div>
    </div>
  </div>

  <div class="card">
    <h2>⚠️ 风险评估</h2>
    <p><strong>整体风险级别:</strong> <span class="risk-badge ${riskColor(summary.overallRiskScore)}">${riskAssessment.riskLevel} (${summary.overallRiskScore}分)</span></p>
    <table>
      <tr><th>类型</th><th>数量</th></tr>
      <tr><td>严重问题</td><td>${riskAssessment.criticalIssues}</td></tr>
      <tr><td>迟到任务</td><td>${riskAssessment.lateJobs}</td></tr>
      <tr><td>技能不匹配</td><td>${riskAssessment.skillMismatches}</td></tr>
      <tr><td>限行冲突</td><td>${riskAssessment.restrictionViolations}</td></tr>
    </table>
  </div>

  ${issues.lateJobs.length > 0 ? `
  <div class="card">
    <h3>⏰ 迟到任务</h3>
    <table>
      <tr><th>任务ID</th><th>客户</th><th>师傅</th><th>预计到达</th><th>时间窗截止</th></tr>
      ${issues.lateJobs.map(j => `<tr><td>${j.jobId}</td><td>${j.clientName}</td><td>${j.workerName}</td><td>${j.eta}</td><td>${j.timeWindow.split(' - ')[1]}</td></tr>`).join('')}
    </table>
  </div>` : ''}

  ${issues.skillMismatchJobs.length > 0 ? `
  <div class="card">
    <h3>❌ 技能不匹配</h3>
    ${issues.skillMismatchJobs.map(i => `<div class="error">${i.message}</div>`).join('')}
  </div>` : ''}

  <div class="card">
    <h2>👥 师傅详情</h2>
    ${workerBreakdown.map(w => `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3>${w.workerName} <span class="risk-badge ${riskColor(w.riskScore)}">风险: ${w.riskScore}分</span></h3>
        <p><strong>任务数:</strong> ${w.jobCount} 个 | <strong>里程:</strong> ${w.totalDistanceKm.toFixed(1)} 公里 | <strong>耗时:</strong> ${(w.totalDurationMinutes / 60).toFixed(1)} 小时</p>
        
        ${w.stops.length > 0 ? `
        <table>
          <tr><th>序号</th><th>客户</th><th>服务类型</th><th>优先级</th><th>时间窗</th><th>预计到达</th><th>状态</th></tr>
          ${w.stops.map((s, idx) => `
            <tr class="${s.isLate ? 'bg-red-50' : ''}">
              <td>${idx + 1}</td>
              <td>${s.clientName}</td>
              <td>${s.serviceType}</td>
              <td>${s.priority}</td>
              <td>${s.timeWindow}</td>
              <td>${s.eta}</td>
              <td>${s.isLate ? '⚠️ 迟到' : '✅ 正常'}</td>
            </tr>
          `).join('')}
        </table>
        ` : ''}
        
        ${w.issues.length > 0 ? w.issues.map(i => `<div class="error">❌ ${i.message}</div>`).join('') : ''}
        ${w.warnings.length > 0 ? w.warnings.map(w => `<div class="warning">⚠️ ${w.message}</div>`).join('') : ''}
      </div>
    `).join('')}
  </div>

  ${unassignedJobs.length > 0 ? `
  <div class="card">
    <h2>❓ 未分配任务</h2>
    <p>以下任务无法分配，请检查师傅技能和时间窗：</p>
    <ul>${unassignedJobs.map(jobId => `<li>${jobId}</li>`).join('')}</ul>
  </div>` : ''}

  <hr>
  <p style="text-align: center; color: #6b7280; margin-top: 32px;">
    报告生成时间: ${new Date().toLocaleString()}
  </p>
</body>
</html>`;

  return html;
}

module.exports = router;
