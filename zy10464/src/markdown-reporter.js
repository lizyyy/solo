const fs = require('fs');
const path = require('path');

class MarkdownReporter {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './audit-output';
    this.reportName = options.reportName || 'postman-audit';
    this.verbose = options.verbose || false;
    this.quiet = options.quiet || false;
  }

  async generate(auditResult) {
    this.ensureOutputDir();

    const outputPath = path.join(this.outputDir, `${this.reportName}.md`);
    
    const content = this.buildMarkdown(auditResult);
    
    fs.writeFileSync(outputPath, content, 'utf-8');
    
    if (!this.quiet) {
      console.log(`📝 Markdown报告已生成: ${outputPath}`);
    }

    return outputPath;
  }

  buildMarkdown(auditResult) {
    const lines = [];
    
    lines.push(this.printHeader(auditResult));
    lines.push('');
    lines.push(this.printSummary(auditResult));
    lines.push('');
    lines.push(this.printAssertionSection(auditResult.assertions));
    lines.push('');
    lines.push(this.printExampleSection(auditResult.examples));
    lines.push('');
    
    if (auditResult.variables) {
      lines.push(this.printVariableSection(auditResult.variables));
      lines.push('');
    }
    
    lines.push(this.printIssuesSection(auditResult));
    lines.push('');
    lines.push(this.printActionItems(auditResult));
    lines.push('');
    lines.push(this.printFooter());

    return lines.join('\n');
  }

  printHeader(auditResult) {
    const metadata = auditResult.metadata;
    return `# Postman Collection 覆盖审计报告

## 基本信息

| 项目 | 内容 |
|------|------|
| **Collection名称** | ${metadata.collectionName} |
| **审计时间** | ${new Date(metadata.auditTime).toLocaleString('zh-CN')} |
| **源文件** | \`${metadata.collectionFile}\` |
| **请求总数** | ${metadata.totalRequests} |`;
  }

  printSummary(auditResult) {
    const assertionRate = auditResult.summary.assertions.coverageRate;
    const exampleRate = auditResult.summary.examples.coverageRate;
    
    let overallStatus = '✅ 通过';
    if (assertionRate < 50 || exampleRate < 50) {
      overallStatus = '🔴 需要改进';
    } else if (assertionRate < 80 || exampleRate < 80) {
      overallStatus = '🟡 基本达标';
    }

    return `## 总体概览

### 评价: ${overallStatus}

| 指标 | 数值 |
|------|------|
| **断言覆盖率** | ${assertionRate}% |
| **示例响应覆盖率** | ${exampleRate}% |
| **有断言的请求** | ${auditResult.summary.assertions.withAssertions} / ${auditResult.summary.assertions.total} |
| **有示例的请求** | ${auditResult.summary.examples.withExamples} / ${auditResult.summary.examples.total} |
| **断言总数** | ${auditResult.assertions.assertionCount} |
| **示例总数** | ${auditResult.examples.totalExamples} |`;
  }

  printAssertionSection(assertionResults) {
    const lines = [];
    
    lines.push('## 📊 断言覆盖分析');
    lines.push('');
    lines.push(`**覆盖率: ${assertionResults.coverageRate}%**`);
    lines.push('');
    lines.push('| 统计项 | 数量 |');
    lines.push('|--------|------|');
    lines.push(`| 有断言的请求 | ${assertionResults.withAssertions} |`);
    lines.push(`| 无断言的请求 | ${assertionResults.withoutAssertions} |`);
    lines.push(`| 断言总数 | ${assertionResults.assertionCount} |`);
    lines.push('');

    if (Object.keys(assertionResults.assertionTypes).length > 0) {
      lines.push('### 断言类型分布');
      lines.push('');
      lines.push('| 类型 | 数量 |');
      lines.push('|------|------|');
      for (const [type, count] of Object.entries(assertionResults.assertionTypes)) {
        lines.push(`| ${type} | ${count} |`);
      }
      lines.push('');
    }

    const withoutAssertions = assertionResults.details.filter(d => !d.hasAssertions);
    if (withoutAssertions.length > 0) {
      lines.push('### ⚠️  缺少断言的请求');
      lines.push('');
      lines.push('| 方法 | 名称 | 路径 | 位置 |');
      lines.push('|------|------|------|------|');
      
      for (const req of withoutAssertions) {
        const itemPath = `item[${req.sourceLocation.itemIndices.join('][')}]`;
        lines.push(`| ${req.requestMethod} | ${req.requestName} | ${req.requestPath || '根目录'} | \`${itemPath}\` |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  printExampleSection(exampleResults) {
    const lines = [];
    
    lines.push('## 📋 示例响应覆盖分析');
    lines.push('');
    lines.push(`**覆盖率: ${exampleResults.coverageRate}%**`);
    lines.push('');
    lines.push('| 统计项 | 数量 |');
    lines.push('|--------|------|');
    lines.push(`| 有示例的请求 | ${exampleResults.withExamples} |`);
    lines.push(`| 无示例的请求 | ${exampleResults.withoutExamples} |`);
    lines.push(`| 示例总数 | ${exampleResults.totalExamples} |`);
    lines.push('');

    if (Object.keys(exampleResults.statusCodeDistribution).length > 0) {
      lines.push('### 状态码分布');
      lines.push('');
      lines.push('| 状态码 | 数量 |');
      lines.push('|--------|------|');
      for (const [code, count] of Object.entries(exampleResults.statusCodeDistribution)) {
        lines.push(`| ${code} | ${count} |`);
      }
      lines.push('');
    }

    const withoutExamples = exampleResults.details.filter(d => !d.hasExamples);
    if (withoutExamples.length > 0) {
      lines.push('### ⚠️  缺少示例响应的请求');
      lines.push('');
      lines.push('| 方法 | 名称 | 路径 | 位置 |');
      lines.push('|------|------|------|------|');
      
      for (const req of withoutExamples) {
        const itemPath = `item[${req.sourceLocation.itemIndices.join('][')}]`;
        lines.push(`| ${req.requestMethod} | ${req.requestName} | ${req.requestPath || '根目录'} | \`${itemPath}\` |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  printVariableSection(variableResults) {
    const lines = [];
    
    lines.push('## 🔧 变量引用分析');
    lines.push('');
    lines.push(`**环境文件:** \`${variableResults.environmentFile}\``);
    lines.push('');
    lines.push(`使用变量的请求: ${variableResults.requestsWithVariables} / ${variableResults.totalRequests}`);
    lines.push('');

    if (variableResults.uniqueUndefinedVariables.length > 0) {
      lines.push('### ❌ 未定义的变量');
      lines.push('');
      lines.push('| 变量名 |');
      lines.push('|--------|');
      for (const varName of variableResults.uniqueUndefinedVariables) {
        lines.push(`| \`${varName}\` |`);
      }
      lines.push('');
    }

    if (Object.keys(variableResults.variableReferences).length > 0) {
      lines.push('### 变量引用统计');
      lines.push('');
      lines.push('| 变量名 | 引用次数 |');
      lines.push('|--------|----------|');
      const sorted = Object.entries(variableResults.variableReferences).sort((a, b) => b[1] - a[1]);
      for (const [varName, count] of sorted) {
        lines.push(`| \`${varName}\` | ${count} |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  printIssuesSection(auditResult) {
    const lines = [];
    const allIssues = [
      ...auditResult.assertions.issues.map(i => ({ ...i, category: '断言' })),
      ...auditResult.examples.issues.map(i => ({ ...i, category: '示例' }))
    ];
    
    if (auditResult.variables?.issues) {
      allIssues.push(...auditResult.variables.issues.map(i => ({ ...i, category: '变量' })));
    }

    lines.push('## ⚠️  发现的问题');
    lines.push('');

    if (allIssues.length === 0) {
      lines.push('✅ 未发现任何问题！');
      return lines.join('\n');
    }

    const grouped = {
      error: allIssues.filter(i => i.severity === 'error'),
      warning: allIssues.filter(i => i.severity === 'warning'),
      info: allIssues.filter(i => i.severity === 'info')
    };

    for (const severity of ['error', 'warning', 'info']) {
      const issues = grouped[severity];
      if (issues.length === 0) continue;

      const icon = severity === 'error' ? '🔴' : severity === 'warning' ? '🟡' : '🔵';
      lines.push(`### ${icon} ${severity.toUpperCase()} (${issues.length})`);
      lines.push('');
      lines.push('| 类别 | 类型 | 描述 | 建议 |');
      lines.push('|------|------|------|------|');
      
      for (const issue of issues) {
        lines.push(`| ${issue.category} | ${issue.type} | ${issue.message} | ${issue.suggestion || '-'} |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  printActionItems(auditResult) {
    const lines = [];
    const actionItems = [];

    const assertionRate = auditResult.summary.assertions.coverageRate;
    const exampleRate = auditResult.summary.examples.coverageRate;

    if (assertionRate < 100) {
      actionItems.push({
        priority: assertionRate < 50 ? '高' : '中',
        title: '完善断言覆盖',
        description: `还有 ${auditResult.summary.assertions.withoutAssertions} 个请求缺少断言，建议为每个 API 请求添加状态码、响应结构、业务数据的断言。`
      });
    }

    if (exampleRate < 100) {
      actionItems.push({
        priority: exampleRate < 50 ? '高' : '中',
        title: '补充示例响应',
        description: `还有 ${auditResult.summary.examples.withoutExamples} 个请求缺少示例响应，建议添加成功和失败场景的示例，方便接口调试和文档生成。`
      });
    }

    if (auditResult.variables?.uniqueUndefinedVariables?.length > 0) {
      actionItems.push({
        priority: '高',
        title: '修复未定义变量',
        description: `发现 ${auditResult.variables.uniqueUndefinedVariables.length} 个未定义的环境变量，请在环境文件中补充: ${auditResult.variables.uniqueUndefinedVariables.join(', ')}`
      });
    }

    lines.push('## 🎯 改进建议');
    lines.push('');

    if (actionItems.length === 0) {
      lines.push('🎉 完美！Collection 已达到良好的覆盖标准。');
      return lines.join('\n');
    }

    lines.push('| 优先级 | 任务 | 说明 |');
    lines.push('|--------|------|------|');
    
    for (const item of actionItems) {
      const priorityIcon = item.priority === '高' ? '🔴' : '🟡';
      lines.push(`| ${priorityIcon} ${item.priority} | **${item.title}** | ${item.description} |`);
    }

    return lines.join('\n');
  }

  printFooter() {
    return `---

*报告由 Postman 覆盖审计工具自动生成*  
*生成时间: ${new Date().toLocaleString('zh-CN')}*`;
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }
}

module.exports = MarkdownReporter;
