import { AirspaceRecord, RouteVersion, RouteData } from '../types';
import { parseKML } from './kml';

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export async function parseImportFile(
  file: File
): Promise<{ type: 'kml' | 'csv' | 'json'; data: any; name: string }> {
  const text = await readFileAsText(file);
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'kml' || ext === 'kmz') {
    const routeData = parseKML(text);
    return { type: 'kml', data: routeData, name: file.name };
  }

  if (ext === 'csv') {
    const records = parseCSV(text);
    return { type: 'csv', data: records, name: file.name };
  }

  if (ext === 'json') {
    const jsonData = JSON.parse(text);
    return { type: 'json', data: jsonData, name: file.name };
  }

  throw new Error(`不支持的文件格式: ${ext}`);
}

export function parseCSV(csvText: string): Partial<AirspaceRecord>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const records: Partial<AirspaceRecord>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const record: Record<string, any> = {};

    headers.forEach((header, index) => {
      const value = values[index] || '';
      switch (header) {
        case 'source':
        case '来源':
          record.source = value;
          break;
        case 'pilot':
        case '飞手':
          record.pilot = value;
          break;
        case 'batterycycle':
        case 'battery_cycle':
        case '电池循环':
          record.batteryCycle = parseInt(value) || 0;
          break;
        case 'status':
        case '状态':
          record.status = value;
          break;
        case 'createdat':
        case 'created_at':
        case '创建时间':
          record.createdAt = value || new Date().toISOString();
          break;
      }
    });

    if (record.source || record.pilot) {
      records.push(record as Partial<AirspaceRecord>);
    }
  }

  return records;
}

export function createRecordFromKML(
  routeData: RouteData,
  pilot: string,
  batteryCycle: number,
  source: string = 'KML导入'
): { record: Omit<AirspaceRecord, 'id' | 'createdAt' | 'updatedAt'>; routeVersion: Omit<RouteVersion, 'id' | 'createdAt'> } {
  const kmlData = '';
  const now = new Date().toISOString();

  const record: Omit<AirspaceRecord, 'id' | 'createdAt' | 'updatedAt'> = {
    source,
    status: 'pending_review',
    batteryCycle,
    pilot,
    currentRouteVersionId: '',
  };

  const routeVersion: Omit<RouteVersion, 'id' | 'createdAt'> = {
    recordId: '',
    kmlData,
    routeData,
    createdBy: pilot,
    version: 1,
    changeDescription: '初始导入',
  };

  return { record, routeVersion };
}

export function validateKML(routeData: RouteData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!routeData.coordinates || routeData.coordinates.length < 2) {
    errors.push('航线至少需要2个坐标点');
  }

  routeData.coordinates.forEach((coord, index) => {
    if (coord.lat < -90 || coord.lat > 90) {
      errors.push(`第${index + 1}个点的纬度超出范围: ${coord.lat}`);
    }
    if (coord.lng < -180 || coord.lng > 180) {
      errors.push(`第${index + 1}个点的经度超出范围: ${coord.lng}`);
    }
    if (coord.alt < 0 || coord.alt > 500) {
      errors.push(`第${index + 1}个点的高度超出合理范围: ${coord.alt}m`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
