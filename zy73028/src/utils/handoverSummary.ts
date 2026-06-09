type RecordStatus = 'pending' | 'confirmed' | 'anomaly';

type AnomalyType =
  | 'weight_unit_mixed'
  | 'duplicate_pet'
  | 'temp_out_of_range'
  | 'missing_data'
  | 'wechat_note_flag';

interface JudgmentRecord {
  id: string;
  operator: string;
  originalAnomaly: AnomalyType;
  newStatus: RecordStatus;
  reason: string;
  timestamp: string;
}

interface SupplementaryNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

interface TempControlRecord {
  id: string;
  status: RecordStatus;
  anomalyType: AnomalyType[];
  mergeGroupId?: string;
  judgments?: JudgmentRecord[];
  supplementaryNotes?: SupplementaryNote[];
}

interface MergeGroup {
  id: string;
  confirmed: boolean;
  mergedRecordIds: string[];
}

export interface HandoverStats {
  total: number;
  confirmed: number;
  pending: number;
  anomaly: number;
  weightUnitMixed: number;
  duplicateGroups: number;
  tempOutOfRange: number;
  missingSupplementary: number;
}

export interface HandoverContext {
  records: TempControlRecord[];
  mergeGroups: MergeGroup[];
  lastOperator?: string;
  lastSavedAt?: string;
  lastAction?: string;
  currentTime?: string;
}

export function computeHandoverStats(ctx: HandoverContext): HandoverStats {
  const { records, mergeGroups } = ctx;

  const total = records.length;
  const confirmed = records.filter((r) => r.status === 'confirmed').length;
  const pending = records.filter((r) => r.status === 'pending').length;
  const anomaly = records.filter((r) => r.status === 'anomaly').length;

  const weightUnitMixed = records.filter(
    (r) => r.anomalyType.includes('weight_unit_mixed') && r.status !== 'confirmed'
  ).length;

  const duplicateGroups = mergeGroups.filter((g) => !g.confirmed).length;

  const tempOutOfRange = records.filter(
    (r) => r.anomalyType.includes('temp_out_of_range') && r.status !== 'confirmed'
  ).length;

  const missingSupplementary = records.filter((r) => {
    const hasAnomaly = r.anomalyType.length > 0;
    const hasNotes =
      r.supplementaryNotes && r.supplementaryNotes.length > 0;
    const hasJudgments =
      r.judgments && r.judgments.length > 0;
    return hasAnomaly && !hasNotes && !hasJudgments && r.status !== 'confirmed';
  }).length;

  return {
    total,
    confirmed,
    pending,
    anomaly,
    weightUnitMixed,
    duplicateGroups,
    tempOutOfRange,
    missingSupplementary,
  };
}

function formatTime(timeStr?: string): string {
  if (!timeStr) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  return timeStr;
}

export function generateHandoverSummary(ctx: HandoverContext): string {
  const stats = computeHandoverStats(ctx);
  const currentTimeStr = formatTime(ctx.currentTime);
  const confirmRate =
    stats.total > 0
      ? Math.round((stats.confirmed / stats.total) * 100)
      : 0;
  const gap = stats.total - stats.confirmed;

  const lines: string[] = [];

  lines.push(
    `截至${currentTimeStr}，共${stats.total}条记录，已确认${stats.confirmed}条（${confirmRate}%），待处理缺口${gap}条：`
  );

  const details: string[] = [];

  if (stats.weightUnitMixed > 0) {
    details.push(`• 体重单位异常待确认：${stats.weightUnitMixed}条`);
  }

  if (stats.duplicateGroups > 0) {
    details.push(`• 疑似重名待合并：${stats.duplicateGroups}组`);
  }

  if (stats.tempOutOfRange > 0) {
    details.push(`• 温度异常待改判：${stats.tempOutOfRange}条`);
  }

  if (stats.missingSupplementary > 0) {
    details.push(`• 后补说明未填：${stats.missingSupplementary}条`);
  }

  if (details.length === 0) {
    details.push('• 当前无待处理异常，全部已确认完成。');
  }

  lines.push(...details);

  if (ctx.lastOperator || ctx.lastSavedAt || ctx.lastAction) {
    const op = ctx.lastOperator || '未知操作员';
    const tm = formatTime(ctx.lastSavedAt);
    const act = ctx.lastAction || '数据持久化操作';
    lines.push(`上次操作：${op} 于 ${tm} 执行${act}。`);
  }

  return lines.join('\n');
}

export interface HandoverDetailItem {
  category: string;
  count: number;
  description: string;
}

export function getHandoverDetailItems(ctx: HandoverContext): HandoverDetailItem[] {
  const stats = computeHandoverStats(ctx);
  const items: HandoverDetailItem[] = [];

  if (stats.weightUnitMixed > 0) {
    items.push({
      category: '体重单位异常',
      count: stats.weightUnitMixed,
      description: '非标准kg单位（斤/g/lb），需确认录入是否准确',
    });
  }

  if (stats.duplicateGroups > 0) {
    items.push({
      category: '疑似同宠异名',
      count: stats.duplicateGroups,
      description: '同主人+同品种+名字近似，需合并确认别名',
    });
  }

  if (stats.tempOutOfRange > 0) {
    items.push({
      category: '温度异常',
      count: stats.tempOutOfRange,
      description: '温度超出品种正常范围，需人工改判',
    });
  }

  if (stats.missingSupplementary > 0) {
    items.push({
      category: '后补说明缺失',
      count: stats.missingSupplementary,
      description: '异常记录缺少后补说明或改判原因',
    });
  }

  return items;
}

export function generateMarkdownHandover(ctx: HandoverContext): string {
  const stats = computeHandoverStats(ctx);
  const currentTimeStr = formatTime(ctx.currentTime);
  const confirmRate =
    stats.total > 0
      ? Math.round((stats.confirmed / stats.total) * 100)
      : 0;
  const gap = stats.total - stats.confirmed;

  const md: string[] = [];

  md.push(`# 异宠温控交接报告`);
  md.push('');
  md.push(`**生成时间**：${currentTimeStr}`);
  md.push('');
  md.push('## 总览');
  md.push('');
  md.push(`| 指标 | 数值 |`);
  md.push(`|------|------|`);
  md.push(`| 记录总数 | ${stats.total} |`);
  md.push(`| 已确认 | ${stats.confirmed}（${confirmRate}%） |`);
  md.push(`| 待处理 | ${stats.pending} |`);
  md.push(`| 异常 | ${stats.anomaly} |`);
  md.push(`| 缺口 | ${gap} |`);
  md.push('');

  const items = getHandoverDetailItems(ctx);
  md.push('## 待处理明细');
  md.push('');
  if (items.length > 0) {
    md.push('| 类别 | 数量 | 说明 |');
    md.push('|------|------|------|');
    for (const it of items) {
      md.push(`| ${it.category} | ${it.count} | ${it.description} |`);
    }
  } else {
    md.push('> 当前无待处理异常，全部已确认完成。');
  }
  md.push('');

  if (ctx.lastOperator || ctx.lastSavedAt || ctx.lastAction) {
    md.push('## 上次操作');
    md.push('');
    md.push(`- **操作员**：${ctx.lastOperator || '未知'}`);
    md.push(`- **操作时间**：${formatTime(ctx.lastSavedAt)}`);
    md.push(`- **操作内容**：${ctx.lastAction || '数据持久化'}`);
    md.push('');
  }

  return md.join('\n');
}
