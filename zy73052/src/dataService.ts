import type {
  InspectionRecord,
  AnomalyInfo,
  Conclusion,
  Filters,
  ResultBundle,
  AnomalyType,
} from './types';

const CRANES = [
  { id: 'TC-001', name: '1号塔吊（北塔）' },
  { id: 'TC-002', name: '2号塔吊（南塔）' },
  { id: 'TC-003', name: '3号塔吊（东塔）' },
  { id: 'TC-004', name: '4号塔吊（西塔）' },
];

const PART_DEFS: Array<{
  name: string;
  category: InspectionRecord['partCategory'];
  min: number;
  max: number;
  unit: string;
  baseline: number;
}> = [
  { name: '主钢丝绳磨损量', category: '钢丝绳', min: 0, max: 8, unit: '%', baseline: 3 },
  { name: '制动蹄片厚度', category: '制动器', min: 5, max: 20, unit: 'mm', baseline: 12 },
  { name: '减速器油温', category: '减速器', min: 20, max: 85, unit: '℃', baseline: 55 },
  { name: '力矩限位器偏差', category: '限位器', min: -5, max: 5, unit: '%', baseline: 0.5 },
  { name: '滑轮槽底磨损', category: '滑轮', min: 0, max: 3, unit: 'mm', baseline: 0.8 },
  { name: '控制回路绝缘', category: '电气', min: 1, max: 100, unit: 'MΩ', baseline: 12 },
];

const INSPECTORS = ['王建国', '李铁柱', '张工', '赵班长', '小宋'];

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function buildStatus(
  v: number | null,
  min: number,
  max: number,
): InspectionRecord['status'] {
  if (v === null) return 'missing';
  const range = max - min;
  if (v < min || v > max) return 'critical';
  if (v < min + range * 0.15 || v > max - range * 0.15) return 'warning';
  return 'normal';
}

export function buildBatchSignature(filters: Filters): string {
  return [
    filters.dateFrom,
    filters.dateTo,
    [...filters.craneIds].sort().join('|'),
    [...filters.categories].sort().join('|'),
    [...filters.statuses].sort().join('|'),
    filters.onlyAnomaly ? 'T' : 'F',
  ].join('::');
}

export function generateInspectionData(filters: Filters): InspectionRecord[] {
  const sig = buildBatchSignature(filters);
  let seed = 0;
  for (let i = 0; i < sig.length; i++) seed = (seed * 31 + sig.charCodeAt(i)) >>> 0;
  const rand = seededRandom(seed || 1);

  const records: InspectionRecord[] = [];
  const start = new Date(filters.dateFrom);
  const end = new Date(filters.dateTo);
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  const sampleDays = Math.min(days, 6);
  const step = Math.max(1, Math.floor(days / sampleDays));

  const activeCranes = filters.craneIds.length
    ? CRANES.filter((c) => filters.craneIds.includes(c.id))
    : CRANES;
  const activeCats = filters.categories.length
    ? filters.categories
    : PART_DEFS.map((p) => p.category);
  const activeParts = PART_DEFS.filter((p) => activeCats.includes(p.category));

  for (let di = 0; di < sampleDays; di++) {
    const d = new Date(start);
    d.setDate(start.getDate() + di * step);
    const dateStr = formatDate(d);

    for (const crane of activeCranes) {
      for (const part of activeParts) {
        const rid = `${crane.id}-${dateStr}-${part.name}`;
        let value: number | null = null;
        const r = rand();

        if (crane.id === 'TC-002' && dateStr === '2026-06-05' && part.name === '主钢丝绳磨损量') {
          value = null;
        } else if (crane.id === 'TC-003' && dateStr === '2026-06-07' && part.name === '减速器油温') {
          value = 112;
        } else if (crane.id === 'TC-001' && dateStr === '2026-06-04' && part.name === '力矩限位器偏差') {
          value = 13.2;
        } else if (crane.id === 'TC-004' && dateStr === '2026-06-06' && part.name === '滑轮槽底磨损') {
          value = 2.7;
        } else if (r < 0.03) {
          value = null;
        } else {
          const noise = (rand() - 0.5) * (part.max - part.min) * 0.4;
          value = Math.round((part.baseline + noise) * 100) / 100;
        }

        const status = buildStatus(value, part.min, part.max);
        records.push({
          id: rid,
          craneId: crane.id,
          craneName: crane.name,
          date: dateStr,
          partName: part.name,
          partCategory: part.category,
          measuredValue: value,
          unit: part.unit,
          thresholdMin: part.min,
          thresholdMax: part.max,
          inspector: INSPECTORS[Math.floor(rand() * INSPECTORS.length)],
          status,
          batchId: '',
        });
      }
    }
  }
  return records;
}

