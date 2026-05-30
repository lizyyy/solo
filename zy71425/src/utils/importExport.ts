import { GameRecord, ExportData, DATA_FORMAT_VERSION, DiagnosisResult } from '../types';
import { diagnoseFailure, diagnoseSuccess } from './diagnosis';

function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `simple:${Math.abs(hash).toString(16)}`;
}

export function exportToJSON(record: GameRecord): string {
  const exportData: ExportData = {
    version: DATA_FORMAT_VERSION,
    exportTime: Date.now(),
    record: deepClone(record),
    checksum: '',
  };

  const recordJSON = JSON.stringify(exportData.record);
  exportData.checksum = generateChecksum(recordJSON + exportData.exportTime);

  return JSON.stringify(exportData, null, 2);
}

export function importFromJSON(jsonString: string): {
  success: boolean;
  record?: GameRecord;
  error?: string;
  diagnosis?: DiagnosisResult;
} {
  try {
    const data: ExportData = JSON.parse(jsonString);

    if (!data.version || data.version !== DATA_FORMAT_VERSION) {
      return {
        success: false,
        error: `数据格式版本不兼容。当前版本: ${DATA_FORMAT_VERSION}，导入版本: ${data.version || '未知'}`,
      };
 }

    const recordJSON = JSON.stringify(data.record);
    const calculatedChecksum = generateChecksum(recordJSON + data.exportTime);

    if (data.checksum !== calculatedChecksum) {
      return {
        success: false,
        error: '数据校验失败，文件可能已被篡改。',
      };
    }

    const validation = validateRecord(data.record);
    if (!validation.valid) {
      return {
        success: false,
        error: `数据格式无效: ${validation.error}`,
      };
    }

    const record = deepClone(data.record);
    record.id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    record.timestamp = Date.now();

    let diagnosis: DiagnosisResult;
    if (record.result.success) {
      diagnosis = diagnoseSuccess(record.result, record.trajectory, record.particleConfig);
    } else {
      diagnosis = diagnoseFailure(
        record.result,
        record.trajectory,
        record.trackElements,
        record.magneticFields,
        record.particleConfig
      );
    }

    return {
      success: true,
      record,
      diagnosis,
    };
  } catch (e) {
    return {
      success: false,
      error: `JSON解析失败: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

function validateRecord(record: unknown): { valid: boolean; error?: string } {
  const r = record as GameRecord;

  if (!r || typeof r !== 'object') {
    return { valid: false, error: '记录不是有效的对象' };
  }

  if (!Array.isArray(r.trackElements)) {
    return { valid: false, error: '缺少trackElements数组' };
  }

  if (!Array.isArray(r.magneticFields)) {
    return { valid: false, error: '缺少magneticFields数组' };
  }

  if (!r.particleConfig || typeof r.particleConfig !== 'object') {
    return { valid: false, error: '缺少particleConfig配置' };
  }

  if (!Array.isArray(r.trajectory)) {
    return { valid: false, error: '缺少trajectory轨迹数据' };
  }

  if (!r.result || typeof r.result !== 'object') {
    return { valid: false, error: '缺少result结果数据' };
  }

  return { valid: true };
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function downloadFile(content: string, filename: string, mimeType: string = 'application/json'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function generateExportFilename(record: GameRecord): string {
  const date = new Date(record.timestamp);
  const dateStr = date.toISOString().slice(0, 10);
  const safeName = record.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_]/g, '_');
  const status = record.result.success ? 'success' : 'fail';
  return `particle-${safeName}-${status}-${dateStr}.json`;
}

export function generateRecordSummary(record: GameRecord): string {
  const lines: string[] = [];
  lines.push(`=== 粒子加速器拼轨 记录摘要 ===`);
  lines.push(`记录名称: ${record.name}`);
  lines.push(`时间: ${new Date(record.timestamp).toLocaleString()}`);
  lines.push(`来源样例: ${record.sampleSource || '自定义'}`);
  lines.push(`结果: ${record.result.success ? '成功' : '失败'}`);
  if (record.result.failureType) {
    lines.push(`失败类型: ${record.result.failureType}`);
  }
  lines.push(`轨道元素数: ${record.trackElements.length}`);
  lines.push(`磁场块数: ${record.magneticFields.length}`);
  lines.push(`粒子类型: ${record.particleConfig.type}`);
  lines.push(`初始能量: ${record.particleConfig.initialEnergy.toExponential(2)} J`);
  lines.push(`模拟帧数: ${record.trajectory.length}`);
  lines.push(`总耗时: ${record.result.totalTime.toExponential(2)} s`);
  if (record.result.collisionPoint) {
    lines.push(`碰撞点: (${record.result.collisionPoint.x.toFixed(1)}, ${record.result.collisionPoint.y.toFixed(1)})`);
  }
  lines.push(`==============================`);
  return lines.join('\n');
}
