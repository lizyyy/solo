import * as fs from 'fs';
import { DeeplinkReport, Issue, RouteAnalysis } from './types';

export class Reporter {
  // 生成完整的报告对象
  static generateReport(
    issues: Issue[],
    routeAnalysis: RouteAnalysis[],
    totalRoutes: number
  ): DeeplinkReport {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    const lowIssues = issues.filter(i => i.severity === 'low').length;

    return {
      summary: {
        totalRoutes,
        totalIssues: issues.length,
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues,
        checkTime: new Date().toISOString()
      },
      issues,
      routeAnalysis
    };
  }

  // 导出 issues.csv 文件
  static exportCsv(report: DeeplinkReport, filePath: string): void {
    const headers = [
      'ID',
      '类型',
      '严重程度',
      '路由',
      '屏幕',
      '消息',
      '详情',
      '建议'
    ];

    const typeMap: Record<Issue['type'], string> = {
      parameter_missing: '参数缺失',
      login_required: '登录态要求',
      deprecated_route: '废弃路由',
      missing_event: '埋点缺失',
      gray_policy_mismatch: '灰度规则不匹配',
      invalid_scheme: '无效协议',
      old_shortlink: '旧短链'
    };

    const severityMap: Record<Issue['severity'], string> = {
      critical: '严重',
      high: '高',
      medium: '中',
      low: '低'
    };

    const rows = report.issues.map(issue => [
      issue.id,
      typeMap[issue.type],
      severityMap[issue.severity],
      this.escapeCsvField(issue.route),
      this.escapeCsvField(issue.screen),
      this.escapeCsvField(issue.message),
      this.escapeCsvField(issue.details),
      this.escapeCsvField(issue.suggestion)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf-8');
    console.log(`✅ 已导出问题列表到: ${filePath}`);
  }

  // 导出 Markdown 报告文件
  static exportMarkdown(report: DeeplinkReport, filePath: string): void {
    const markdownContent = this.generateMarkdownContent(report);
    fs.writeFileSync(filePath, markdownContent, 'utf-8');
    console.log(`✅ 已导出详细报告到: ${filePath}`);
  }

  // 生成 Markdown 内容
  private static generateMarkdownContent(report: DeeplinkReport): string {
    const { summary, issues, routeAnalysis } = report;

    const typeEmojiMap: Record<Issue['type'], string> = {
      parameter_missing: '🔧',
      login_required: '🔐',
      deprecated_route: '⚠️',
      missing_event: '📊',
      gray_policy_mismatch: '🎯',
      invalid_scheme: '❌',
      old_shortlink: '🔗'
    };

    const typeMap: Record<Issue['type'], string> = {
      parameter_missing: '参数缺失',
      login_required: '登录态要求',
      deprecated_route: '废弃路由',
      missing_event: '埋点缺失',
      gray_policy_mismatch: '灰度规则不匹配',
      invalid_scheme: '无效协议',
      old_shortlink: '旧短链'
    };

    const severityEmojiMap: Record<Issue['severity'], string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };

    const severityMap: Record<Issue['severity'], string> = {
      critical: '严重',
      high: '高',
      medium: '中',
      low: '低'
    };

    let content = `# 深链路发布预检报告

> 生成时间: ${new Date(summary.checkTime).toLocaleString('zh-CN')}

---

## 📊 概览

| 指标 | 数值 |
|------|------|
| 总路由数 | ${summary.totalRoutes} |
| 总问题数 | ${summary.totalIssues} |
| 严重问题 | ${summary.criticalIssues} |
| 高优先级问题 | ${summary.highIssues} |
| 中优先级问题 | ${summary.mediumIssues} |
| 低优先级问题 | ${summary.lowIssues} |

---

## 🎯 问题详情

`;

    if (issues.length === 0) {
      content += `### ✅ 未发现任何问题

恭喜！所有检查项均通过。
`;
    } else {
      // 按严重程度分组
      const groupedIssues: Record<Issue['severity'], Issue[]> = {
        critical: [],
        high: [],
        medium: [],
        low: []
      };

      issues.forEach(issue => {
        groupedIssues[issue.severity].push(issue);
      });

      const severityOrder: Issue['severity'][] = ['critical', 'high', 'medium', 'low'];

      for (const severity of severityOrder) {
        const severityIssues = groupedIssues[severity];
        if (severityIssues.length === 0) continue;

        content += `### ${severityEmojiMap[severity]} ${severityMap[severity]}问题 (${severityIssues.length}个)

`;

        severityIssues.forEach((issue, index) => {
          content += `#### ${typeEmojiMap[issue.type]} ${issue.id}: ${issue.message}

- **类型**: ${typeMap[issue.type]}
- **严重程度**: ${severityMap[severity]}
- **路由**: \`${issue.route}\`
- **目标屏幕**: \`${issue.screen}\`

**详情**:
${issue.details}

**建议**:
${issue.suggestion}

---

`;
        });
      }
    }

    content += `## 📋 路由分析详情

`;

    const statusEmojiMap: Record<RouteAnalysis['status'], string> = {
      pass: '✅',
      warning: '⚠️',
      error: '❌'
    };

    const statusMap: Record<RouteAnalysis['status'], string> = {
      pass: '通过',
      warning: '警告',
      error: '错误'
    };

    // 按状态排序
    const sortedAnalysis = [...routeAnalysis].sort((a, b) => {
      const statusOrder: RouteAnalysis['status'][] = ['error', 'warning', 'pass'];
      return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    });

    sortedAnalysis.forEach(analysis => {
      content += `### ${statusEmojiMap[analysis.status]} \`${analysis.path}\`

- **协议**: \`${analysis.scheme}\`
- **目标屏幕**: \`${analysis.targetScreen}\`
- **状态**: ${statusMap[analysis.status]}

**检查项**:

`;

      analysis.checks.forEach(check => {
        const checkStatus = check.passed ? '✅' : '❌';
        content += `- ${checkStatus} **${check.name}**: ${check.message || (check.passed ? '通过' : '失败')}
`;
      });

      content += `
---

`;
    });

    content += `## 📝 附录

### 问题类型说明

| 类型 | 说明 |
|------|------|
| 🔧 参数缺失 | URL 中缺少必填参数或参数值为空 |
| 🔐 登录态要求 | 路由需要登录但未检测到登录状态 |
| ⚠️ 废弃路由 | 使用了已标记为废弃的路由 |
| 📊 埋点缺失 | 目标屏幕要求的埋点事件未触发 |
| 🎯 灰度规则不匹配 | 用户上下文不符合灰度规则要求 |
| 🔗 旧短链 | 检测到可能仍在使用的旧短链格式 |

### 严重程度说明

| 级别 | 说明 |
|------|------|
| 🔴 严重 | 必须立即修复的阻塞性问题 |
| 🟠 高 | 重要问题，建议在发布前修复 |
| 🟡 中 | 中等问题，可根据实际情况处理 |
| 🟢 低 | 轻微问题或优化建议 |

---

*此报告由深链路发布预检工具自动生成*
`;

    return content;
  }

  // 转义 CSV 字段
  private static escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  // 打印控制台摘要
  static printConsoleSummary(report: DeeplinkReport): void {
    const { summary } = report;
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 深链路发布预检结果');
    console.log('='.repeat(60));
    
    console.log(`\n📊 概览:`);
    console.log(`  总路由数: ${summary.totalRoutes}`);
    console.log(`  总问题数: ${summary.totalIssues}`);
    
    if (summary.totalIssues > 0) {
      console.log(`\n🎯 问题分布:`);
      
      const items = [
        { count: summary.criticalIssues, label: '严重', emoji: '🔴' },
        { count: summary.highIssues, label: '高优先级', emoji: '🟠' },
        { count: summary.mediumIssues, label: '中优先级', emoji: '🟡' },
        { count: summary.lowIssues, label: '低优先级', emoji: '🟢' }
      ];
      
      items.forEach(item => {
        if (item.count > 0) {
          console.log(`  ${item.emoji} ${item.label}: ${item.count} 个`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (summary.totalIssues === 0) {
      console.log('✅ 所有检查项均通过！');
    } else if (summary.criticalIssues > 0 || summary.highIssues > 0) {
      console.log('⚠️ 发现重要问题，建议在发布前修复！');
    } else {
      console.log('ℹ️ 发现一些问题，请查看详细报告。');
    }
    
    console.log('='.repeat(60) + '\n');
  }
}
