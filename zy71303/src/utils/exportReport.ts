import type { StringParams, TensionResult, Anomaly } from './tensionCalc';

export interface ExportRow {
  stringId: number;
  name: string;
  scaleLengthMm: number;
  targetNote: string;
  frequencyHz: number;
  linearDensity: number;
  linearDensityUnit: string;
  gaugeMm: number;
  tensionN: number;
  tensionPercent: number;
  anomalyFlags: string;
  anomalyDescriptions: string;
  rawScaleLength: string;
  rawFrequency: string;
  rawLinearDensity: string;
  rawGauge: string;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateCSV(
  strings: StringParams[],
  results: TensionResult[],
  totalTension: number,
  presetName: string,
): string {
  const header = [
    '弦序号', '弦名', '弦长(mm)', '目标音高', '频率(Hz)',
    '线密度', '线密度单位', '弦径(mm)',
    '张力(N)', '张力占比(%)', '异常标记', '异常描述',
    '原始弦长', '原始频率', '原始线密度', '原始弦径',
  ].map(escapeCSV).join(',');

  const rows = strings.map((s, i) => {
    const r = results[i];
    const percent = totalTension > 0 ? (r.tension / totalTension * 100) : 0;
    const flags = r.anomalies.map(a => a.type).join(';');
    const descriptions = r.anomalies.map(a => a.message).join('; ');

    return [
      s.id, escapeCSV(s.name), s.scaleLength, escapeCSV(s.targetNote), s.frequency,
      s.linearDensity, s.linearDensityUnit, s.gauge,
      r.tension.toFixed(2), percent.toFixed(1),
      escapeCSV(flags), escapeCSV(descriptions),
      escapeCSV(s.rawInputs.scaleLength), escapeCSV(s.rawInputs.frequency),
      escapeCSV(s.rawInputs.linearDensity), escapeCSV(s.rawInputs.gauge),
    ].join(',');
  });

  const summaryLine = [
    '', '合计', '', '', '', '', '', '',
    totalTension.toFixed(2), '100.0', '', `调弦方式: ${escapeCSV(presetName)}`,
    '', '', '', `导出时间: ${new Date().toISOString()}`,
  ].join(',');

  return [header, ...rows, summaryLine].join('\n');
}

export function downloadCSV(csvContent: string, filename: string = 'guitar-tension-report.csv'): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
