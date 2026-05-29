import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  FileType,
  ProcessStatus,
  FileRecord,
  UserBucket,
  ExposureLog,
  OperationChange,
  ConversionData,
  ExperimentConfig,
  ContaminationType,
  LogEntry
} from '../types';
import {
  UserBucketSchema,
  ExposureLogSchema,
  OperationChangeSchema,
  ConversionDataSchema,
  ExperimentConfigSchema,
  validateAndParseRows,
  ParseError
} from '../types/schemas';

export interface ParseOptions {
  encoding?: string;
  delimiter?: string;
  hasHeader?: boolean;
  skipEmptyRows?: boolean;
}

export interface FileParseResult<T> {
  success: boolean;
  data: T[];
  errors: ParseError[];
  rowCount: number;
  validCount: number;
  invalidCount: number;
}

export class FileParserEngine {
  static detectFileType(filename: string): FileType {
    const lowerName = filename.toLowerCase();

    if (lowerName.includes('bucket') || lowerName.includes('分桶') || lowerName.includes('user')) {
      return FileType.USER_BUCKET;
    }
    if (lowerName.includes('exposure') || lowerName.includes('曝光') || lowerName.includes('exp')) {
      return FileType.EXPOSURE_LOG;
    }
    if (lowerName.includes('change') || lowerName.includes('变更') || lowerName.includes('operation') || lowerName.includes('运营')) {
      return FileType.OPERATION_CHANGE;
    }
    if (lowerName.includes('conversion') || lowerName.includes('转化') || lowerName.includes('conv')) {
      return FileType.CONVERSION_DATA;
    }
    if (lowerName.includes('config') || lowerName.includes('配置') || lowerName.includes('experiment')) {
      return FileType.EXPERIMENT_CONFIG;
    }
    if (lowerName.includes('report') || lowerName.includes('报告') || lowerName.includes('contamination')) {
      return FileType.CONTAMINATION_REPORT;
    }

    return FileType.UNKNOWN;
  }

  static async parseFile<T>(
    file: File,
    options: ParseOptions = {}
  ): Promise<{ data: any[]; headers: string[] }> {
    const { hasHeader = true, skipEmptyRows = true } = options;

    return new Promise((resolve, reject) => {
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'csv' || extension === 'txt') {
        Papa.parse(file, {
          header: hasHeader,
          skipEmptyLines: skipEmptyRows,
          encoding: options.encoding || 'UTF-8',
          delimiter: options.delimiter,
          complete: (result) => {
            if (result.errors.length > 0 && result.data.length === 0) {
              reject(new Error(`CSV解析错误: ${result.errors[0].message}`));
            } else {
              const headers = hasHeader && result.meta.fields ? result.meta.fields : [];
              resolve({
                data: result.data as any[],
                headers
              });
            }
          },
          error: (error) => {
            reject(new Error(`CSV解析失败: ${error.message}`));
          }
        });
      } else if (extension === 'xlsx' || extension === 'xls') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
              header: hasHeader ? 1 : 0,
              defval: ''
            }) as any[];

            let headers: string[] = [];
            let dataRows: any[] = jsonData;

            if (hasHeader && jsonData.length > 0) {
              headers = Object.keys(jsonData[0]);
            }

