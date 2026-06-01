import * as XLSX from 'xlsx';
import type { DataRecord, FieldMapping, SourceInfo, AnomalyInfo, GreekAxis } from '@/types';

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true }) as Record<string, unknown>[];
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export function autoDetectMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  const patterns: Record<string, string[]> = {
    delta: ['delta', 'δ', '德尔塔'],
    gamma: ['gamma', 'γ', '伽马'],
    theta: ['theta', 'θ', '西塔'],
    vega: ['vega', 'ν', '维加'],
    rho: ['rho', 'ρ', '柔'],
    label: ['label', 'name', '名称', '标的', '合约', '代码'],
    strike: ['strike', '行权价', '执行价', 'K'],
    maturity: ['maturity', 'expiry', '到期', '期限'],
  };

  for (const [field, keywords] of Object.entries(patterns)) {
    for (const keyword of keywords) {
      const idx = lowerHeaders.findIndex(h => h.includes(keyword));
      if (idx !== -1) {
        (mapping as Record<string, string>)[field] = headers[idx];
        break;
      }
    }
  }

  return mapping;
}

export function detectAnomaly(
  record: Record<string, unknown>,
  mapping: FieldMapping
): AnomalyInfo {
  const thresholds: Record<string, [number, number]> = {
    delta: [-0.95, 0.95],
    gamma: [-2, 2],
    theta: [-500, 500],
    vega: [-1000, 1000],
  };

  for (const [greek, [min, max]] of Object.entries(thresholds)) {
    const col = (mapping as Record<string, string | undefined>)[greek];
    if (!col) continue;
    const val = Number(record[col]);
    if (isNaN(val)) continue;
    if (val < min || val > max) {
      return {
        isAnomaly: true,
        anomalyType: `${greek.toUpperCase()} 超出阈值`,
        detectedAt: new Date().toISOString(),
      };
    }
  }

  return { isAnomaly: false };
}

export function buildDataRecord(
  raw: Record<string, unknown>,
  mapping: FieldMapping,
  sourceInfo: SourceInfo
): DataRecord {
  const mapped: Record<string, unknown> = {};
  for (const [field, col] of Object.entries(mapping)) {
    if (!col) continue;
    let val = raw[col];
    if (['delta', 'gamma', 'theta', 'vega', 'rho', 'strike'].includes(field)) {
      val = Number(val);
    }
    mapped[field] = val;
  }

  const anomaly = detectAnomaly(raw, mapping);

  return {
    id: generateId(),
    raw,
    mapped,
    source: sourceInfo,
    anomaly,
    notes: [],
  };
}

export function getGreekColor(axis: GreekAxis, value: number): string {
  const colors: Record<GreekAxis, [string, string]> = {
    delta: ['#ef4444', '#22c55e'],
    gamma: ['#f59e0b', '#8b5cf6'],
    theta: ['#06b6d4', '#ec4899'],
    vega: ['#3b82f6', '#10b981'],
  };
  const [neg, pos] = colors[axis];
  const t = Math.max(-1, Math.min(1, value));
  if (t >= 0) {
    return pos;
  }
  return neg;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatAxisLabel(axis: GreekAxis): string {
  const labels: Record<GreekAxis, string> = {
    delta: 'Delta (Δ)',
    gamma: 'Gamma (Γ)',
    theta: 'Theta (Θ)',
    vega: 'Vega (ν)',
  };
  return labels[axis];
}

export function detectSourceType(fileName: string): SourceInfo['type'] {
  const name = fileName.toLowerCase();
  if (name.includes('gis') || name.includes('地理')) return 'gis';
  if (name.includes('巡检') || name.includes('inspection') || name.includes('平板')) return 'inspection';
  return 'excel';
}

export function computeRanges(records: DataRecord[]): Record<GreekAxis, [number, number]> {
  const result: Record<GreekAxis, [number, number]> = {
    delta: [Infinity, -Infinity],
    gamma: [Infinity, -Infinity],
    theta: [Infinity, -Infinity],
    vega: [Infinity, -Infinity],
  };

  for (const rec of records) {
    for (const greek of ['delta', 'gamma', 'theta', 'vega'] as GreekAxis[]) {
      const v = rec.mapped[greek];
      if (typeof v === 'number' && !isNaN(v)) {
        result[greek][0] = Math.min(result[greek][0], v);
        result[greek][1] = Math.max(result[greek][1], v);
      }
    }
  }

  return result;
}
