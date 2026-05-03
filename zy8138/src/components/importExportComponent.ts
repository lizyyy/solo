import Papa from 'papaparse';
import type { 
  Scene, Prop, PropAppearance, ContinuityRule, 
  ContinuityIssue, ConfirmedIssue 
} from '../types';
import { parseScenesJson, parsePropsCsv, parseContinuityRulesYaml } from '../parsers';

export interface ImportOptions {
  onScenesImported?: (scenes: Scene[]) => void;
  onPropsImported?: (props: Prop[], appearances: PropAppearance[]) => void;
  onRulesImported?: (rules: ContinuityRule[]) => void;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export interface ExportOptions {
  scenes: Scene[];
  props: Prop[];
  appearances: PropAppearance[];
  rules: ContinuityRule[];
  issues: ContinuityIssue[];
  confirmedIssues: ConfirmedIssue[];
  projectName: string;
}

export function renderImportSection(_options: ImportOptions): string {
  return `
    <div class="import-section">
      <h2>导入数据</h2>
      <div class="import-controls">
        <div class="import-group">
          <label class="import-label">导入场景 (JSON)</label>
          <input type="file" id="import-scenes" accept=".json" class="import-input" />
          <button class="import-btn" data-target="scenes">选择文件</button>
        </div>
        <div class="import-group">
          <label class="import-label">导入道具 (CSV)</label>
          <input type="file" id="import-props" accept=".csv" class="import-input" />
          <button class="import-btn" data-target="props">选择文件</button>
        </div>
        <div class="import-group">
          <label class="import-label">导入规则 (YAML)</label>
          <input type="file" id="import-rules" accept=".yaml,.yml" class="import-input" />
          <button class="import-btn" data-target="rules">选择文件</button>
        </div>
      </div>
      <div class="import-status" id="import-status"></div>
    </div>
  `;
}

export async function handleFileImport(
  file: File,
  type: 'scenes' | 'props' | 'rules',
  options: ImportOptions
): Promise<void> {
  const reader = new FileReader();

  reader.onload = async (e) => {
    const content = e.target?.result as string;
    if (!content) {
      options.onError?.('文件内容为空');
      return;
    }

    try {
      switch (type) {
        case 'scenes': {
          const result = parseScenesJson(content);
          if (result.success && result.data) {
            options.onScenesImported?.(result.data);
            options.onSuccess?.(`成功导入 ${result.data.length} 个场景`);
          } else {
            options.onError?.(`导入失败: ${result.errors.join(', ')}`);
          }
          break;
        }
        case 'props': {
          const result = parsePropsCsv(content);
          if (result.success && result.data) {
            options.onPropsImported?.(result.data.props, result.data.appearances);
            options.onSuccess?.(`成功导入 ${result.data.props.length} 个道具和 ${result.data.appearances.length} 个出场记录`);
          } else {
            options.onError?.(`导入失败: ${result.errors.join(', ')}`);
          }
          break;
        }
        case 'rules': {
          const result = parseContinuityRulesYaml(content);
          if (result.success && result.data) {
            options.onRulesImported?.(result.data);
            options.onSuccess?.(`成功导入 ${result.data.length} 条规则`);
          } else {
            options.onError?.(`导入失败: ${result.errors.join(', ')}`);
          }
          break;
        }
      }
    } catch (error) {
      options.onError?.(`处理文件时出错: ${(error as Error).message}`);
    }
  };

  reader.onerror = () => {
    options.onError?.('文件读取失败');
  };

  reader.readAsText(file);
}

export function renderExportSection(): string {
  return `
    <div class="export-section">
      <h2>导出报告</h2>
      <div class="export-controls">
        <button class="export-btn" data-format="report">
          导出报告 (review_report.md)
        </button>
        <button class="export-btn" data-format="issues">
          导出问题 (issues.csv)
        </button>
      </div>
    </div>
  `;
}

export function generateReviewReport(options: ExportOptions): string {
  const {
    scenes,
    props,
    appearances,
    rules,
    issues,
    confirmedIssues,
    projectName,
  } = options;

  const confirmedIssueIds = new Set(confirmedIssues.map(ci => ci.issueId));
  const unconfirmedIssues = issues.filter(i => !confirmedIssueIds.has(i.id));
  const criticalIssues = unconfirmedIssues.filter(i => i.severity === 'critical');
  const warningIssues = unconfirmedIssues.filter(i => i.severity === 'warning');
  const infoIssues = unconfirmedIssues.filter(i => i.severity === 'info');

  const now = new Date().toISOString();

  let report = `# ${projectName} - 道具连续性检查报告

> 生成时间: ${now}

---

## 概览

| 项目 | 数量 |
|------|------|
| 总场次数 | ${scenes.length} |
| 总道具数 | ${props.length} |
| 道具出场记录 | ${appearances.length} |
| 启用规则数 | ${rules.filter(r => r.enabled).length} |

---

## 问题统计

| 严重程度 | 待确认 | 已确认 | 总计 |
|----------|--------|--------|------|
| 严重 (Critical) | ${criticalIssues.length} | ${confirmedIssues.filter(ci => issues.find(i => i.id === ci.issueId)?.severity === 'critical').length} | ${issues.filter(i => i.severity === 'critical').length} |
| 警告 (Warning) | ${warningIssues.length} | ${confirmedIssues.filter(ci => issues.find(i => i.id === ci.issueId)?.severity === 'warning').length} | ${issues.filter(i => i.severity === 'warning').length} |
| 信息 (Info) | ${infoIssues.length} | ${confirmedIssues.filter(ci => issues.find(i => i.id === ci.issueId)?.severity === 'info').length} | ${issues.filter(i => i.severity === 'info').length} |
| **总计** | **${unconfirmedIssues.length}** | **${confirmedIssues.length}** | **${issues.length}** |

---

## 待确认问题详情

`;

  if (unconfirmedIssues.length === 0) {
    report += `✅ 所有问题均已确认处理。

`;
  } else {
    if (criticalIssues.length > 0) {
      report += `### 🔴 严重问题 (${criticalIssues.length})

`;
      for (const issue of criticalIssues) {
        report += `#### ${issue.ruleName}

- **描述**: ${issue.description}
- **道具**: ${issue.propName || 'N/A'}
- **场景**: ${issue.sceneNumber || 'N/A'}
- **关联项**: ${issue.relatedItems.join(', ') || 'N/A'}

`;
      }
    }

    if (warningIssues.length > 0) {
      report += `### 🟡 警告问题 (${warningIssues.length})

`;
      for (const issue of warningIssues) {
        report += `#### ${issue.ruleName}

- **描述**: ${issue.description}
- **道具**: ${issue.propName || 'N/A'}
- **场景**: ${issue.sceneNumber || 'N/A'}
- **关联项**: ${issue.relatedItems.join(', ') || 'N/A'}

`;
      }
    }

    if (infoIssues.length > 0) {
      report += `### ℹ️ 信息问题 (${infoIssues.length})

`;
      for (const issue of infoIssues) {
        report += `#### ${issue.ruleName}

- **描述**: ${issue.description}
- **道具**: ${issue.propName || 'N/A'}
- **场景**: ${issue.sceneNumber || 'N/A'}
- **关联项**: ${issue.relatedItems.join(', ') || 'N/A'}

`;
      }
    }
  }

  if (confirmedIssues.length > 0) {
    report += `---

## 已确认问题

| 问题ID | 规则名称 | 确认人 | 确认时间 |
|--------|----------|--------|----------|
`;
    for (const confirmed of confirmedIssues) {
      const issue = issues.find(i => i.id === confirmed.issueId);
      report += `| ${confirmed.issueId} | ${issue?.ruleName || 'N/A'} | ${confirmed.confirmedBy} | ${new Date(confirmed.confirmedAt).toISOString()} |
`;
    }
    report += `
`;
  }

  report += `---

## 场次列表

| 场次编号 | 描述 | 地点 | 计划拍摄日期 | 实际拍摄日期 | 补拍日期 |
|----------|------|------|--------------|--------------|----------|
`;

  for (const scene of scenes) {
    report += `| ${scene.sceneNumber} | ${scene.description} | ${scene.location} | ${scene.plannedShootDate} | ${scene.actualShootDate || 'N/A'} | ${scene.reshootDate || 'N/A'} |
`;
  }

  report += `
---

## 道具列表

| 道具编号 | 名称 | 类别 | 负责人 | 当前位置 | 状态 |
|----------|------|------|--------|----------|------|
`;

  for (const prop of props) {
    report += `| ${prop.propNumber} | ${prop.name} | ${prop.category} | ${prop.responsiblePerson || '未指定'} | ${prop.currentLocation} | ${prop.status} |
`;
  }

  report += `
---

*此报告由道具连续性检查工具自动生成*
`;

  return report;
}

export function generateIssuesCsv(options: ExportOptions): string {
  const { issues, confirmedIssues } = options;
  const confirmedIssueIds = new Set(confirmedIssues.map(ci => ci.issueId));

  const headers = [
    '问题ID',
    '规则名称',
    '严重程度',
    '描述',
    '道具名称',
    '场景编号',
    '关联项',
    '状态',
    '确认人',
    '确认时间',
    '发现时间',
  ];

  const rows = issues.map(issue => {
    const isConfirmed = confirmedIssueIds.has(issue.id);
    const confirmed = confirmedIssues.find(ci => ci.issueId === issue.id);

    return [
      issue.id,
      issue.ruleName,
      issue.severity,
      issue.description,
      issue.propName || '',
      issue.sceneNumber || '',
      issue.relatedItems.join('; '),
      isConfirmed ? '已确认' : '待确认',
      confirmed?.confirmedBy || '',
      confirmed ? new Date(confirmed.confirmedAt).toISOString() : '',
      new Date(issue.timestamp).toISOString(),
    ];
  });

  const csvContent = Papa.unparse([headers, ...rows]);
  return csvContent;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