            resolve({ data: dataRows, headers });
          } catch (error) {
            reject(new Error(`Excel解析失败: ${error instanceof Error ? error.message : '未知错误'}`));
          }
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsArrayBuffer(file);
      } else if (extension === 'json') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const jsonData = JSON.parse(e.target?.result as string);
            const data = Array.isArray(jsonData) ? jsonData : [jsonData];
            const headers = data.length > 0 ? Object.keys(data[0]) : [];
            resolve({ data, headers });
          } catch (error) {
            reject(new Error(`JSON解析失败: ${error instanceof Error ? error.message : '格式错误'}`));
          }
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsText(file);
      } else {
        reject(new Error(`不支持的文件格式: .${extension}`));
      }
    });
  }

  static async parseUserBuckets(file: File): Promise<FileParseResult<UserBucket>> {
    try {
      const { data } = await this.parseFile(file);
      const result = validateAndParseRows(data, UserBucketSchema);

      return {
        success: result.success,
        data: result.data as UserBucket[],
        errors: result.errors,
        rowCount: data.length,
        validCount: result.data.length,
        invalidCount: data.length - result.data.length
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, message: error instanceof Error ? error.message : '文件解析失败' }],
        rowCount: 0,
        validCount: 0,
        invalidCount: 0
      };
    }
  }

  static async parseExposureLogs(file: File): Promise<FileParseResult<ExposureLog>> {
    try {
      const { data } = await this.parseFile(file);
      const parsed = validateAndParseRows(data, ExposureLogSchema);

      const logs: ExposureLog[] = parsed.data.map(row => ({
        ...row,
        isContaminated: false,
        contaminationType: ContaminationType.NONE
      })) as ExposureLog[];

      return {
        success: parsed.success,
        data: logs,
        errors: parsed.errors,
        rowCount: data.length,
        validCount: logs.length,
        invalidCount: data.length - parsed.data.length
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, message: error instanceof Error ? error.message : '文件解析失败' }],
        rowCount: 0,
        validCount: 0,
        invalidCount: 0
      };
    }
  }

  static async parseOperationChanges(file: File): Promise<FileParseResult<OperationChange>> {
    try {
      const { data } = await this.parseFile(file);
      const result = validateAndParseRows(data, OperationChangeSchema);

      return {
        success: result.success,
        data: result.data as OperationChange[],
        errors: result.errors,
        rowCount: data.length,
        validCount: result.data.length,
        invalidCount: data.length - result.data.length
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, message: error instanceof Error ? error.message : '文件解析失败' }],
        rowCount: 0,
        validCount: 0,
        invalidCount: 0
      };
    }
  }

  static async parseConversionData(file: File): Promise<FileParseResult<ConversionData>> {
    try {
      const { data } = await this.parseFile(file);
      const result = validateAndParseRows(data, ConversionDataSchema);

      return {
        success: result.success,
        data: result.data as ConversionData[],
        errors: result.errors,
        rowCount: data.length,
        validCount: result.data.length,
        invalidCount: data.length - result.data.length
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, message: error instanceof Error ? error.message : '文件解析失败' }],
        rowCount: 0,
        validCount: 0,
        invalidCount: 0
      };
    }
  }

  static async parseExperimentConfig(file: File): Promise<FileParseResult<ExperimentConfig>> {
    try {
      const { data } = await this.parseFile(file);
      const result = validateAndParseRows(data, ExperimentConfigSchema);

      return {
        success: result.success,
        data: result.data as ExperimentConfig[],
        errors: result.errors,
        rowCount: data.length,
        validCount: result.data.length,
        invalidCount: data.length - result.data.length
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, message: error instanceof Error ? error.message : '文件解析失败' }],
        rowCount: 0,
        validCount: 0,
        invalidCount: 0
      };
    }
  }

  static async parseFileByType(
    file: File,
    fileType: FileType
  ): Promise<FileParseResult<any>> {
    switch (fileType) {
      case FileType.USER_BUCKET:
        return this.parseUserBuckets(file);
      case FileType.EXPOSURE_LOG:
        return this.parseExposureLogs(file);
      case FileType.OPERATION_CHANGE:
        return this.parseOperationChanges(file);
      case FileType.CONVERSION_DATA:
        return this.parseConversionData(file);
      case FileType.EXPERIMENT_CONFIG:
        return this.parseExperimentConfig(file);
      default:
        return {
          success: false,
          data: [],
          errors: [{ row: 0, message: `不支持的文件类型: ${fileType}` }],
          rowCount: 0,
          validCount: 0,
          invalidCount: 0
        };
    }
  }

  static generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static createFileRecord(file: File, detectedType?: FileType): FileRecord {
    const type = detectedType || this.detectFileType(file.name);
    return {
      id: `${file.name}_${this.generateId()}`,
      name: file.name,
      path: file.webkitRelativePath || file.name,
      size: file.size,
      type,
      status: ProcessStatus.PENDING,
      rowCount: 0,
      createdAt: Date.now()
    };
  }

  static formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  static createLogEntry(
    level: LogEntry['level'],
    message: string,
    details?: string
  ): LogEntry {
    return {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      message,
      details
    };
  }

  static mergeDeduplicate<T extends { [key: string]: any }>(
    existingData: T[],
    newData: T[],
    idField: string
  ): T[] {
    const existingMap = new Map(existingData.map(item => [item[idField], item]));

    newData.forEach(item => {
      const id = item[idField];
      if (existingMap.has(id)) {
        const existing = existingMap.get(id)!;
        const existingTime = existing['bucketTime'] || existing['exposureTime'] || existing['changeTime'] || existing['conversionTime'] || 0;
        const newTime = item['bucketTime'] || item['exposureTime'] || item['changeTime'] || item['conversionTime'] || 0;
        if (newTime > existingTime) {
          existingMap.set(id, item);
        }
      } else {
        existingMap.set(id, item);
      }
    });

    return Array.from(existingMap.values());
  }
}
