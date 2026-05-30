import type { ModalRecord, ParameterSnapshot, FrequencyPeak, AuditEntry, BoxDimensions, SoundHole, WoodMaterial } from '@/types';
import { validateAll } from './validation';
import { detectOverlappingPeaks, calculateAllPeaks } from './modalCalculation';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const PRESET_WOODS: WoodMaterial[] = [
  { name: '云杉 (Sitka Spruce)', density: 430, elasticModulus: 11.5, isCustom: false },
  { name: '雪松 (Western Red Cedar)', density: 350, elasticModulus: 8.5, isCustom: false },
  { name: '红松 (Engelmann Spruce)', density: 390, elasticModulus: 10.0, isCustom: false },
  { name: '桃花心木 (Mahogany)', density: 540, elasticModulus: 10.8, isCustom: false },
  { name: '玫瑰木 (Rosewood)', density: 830, elasticModulus: 14.0, isCustom: false },
  { name: '枫木 (Maple)', density: 630, elasticModulus: 12.0, isCustom: false },
];

export const SAMPLE_PROBLEM_RECORDS: Partial<ModalRecord>[] = [
  {
    id: 'sample-unit-error',
    name: '样例1: 尺寸单位错误',
    status: 'returned',
    createdAt: new Date('2025-05-20T10:00:00').toISOString(),
    updatedAt: new Date('2025-05-20T10:00:00').toISOString(),
    parameters: {
      id: 'p-sample1',
      recordId: 'sample-unit-error',
      source: 'import',
      sourceDetail: '导入自外部CSV (单位列标记为cm但数值为mm)',
      boxDims: { length: 480, width: 350, depth: 120 },
      soundHole: { diameter: 90, position: '面板中央' },
      wood: { name: '云杉 (Sitka Spruce)', density: 430, elasticModulus: 11.5, isCustom: false },
      lengthUnit: 'cm',
      densityUnit: 'kg_m3',
    } as ParameterSnapshot,
    peaks: [],
    auditLog: [
      {
        id: 'a-sample1-1',
        recordId: 'sample-unit-error',
        action: 'import',
        operator: '系统',
        reason: '导入时检测到尺寸单位异常：箱体长度480cm超出合理范围，疑似将mm值误标记为cm',
        timestamp: new Date('2025-05-20T10:00:00').toISOString(),
        snapshot: {} as ParameterSnapshot,
      },
      {
        id: 'a-sample1-2',
        recordId: 'sample-unit-error',
        action: 'status_change',
        operator: '系统',
        reason: '自动标记为"需退回"：尺寸单位错误，箱体长度480cm远超标准范围(30–60cm)',
        timestamp: new Date('2025-05-20T10:00:01').toISOString(),
        snapshot: {} as ParameterSnapshot,
      },
    ] as AuditEntry[],
  },
  {
    id: 'sample-overlap',
    name: '样例2: 频率峰重叠',
    status: 'pending',
    createdAt: new Date('2025-05-21T14:00:00').toISOString(),
    updatedAt: new Date('2025-05-21T14:00:00').toISOString(),
    parameters: {
      id: 'p-sample2',
      recordId: 'sample-overlap',
      source: 'manual',
      sourceDetail: '手动输入',
      boxDims: { length: 500, width: 360, depth: 110 },
      soundHole: { diameter: 85, position: '面板中央' },
      wood: { name: '云杉 (Sitka Spruce)', density: 430, elasticModulus: 11.5, isCustom: false },
      lengthUnit: 'mm',
      densityUnit: 'kg_m3',
    } as ParameterSnapshot,
    peaks: [
      { id: 's2-helm', recordId: 'sample-overlap', frequency: 128.5, amplitude: 1, modeLabel: 'Helmholtz 共振', isOverlapping: true },
      { id: 's2-p1', recordId: 'sample-overlap', frequency: 131.2, amplitude: 1, modeLabel: '面板模态 n=1', isOverlapping: true },
      { id: 's2-p2', recordId: 'sample-overlap', frequency: 262.4, amplitude: 0.5, modeLabel: '面板模态 n=2', isOverlapping: false },
      { id: 's2-p3', recordId: 'sample-overlap', frequency: 393.6, amplitude: 0.33, modeLabel: '面板模态 n=3', isOverlapping: false },
    ] as FrequencyPeak[],
    auditLog: [
      {
        id: 'a-sample2-1',
        recordId: 'sample-overlap',
        action: 'create',
        operator: '制琴师A',
        reason: '手动输入参数，检测到Helmholtz共振(128.5Hz)与面板模态n=1(131.2Hz)重叠，差值仅2.7Hz',
        timestamp: new Date('2025-05-21T14:00:00').toISOString(),
        snapshot: {} as ParameterSnapshot,
      },
    ] as AuditEntry[],
  },
  {
    id: 'sample-missing-material',
    name: '样例3: 材料参数缺失',
    status: 'returned',
    createdAt: new Date('2025-05-22T09:00:00').toISOString(),
    updatedAt: new Date('2025-05-22T09:00:00').toISOString(),
    parameters: {
      id: 'p-sample3',
      recordId: 'sample-missing-material',
      source: 'import',
      sourceDetail: '导入自外部JSON',
      boxDims: { length: 480, width: 350, depth: 100 },
      soundHole: { diameter: 88, position: '面板中央' },
      wood: { name: '自定义木材', density: 0, elasticModulus: 0, isCustom: true },
      lengthUnit: 'mm',
      densityUnit: 'kg_m3',
    } as ParameterSnapshot,
    peaks: [],
    auditLog: [
      {
        id: 'a-sample3-1',
        recordId: 'sample-missing-material',
        action: 'import',
        operator: '系统',
        reason: '导入时检测到材料参数缺失：密度=0、弹性模量=0，无法计算模态频率',
        timestamp: new Date('2025-05-22T09:00:00').toISOString(),
        snapshot: {} as ParameterSnapshot,
      },
      {
        id: 'a-sample3-2',
        recordId: 'sample-missing-material',
        action: 'status_change',
        operator: '系统',
        reason: '自动标记为"需退回"：材料参数缺失，需要补充木材密度和弹性模量',
        timestamp: new Date('2025-05-22T09:00:01').toISOString(),
        snapshot: {} as ParameterSnapshot,
      },
    ] as AuditEntry[],
  },
];

