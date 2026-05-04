const { v4: uuidv4 } = require('uuid');
const { runQuery } = require('../config/database');

function generateMarkdownReport(evaluation, contextPackage, strategy) {
  const result = evaluation.getResult();
  const stats = result?.statistics || {};
  const retained = result?.retained || {};
  const lost = result?.lost || {};

  let md = `# LLM 上下文评估报告

## 基本信息

| 项目 | 值 |
|------|-----|
| 评估 ID | ${evaluation.id} |
| 上下文包 ID | ${evaluation.contextPackageId} |
| 策略 | ${strategy?.name || '未知'} |
| 风险等级 | ${getRiskBadge(evaluation.riskLevel)} |
| 评估时间 | ${evaluation.createdAt} |

## Token 统计

| 指标 | 数值 |
|------|------|
| 原始 Token 总数 | ${stats.totalOriginalTokens || 0} |
| 保留 Token 数 | ${stats.totalRetainedTokens || 0} |
| 丢失 Token 数 | ${stats.totalLostTokens || 0} |
| 保留率 | ${calculateRetentionRate(stats)}% |

## 保留内容摘要

`;

  if (retained.conversations?.length > 0) {
    md += `### 对话消息 (${retained.conversations.length} 条)

`;
    retained.conversations.forEach((msg, idx) => {
      md += `**${msg.role}** (${countMsgTokens(msg)} tokens):
\`\`\`
${truncateText(msg.content || '', 200)}
\`\`\`

`;
    });
  }

  if (retained.docs) {
    md += `### 文档资料

\`\`\`markdown
${truncateText(retained.docs, 500)}
\`\`\`

`;
  }

  if (retained.toolResults) {
    md += `### 工具结果

\`\`\`json
${truncateText(JSON.stringify(retained.toolResults, null, 2), 500)}
\`\`\`

`;
  }

  if (retained.budgetConstraints && Object.keys(retained.budgetConstraints).length > 0) {
    md += `### 预算约束

\`\`\`yaml
${truncateText(JSON.stringify(retained.budgetConstraints, null, 2), 300)}
\`\`\`

`;
  }

  md += `## 丢失内容摘要

`;

  const hasLostContent = 
    (lost.conversations?.length > 0) || 
    lost.docs || 
    lost.toolResults;

  if (!hasLostContent) {
    md += `✅ 所有内容均已保留。

`;
  } else {
    if (lost.conversations?.length > 0) {
      md += `### 丢失的对话消息 (${lost.conversations.length} 条)

`;
      lost.conversations.forEach((msg, idx) => {
        md += `- **${msg.role}**: ${truncateText(msg.content || '', 100)} (${countMsgTokens(msg)} tokens)
`;
      });
      md += `
`;
    }

    if (lost.docs) {
      md += `### 丢失的文档资料

部分文档内容被裁剪，丢失约 ${countTokens(lost.docs) - countTokens(retained.docs || '')} tokens。

`;
    }

    if (lost.toolResults) {
      md += `### 丢失的工具结果

部分工具结果被裁剪。

`;
    }
  }

  if (evaluation.notes) {
    md += `## 备注

${evaluation.notes}

`;
  }

  md += `---

*报告生成时间: ${new Date().toISOString()}*
`;

  return md;
}

function generateJsonReport(evaluation, contextPackage, strategy) {
  const result = evaluation.getResult();
  
  return {
    reportId: uuidv4(),
    generatedAt: new Date().toISOString(),
    evaluation: {
      id: evaluation.id,
      contextPackageId: evaluation.contextPackageId,
      strategyId: evaluation.strategyId,
      riskLevel: evaluation.riskLevel,
      notes: evaluation.notes,
      createdAt: evaluation.createdAt
    },
    strategy: strategy ? {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      maxTokens: strategy.maxTokens,
      priorityRules: strategy.priorityRules
    } : null,
    statistics: result?.statistics || {},
    retained: result?.retained || {},
    lost: result?.lost || {},
    contextPackageSummary: {
      id: contextPackage?.id,
      taskId: contextPackage?.taskId,
      totalTokens: contextPackage?.totalTokens,
      createdAt: contextPackage?.createdAt
    }
  };
}

function saveReport(evaluationId, format, content) {
  const id = uuidv4();
  
  runQuery(
    'INSERT INTO reports (id, evaluation_id, format, content, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [id, evaluationId, format, content]
  );

  return { id, evaluationId, format, createdAt: new Date().toISOString() };
}

function getReport(id) {
  const results = runQuery('SELECT * FROM reports WHERE id = ?', [id]);
  if (results.length === 0) return null;
  return results[0];
}

function getReportsByEvaluationId(evaluationId) {
  return runQuery(
    'SELECT * FROM reports WHERE evaluation_id = ? ORDER BY created_at DESC',
    [evaluationId]
  );
}

function getRiskBadge(riskLevel) {
  const badges = {
    low: '🟢 低风险',
    medium: '🟡 中风险',
    high: '🔴 高风险'
  };
  return badges[riskLevel] || riskLevel;
}

function calculateRetentionRate(stats) {
  if (!stats || stats.totalOriginalTokens === 0) return 100;
  return Math.round((stats.totalRetainedTokens / stats.totalOriginalTokens) * 100);
}

function countMsgTokens(msg) {
  if (!msg) return 0;
  let count = 0;
  if (msg.role) count += msg.role.length / 4;
  if (msg.content) count += msg.content.length / 4;
  return Math.ceil(count);
}

function countTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '... (已截断)';
}

module.exports = {
  generateMarkdownReport,
  generateJsonReport,
  saveReport,
  getReport,
  getReportsByEvaluationId
};
