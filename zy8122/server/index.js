const express = require('express');
const multer = require('multer');
const path = require('path');
const TokenAnalyzer = require('./tokenAnalyzer');
const ChangeDetector = require('./changeDetector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const upload = multer({ dest: 'uploads/' });

app.get('/api/sample', (req, res) => {
  try {
    const sampleTokensV1 = require('../data/tokens-v1.json');
    const sampleTokensV2 = require('../data/tokens-v2.json');
    const sampleRules = require('../data/rules.json');
    const sampleLogs = require('../data/component-logs.json');

    const tokenAnalyzer = new TokenAnalyzer();
    const changeDetector = new ChangeDetector(sampleRules);

    const analyzedV1 = tokenAnalyzer.analyze(sampleTokensV1);
    const analyzedV2 = tokenAnalyzer.analyze(sampleTokensV2);

    const changes = changeDetector.detectChanges(analyzedV1, analyzedV2);
    const componentImpacts = changeDetector.analyzeComponentImpacts(sampleLogs, changes);
    const rollbackSuggestions = changeDetector.generateRollbackSuggestions(changes, componentImpacts);

    res.json({
      success: true,
      data: {
        tokensV1: sampleTokensV1,
        tokensV2: sampleTokensV2,
        analyzedV1,
        analyzedV2,
        changes,
        componentImpacts,
        rollbackSuggestions
      }
    });
  } catch (error) {
    console.error('Sample data error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/analyze', upload.fields([
  { name: 'tokensV1', maxCount: 1 },
  { name: 'tokensV2', maxCount: 1 },
  { name: 'componentLogs', maxCount: 1 },
  { name: 'rules', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files;
    const body = req.body;

    let tokensV1, tokensV2, componentLogs, rules;

    if (files.tokensV1) {
      tokensV1 = require(path.join(__dirname, '../', files.tokensV1[0].path));
    } else if (body.tokensV1) {
      tokensV1 = JSON.parse(body.tokensV1);
    }

    if (files.tokensV2) {
      tokensV2 = require(path.join(__dirname, '../', files.tokensV2[0].path));
    } else if (body.tokensV2) {
      tokensV2 = JSON.parse(body.tokensV2);
    }

    if (files.componentLogs) {
      const logsContent = require('fs').readFileSync(files.componentLogs[0].path, 'utf-8');
      componentLogs = logsContent.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
    } else if (body.componentLogs) {
      componentLogs = body.componentLogs.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
    }

    if (files.rules) {
      const yaml = require('js-yaml');
      const rulesContent = require('fs').readFileSync(files.rules[0].path, 'utf-8');
      rules = yaml.load(rulesContent);
    } else if (body.rules) {
      const yaml = require('js-yaml');
      rules = yaml.load(body.rules);
    }

    if (!tokensV1 || !tokensV2) {
      return res.status(400).json({ success: false, error: '请提供 tokens-v1.json 和 tokens-v2.json' });
    }

    const tokenAnalyzer = new TokenAnalyzer();
    const changeDetector = new ChangeDetector(rules || {});

    const analyzedV1 = tokenAnalyzer.analyze(tokensV1);
    const analyzedV2 = tokenAnalyzer.analyze(tokensV2);

    const changes = changeDetector.detectChanges(analyzedV1, analyzedV2);
    const componentImpacts = componentLogs ? changeDetector.analyzeComponentImpacts(componentLogs, changes) : [];
    const rollbackSuggestions = changeDetector.generateRollbackSuggestions(changes, componentImpacts);

    res.json({
      success: true,
      data: {
        tokensV1,
        tokensV2,
        analyzedV1,
        analyzedV2,
        changes,
        componentImpacts,
        rollbackSuggestions
      }
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/export/markdown', (req, res) => {
  try {
    const { data } = req.body;
    const { changes, componentImpacts, rollbackSuggestions, analyzedV1, analyzedV2 } = data;

    let markdown = `# Design Token 变更分析报告\n\n`;
    markdown += `生成时间: ${new Date().toISOString()}\n\n`;
    markdown += `---\n\n`;

    markdown += `## 1. 变更摘要\n\n`;
    const stats = {
      added: changes.filter(c => c.type === 'added').length,
      removed: changes.filter(c => c.type === 'removed').length,
      modified: changes.filter(c => c.type === 'modified').length,
      breaking: changes.filter(c => c.isBreaking).length
    };
    markdown += `- 新增 Token: ${stats.added}\n`;
    markdown += `- 删除 Token: ${stats.removed}\n`;
    markdown += `- 修改 Token: ${stats.modified}\n`;
    markdown += `- 破坏性变更: ${stats.breaking}\n\n`;

    if (stats.breaking > 0) {
      markdown += `## 2. 破坏性变更详情\n\n`;
      const breakingChanges = changes.filter(c => c.isBreaking);
      breakingChanges.forEach((change, index) => {
        markdown += `### ${index + 1}. ${change.tokenPath}\n\n`;
        markdown += `- 类型: ${change.type}\n`;
        markdown += `- 原因: ${change.breakingReason || '未知'}\n\n`;
        if (change.oldValue !== undefined) {
          markdown += `- 旧值: \`${JSON.stringify(change.oldValue)}\`\n`;
        }
        if (change.newValue !== undefined) {
          markdown += `- 新值: \`${JSON.stringify(change.newValue)}\`\n`;
        }
        markdown += `\n`;
      });
    }

    if (componentImpacts && componentImpacts.length > 0) {
      markdown += `## 3. 受影响组件\n\n`;
      componentImpacts.forEach((impact, index) => {
        markdown += `### ${index + 1}. ${impact.componentName}\n\n`;
        markdown += `- 影响 Token 数量: ${impact.affectedTokens.length}\n`;
        markdown += `- 影响范围: ${impact.severity}\n\n`;
        if (impact.usageExamples && impact.usageExamples.length > 0) {
          markdown += `使用示例:\n`;
          impact.usageExamples.slice(0, 5).forEach(example => {
            markdown += `  - \`${example}\`\n`;
          });
          markdown += `\n`;
        }
      });
    }

    if (rollbackSuggestions && rollbackSuggestions.length > 0) {
      markdown += `## 4. 回滚建议\n\n`;
      const priorityGroups = {
        high: rollbackSuggestions.filter(s => s.priority === 'high'),
        medium: rollbackSuggestions.filter(s => s.priority === 'medium'),
        low: rollbackSuggestions.filter(s => s.priority === 'low')
      };

      if (priorityGroups.high.length > 0) {
        markdown += `### 高优先级\n\n`;
        priorityGroups.high.forEach((suggestion, index) => {
          markdown += `${index + 1}. **${suggestion.tokenPath}**\n`;
          markdown += `   - 问题: ${suggestion.reason}\n`;
          markdown += `   - 建议: ${suggestion.action}\n\n`;
        });
      }

      if (priorityGroups.medium.length > 0) {
        markdown += `### 中优先级\n\n`;
        priorityGroups.medium.forEach((suggestion, index) => {
          markdown += `${index + 1}. **${suggestion.tokenPath}**\n`;
          markdown += `   - 问题: ${suggestion.reason}\n`;
          markdown += `   - 建议: ${suggestion.action}\n\n`;
        });
      }
    }

    const contrastRisks = changes.filter(c => c.contrastRisk);
    if (contrastRisks.length > 0) {
      markdown += `## 5. 对比度风险\n\n`;
      contrastRisks.forEach((risk, index) => {
        markdown += `${index + 1}. **${risk.tokenPath}**\n`;
        markdown += `   - 对比度: ${risk.contrastRatio.toFixed(2)}:1\n`;
        markdown += `   - 风险等级: ${risk.contrastRisk}\n`;
        markdown += `   - 建议: 确保符合 WCAG 2.1 AA 标准 (文本 4.5:1, 大文本 3:1)\n\n`;
      });
    }

    markdown += `---\n\n`;
    markdown += `报告由 Design Token Replay 生成\n`;

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename="token-analysis-report.md"');
    res.send(markdown);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/export/json', (req, res) => {
  try {
    const { data } = req.body;
    
    const jsonData = {
      generatedAt: new Date().toISOString(),
      ...data
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="token-analysis-report.json"');
    res.send(JSON.stringify(jsonData, null, 2));
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Design Token Replay 服务运行在 http://localhost:${PORT}`);
  console.log(`按 Ctrl+C 停止服务`);
});