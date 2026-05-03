import {
  CheckResult,
  ReviewSession,
  Issue,
  IssueStatus,
  Severity,
  IssueType,
  AuditPackage,
  AuditSummary
} from '../types';

interface ExporterOptions {
  reportName: string;
  includeFixed: boolean;
  includeIgnored: boolean;
}

const typeLabels: Record<IssueType, string> = {
  focus_to_hidden: '焦点跳到隐藏元素',
  modal_not_trapped: '对话框未困住焦点',
  no_readable_name: '无可读名称',
  shortcut_conflict: '快捷键冲突',
  focus_order_violation: '焦点顺序违规',
  tabindex_issue: 'tabindex 问题',
  aria_role_mismatch: 'ARIA 角色不匹配'
};

const severityLabels: Record<Severity, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低'
};

const statusLabels: Record<IssueStatus, string> = {
  new: '新问题',
  confirmed: '已确认',
  ignored: '已忽略',
  fixed: '已修复'
};

export class Exporter {
  private options: ExporterOptions;

  constructor(options?: Partial<ExporterOptions>) {
    this.options = {
      reportName: options?.reportName || '无障碍焦点顺序审计报告',
      includeFixed: options?.includeFixed || false,
      includeIgnored: options?.includeIgnored || false
    };
  }

  exportMarkdown(checkResult: CheckResult, reviewSession: ReviewSession | null): string {
    const issues = this.filterIssues(checkResult.issues, reviewSession);
    const summary = this.buildSummary(checkResult, reviewSession, issues);

    let markdown = '';

    markdown += this.generateHeader();
    markdown += this.generateOverview(summary);
    markdown += this.generateIssueSummary(issues);
    markdown += this.generateFocusOrderSummary(checkResult);
    markdown += this.generateCriticalOperationsSummary(checkResult);
    markdown += this.generateDetailedIssues(issues, reviewSession);
    markdown += this.generateReferences();
    markdown += this.generateFooter();

    return markdown;
  }

  exportCsv(checkResult: CheckResult, reviewSession: ReviewSession | null): string {
    const issues = this.filterIssues(checkResult.issues, reviewSession);

    const headers = [
      'ID',
      '严重级别',
      '问题类型',
      '标题',
      '描述',
      '建议',
      '元素选择器',
      '元素XPath',
      '标签名',
      '文本内容',
      '状态',
      '复核备注',
      '轨迹位置',
      '创建时间'
    ];

    const rows: string[][] = [headers];

    for (const issue of issues) {
      const reviewItem = reviewSession?.issues.find(r => r.issueId === issue.id);
      const status = reviewItem?.status || 'new';
      const reviewNote = reviewItem?.reviewerNote || '';

      rows.push([
        this.escapeCsv(issue.id),
        this.escapeCsv(severityLabels[issue.severity]),
        this.escapeCsv(typeLabels[issue.type]),
        this.escapeCsv(issue.title),
        this.escapeCsv(issue.description),
        this.escapeCsv(issue.suggestion),
        this.escapeCsv(issue.element.selector),
        this.escapeCsv(issue.element.xpath),
        this.escapeCsv(issue.element.tagName),
        this.escapeCsv(issue.element.textContent),
        this.escapeCsv(statusLabels[status]),
        this.escapeCsv(reviewNote),
        issue.trajectoryIndex !== undefined ? String(issue.trajectoryIndex + 1) : '',
        this.escapeCsv(issue.createdAt)
      ]);
    }

    return rows.map(row => row.join(',')).join('\n');
  }

