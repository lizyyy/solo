import type { Operation, GameRound, Conflict, ScoreNote } from '@/types/game';
import type { TimelineEvent } from '@/types/audit';
import type { AuditLogEntry, HandoverReport, ConflictEvidence, EvidenceItem } from '@/types/audit';
import { generateId, getCurrentTimestamp, formatTimestamp, getOperatorName } from './storage';

export const createAuditLog = (
  action: string,
  targetType: string,
  targetId: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
  note?: string
): AuditLogEntry => {
  return {
    id: generateId(),
    timestamp: getCurrentTimestamp(),
    operator: getOperatorName(),
    action,
    targetType,
    targetId,
    before,
    after,
    note,
    source: '黑胶节拍修复赛-审计系统',
  };
};

export const buildTimeline = (
  round: GameRound,
  operations: Operation[],
  notes: ScoreNote[],
  conflicts: Conflict[]
): TimelineEvent[] => {
  const events: TimelineEvent[] = [];

  events.push({
    id: `start-${round.id}`,
    timestamp: round.startTime,
    type: 'status_change',
    title: '比赛开始',
    description: `关卡：${round.levelName}，玩家：${round.playerName}`,
    operator: round.operator,
    source: round.source,
  });

  if (round.pausedAt) {
    events.push({
      id: `pause-${round.id}`,
      timestamp: round.pausedAt,
      type: 'status_change',
      title: '比赛暂停',
      description: '比赛中途暂停',
      operator: round.operator,
      source: round.source,
    });
  }

  if (round.resumedAt) {
    events.push({
      id: `resume-${round.id}`,
      timestamp: round.resumedAt,
      type: 'status_change',
      title: '比赛恢复',
      description: '暂停后继续比赛',
      operator: round.operator,
      source: round.source,
    });
  }

  operations.forEach(op => {
    const typeLabel = op.type === 'drag' ? '拖拽' : '点击';
    const deltaParts: string[] = [];
    if (op.resourceDelta !== 0) {
      deltaParts.push(`资源${op.resourceDelta > 0 ? '+' : ''}${op.resourceDelta}`);
    }
    if (op.scoreDelta !== 0) {
      deltaParts.push(`分数${op.scoreDelta > 0 ? '+' : ''}${op.scoreDelta}`);
    }
    if (op.riskDelta !== 0) {
      deltaParts.push(`风险${op.riskDelta > 0 ? '+' : ''}${op.riskDelta}`);
    }

    events.push({
      id: op.id,
      timestamp: op.timestamp,
      type: 'operation',
      title: `${typeLabel}操作：${op.elementLabel}`,
      description: deltaParts.join('，') + (op.note ? ` | 备注：${op.note}` : ''),
      operator: op.operator,
      source: op.source,
      metadata: {
        resourceDelta: op.resourceDelta,
        scoreDelta: op.scoreDelta,
        riskDelta: op.riskDelta,
        resourcesAfter: op.resourcesAfter,
        scoreAfter: op.scoreAfter,
        riskAfter: op.riskAfter,
        isJudgementCall: op.isJudgementCall,
        judgementReason: op.judgementReason,
      },
    });
  });

  notes.forEach(note => {
    events.push({
      id: note.id,
      timestamp: note.timestamp,
      type: 'note',
      title: '备注记录',
      description: note.content,
      operator: note.author,
      source: note.source,
    });
  });

  conflicts.forEach(conflict => {
    events.push({
      id: conflict.id,
      timestamp: conflict.resolvedAt || conflict.importedData.timestamp,
      type: conflict.status === 'resolved' ? 'judgement' : 'conflict',
      title: conflict.status === 'resolved' ? '冲突已裁决' : '数据冲突待处理',
      description: `字段：${conflict.field}，${conflict.suggestedAction}`,
      operator: conflict.resolvedBy || '系统',
      source: '冲突检测',
      metadata: {
        classroomValue: conflict.classroomData.value,
        importedValue: conflict.importedData.value,
        resolution: conflict.resolution,
      },
    });
  });

  if (round.endTime) {
    events.push({
      id: `end-${round.id}`,
      timestamp: round.endTime,
      type: 'status_change',
      title: '比赛结束',
      description: `最终分数：${round.finalScore}，资源：${round.finalResources}，风险：${round.finalRisk}`,
      operator: round.operator,
      source: round.source,
    });
  }

  return events.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

export const generateConflictEvidence = (conflict: Conflict): ConflictEvidence => {
  const classroom: EvidenceItem = {
    label: '课堂计分表',
    value: conflict.classroomData.value,
    source: conflict.classroomData.source,
    timestamp: conflict.classroomData.timestamp,
    note: conflict.classroomData.note,
  };

  const imported: EvidenceItem = {
    label: '导入数据',
    value: conflict.importedData.value,
    source: conflict.importedData.source,
    timestamp: conflict.importedData.timestamp,
    note: conflict.importedData.note,
  };

  return {
    conflictId: conflict.id,
    field: conflict.field,
    classroom,
    imported,
    suggestedAction: conflict.suggestedAction,
    suggestedReason: conflict.suggestedReason,
  };
};

export const generateHandoverReport = (
  round: GameRound,
  operations: Operation[],
  notes: ScoreNote[],
  conflicts: Conflict[]
): HandoverReport => {
  const timeline = buildTimeline(round, operations, notes, conflicts);
  const resolvedConflicts = conflicts.filter(c => c.status === 'resolved');
  const pendingConflicts = conflicts.filter(c => c.status === 'pending');

  const recommendations: string[] = [];
  
  if (round.finalResources < 0) {
    recommendations.push('本局资源出现负数，建议核查每一步资源消耗操作是否合理');
  }
  
  if (round.finalRisk >= round.initialResources * 0.8) {
    recommendations.push('本局风险值较高，建议复核高风险操作的判罚依据');
  }
  
  if (pendingConflicts.length > 0) {
    recommendations.push(`有 ${pendingConflicts.length} 条数据冲突待处理，请及时裁决`);
  }
  
  if (operations.some(op => op.isJudgementCall)) {
    recommendations.push('本局包含人工裁决操作，交接时需特别说明判罚理由');
  }

  if (recommendations.length === 0) {
    recommendations.push('本局数据完整，无特殊异常，可正常交接');
  }

  const summaryParts: string[] = [];
  summaryParts.push(`玩家"${round.playerName}"在"${round.levelName}"关卡的比赛`);
  summaryParts.push(`最终分数 ${round.finalScore}（目标 ${round.targetScore}）`);
  summaryParts.push(`最终资源 ${round.finalResources}，风险值 ${round.finalRisk}`);
  if (conflicts.length > 0) {
    summaryParts.push(`存在 ${conflicts.length} 处数据冲突（已解决 ${resolvedConflicts.length}，待处理 ${pendingConflicts.length}）`);
  }

  return {
    generatedAt: getCurrentTimestamp(),
    generatedBy: getOperatorName(),
    roundId: round.id,
    playerName: round.playerName,
    levelName: round.levelName,
    startTime: round.startTime,
    endTime: round.endTime,
    finalScore: round.finalScore,
    finalResources: round.finalResources,
    finalRisk: round.finalRisk,
    timeline,
    conflicts: {
      total: conflicts.length,
      resolved: resolvedConflicts.length,
      pending: pendingConflicts.length,
      details: conflicts.map(c => ({
        id: c.id,
        field: c.field,
        classroomValue: c.classroomData.value,
        importedValue: c.importedData.value,
        resolution: c.resolution,
        resolvedBy: c.resolvedBy,
      })),
    },
    notes: notes.map(n => ({
      content: n.content,
      author: n.author,
      timestamp: n.timestamp,
      source: n.source,
    })),
    summary: summaryParts.join('。'),
    recommendations,
  };
};

export const formatReportAsMarkdown = (report: HandoverReport): string => {
  const lines: string[] = [];

  lines.push('# 黑胶节拍修复赛 - 交接报告');
  lines.push('');
  lines.push(`> 生成时间：${formatTimestamp(report.generatedAt)}`);
  lines.push(`> 生成人：${report.generatedBy}`);
  lines.push('');
  lines.push('## 比赛概况');
  lines.push('');
  lines.push(`| 项目 | 内容 |`);
  lines.push(`|------|------|`);
  lines.push(`| 玩家 | ${report.playerName} |`);
  lines.push(`| 关卡 | ${report.levelName} |`);
  lines.push(`| 开始时间 | ${formatTimestamp(report.startTime)} |`);
  lines.push(`| 结束时间 | ${report.endTime ? formatTimestamp(report.endTime) : '进行中'} |`);
  lines.push(`| 最终分数 | ${report.finalScore} |`);
  lines.push(`| 最终资源 | ${report.finalResources} |`);
  lines.push(`| 最终风险 | ${report.finalRisk} |`);
  lines.push('');
  lines.push('## 本局总结');
  lines.push('');
  lines.push(report.summary);
  lines.push('');
  lines.push('## 操作时间线');
  lines.push('');
  
  report.timeline.forEach(event => {
    const icon = {
      operation: '🔘',
      note: '📝',
      conflict: '⚠️',
      status_change: '🔄',
      judgement: '⚖️',
    }[event.type];
    
    lines.push(`### ${icon} ${formatTimestamp(event.timestamp)} - ${event.title}`);
    lines.push('');
    lines.push(`- **操作人**：${event.operator}`);
    lines.push(`- **来源**：${event.source}`);
    lines.push(`- **描述**：${event.description}`);
    if (event.metadata) {
      lines.push(`- **详情**：\`${JSON.stringify(event.metadata, null, 2)}\``);
    }
    lines.push('');
  });

  if (report.conflicts.total > 0) {
    lines.push('## 数据冲突');
    lines.push('');
    lines.push(`总计 ${report.conflicts.total} 条，已解决 ${report.conflicts.resolved} 条，待处理 ${report.conflicts.pending} 条`);
    lines.push('');
    lines.push(`| 字段 | 课堂计分表 | 导入数据 | 裁决结果 | 裁决人 |`);
    lines.push(`|------|------------|----------|----------|--------|`);
    report.conflicts.details.forEach(d => {
      lines.push(`| ${d.field} | ${d.classroomValue} | ${d.importedValue} | ${d.resolution} | ${d.resolvedBy || '-'} |`);
    });
    lines.push('');
  }

  if (report.notes.length > 0) {
    lines.push('## 备注记录');
    lines.push('');
    report.notes.forEach(n => {
      lines.push(`> ${n.content}`);
      lines.push(`>`);
      lines.push(`> — ${n.author}（${n.source}），${formatTimestamp(n.timestamp)}`);
      lines.push('');
    });
  }

  lines.push('## 交接建议');
  lines.push('');
  report.recommendations.forEach((rec, i) => {
    lines.push(`${i + 1}. ${rec}`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('_本报告由黑胶节拍修复赛计分系统自动生成_');

  return lines.join('\n');
};
