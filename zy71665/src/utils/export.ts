import { toPng } from 'html-to-image';
import Papa from 'papaparse';
import type { MeasurementRecord, CalculationResult, Anomaly, FilterState, AnomalyType } from '@/types';

export function filterRecords(
  records: MeasurementRecord[],
  anomalies: Anomaly[],
  results: CalculationResult[],
  filter: FilterState
): MeasurementRecord[] {
  const anomalyRecordIds = new Set(anomalies.filter((a) => filter.anomalyTypes.includes(a.type)).map((a) => a.recordId));
  const resultMap = new Map(results.map((r) => [r.recordId, r]));

  return records.filter((r) => {
    if (r.wavelength < filter.wavelengthRange[0] || r.wavelength > filter.wavelengthRange[1]) return false;
    if (r.fiberLength < filter.lengthRange[0] || r.fiberLength > filter.lengthRange[1]) return false;
    if (filter.dataSource.length > 0 && !filter.dataSource.includes(r.dataSource)) return false;
    if (filter.anomalyTypes.length > 0 && !anomalyRecordIds.has(r.id)) return false;
    return true;
  });
}

export function filterResults(results: CalculationResult[], filteredRecordIds: Set<string>): CalculationResult[] {
  return results.filter((r) => filteredRecordIds.has(r.recordId));
}

export function filterAnomalies(anomalies: Anomaly[], filteredRecordIds: Set<string>): Anomaly[] {
  return anomalies.filter((a) => filteredRecordIds.has(a.recordId));
}

export function exportToCsv(
  records: MeasurementRecord[],
  results: CalculationResult[],
  anomalies: Anomaly[]
): void {
  const resultMap = new Map(results.map((r) => [r.recordId, r]));
  const anomalyMap = new Map<string, Anomaly[]>();
  for (const a of anomalies) {
    if (!anomalyMap.has(a.recordId)) anomalyMap.set(a.recordId, []);
    anomalyMap.get(a.recordId)!.push(a);
  }

  const rows = records.map((r) => {
    const res = resultMap.get(r.id);
    const ans = anomalyMap.get(r.id) || [];
    return {
      ID: r.id,
      光纤长度_km: r.fiberLength,
      长度单位: r.lengthUnit,
      输入功率: r.inputPower,
      输出功率: r.outputPower,
      功率单位: r.powerUnit,
      波长: r.wavelength,
      波长单位: r.wavelengthUnit,
      接头数量: r.connectorCount,
      接头编号: r.connectorIds.join(';'),
      数据来源: r.dataSource,
      备注: r.notes,
      损耗_dB: res?.lossDB ?? '',
      每公里损耗_dB_km: res?.lossPerKm ?? '',
      接头损耗_dB: res?.connectorLoss ?? '',
      总损耗_dB: res?.totalLoss ?? '',
      异常: ans.map((a) => a.type).join(';') || '无',
    };
  });

  const csv = Papa.unparse(rows);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `光纤损耗测量_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportToImage(elementId: string, fileName: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return;
  const dataUrl = await toPng(element, { backgroundColor: '#ffffff' });
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}

export function getDefaultFilter(): FilterState {
  return {
    wavelengthRange: [0, 2000],
    lengthRange: [0, 1000],
    anomalyTypes: [] as AnomalyType[],
    dataSource: [] as ('system' | 'manual')[],
  };
}
