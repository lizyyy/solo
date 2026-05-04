import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database.js';
import { calculateRiskScore } from '../services/issueAnalyzer.js';

const router = Router();

router.get('/:sessionId/markdown', (req, res) => {
  const db = getDB();
  const { sessionId } = req.params;
  
  const session = db.prepare(`
    SELECT * FROM training_sessions WHERE id = ?
  `).get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: '训练场次不存在' });
  }
  
  const issues = db.prepare(`
    SELECT * FROM identified_issues WHERE session_id = ?
    ORDER BY CASE severity 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      WHEN 'low' THEN 4 
      ELSE 5 
    END
  `).all(sessionId).map(i => ({
    ...i,
    details: i.details ? JSON.parse(i.details) : null
  }));
  
  const notes = db.prepare(`
    SELECT * FROM review_notes WHERE session_id = ?
    ORDER BY reviewed_at DESC
  `).all(sessionId);
  
  const riskAssessment = calculateRiskScore(issues);
  
  const markdown = generateMarkdownReport(session, issues, notes, riskAssessment);
  
  recordExport(db, sessionId, 'markdown');
  
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="fire-training-review-${sessionId.substring(0, 8)}.md"`);
  res.send(markdown);
});

router.get('/:sessionId/json', (req, res) => {
  const db = getDB();
  const { sessionId } = req.params;
  
  const session = db.prepare(`
    SELECT * FROM training_sessions WHERE id = ?
  `).get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: '训练场次不存在' });
  }
  
  const issues = db.prepare(`
    SELECT * FROM identified_issues WHERE session_id = ?
    ORDER BY CASE severity 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      WHEN 'low' THEN 4 
      ELSE 5 
    END
  `).all(sessionId).map(i => ({
    ...i,
    details: i.details ? JSON.parse(i.details) : null
  }));
  
  const notes = db.prepare(`
    SELECT * FROM review_notes WHERE session_id = ?
    ORDER BY reviewed_at DESC
  `).all(sessionId);
  
  const sensors = db.prepare(`
    SELECT * FROM sensor_points WHERE session_id = ?
  `).all(sessionId);
  
  const riskAssessment = calculateRiskScore(issues);
  
  const auditPackage = {
    exportMetadata: {
      id: uuidv4(),
      exportTimestamp: new Date().toISOString(),
      exportType: 'json_audit'
    },
    session: {
      id: session.id,
      name: session.name,
      description: session.description,
      createdAt: session.created_at,
      updatedAt: session.updated_at
    },
    venue_geojson: session.venue_geojson ? JSON.parse(session.venue_geojson) : null,
    fan_window_data: session.fan_window_data ? JSON.parse(session.fan_window_data) : null,
    sensor_data: session.sensor_data ? JSON.parse(session.sensor_data) : null,
    sensorPoints: sensors,
    identifiedIssues: issues,
    reviewNotes: notes,
    riskAssessment: riskAssessment,
    summary: {
      totalIssues: issues.length,
      bySeverity: {
        critical: issues.filter(i => i.severity === 'critical').length,
        high: issues.filter(i => i.severity === 'high').length,
        medium: issues.filter(i => i.severity === 'medium').length,
        low: issues.filter(i => i.severity === 'low').length
      },
      reviewNotesCount: notes.length,
      resolvedNotes: notes.filter(n => n.is_resolved === 1).length
    }
  };
  
  recordExport(db, sessionId, 'json');
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="fire-training-audit-${sessionId.substring(0, 8)}.json"`);
  res.json(auditPackage);
});