  exportJson(checkResult: CheckResult, reviewSession: ReviewSession | null): AuditPackage {
    const issues = this.filterIssues(checkResult.issues, reviewSession);
    const summary = this.buildSummary(checkResult, reviewSession, issues);

    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      snapshotId: checkResult.scanResult.snapshotId,
      checkResult: {
        ...checkResult,
        issues
      },
      reviewSession: reviewSession || null,
      summary
    };
  }

  private filterIssues(issues: Issue[], reviewSession: ReviewSession | null): Issue[] {
    return issues.filter(issue => {
      const reviewItem = reviewSession?.issues.find(r => r.issueId === issue.id);
      const status = reviewItem?.status || 'new';

      if (status === 'fixed' && !this.options.includeFixed) {
        return false;
      }

      if (status === 'ignored' && !this.options.includeIgnored) {
        return false;
      }

      return true;
    });
  }

  private buildSummary(
    checkResult: CheckResult,
    reviewSession: ReviewSession | null,
    filteredIssues: Issue[]
  ): AuditSummary {
    const issueOverview = {
      total: filteredIssues.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      confirmed: 0,
      ignored: 0,
      new: 0
    };

    for (const issue of filteredIssues) {
      issueOverview[issue.severity]++;

      const reviewItem = reviewSession?.issues.find(r => r.issueId === issue.id);
      const status = reviewItem?.status || 'new';
      issueOverview[status]++;
    }

    const hiddenElements = checkResult.scanResult.focusableElements.filter(
      el => !el.visible || el.ariaHidden
    );

    return {
      snapshotInfo: {
        title: checkResult.scanResult.pageTitle,
        url: checkResult.scanResult.pageUrl,
        timestamp: checkResult.scanResult.timestamp
      },
      issueOverview,
      focusOrder: {
        totalFocusable: checkResult.scanResult.focusableElements.length,
        tabTrajectoryItems: checkResult.scanResult.trajectory?.items.length || 0,
        hiddenElements: hiddenElements.length
      },
      criticalOperations: {
        total: checkResult.scanResult.criticalOperations.length,
        tested: checkResult.scanResult.criticalOperations.filter(o => o.required).length
      }
    };
  }

  private generateHeader(): string {
    return `# ${this.options.reportName}

> 生成时间: ${new Date().toLocaleString('zh-CN')}
> 工具: 焦点顺序体检员 (Focus Order Inspector)

---

`;
  }

  private generateOverview(summary: AuditSummary): string {
    return `## 一、概览

### 快照信息

| 项目 | 内容 |
|------|------|
| 页面标题 | ${summary.snapshotInfo.title} |
| 页面 URL | ${summary.snapshotInfo.url} |
| 扫描时间 | ${new Date(summary.snapshotInfo.timestamp).toLocaleString('zh-CN')} |

### 问题统计

| 统计项 | 数量 |
|--------|------|
| **总问题数** | **${summary.issueOverview.total}** |
| 严重 (Critical) | ${summary.issueOverview.critical} |
| 高 (High) | ${summary.issueOverview.high} |
| 中 (Medium) | ${summary.issueOverview.medium} |
| 低 (Low) | ${summary.issueOverview.low} |

### 复核状态

| 状态 | 数量 |
|------|------|
| 新问题 | ${summary.issueOverview.new} |
| 已确认 | ${summary.issueOverview.confirmed} |
| 已忽略 | ${summary.issueOverview.ignored} |
| 已修复 | ${summary.issueOverview.fixed} |

---

`;
  }

  private generateIssueSummary(issues: Issue[]): string {
    if (issues.length === 0) {
      return `## 二、问题摘要

✅ 未发现问题

---

`;
    }

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const issue of issues) {
      const typeLabel = typeLabels[issue.type] || issue.type;
      byType[typeLabel] = (byType[typeLabel] || 0) + 1;

      const severityLabel = severityLabels[issue.severity];
      bySeverity[severityLabel] = (bySeverity[severityLabel] || 0) + 1;
    }

    let markdown = `## 二、问题摘要

### 按问题类型分布

| 问题类型 | 数量 |
|----------|------|
`;

    for (const [type, count] of Object.entries(byType)) {
      markdown += `| ${type} | ${count} |\n`;
    }

    markdown += `
### 按严重级别分布

| 严重级别 | 数量 |
|----------|------|
`;

    const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];
    for (const severity of severityOrder) {
      const label = severityLabels[severity];
      const count = bySeverity[label] || 0;
      markdown += `| ${label} | ${count} |\n`;
    }

    markdown += `
---

`;

    return markdown;
  }

  private generateFocusOrderSummary(checkResult: CheckResult): string {
    const { focusableElements, trajectory } = checkResult.scanResult;

    const visibleElements = focusableElements.filter(el => el.visible && !el.ariaHidden);
    const hiddenElements = focusableElements.filter(el => !el.visible || el.ariaHidden);
    const positiveTabindex = focusableElements.filter(el => el.tabindex !== null && el.tabindex > 0);

    let markdown = `## 三、焦点顺序分析

### 可聚焦元素统计

| 分类 | 数量 |
|------|------|
| 总可聚焦元素 | ${focusableElements.length} |
| 可见元素 | ${visibleElements.length} |
| 隐藏/aria-hidden | ${hiddenElements.length} |
| 正 tabindex | ${positiveTabindex.length} |

`;

    if (trajectory) {
      markdown += `### Tab 轨迹统计

| 项目 | 数值 |
|------|------|
| 轨迹点数量 | ${trajectory.items.length} |
| 浏览器 | ${trajectory.metadata.browser} |
| 视口 | ${trajectory.metadata.viewport.width} x ${trajectory.metadata.viewport.height} |

`;
    }

    markdown += `---

`;

    return markdown;
  }

  private generateCriticalOperationsSummary(checkResult: CheckResult): string {
    const { criticalOperations } = checkResult.scanResult;

    if (criticalOperations.length === 0) {
      return `## 四、关键操作清单

无关键操作定义

---

`;
    }

    const typeLabels: Record<string, string> = {
      click: '点击',
      input: '输入',
      select: '选择',
      modal: '模态框',
      navigation: '导航'
    };

    let markdown = `## 四、关键操作清单

共 ${criticalOperations.length} 个操作，其中 ${criticalOperations.filter(o => o.required).length} 个必填。

| ID | 描述 | 类型 | 必填 | 选择器 |
|----|------|------|------|--------|
`;

    for (const op of criticalOperations) {
      markdown += `| ${op.id} | ${op.description} | ${typeLabels[op.operationType] || op.operationType} | ${op.required ? '是' : '否'} | \`${op.selector}\` |\n`;
    }

    markdown += `
---

`;

    return markdown;
  }

  private generateDetailedIssues(issues: Issue[], reviewSession: ReviewSession | null): string {
    if (issues.length === 0) {
      return `## 五、问题详情

✅ 未发现问题

---

`;
    }

    const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];

    let markdown = `## 五、问题详情

`;

    for (const severity of severityOrder) {
      const severityIssues = issues.filter(i => i.severity === severity);
      
      if (severityIssues.length === 0) {
        continue;
      }

      markdown += `### ${severityLabels[severity]}级别问题 (${severityIssues.length}个)

`;

      for (let i = 0; i < severityIssues.length; i++) {
        const issue = severityIssues[i];
        const reviewItem = reviewSession?.issues.find(r => r.issueId === issue.id);
        const status = reviewItem?.status || 'new';

        markdown += `#### ${i + 1}. ${issue.title}

| 项目 | 内容 |
|------|------|
| **ID** | \`${issue.id}\` |
| **类型** | ${typeLabels[issue.type]} |
| **严重级别** | ${severityLabels[issue.severity]} |
| **复核状态** | ${statusLabels[status]} |

**描述:**

${issue.description}

**元素信息:**

- 选择器: \`${issue.element.selector}\`
- XPath: \`${issue.element.xpath}\`
- 标签: \`${issue.element.tagName}\`
- 文本: ${issue.element.textContent || '(无)'}
- aria-label: ${issue.element.ariaLabel || '(无)'}

**建议修复:**

${issue.suggestion}

`;

        if (reviewItem?.reviewerNote) {
          markdown += `**复核备注:**

${reviewItem.reviewerNote}

`;
        }

        if (issue.references.length > 0) {
          markdown += `**参考标准:**

`;
          for (const ref of issue.references) {
            markdown += `- ${ref.standard}: ${ref.section}\n`;
            markdown += `  ${ref.url}\n`;
          }
          markdown += '\n';
        }

        markdown += '---\n\n';
      }
    }

    return markdown;
  }

  private generateReferences(): string {
    return `## 六、参考标准

### WCAG 2.1 相关标准

| 编号 | 标准 | 级别 | 说明 |
|------|------|------|------|
| 2.4.3 | [Focus Order](https://www.w3.org/TR/WCAG21/#focus-order) | A | 键盘焦点顺序应符合逻辑 |
| 2.4.7 | [Focus Visible](https://www.w3.org/TR/WCAG21/#focus-visible) | AA | 键盘焦点指示器应可见 |
| 2.1.1 | [Keyboard](https://www.w3.org/TR/WCAG21/#keyboard) | A | 所有功能应可通过键盘访问 |
| 2.1.4 | [Character Key Shortcuts](https://www.w3.org/TR/WCAG21/#character-key-shortcuts) | A | 单字符快捷键应可关闭或重新映射 |
| 1.1.1 | [Non-text Content](https://www.w3.org/TR/WCAG21/#non-text-content) | A | 非文本内容应有替代文本 |
| 2.4.4 | [Link Purpose](https://www.w3.org/TR/WCAG21/#link-purpose-in-context) | A | 链接目的在上下文中应清晰 |
| 4.1.2 | [Name, Role, Value](https://www.w3.org/TR/WCAG21/#name-role-value) | A | UI 组件应提供名称、角色和值 |
| 1.3.1 | [Info and Relationships](https://www.w3.org/TR/WCAG21/#info-and-relationships) | A | 信息、结构和关系应可通过程序确定 |

### ARIA 最佳实践

- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/)
- [Using ARIA](https://www.w3.org/TR/using-aria/)

---

`;
  }

  private generateFooter(): string {
    return `## 七、附录

### 工具信息

- **工具名称**: 焦点顺序体检员 (Focus Order Inspector)
- **版本**: 1.0.0
- **报告版本**: 1.0.0

### 严重级别定义

| 级别 | 说明 |
|------|------|
| **Critical (严重)** | 立即需要修复的问题，会导致核心功能无法使用或严重影响残障用户 |
| **High (高)** | 需要在近期修复的问题，会显著影响可用性 |
| **Medium (中)** | 建议修复的问题，对可用性有一定影响 |
| **Low (低)** | 建议修复的问题，影响较小或属于最佳实践 |

### 问题类型定义

| 类型 | 说明 |
|------|------|
| focus_to_hidden | 焦点跳到隐藏元素 |
| modal_not_trapped | 模态对话框未困住焦点 |
| no_readable_name | 交互元素缺少可读名称 |
| shortcut_conflict | 快捷键冲突或不当使用 |
| focus_order_violation | 焦点顺序与 DOM 顺序不一致 |
| tabindex_issue | tabindex 属性不当使用 |
| aria_role_mismatch | ARIA role 与原生语义不匹配 |

---

*报告由焦点顺序体检员自动生成，建议结合人工复核确认。*
`;
  }

  private escapeCsv(value: string): string {
    if (value === undefined || value === null) {
      return '';
    }

    const strValue = String(value);
    
    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }

    return strValue;
  }
}
