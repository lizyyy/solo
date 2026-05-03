import { Router } from 'express';
import { storageService } from '../services/storage.js';
import { evaluationEngine } from '../services/evaluationEngine.js';
import { auditService } from '../services/auditService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [users, flags, segments, auditResult] = await Promise.all([
      storageService.getUsers(),
      storageService.getFlags(),
      storageService.getSegments(),
      auditService.getLogs({ limit: 50 })
    ]);

    const batchResults = evaluationEngine.evaluateBatch(users, flags, segments);
    const analysis = evaluationEngine.analyzeBatchResults(batchResults, flags);

    const reportData = {
      summary: {
        totalUsers: users.length,
        totalSegments: segments.length,
        totalFlags: flags.length,
        enabledFlags: flags.filter(f => f.enabled).length
      },
      rules: {
        flags: flags.map(f => ({
          ...f,
          conditionCount: (f.segments || []).length
        })),
        segments: segments.map(s => ({
          ...s,
          conditionCount: (s.conditions || []).length
        }))
      },
      batchStats: {
        totalUsers: analysis.totalUsers,
        totalFlags: analysis.totalFlags,
        totalConflicts: analysis.conflicts.length,
        totalAnomalies: analysis.anomalies.length,
        flagStats: analysis.flagStats.map(fs => ({
          flagKey: fs.flagKey,
          flagName: fs.flagName,
          enabledCount: fs.enabled,
          disabledCount: fs.disabled,
          total: fs.total,
          killSwitchOverride: fs.killSwitchOverride,
          dependencyBlocked: fs.dependencyBlocked,
          percentageMissed: fs.percentageMissed,
          segmentMissed: fs.segmentMissed,
          globalDisabled: fs.globalDisabled
        })),
        conflicts: analysis.conflicts.map(c => ({
          id: c.user.id,
          userName: c.user.name,
          overrideFlags: c.overrideFlags
        })).slice(0, 10),
        anomalies: analysis.anomalies.map(a => ({
          id: a.user.id,
          userName: a.user.name,
          anomalies: a.anomalies
        })).slice(0, 10)
      },
      recentAudit: auditResult.logs.slice(0, 20),
      generatedAt: new Date().toISOString()
    };

    res.json(reportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/markdown', async (req, res) => {
  try {
    const [users, flags, segments, auditResult] = await Promise.all([
      storageService.getUsers(),
      storageService.getFlags(),
      storageService.getSegments(),
      auditService.getLogs({ limit: 50 })
    ]);

    const batchResults = evaluationEngine.evaluateBatch(users, flags, segments);
    const analysis = evaluationEngine.analyzeBatchResults(batchResults, flags);
    const auditLogs = auditResult.logs;

    const markdown = generateMarkdownReport(
      users, 
      flags, 
      segments, 
      analysis, 
      auditLogs
    );

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=feature-flag-report-${Date.now()}.md`
    );

    res.send(markdown);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/html', async (req, res) => {
  try {
    const [users, flags, segments, auditResult] = await Promise.all([
      storageService.getUsers(),
      storageService.getFlags(),
      storageService.getSegments(),
      auditService.getLogs({ limit: 50 })
    ]);

    const batchResults = evaluationEngine.evaluateBatch(users, flags, segments);
    const analysis = evaluationEngine.analyzeBatchResults(batchResults, flags);
    const auditLogs = auditResult.logs;

    const html = generateHtmlReport(
      users, 
      flags, 
      segments, 
      analysis, 
      auditLogs
    );

    res.setHeader('Content-Type', 'text/html');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=feature-flag-report-${Date.now()}.html`
    );

    res.send(html);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function generateMarkdownReport(users, flags, segments, analysis, auditLogs) {
  const generatedAt = new Date().toISOString();
  
  return `# Feature Flag 灰度规则演练报告

> 生成时间: ${generatedAt}

---

## 一、数据概览

| 类型 | 数量 |
|------|------|
| 用户样本 | ${users.length} |
| Feature Flag | ${flags.length} |
| Segment 规则 | ${segments.length} |
| 最近审计记录 | ${auditLogs.length} |

---

## 二、Flag 配置摘要

### 2.1 Flag 列表

${flags.map(flag => `
#### ${flag.name} (\`${flag.key}\`)

- **状态**: ${flag.enabled ? '✅ 启用' : '❌ 关闭'}
- **Kill Switch**: ${flag.killSwitch ? '⚠️ 已启用' : '未启用'}
- **描述**: ${flag.description || '无描述'}

**配置详情:**
- 关联 Segments: ${flag.segments?.length || 0} 个
- 灰度百分比: ${flag.percentage !== null ? `${flag.percentage}%` : '未设置'}
- 依赖 Flag: ${flag.dependsOn?.length > 0 ? flag.dependsOn.join(', ') : '无'}
`).join('')}

---

## 三、Segment 配置摘要

${segments.map(segment => `
### ${segment.name}

- **描述**: ${segment.description || '无描述'}
- **条件数量**: ${segment.conditions?.length || 0}

**条件列表:**
${(segment.conditions || []).map(cond => `- \`${cond.field}\` ${cond.operator} \`${cond.value}\``).join('\n') || '无条件'}
`).join('')}

---

## 四、批量命中统计

### 4.1 总体统计

- **总用户数**: ${analysis.totalUsers}
- **总 Flag 数**: ${analysis.totalFlags}

### 4.2 各 Flag 命中详情

${analysis.flagStats.map(stat => {
  const enabledPercent = stat.total > 0 ? ((stat.enabled / stat.total) * 100).toFixed(1) : 0;
  const disabledPercent = stat.total > 0 ? ((stat.disabled / stat.total) * 100).toFixed(1) : 0;
  
  return `
#### ${stat.flagName} (\`${stat.flagKey}\`)

| 指标 | 数量 | 占比 |
|------|------|------|
| 总评估数 | ${stat.total} | 100% |
| **命中（启用）** | **${stat.enabled}** | **${enabledPercent}%** |
| **未命中（关闭）** | **${stat.disabled}** | **${disabledPercent}%** |

**关闭原因分布:**
- Kill Switch 覆盖: ${stat.killSwitchOverride}
- 依赖阻止: ${stat.dependencyBlocked}
- 分桶未命中: ${stat.percentageMissed}
- Segment 未匹配: ${stat.segmentMissed}
- 全局开关关闭: ${stat.globalDisabled}
`;
}).join('')}

---

## 五、冲突与异常分析

### 5.1 冲突列表（被覆盖的 Flag）

${analysis.conflicts.length > 0 ? analysis.conflicts.map(conflict => `
#### 用户: ${conflict.user.name} (${conflict.user.id})

被覆盖的 Flag:
${conflict.overrideFlags.map(f => `- **${f.flagName}** (\`${f.flagKey}\`): ${f.overrideReason}`).join('\n')}
`).join('') : '无冲突'}

### 5.2 异常用户

${analysis.anomalies.length > 0 ? analysis.anomalies.map(anomaly => `
#### 用户: ${anomaly.user.name} (${anomaly.user.id})

异常类型:
${anomaly.anomalies.map(a => `- **${a.type}**: ${a.message}`).join('\n')}
`).join('') : '无异常'}

---

## 六、最近改动记录

${auditLogs.length > 0 ? auditLogs.map(log => `
### ${log.action} - ${log.entityType}

- **时间**: ${log.timestamp}
- **描述**: ${log.description || '无描述'}
- **实体 ID**: ${log.entityId}
`).join('') : '无审计记录'}

---

*报告由 Feature Flag 灰度规则演练台自动生成*
`;
}

function generateHtmlReport(users, flags, segments, analysis, auditLogs) {
  const generatedAt = new Date().toISOString();
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feature Flag 灰度规则演练报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .report-container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 { color: #1a1a1a; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
    h2 { color: #1a1a1a; margin-top: 30px; margin-bottom: 15px; padding-left: 10px; border-left: 4px solid #3b82f6; }
    h3 { color: #2d3748; margin-top: 20px; margin-bottom: 10px; }
    h4 { color: #4a5568; margin-top: 15px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
    th { background: #f7fafc; font-weight: 600; }
    tr:nth-child(even) { background: #f7fafc; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-info { background: #dbeafe; color: #1e40af; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: 'Fira Code', monospace; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 30px 0; }
    .stat-card { display: flex; gap: 20px; flex-wrap: wrap; margin: 20px 0; }
    .stat-item { flex: 1; min-width: 150px; background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: bold; color: #3b82f6; }
    .stat-label { font-size: 14px; color: #64748b; margin-top: 5px; }
    .progress-bar { height: 20px; background: #e2e8f0; border-radius: 10px; overflow: hidden; margin: 10px 0; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); }
    .generated-at { text-align: right; color: #64748b; font-size: 12px; margin-bottom: 20px; }
    .card { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 15px 0; }
    .flag-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }
    .flag-item { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
    .flag-name { font-weight: 600; color: #1e293b; margin-bottom: 5px; }
    .flag-key { font-size: 12px; color: #64748b; font-family: monospace; }
    .conflict-item { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 10px 0; border-radius: 0 4px 4px 0; }
    .anomaly-item { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 10px 0; border-radius: 0 4px 4px 0; }
    .audit-item { background: #f1f5f9; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .audit-action { font-weight: 600; margin-bottom: 5px; }
    .audit-time { font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="report-container">
    <h1>Feature Flag 灰度规则演练报告</h1>
    <div class="generated-at">生成时间: ${generatedAt}</div>
    
    <hr>
    
    <h2>一、数据概览</h2>
    <div class="stat-card">
      <div class="stat-item">
        <div class="stat-value">${users.length}</div>
        <div class="stat-label">用户样本</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${flags.length}</div>
        <div class="stat-label">Feature Flag</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${segments.length}</div>
        <div class="stat-label">Segment 规则</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${auditLogs.length}</div>
        <div class="stat-label">最近审计记录</div>
      </div>
    </div>
    
    <h2>二、Flag 配置摘要</h2>
    <h3>2.1 Flag 列表</h3>
    ${flags.map(flag => `
    <div class="card">
      <h4>${flag.name} <code>${flag.key}</code></h4>
      <div class="flag-summary">
        <div class="flag-item">
          <div class="flag-name">状态</div>
          <span class="badge ${flag.enabled ? 'badge-success' : 'badge-danger'}">${flag.enabled ? '启用' : '关闭'}</span>
        </div>
        <div class="flag-item">
          <div class="flag-name">Kill Switch</div>
          <span class="badge ${flag.killSwitch ? 'badge-warning' : 'badge-info'}">${flag.killSwitch ? '已启用' : '未启用'}</span>
        </div>
        <div class="flag-item">
          <div class="flag-name">灰度百分比</div>
          <div>${flag.percentage !== null ? `${flag.percentage}%` : '未设置'}</div>
        </div>
        <div class="flag-item">
          <div class="flag-name">关联 Segments</div>
          <div>${flag.segments?.length || 0} 个</div>
        </div>
      </div>
      <p><strong>描述:</strong> ${flag.description || '无描述'}</p>
      <p><strong>依赖 Flag:</strong> ${flag.dependsOn?.length > 0 ? flag.dependsOn.map(d => `<code>${d}</code>`).join(', ') : '无'}</p>
    </div>
    `).join('')}
    
    <h2>三、Segment 配置摘要</h2>
    ${segments.map(segment => `
    <div class="card">
      <h4>${segment.name}</h4>
      <p><strong>描述:</strong> ${segment.description || '无描述'}</p>
      <p><strong>条件数量:</strong> ${segment.conditions?.length || 0}</p>
      ${(segment.conditions || []).length > 0 ? `
      <table>
        <thead><tr><th>字段</th><th>操作符</th><th>值</th></tr></thead>
        <tbody>
          ${segment.conditions.map(cond => `
          <tr><td><code>${cond.field}</code></td><td>${cond.operator}</td><td><code>${cond.value}</code></td></tr>
          `).join('')}
        </tbody>
      </table>
      ` : '<p>无条件配置</p>'}
    </div>
    `).join('')}
    
    <h2>四、批量命中统计</h2>
    <h3>4.1 总体统计</h3>
    <div class="stat-card">
      <div class="stat-item">
        <div class="stat-value">${analysis.totalUsers}</div>
        <div class="stat-label">总用户数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${analysis.totalFlags}</div>
        <div class="stat-label">总 Flag 数</div>
      </div>
    </div>
    
    <h3>4.2 各 Flag 命中详情</h3>
    ${analysis.flagStats.map(stat => {
      const enabledPercent = stat.total > 0 ? ((stat.enabled / stat.total) * 100).toFixed(1) : 0;
      const disabledPercent = stat.total > 0 ? ((stat.disabled / stat.total) * 100).toFixed(1) : 0;
      
      return `
      <div class="card">
        <h4>${stat.flagName} <code>${stat.flagKey}</code></h4>
        
        <div style="display: flex; gap: 20px; margin: 15px 0;">
          <div style="flex: 1; text-align: center; padding: 15px; background: #d1fae5; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #065f46;">${stat.enabled}</div>
            <div style="font-size: 12px; color: #065f46;">命中 (${enabledPercent}%)</div>
          </div>
          <div style="flex: 1; text-align: center; padding: 15px; background: #fee2e2; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #991b1b;">${stat.disabled}</div>
            <div style="font-size: 12px; color: #991b1b;">未命中 (${disabledPercent}%)</div>
          </div>
        </div>
        
        <h5>关闭原因分布</h5>
        <table>
          <thead><tr><th>原因</th><th>数量</th></tr></thead>
          <tbody>
            <tr><td>Kill Switch 覆盖</td><td>${stat.killSwitchOverride}</td></tr>
            <tr><td>依赖阻止</td><td>${stat.dependencyBlocked}</td></tr>
            <tr><td>分桶未命中</td><td>${stat.percentageMissed}</td></tr>
            <tr><td>Segment 未匹配</td><td>${stat.segmentMissed}</td></tr>
            <tr><td>全局开关关闭</td><td>${stat.globalDisabled}</td></tr>
          </tbody>
        </table>
      </div>
      `;
    }).join('')}
    
    <h2>五、冲突与异常分析</h2>
    
    <h3>5.1 冲突列表（被覆盖的 Flag）</h3>
    ${analysis.conflicts.length > 0 ? analysis.conflicts.map(conflict => `
    <div class="conflict-item">
      <h4>用户: ${conflict.user.name} (${conflict.user.id})</h4>
      <p><strong>被覆盖的 Flag:</strong></p>
      <ul>
        ${conflict.overrideFlags.map(f => `<li><strong>${f.flagName}</strong> (<code>${f.flagKey}</code>): ${f.overrideReason}</li>`).join('')}
      </ul>
    </div>
    `).join('') : '<p>无冲突</p>'}
    
    <h3>5.2 异常用户</h3>
    ${analysis.anomalies.length > 0 ? analysis.anomalies.map(anomaly => `
    <div class="anomaly-item">
      <h4>用户: ${anomaly.user.name} (${anomaly.user.id})</h4>
      <p><strong>异常类型:</strong></p>
      <ul>
        ${anomaly.anomalies.map(a => `<li><strong>${a.type}</strong>: ${a.message}</li>`).join('')}
      </ul>
    </div>
    `).join('') : '<p>无异常</p>'}
    
    <h2>六、最近改动记录</h2>
    ${auditLogs.length > 0 ? auditLogs.map(log => `
    <div class="audit-item">
      <div class="audit-action">
        <span class="badge ${log.action === 'CREATE' ? 'badge-success' : log.action === 'DELETE' ? 'badge-danger' : 'badge-info'}">${log.action}</span>
        ${log.entityType}
      </div>
      <div class="audit-time">${log.timestamp}</div>
      <p><strong>描述:</strong> ${log.description || '无描述'}</p>
      <p><strong>实体 ID:</strong> <code>${log.entityId}</code></p>
    </div>
    `).join('') : '<p>无审计记录</p>'}
    
    <hr>
    <p style="text-align: center; color: #64748b; font-size: 12px;">
      报告由 Feature Flag 灰度规则演练台自动生成
    </p>
  </div>
</body>
</html>`;
}

export default router;