function generateMarkdownReport(session, issues, notes, riskAssessment) {
  const issueTypeLabels = {
    'fan_direction_abnormal': '风机方向异常',
    'concentration_exceeded': '浓度超阈值',
    'exit_blocked': '出口被烟雾遮挡',
    'sensor_offline': '传感器离线'
  };
  
  const severityLabels = {
    'critical': '严重',
    'high': '高',
    'medium': '中',
    'low': '低'
  };
  
  const riskLevelLabels = {
    'critical': '严重风险',
    'high': '高风险',
    'medium': '中等风险',
    'low': '低风险'
  };
  
  let md = `# 消防训练馆烟雾扩散复盘报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 训练名称 | ${session.name} |
| 训练描述 | ${session.description || '无'} |
| 创建时间 | ${session.created_at} |
| 更新时间 | ${session.updated_at} |
| 报告生成时间 | ${new Date().toISOString()} |

---

## 风险评估

| 指标 | 数值 |
|------|------|
| 风险等级 | **${riskLevelLabels[riskAssessment.riskLevel] || riskAssessment.riskLevel}** |
| 风险评分 | ${riskAssessment.score} 分 |
| 问题总数 | ${riskAssessment.totalIssues} 个 |

### 问题分布

| 严重程度 | 数量 |
|----------|------|
| 严重 (Critical) | ${riskAssessment.breakdown.critical} |
| 高 (High) | ${riskAssessment.breakdown.high} |
| 中 (Medium) | ${riskAssessment.breakdown.medium} |
| 低 (Low) | ${riskAssessment.breakdown.low} |

---

## 已识别问题

`;

  if (issues.length === 0) {
    md += `本次训练未识别到问题。\n\n`;
  } else {
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const typeLabel = issueTypeLabels[issue.issue_type] || issue.issue_type;
      const severityLabel = severityLabels[issue.severity] || issue.severity;
      
      md += `### ${i + 1}. ${typeLabel} [${severityLabel}]

**描述**: ${issue.description}

${issue.location ? `**位置**: ${issue.location}\n` : ''}
${issue.timestamp ? `**时间**: ${issue.timestamp}\n` : ''}

`;
      
      if (issue.details) {
        md += `**详细信息**:
\`\`\`json
${JSON.stringify(issue.details, null, 2)}
\`\`\`

`;
      }
      
      md += `---

`;
    }
  }

  md += `## 复核备注

`;

  if (notes.length === 0) {
    md += `暂无复核备注。\n\n`;
  } else {
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const resolved = note.is_resolved === 1 ? '✅ 已解决' : '⏳ 未解决';
      
      md += `### ${i + 1}. ${resolved

**复核人**: ${note.reviewed_by || '匿名'}

**时间**: ${note.reviewed_at}

**内容**: ${note.content}

${note.resolution ? `**解决方案**: ${note.resolution}\n` : ''}

---

`;
    }
  }

  md += `## 建议与改进

根据本次复盘结果，建议采取以下改进措施：

`;

  if (issues.some(i => i.issue_type === 'fan_direction_abnormal')) {
    md += `- **风机系统**: 检查风机方向设置，确保进排风平衡，避免正压/负压异常情况。\n`;
  }
  
  if (issues.some(i => i.issue_type === 'concentration_exceeded')) {
    md += `- **烟雾浓度**: 检查烟雾源控制和排烟系统效率，降低关键区域烟雾浓度。\n`;
  }
  
  if (issues.some(i => i.issue_type === 'exit_blocked')) {
    md += `- **疏散出口**: 确保疏散出口附近烟雾浓度控制在安全范围内，保证疏散路线畅通。\n`;
  }
  
  if (issues.some(i => i.issue_type === 'sensor_offline')) {
    md += `- **传感器系统**: 检查离线传感器，确保数据采集完整可靠。\n`;
  }
  
  if (issues.length === 0) {
    md += `- 本次训练未发现明显问题，建议保持现有操作流程。\n`;
  }

  md += `
---

*本报告由消防训练复盘工具自动生成`;

  return md;
}

function recordExport(db, sessionId, exportType) {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO export_audit (id, session_id, export_type, export_timestamp, exported_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, sessionId, exportType, now, 'system');
}

export default router;
