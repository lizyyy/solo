import type { Batch } from '../types';
import { getStageName, getDoughTypeName, formatDateTime } from '../utils';
import { getDataVersion } from './storage';

export const exportToJSON = (batches: Batch[]): string => {
  const data = {
    version: getDataVersion(),
    exportTime: new Date().toISOString(),
    batches: batches
  };
  return JSON.stringify(data, null, 2);
};

export const exportToCSV = (batches: Batch[]): string => {
  const headers = [
    '批次编号',
    '面团类型',
    '重量(g)',
    '目标温度(°C)',
    '当前阶段',
    '创建时间',
    '温度记录数',
    '平均温度(°C)',
    '备注'
  ];
  
  const rows = batches.map(batch => {
    const avgTemp = batch.temperatureRecords.length > 0
      ? (batch.temperatureRecords.reduce((sum, r) => sum + r.temperature, 0) / batch.temperatureRecords.length).toFixed(1)
      : '-';
    
    return [
      batch.batchNumber,
      getDoughTypeName(batch.doughType),
      batch.weight.toString(),
      batch.targetTemperature.toString(),
      getStageName(batch.currentStage),
      formatDateTime(batch.createdAt),
      batch.temperatureRecords.length.toString(),
      avgTemp,
      batch.notes || '-'
    ];
  });
  
  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
};

export const exportTemperatureRecordsCSV = (batches: Batch[]): string => {
  const headers = [
    '批次编号',
    '面团类型',
    '阶段',
    '温度(°C)',
    '记录时间',
    '备注'
  ];
  
  const records = batches.flatMap(batch => 
    batch.temperatureRecords.map(record => [
      batch.batchNumber,
      getDoughTypeName(batch.doughType),
      getStageName(record.stage),
      record.temperature.toFixed(1),
      formatDateTime(record.recordedAt),
      record.note || '-'
    ])
  );
  
  return [
    headers.join(','),
    ...records.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
};

export const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const getExportFilename = (type: string): string => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
  
  const timestamps = {
    json: `bakery_batches_${dateStr}_${timeStr}.json`,
    csv: `bakery_batches_${dateStr}_${timeStr}.csv`,
    temp_csv: `bakery_temperature_records_${dateStr}_${timeStr}.csv`
  };
  
  return timestamps[type as keyof typeof timestamps] || `export_${dateStr}.txt`;
};