export function generateFrequencyData(peaks: FrequencyPeak[], points: number = 200): { labels: number[]; datasets: { x: number; y: number }[] } {
  if (peaks.length === 0) return { labels: [], datasets: [] };

  const minFreq = Math.min(...peaks.map((p) => p.frequency)) * 0.5;
  const maxFreq = Math.max(...peaks.map((p) => p.frequency)) * 1.5;
  const step = (maxFreq - minFreq) / points;

  const labels: number[] = [];
  const data: { x: number; y: number }[] = [];

  for (let i = 0; i <= points; i++) {
    const f = minFreq + step * i;
    labels.push(Math.round(f * 10) / 10);
    let y = 0;
    for (const peak of peaks) {
      const sigma = 3;
      y += peak.amplitude * Math.exp(-Math.pow(f - peak.frequency, 2) / (2 * sigma * sigma));
    }
    data.push({ x: Math.round(f * 10) / 10, y: Math.round(y * 1000) / 1000 });
  }

  return { labels, datasets: data };
}

export function validateImportRecord(record: Partial<ModalRecord>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!record.parameters) {
    errors.push('缺少参数数据');
    return { valid: false, errors };
  }

  const params = record.parameters;

  if (!params.boxDims || params.boxDims.length === 0 || params.boxDims.width === 0 || params.boxDims.depth === 0) {
    errors.push('箱体尺寸数据不完整');
  }

  if (!params.soundHole || params.soundHole.diameter === 0) {
    errors.push('音孔直径数据缺失');
  }

  if (!params.wood || params.wood.density === 0 || params.wood.elasticModulus === 0) {
    errors.push('木材参数缺失（密度或弹性模量为0）');
  }

  if (params.boxDims) {
    const validationErrors = validateAll(params.boxDims, params.soundHole || { diameter: 0, position: '' }, params.wood || { name: '', density: 0, elasticModulus: 0, isCustom: true }, params.lengthUnit || 'mm', params.densityUnit || 'kg_m3');
    for (const ve of validationErrors) {
      errors.push(ve.message);
    }
  }

  if (record.peaks && record.peaks.length > 1) {
    const overlapping = detectOverlappingPeaks(record.peaks);
    const overlapCount = overlapping.filter((p) => p.isOverlapping).length;
    if (overlapCount > 0) {
      errors.push(`检测到 ${overlapCount} 个频率峰重叠`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function exportRecord(record: ModalRecord): string {
  const exportData = {
    version: '1.0',
    exportTime: new Date().toISOString(),
    record: {
      id: record.id,
      name: record.name,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      parameters: record.parameters,
      peaks: record.peaks,
      auditLog: record.auditLog,
    },
  };
  return JSON.stringify(exportData, null, 2);
}

export function createRecord(
  name: string,
  boxDims: BoxDimensions,
  soundHole: SoundHole,
  wood: WoodMaterial,
  lengthUnit: 'mm' | 'cm' | 'in',
  densityUnit: 'kg_m3' | 'g_cm3',
  source: 'manual' | 'import',
  sourceDetail: string,
  operator: string,
  reason: string
): ModalRecord {
  const id = uid();
  const params: ParameterSnapshot = {
    id: uid(),
    recordId: id,
    source,
    sourceDetail,
    boxDims: { ...boxDims },
    soundHole: { ...soundHole },
    wood: { ...wood },
    lengthUnit,
    densityUnit,
  };

  const validationErrors = validateAll(boxDims, soundHole, wood, lengthUnit, densityUnit);
  const hasMaterialMissing = wood.density === 0 || wood.elasticModulus === 0;
  let peaks: FrequencyPeak[] = [];
  let status: 'processed' | 'pending' | 'returned' = 'pending';

  if (validationErrors.length > 0 || hasMaterialMissing) {
    status = 'returned';
  } else {
    peaks = calculateAllPeaks(boxDims, soundHole, wood, lengthUnit, densityUnit, id);
    const hasOverlap = peaks.some((p: FrequencyPeak) => p.isOverlapping);
    if (hasOverlap) {
      status = 'pending';
    } else {
      status = 'pending';
    }
  }

  const auditEntry: AuditEntry = {
    id: uid(),
    recordId: id,
    action: source === 'import' ? 'import' : 'create',
    operator,
    reason: reason || (source === 'import' ? '从外部导入' : '手动创建'),
    timestamp: new Date().toISOString(),
    snapshot: params,
  };

  return {
    id,
    name,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parameters: params,
    peaks,
    auditLog: [auditEntry],
  };
}