export function detectAnomalies(records: InspectionRecord[]): AnomalyInfo[] {
  const anomalies: AnomalyInfo[] = [];
  const grouped = new Map<string, InspectionRecord[]>();
  for (const r of records) {
    const k = `${r.craneId}|${r.partName}`;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(r);
  }

  for (const r of records) {
    if (r.measuredValue === null) {
      anomalies.push({
        recordId: r.id,
        type: 'gap',
        description: `采样断档：${r.date} ${r.craneName} 的 ${r.partName} 未采集`,
        severity: 'high',
        evidence: ['巡检表字段为空', `现场巡检员：${r.inspector}`, '请补采或说明原因'],
      });
      continue;
    }
    if (r.status === 'critical') {
      anomalies.push({
        recordId: r.id,
        type: 'threshold',
        description: `阈值突破：${r.partName}=${r.measuredValue}${r.unit}，正常区间 [${r.thresholdMin}, ${r.thresholdMax}]`,
        severity: 'high',
        evidence: [
          `实测值 ${r.measuredValue}${r.unit}`,
          `阈值下限 ${r.thresholdMin}${r.unit}`,
          `阈值上限 ${r.thresholdMax}${r.unit}`,
          `超出 ${r.measuredValue < r.thresholdMin
            ? (r.thresholdMin - r.measuredValue).toFixed(2)
            : (r.measuredValue - r.thresholdMax).toFixed(2)
          }${r.unit}`,
        ],
      });
    }
  }

  for (const [, group] of grouped) {
    const valid = group.filter((g) => g.measuredValue !== null);
    if (valid.length < 3) continue;
    const values = valid.map((g) => g.measuredValue as number);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(
      values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length,
    );
    if (std === 0) continue;
    for (const r of valid) {
      const z = Math.abs((r.measuredValue! - avg) / std);
      if (z > 1.8 && r.status === 'normal') {
        anomalies.push({
          recordId: r.id,
          type: 'avg_masked',
          description: `被均值掩盖的离群：${r.partName}=${r.measuredValue}${r.unit}，z=${z.toFixed(2)}，均值=${avg.toFixed(2)}${r.unit}`,
          severity: 'medium',
          evidence: [
            `本批次均值 ${avg.toFixed(2)}${r.unit}`,
            `标准差 ${std.toFixed(2)}${r.unit}`,
            `Z 分数 ${z.toFixed(2)}`,
            '虽然在阈值内，但偏离同组均值，易被平均掩盖',
          ],
        });
      } else if (z > 2.0) {
        anomalies.push({
          recordId: r.id,
          type: 'outlier',
          description: `统计离群：${r.partName}=${r.measuredValue}${r.unit}，z=${z.toFixed(2)}`,
          severity: r.status === 'critical' ? 'high' : 'medium',
          evidence: [
            `本批次均值 ${avg.toFixed(2)}${r.unit}`,
            `Z 分数 ${z.toFixed(2)}`,
          ],
        });
      }
    }
  }

  const seen = new Set<string>();
  return anomalies.filter((a) => (seen.has(a.recordId + a.type) ? false : (seen.add(a.recordId + a.type), true)));
}

