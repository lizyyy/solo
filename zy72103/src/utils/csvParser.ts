import Papa from 'papaparse';
import type { BatteryRecord } from '@/types';

export function parseCsvFile(file: File): Promise<BatteryRecord[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const records = parseCsvData(results.data as Record<string, string>[]);
          resolve(records);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export function parseCsvText(content: string): BatteryRecord[] {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
  });
  return parseCsvData(result.data as Record<string, string>[]);
}

function parseCsvData(data: Record<string, string>[]): BatteryRecord[] {
  return data.map((row, index) => {
    const timestamp = parseTimestamp(row);

    return {
      id: `REC-${String(index + 1).padStart(3, '0')}`,
      timestamp,
      temperature: parseNumber(row, ['温度', '温度(°C)', 'temperature', 'Temperature']),
      voltage: parseNumber(row, ['电压', '电压(V)', 'voltage', 'Voltage']),
      current: parseNumber(row, ['电流', '电流(A)', 'current', 'Current']),
      internalResistance: parseNumber(row, ['内阻', '内阻(mΩ)', 'resistance', 'Resistance']),
      dataQuality: {
        isNull: false,
        isDuplicate: false,
        isBoundary: false,
        isExtreme: false,
      },
      detectionSteps: [],
    };
  });
}

function parseTimestamp(row: Record<string, string>): Date {
  const timeKeys = ['时间', 'timestamp', 'Timestamp', 'Time', 'time'];
  for (const key of timeKeys) {
    if (row[key]) {
      return new Date(row[key]);
    }
  }
  return new Date();
}

function parseNumber(
  row: Record<string, string>,
  possibleKeys: string[],
): number | null {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== '') {
      const num = parseFloat(row[key]);
      if (!isNaN(num)) {
        return num;
      }
    }
  }
  return null;
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
