import type { ImportData, ImportResult, TransitWindow, DataSource } from '@/types';
import { generateId } from '@/utils/timeUtils';
import { SATELLITE_COLORS } from '@/types';

export function validateImportData(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('数据格式错误，应为JSON对象');
    return { valid: false, errors };
  }
  
  const obj = data as Record<string, unknown>;
  
  if (!['ORBIT_ELEMENTS', 'TELEMETRY'].includes(obj.type as string)) {
    errors.push('数据类型必须是 ORBIT_ELEMENTS 或 TELEMETRY');
  }
  
  if (!obj.name || typeof obj.name !== 'string') {
    errors.push('数据源名称不能为空');
  }
  
  if (!['UTC', 'TAI', 'LOCAL'].includes(obj.timeSystem as string)) {
    errors.push('时间制式必须是 UTC、TAI 或 LOCAL');
  }
  
  if (!Array.isArray(obj.windows)) {
    errors.push('窗口数据必须是数组格式');
    return { valid: errors.length === 0, errors };
  }
  
  const windows = obj.windows as unknown[];
  windows.forEach((w, index) => {
    const window = w as Record<string, unknown>;
    if (!window.satelliteId || typeof window.satelliteId !== 'string') {
      errors.push(`窗口${index + 1}: 缺少卫星ID`);
    }
    if (!window.satelliteName || typeof window.satelliteName !== 'string') {
      errors.push(`窗口${index + 1}: 缺少卫星名称`);
    }
    if (!window.startTime || isNaN(new Date(window.startTime as string).getTime())) {
      errors.push(`窗口${index + 1}: 开始时间格式无效`);
    }
    if (!window.endTime || isNaN(new Date(window.endTime as string).getTime())) {
      errors.push(`窗口${index + 1}: 结束时间格式无效`);
    }
    if (window.startTime && window.endTime) {
      const start = new Date(window.startTime as string).getTime();
      const end = new Date(window.endTime as string).getTime();
      if (start >= end) {
        errors.push(`窗口${index + 1}: 结束时间必须晚于开始时间`);
      }
    }
  });
  
  return { valid: errors.length === 0, errors };
}

export function processImportData(
  importData: ImportData,
  existingWindows: TransitWindow[]
): { windows: TransitWindow[]; dataSource: DataSource; warnings: string[] } {
  const warnings: string[] = [];
  const dataSourceId = generateId();
  
  const dataSource: DataSource = {
    id: dataSourceId,
    type: importData.type,
    name: importData.name,
    timeSystem: importData.timeSystem,
    importedAt: new Date().toISOString(),
    rawData: importData
  };
  
  const timeSource = importData.type === 'ORBIT_ELEMENTS' ? 'ORBIT' : 'TELEMETRY';
  
  const windows: TransitWindow[] = importData.windows.map((w, index) => {
    const existingSameSatellite = existingWindows.filter(
      ew => ew.satelliteId === w.satelliteId
    );
    
    if (existingSameSatellite.length > 0) {
      warnings.push(`卫星${w.satelliteName}已存在${existingSameSatellite.length}个窗口，请检查是否重复`);
    }
    
    return {
      id: generateId(),
      satelliteId: w.satelliteId,
      satelliteName: w.satelliteName,
      startTime: w.startTime,
      endTime: w.endTime,
      timeSource,
      timeSystem: importData.timeSystem,
      status: 'NORMAL',
      description: w.description || `导入自${importData.name}`,
      color: w.color || SATELLITE_COLORS[index % SATELLITE_COLORS.length],
      priority: w.priority || 5,
      dataSourceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
  
  return { windows, dataSource, warnings };
}

export async function parseImportFile(file: File): Promise<ImportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as ImportData;
        resolve(data);
      } catch (error) {
        reject(new Error('JSON解析失败，请检查文件格式'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

export function createImportResult(
  success: boolean,
  dataSourceId: string,
  importedCount: number,
  conflicts: ImportResult['conflicts'],
  warnings: string[]
): ImportResult {
  return {
    success,
    dataSourceId,
    importedCount,
    conflicts,
    warnings
  };
}