export function buildConclusions(
  records: InspectionRecord[],
  anomalies: AnomalyInfo[],
): Conclusion[] {
  const conclusions: Conclusion[] = [];
  const byCrane = new Map<string, InspectionRecord[]>();
  for (const r of records) byCrane.set(r.craneId, [...(byCrane.get(r.craneId) || []), r]);

  const anomalyByRec = new Map<string, AnomalyInfo[]>();
  for (const a of anomalies) {
    anomalyByRec.set(a.recordId, [...(anomalyByRec.get(a.recordId) || []), a]);
  }

  for (const [craneId, recs] of byCrane) {
    const name = recs[0].craneName;
    const criticalCount = recs.filter((r) => r.status === 'critical').length;
    const missingCount = recs.filter((r) => r.status === 'missing').length;
    const warningCount = recs.filter((r) => r.status === 'warning').length;
    const affected = recs
      .filter((r) => r.status !== 'normal')
      .map((r) => r.id);
    const anomalyIds = anomalies
      .filter((a) => recs.some((r) => r.id === a.recordId))
      .map((a) => a.recordId + '::' + a.type);

    if (criticalCount || missingCount) {
      conclusions.push({
        id: `CON-${craneId}-CRIT`,
        title: `${name} 需立即维保`,
        detail: `关键项超限 ${criticalCount} 项，采样断档 ${missingCount} 项，需立即调度备件并派工。预警 ${warningCount} 项纳入次周排程。`,
        affectedRecords: affected,
        createdAt: new Date().toISOString(),
        batchId: '',
        anomalyIds,
        deltaNote: criticalCount > 0
          ? `本次结论含 ${criticalCount} 个超限项，直接驱动排程优先级升级`
          : undefined,
      });
    } else if (warningCount) {
      conclusions.push({
        id: `CON-${craneId}-WARN`,
        title: `${name} 进入关注期`,
        detail: `预警项 ${warningCount} 项，建议纳入 7 天内排程，并在下轮巡检加密采样。`,
        affectedRecords: affected,
        createdAt: new Date().toISOString(),
        batchId: '',
        anomalyIds,
      });
    }
  }

  const gapAnoms = anomalies.filter((a) => a.type === 'gap');
  if (gapAnoms.length) {
    conclusions.push({
      id: 'CON-GAP',
      title: `存在 ${gapAnoms.length} 条采样断档`,
      detail: '断档记录未参与阈值判定和均值计算，请现场调度小宋复核补采，避免掩盖真实异常。',
      affectedRecords: gapAnoms.map((a) => a.recordId),
      createdAt: new Date().toISOString(),
      batchId: '',
      anomalyIds: gapAnoms.map((a) => a.recordId + '::' + a.type),
      deltaNote: `断档数量变化会直接影响统计均值，本次剔除了 ${gapAnoms.length} 条空值`,
    });
  }

  const maskedAnoms = anomalies.filter((a) => a.type === 'avg_masked');
  if (maskedAnoms.length) {
    conclusions.push({
      id: 'CON-MASKED',
      title: `${maskedAnoms.length} 条异常被均值掩盖`,
      detail: '这些记录虽在阈值内，但偏离同组均值，之前靠巡检表硬凑时容易被略过，需单独拎出二次确认。',
      affectedRecords: maskedAnoms.map((a) => a.recordId),
      createdAt: new Date().toISOString(),
      batchId: '',
      anomalyIds: maskedAnoms.map((a) => a.recordId + '::' + a.type),
      deltaNote: '本结论为新增维度，之前人工处理时不产出该类提示',
    });
  }

  if (!conclusions.length) {
    conclusions.push({
      id: 'CON-OK',
      title: '本批次全部正常',
      detail: '所有记录在阈值内且无断档，无需调整排程。',
      affectedRecords: [],
      createdAt: new Date().toISOString(),
      batchId: '',
      anomalyIds: [],
    });
  }
  return conclusions;
}

export function buildResultBundle(filters: Filters): ResultBundle {
  const batchId = 'B' + Date.now().toString(36).toUpperCase();
  const rawRecords = generateInspectionData(filters);
  const statusFiltered = filters.statuses.length
    ? rawRecords.filter((r) => filters.statuses.includes(r.status))
    : rawRecords;
  const anomaliesAll = detectAnomalies(rawRecords);
  const anomalyRecIds = new Set(anomaliesAll.map((a) => a.recordId));
  const records = (filters.onlyAnomaly
    ? statusFiltered.filter((r) => anomalyRecIds.has(r.id))
    : statusFiltered
  ).map((r) => ({ ...r, batchId }));

  const anomalies = anomaliesAll.filter((a) => records.some((r) => r.id === a.recordId));
  const conclusions = buildConclusions(records, anomalies).map((c) => ({ ...c, batchId }));

  const stats = {
    total: records.length,
    normal: records.filter((r) => r.status === 'normal').length,
    warning: records.filter((r) => r.status === 'warning').length,
    critical: records.filter((r) => r.status === 'critical').length,
    missing: records.filter((r) => r.status === 'missing').length,
    anomalyTotal: anomalies.length,
  };

  const summaryParts = [
    `本批次共 ${stats.total} 条巡检记录，`,
    `正常 ${stats.normal}、预警 ${stats.warning}、超限 ${stats.critical}、断档 ${stats.missing}。`,
    anomalies.length
      ? `检出异常 ${anomalies.length} 条（其中断档 ${anomalies.filter((a) => a.type === 'gap').length} 条、被均值掩盖 ${anomalies.filter((a) => a.type === 'avg_masked').length} 条）。`
      : '未检出异常。',
    conclusions.length ? `产出结论 ${conclusions.length} 条。` : '',
  ];

  return {
    batchId,
    generatedAt: new Date().toISOString(),
    filters,
    records,
    anomalies,
    conclusions,
    stats,
    pageSummary: summaryParts.join(''),
  };
}

export const CRANE_OPTIONS = CRANES;
export const CATEGORY_OPTIONS = Array.from(new Set(PART_DEFS.map((p) => p.category)));
export const STATUS_OPTIONS: Array<{ value: InspectionRecord['status']; label: string }> = [
  { value: 'normal', label: '正常' },
  { value: 'warning', label: '预警' },
  { value: 'critical', label: '超限' },
  { value: 'missing', label: '断档' },
];

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  gap: '采样断档',
  outlier: '统计离群',
  threshold: '阈值突破',
  avg_masked: '被均值掩盖',
};
