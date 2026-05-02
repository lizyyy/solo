import { 
  Session, 
  Source, 
  CalibrationResult, 
  Problem, 
  Event,
  SyncIssue
} from './types';
import { 
  getSourceTypeLabel, 
  getEventTypeLabel, 
  getProblemTypeLabel, 
  getSeverityLabel,
  getConfidenceLabel
} from './models';
import { downloadFile } from './storage';
import { getSourceDelayInfo, calculateTimelineBounds } from './timeline';

export function generateMarkdownReport(
  session: Session,
  options: {
    includeSources?: boolean;
    includeEvents?: boolean;
    includeResults?: boolean;
    includeProblems?: boolean;
    includeSyncIssues?: boolean;
  } = {}
): string {
  const {
    includeSources = true,
    includeEvents = true,
    includeResults = true,
    includeProblems = true,
    includeSyncIssues = true
  } = options;

  const lines: string[] = [];

  lines.push(`# 多路音视频延迟校准报告`);
  lines.push('');
  lines.push(`> 会话名称: ${session.name}`);
  lines.push(`> 会话ID: ${session.id}`);
  lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`> 时间戳单位: ${session.timestampUnit === 'ms' ? '毫秒' : '秒'}`);
  lines.push('');

  lines.push('## 统计概览');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 源数量 | ${session.sources.length} |`);
  lines.push(`| 事件数量 | ${session.events.length} |`);
  lines.push(`| 校准结果数量 | ${session.calibrationResults.length} |`);
  lines.push(`| 问题数量 | ${session.problems.length} |`);
  lines.push(`| 同步问题数量 | ${session.syncIssues.length} |`);
  lines.push('');

  const bounds = calculateTimelineBounds(session.events);
  if (bounds.duration > 0) {
    lines.push('## 时间线范围');
    lines.push('');
    lines.push(`- 开始时间: ${bounds.startTime.toFixed(2)} ms`);
    lines.push(`- 结束时间: ${bounds.endTime.toFixed(2)} ms`);
    lines.push(`- 总时长: ${(bounds.duration / 1000).toFixed(3)} 秒`);
    lines.push('');
  }

  if (includeSources && session.sources.length > 0) {
    lines.push('## 源清单');
    lines.push('');
    lines.push('| 名称 | 类型 | 采样率 | 帧率 | 延迟偏移 | 参与混音 | 颜色 |');
    lines.push('|------|------|--------|------|----------|----------|------|');

    for (const source of session.sources) {
      const isMaster = source.id === session.masterClockSourceId;
      const name = isMaster ? `${source.name} (主时钟)` : source.name;
      lines.push(`| ${name} | ${getSourceTypeLabel(source.type)} | ${source.sampleRate || '-'} | ${source.frameRate || '-'} | ${source.delayOffset.toFixed(2)} ms | ${source.isInMix ? '是' : '否'} | <span style="color:${source.color}">■</span> |`);
    }
    lines.push('');
  }

  if (includeResults && session.calibrationResults.length > 0) {
    lines.push('## 校准结果');
    lines.push('');
    lines.push('| 源 | 延迟偏移 | 置信度 | 置信度等级 | 证据数量 | 手动覆盖 |');
    lines.push('|------|----------|--------|------------|----------|----------|');

    for (const result of session.calibrationResults) {
      const source = session.sources.find(s => s.id === result.sourceId);
      const sourceName = source?.name || result.sourceId;
      const delayInfo = getSourceDelayInfo(result.sourceId, session.calibrationResults);

      lines.push(`| ${sourceName} | ${delayInfo.readable} | ${(result.confidence * 100).toFixed(1)}% | ${getConfidenceLabel(result.confidenceLevel)} | ${result.evidence.length} | ${result.isManualOverride ? '是' : '否'} |`);
    }
    lines.push('');

    for (const result of session.calibrationResults) {
      if (result.evidence.length > 0) {
        const source = session.sources.find(s => s.id === result.sourceId);
        const sourceName = source?.name || result.sourceId;

        lines.push(`### ${sourceName} 的校准证据`);
        lines.push('');
        lines.push('| 证据类型 | 源时间戳 | 参考时间戳 | 偏差 | 置信度 |');
        lines.push('|----------|----------|------------|------|--------|');

        for (const ev of result.evidence) {
          lines.push(`| ${getEventTypeLabel(ev.type)} | ${ev.sourceTimestamp.toFixed(2)} ms | ${ev.referenceTimestamp.toFixed(2)} ms | ${ev.delta > 0 ? '+' : ''}${ev.delta.toFixed(2)} ms | ${(ev.confidence * 100).toFixed(1)}% |`);
        }
        lines.push('');
      }
    }
  }

  if (includeProblems && session.problems.length > 0) {
    lines.push('## 问题列表');
    lines.push('');

    const unresolvedProblems = session.problems.filter(p => !p.resolved);
    const resolvedProblems = session.problems.filter(p => p.resolved);

    if (unresolvedProblems.length > 0) {
      lines.push('### 未解决的问题');
      lines.push('');
      lines.push('| 类型 | 严重程度 | 源 | 消息 | 建议 |');
      lines.push('|------|----------|-----|------|------|');

      for (const problem of unresolvedProblems) {
        const source = problem.sourceId ? session.sources.find(s => s.id === problem.sourceId) : null;
        const sourceName = source?.name || '-';
        lines.push(`| ${getProblemTypeLabel(problem.type)} | ${getSeverityLabel(problem.severity)} | ${sourceName} | ${problem.message} | ${problem.suggestion} |`);
      }
      lines.push('');
    }

    if (resolvedProblems.length > 0) {
      lines.push('### 已解决的问题');
      lines.push('');
      lines.push('| 类型 | 严重程度 | 源 | 消息 |');
      lines.push('|------|----------|-----|------|');

      for (const problem of resolvedProblems) {
        const source = problem.sourceId ? session.sources.find(s => s.id === problem.sourceId) : null;
        const sourceName = source?.name || '-';
        lines.push(`| ${getProblemTypeLabel(problem.type)} | ${getSeverityLabel(problem.severity)} | ${sourceName} | ${problem.message} |`);
      }
      lines.push('');
    }
  }

  if (includeSyncIssues && session.syncIssues.length > 0) {
    lines.push('## 同步问题');
    lines.push('');
    lines.push('| 时间范围 | 涉及源 | 最大偏差 | 描述 |');
    lines.push('|----------|--------|----------|------|');

    for (const issue of session.syncIssues) {
      const sourceNames = issue.sources.map(id => {
        const source = session.sources.find(s => s.id === id);
        return source?.name || id;
      }).join(', ');
      lines.push(`| ${issue.timeRange[0].toFixed(0)}ms - ${issue.timeRange[1].toFixed(0)}ms | ${sourceNames} | ${issue.maxDeviation.toFixed(1)}ms | ${issue.description} |`);
    }
    lines.push('');
  }

  if (includeEvents && session.events.length > 0) {
    lines.push('## 事件清单');
    lines.push('');
    lines.push('> 显示最近 50 个事件');
    lines.push('');
    lines.push('| 时间戳 | 源 | 类型 | 描述 | 置信度 |');
    lines.push('|--------|-----|------|------|--------|');

    const recentEvents = [...session.events]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-50);

    for (const event of recentEvents) {
      const source = session.sources.find(s => s.id === event.sourceId);
      const sourceName = source?.name || event.sourceId;
      const description = event.description || '-';
      lines.push(`| ${event.timestamp.toFixed(2)} ms | ${sourceName} | ${getEventTypeLabel(event.type)} | ${description} | ${(event.confidence * 100).toFixed(1)}% |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`*报告由多路音视频延迟校准台生成 | 版本 ${session.version}*`);

  return lines.join('\n');
}

export function generateDelayOffsetCSV(
  session: Session
): string {
  const lines: string[] = [];

  lines.push('source_id,source_name,source_type,delay_offset_ms,confidence,confidence_level,is_manual_override,is_master_clock,evidence_count');

  for (const result of session.calibrationResults) {
    const source = session.sources.find(s => s.id === result.sourceId);
    const sourceName = source?.name || '';
    const sourceType = source?.type || '';
    const isMaster = result.sourceId === session.masterClockSourceId;

    lines.push([
      result.sourceId,
      `"${sourceName}"`,
      sourceType,
      result.delayOffset.toFixed(3),
      result.confidence.toFixed(4),
      result.confidenceLevel,
      result.isManualOverride ? 'true' : 'false',
      isMaster ? 'true' : 'false',
      result.evidence.length
    ].join(','));
  }

  return lines.join('\n');
}

export function generateEventsCSV(
  session: Session
): string {
  const lines: string[] = [];

  lines.push('event_id,source_id,source_name,event_type,timestamp_ms,value,rtp_timestamp,description,confidence');

  const sortedEvents = [...session.events].sort((a, b) => a.timestamp - b.timestamp);

  for (const event of sortedEvents) {
    const source = session.sources.find(s => s.id === event.sourceId);
    const sourceName = source?.name || '';

    lines.push([
      event.id,
      event.sourceId,
      `"${sourceName}"`,
      event.type,
      event.timestamp.toFixed(3),
      event.value !== undefined ? event.value.toFixed(3) : '',
      event.rtpTimestamp !== undefined ? event.rtpTimestamp.toString() : '',
      `"${event.description || ''}"`,
      event.confidence.toFixed(4)
    ].join(','));
  }

  return lines.join('\n');
}

export function downloadMarkdownReport(session: Session): void {
  const content = generateMarkdownReport(session);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `calibration-report-${timestamp}.md`;
  downloadFile(content, filename, 'text/markdown');
}

export function downloadDelayOffsetCSV(session: Session): void {
  const content = generateDelayOffsetCSV(session);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `delay-offsets-${timestamp}.csv`;
  downloadFile(content, filename, 'text/csv');
}

export function downloadEventsCSV(session: Session): void {
  const content = generateEventsCSV(session);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `events-${timestamp}.csv`;
  downloadFile(content, filename, 'text/csv');
}
