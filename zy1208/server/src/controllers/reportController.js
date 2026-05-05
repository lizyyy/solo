const AnalysisResult = require('../models/AnalysisResult');
const Drill = require('../models/Drill');
const ImportFile = require('../models/ImportFile');

class ReportController {
  static async exportMarkdown(req, res) {
    try {
      const { id } = req.params;
      
      const drill = Drill.findById(id);
      const analysis = AnalysisResult.findByDrillId(id);
      const files = ImportFile.findByDrillId(id);
      
      if (!drill) {
        return res.status(404).json({ error: '演练不存在' });
      }
      
      const markdown = ReportController._generateMarkdown(drill, analysis, files);
      
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="analysis-report-${drill.id}.md`);
      res.send(markdown);
    } catch (error) {
      console.error('导出Markdown报告失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static _generateMarkdown(drill, analysis, files) {
    let content = `# 数据库性能调优分析报告
====================

## 基本信息

| 项目 | 内容 |
|------|------|
| 演练名称 | ${drill.name} |
| 演练ID | ${drill.id} |
| 创建时间 | ${drill.created_at} |
| 状态 | ${drill.status} |
${drill.description ? `| 描述 | ${drill.description} |` : ''}

`;

    content += `## 导入文件

| 文件名称 | 类型 | 大小 |
|----------|------|------|
`;
    for (const file of files) {
      const sizeMB = (file.file_size / 1024 / 1024).toFixed(2);
      content += `| ${file.file_name} | ${file.file_type} | ${sizeMB} MB |\n`;
    }
    content += '\n';

    if (analysis && analysis.overallScore !== undefined) {
      content += `## 总体评分

**综合评分: ${analysis.overallScore}/100 分

`;
    }

    if (analysis && analysis.bottlenecks && analysis.bottlenecks.length > 0) {
      content += `## 瓶颈分析

按影响程度排序：

`;
      const sortedBottlenecks = [...analysis.bottlenecks].sort((a, b) => 
        (b.impactScore || 0) - (a.impactScore || 0)
      );
      
      for (const bottleneck of sortedBottlenecks) {
        const severityEmoji = bottleneck.severity === 'critical' ? '🔴' : 
                              bottleneck.severity === 'high' ? '🟠' : 
                              bottleneck.severity === 'medium' ? '🟡' : '🟢';
        content += `### ${severityEmoji} ${bottleneck.category} - 影响分数: ${bottleneck.impactScore || 0}

**问题描述:** ${bottleneck.description || '未提供详细描述'}

**建议:** ${bottleneck.suggestion || '需要进一步分析'}

---

`;
      }
    }

    if (analysis && analysis.sqlSuggestions && analysis.sqlSuggestions.length > 0) {
      content += `## SQL 优化建议

`;
      for (const suggestion of analysis.sqlSuggestions) {
        content += `### ${suggestion.title || 'SQL 优化'}

**问题:** ${suggestion.problem || '未描述'}

**原 SQL:**
\`\`\`sql
${suggestion.originalSql || 'N/A'}
\`\`\`

**优化建议:**
\`\`\`sql
${suggestion.optimizedSql || 'N/A'}
\`\`\`

**说明:** ${suggestion.explanation || ''}

---

`;
      }
    }

    if (analysis && analysis.indexSuggestions && analysis.indexSuggestions.length > 0) {
      content += `## 索引优化建议

`;
      for (const suggestion of analysis.indexSuggestions) {
        const action = suggestion.action === 'create' ? '创建' : 
                       suggestion.action === 'drop' ? '删除' : 
                       suggestion.action === 'modify' ? '修改' : '建议';
        
        content += `### ${action}索引 - ${suggestion.tableName || '未知表'}

**索引名:** ${suggestion.indexName || 'N/A'}

**问题:** ${suggestion.problem || '未描述'}

**建议 SQL:**
\`\`\`sql
${suggestion.sql || 'N/A'}
\`\`\`

---

`;
      }
    }

    if (analysis && analysis.connectionPool) {
      content += `## 连接池分析

| 参数 | 当前值 | 建议值 | 说明 |
|------|--------|--------|------|
`;
      const pool = analysis.connectionPool;
      if (pool.currentMaxConnections) content += `| 最大连接数 | ${pool.currentMaxConnections} | ${pool.suggestedMaxConnections || '根据负载调整'} | ${pool.maxConnectionsExplanation || ''} |\n`;
      if (pool.currentIdleTimeout) content += `| 空闲超时 | ${pool.currentIdleTimeout} | ${pool.suggestedIdleTimeout || '合理范围'} | ${pool.idleTimeoutExplanation || ''} |\n`;
      if (pool.currentMinIdle) content += `| 最小空闲连接 | ${pool.currentMinIdle} | ${pool.suggestedMinIdle || '根据流量调整'} | ${pool.minIdleExplanation || ''} |\n`;
      content += '\n';
      
      if (pool.connectionIssues && pool.connectionIssues.length > 0) {
        content += `### 连接池问题

`;
        for (const issue of pool.connectionIssues) {
          content += `- ${issue}\n`;
        }
        content += '\n';
      }
    }

    if (analysis && analysis.readWriteRouting) {
      content += `## 读写分离分析

`;
      const routing = analysis.readWriteRouting;
      
      if (routing.issues && routing.issues.length > 0) {
        content += `### 路由问题

`;
        for (const issue of routing.issues) {
          content += `- ${issue}\n`;
        }
        content += '\n';
      }
      
      if (routing.suggestions && routing.suggestions.length > 0) {
        content += `### 优化建议

`;
        for (const suggestion of routing.suggestions) {
          content += `- ${suggestion}\n`;
        }
        content += '\n';
      }
    }

    if (analysis && analysis.shardingRisks && analysis.shardingRisks.length > 0) {
      content += `## 分片风险分析

`;
      for (const risk of analysis.shardingRisks) {
        const severityEmoji = risk.severity === 'critical' ? '🔴' : 
                              risk.severity === 'high' ? '🟠' : 
                              risk.severity === 'medium' ? '🟡' : '🟢';
        content += `### ${severityEmoji} ${risk.category || '分片风险'} - ${risk.tableName || '未知表'}

**问题:** ${risk.description || '未描述'}

**风险等级: ${risk.impact || '需要评估'}

**建议:** ${risk.suggestion || '需要进一步分析'}

---

`;
      }
    }

    content += `## 附录

报告生成时间: ${new Date().toISOString()}
演练ID: ${drill.id}

---

*此报告由数据库性能调优演练台自动生成*
`;

    return content;
  }

  static async exportJson(req, res) {
    try {
      const { id } = req.params;
      
      const drill = Drill.findById(id);
      const analysis = AnalysisResult.findByDrillId(id);
      const files = ImportFile.findByDrillId(id);
      
      if (!drill) {
        return res.status(404).json({ error: '演练不存在' });
      }
      
      const report = {
        meta: {
          generatedAt: new Date().toISOString(),
          version: '1.0.0'
        },
        drill: drill,
        files: files,
        analysis: analysis
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analysis-report-${drill.id}.json"`);
      res.json(report);
    } catch (error) {
      console.error('导出JSON报告失败:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ReportController;
