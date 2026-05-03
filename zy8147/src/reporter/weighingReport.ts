import { AnalysisResult, WeighingEvent, Issue, IssueType } from '../types';

const issueTypeLabels: Record<IssueType, string> = {
  calibration_expired: '校准过期',
  weight_jump: '重量跳变',
  duplicate_frame: '重复帧',
  midnight_batch_misalignment: '跨午夜批次错位',
  bad_frame: '坏帧',
  weight_out_of_tolerance: '重量超差',
  unstable_reading: '不稳定读数',
  missing_data: '数据缺失',
};

const severityLabels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

export function generateWeighingReport(result: AnalysisResult): string {
  const { summary, issues, weighingEvents, stationStates } = result;
  
  const sections: string[] = [];
  
  sections.push(generateHeader(summary));
  sections.push(generateSummarySection(summary));
  sections.push(generateIssuesSection(issues));
  sections.push(generateWeighingEventsSection(weighingEvents));
  sections.push(generateStationsSection(stationStates, summary.stationsAnalyzed));
  sections.push(generateFooter());
  
  return sections.join('\n\n---\n\n');
}

function generateHeader(summary: AnalysisResult['summary']): string {
  return `# 称重日志分析报告

**生成时间**: ${summary.analysisTime.toLocaleString('zh-CN')}

**分析结果概览**:
- 总帧数: ${summary.totalFrames}
- 有效帧: ${summary.validFrames}
- 无效帧: ${summary.invalidFrames}
- 重复帧: ${summary.duplicateFrames}
- 称重事件: ${summary.weighingEvents}
- 问题总数: ${summary.totalIssues}`;
}

function generateSummarySection(summary: AnalysisResult['summary']): string {
  const issuesByType = Object.entries(summary.issuesByType)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `| ${issueTypeLabels[type as IssueType] || type} | ${count} |`)
    .join('\n');

  return `## 问题统计

| 问题类型 | 数量 |
|----------|------|
${issuesByType || '| (无问题) | 0 |'}

## 分析工位

${summary.stationsAnalyzed.map(s => `- ${s}`).join('\n')}`;
}

function generateIssuesSection(issues: Issue[]): string {
  if (issues.length === 0) {
    return `## 问题详情

未发现任何问题。`;
  }

  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const highIssues = issues.filter(i => i.severity === 'high');
  const mediumIssues = issues.filter(i => i.severity === 'medium');
  const lowIssues = issues.filter(i => i.severity === 'low');

  const sections: string[] = ['## 问题详情'];

  if (criticalIssues.length > 0) {
    sections.push(`\n### 严重问题 (${criticalIssues.length})`);
    sections.push(issuesToMarkdownList(criticalIssues));
  }

  if (highIssues.length > 0) {
    sections.push(`\n### 高优先级问题 (${highIssues.length})`);
    sections.push(issuesToMarkdownList(highIssues));
  }

  if (mediumIssues.length > 0) {
    sections.push(`\n### 中优先级问题 (${mediumIssues.length})`);
    sections.push(issuesToMarkdownList(mediumIssues));
  }

  if (lowIssues.length > 0) {
    sections.push(`\n### 低优先级问题 (${lowIssues.length})`);
    sections.push(issuesToMarkdownList(lowIssues));
  }

  return sections.join('\n');
}

function issuesToMarkdownList(issues: Issue[]): string {
  return issues
    .map((issue) => {
      const details = Object.entries(issue.details)
        .filter(([k]) => !k.includes('rawLine') && !k.includes('lineIndex'))
        .map(([key, value]) => {
          if (value instanceof Date) {
            return `  - ${key}: ${value.toLocaleString('zh-CN')}`;
          }
          return `  - ${key}: ${value}`;
        })
        .join('\n');

      return [
        `**${issueTypeLabels[issue.type] || issue.type}**`,
        `  - 时间: ${issue.timestamp.toLocaleString('zh-CN')}`,
        `  - 工位: ${issue.stationId}`,
        `  - 描述: ${issue.description}`,
        details ? `  - 详情:\n${details}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .map((s) => `1. ${s}`)
    .join('\n\n');
}

function generateWeighingEventsSection(events: WeighingEvent[]): string {
  if (events.length === 0) {
    return `## 称重事件

未检测到有效的称重事件。`;
  }

  const eventsByStation = events.reduce((acc, event) => {
    if (!acc[event.stationId]) {
      acc[event.stationId] = [];
    }
    acc[event.stationId].push(event);
    return acc;
  }, {} as Record<string, WeighingEvent[]>);

  const sections: string[] = ['## 称重事件详情'];

  for (const [stationId, stationEvents] of Object.entries(eventsByStation)) {
    sections.push(`\n### 工位 ${stationId}`);
    
    const tableRows = stationEvents
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .map((event) => {
        const durationMs = event.endTime.getTime() - event.startTime.getTime();
        const durationSec = (durationMs / 1000).toFixed(2);
        
        return [
          `| ${event.startTime.toLocaleString('zh-CN')}`,
          `${event.batchId || '(无批次)'}`,
          `${event.stableWeight} ${event.unit}`,
          `${event.netWeight} ${event.unit}`,
          `${durationSec}s`,
          `${event.frames.length}`,
          '|',
        ].join(' | ');
      })
      .join('\n');

    sections.push(`
| 开始时间 | 批次ID | 毛重 | 净重 | 耗时 | 帧数 |
|----------|--------|------|------|------|------|
${tableRows}`);
  }

  return sections.join('\n');
}

function generateStationsSection(
  stationStates: AnalysisResult['stationStates'],
  stations: string[]
): string {
  const sections: string[] = ['## 工位状态'];

  for (const stationId of stations) {
    const state = stationStates[stationId];
    if (!state) continue;

    sections.push(`\n### 工位 ${stationId}`);
    sections.push(`- 单位: ${state.unit}`);
    sections.push(`- 皮重: ${state.tare} ${state.unit}`);
    sections.push(`- 总帧数: ${state.frames.length}`);
    sections.push(`- 最后稳定时间: ${state.lastStableTime ? state.lastStableTime.toLocaleString('zh-CN') : '无'}`);
    sections.push(`- 最后稳定重量: ${state.stableWeight !== null ? `${state.stableWeight} ${state.unit}` : '无'}`);
  }

  return sections.join('\n');
}

function generateFooter(): string {
  return `## 说明

本报告由称重日志分析工具自动生成。

### 问题类型说明

- **校准过期**: 设备校准证书已过期，需要重新校准
- **重量跳变**: 称重值发生异常大幅波动
- **重复帧**: 检测到相同内容的重复数据帧
- **跨午夜批次错位**: 称重事件跨越午夜，可能存在批次归属错误
- **坏帧**: 数据帧格式错误，无法解析
- **重量超差**: 称重结果超出批次公差范围
- **不稳定读数**: 连续不稳定读数
- **数据缺失**: 缺少必要的配置或数据`;
}
