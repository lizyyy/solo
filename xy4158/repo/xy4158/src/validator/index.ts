import { 
  ValidationIssue, 
  IssueType, 
  Severity,
  ScannedFile,
  TimelineEntry,
  ValidationRules,
  DeviceConfig
} from '../types';
import { generateId, groupBy, sortBy, parseTimestamp } from '../utils';

export interface ValidatorOptions {
  rules: ValidationRules;
  devices: DeviceConfig[];
}

export class RuleValidator {
  private options: ValidatorOptions;
  private issues: ValidationIssue[] = [];

  constructor(options: ValidatorOptions) {
    this.options = options;
  }

  async validateAll(
    scannedFiles: ScannedFile[],
    timelineEntries: TimelineEntry[]
  ): Promise<ValidationIssue[]> {
    this.issues = [];

    this.validateFileExtensions(scannedFiles);
    this.validateFileSize(scannedFiles);
    this.validateDeviceIds(scannedFiles);
    this.validateDuplicates(scannedFiles);
    this.validateCorruptedFiles(scannedFiles);
    this.validateTimeDrift(timelineEntries);
    this.validateMissingRecords(timelineEntries);
    this.validateCrossDeviceConflicts(timelineEntries);

    return sortBy(this.issues, i => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[i.severity];
    });
  }

  private createIssue(
    type: IssueType,
    severity: Severity,
    deviceId: string,
    description: string,
    details: Record<string, any>,
    suggestedAction: string,
    fileId?: string,
    fileName?: string
  ): ValidationIssue {
    return {
      id: generateId(),
      type,
      severity,
      deviceId,
      fileId,
      fileName,
      description,
      details,
      suggestedAction
    };
  }

  private validateFileExtensions(files: ScannedFile[]): void {
    const allowed = this.options.rules.allowedExtensions.map(e => e.toLowerCase());
    
    for (const file of files) {
      const ext = file.extension.toLowerCase().replace('.', '');
      if (!allowed.includes(ext) && !allowed.includes(`.${ext}`)) {
        this.issues.push(this.createIssue(
          'unexpected_extension',
          'medium',
          file.deviceId || 'unknown',
          `文件 ${file.name} 使用了不支持的扩展名 ${file.extension}`,
          {
            filePath: file.path,
            extension: file.extension,
            allowedExtensions: this.options.rules.allowedExtensions
          },
          '确认文件类型是否正确，或更新项目配置中的允许扩展名列表',
          file.id,
          file.name
        ));
      }
    }
  }

  private validateFileSize(files: ScannedFile[]): void {
    const minSize = this.options.rules.minFileSize;
    
    for (const file of files) {
      if (file.size < minSize) {
        this.issues.push(this.createIssue(
          'file_too_small',
          'high',
          file.deviceId || 'unknown',
          `文件 ${file.name} 大小异常 (${file.size} 字节)`,
          {
            filePath: file.path,
            actualSize: file.size,
            minimumSize: minSize
          },
          '检查文件是否完整，确认数据采集是否正常',
          file.id,
          file.name
        ));
      }
    }
  }

  private validateDeviceIds(files: ScannedFile[]): void {
    if (!this.options.rules.requireDeviceIdInFilename) return;
    
    for (const file of files) {
      if (!file.deviceId) {
        this.issues.push(this.createIssue(
          'invalid_filename',
          'high',
          'unknown',
          `无法从文件名 ${file.name} 中识别设备ID`,
          {
            filePath: file.path,
            filename: file.name
          },
          '重命名文件以包含设备ID，或手动关联到正确的设备',
          file.id,
          file.name
        ));
      }
    }
  }

  private validateDuplicates(files: ScannedFile[]): void {
    const hashGroups = groupBy(files, f => f.hash);
    
    for (const [hash, group] of Object.entries(hashGroups)) {
      if (group.length > 1) {
        for (let i = 1; i < group.length; i++) {
          const file = group[i];
          this.issues.push(this.createIssue(
            'duplicate_file',
            'medium',
            file.deviceId || 'unknown',
            `文件 ${file.name} 与 ${group[0].name} 内容重复`,
            {
              duplicateHash: hash,
              originalFile: {
                name: group[0].name,
                path: group[0].path,
                id: group[0].id
              },
              duplicateFile: {
                name: file.name,
                path: file.path,
                id: file.id
              }
            },
            '删除重复文件，保留原始版本',
            file.id,
            file.name
          ));
        }
      }
    }
  }

  private validateCorruptedFiles(files: ScannedFile[]): void {
    for (const file of files) {
      if (!file.isValid && file.validationErrors.length > 0) {
        this.issues.push(this.createIssue(
          'corrupted_file',
          'critical',
          file.deviceId || 'unknown',
          `文件 ${file.name} 验证失败，可能已损坏`,
          {
            filePath: file.path,
            errors: file.validationErrors,
            fileSize: file.size
          },
          '检查文件完整性，尝试从源设备重新拷贝',
          file.id,
          file.name
        ));
      }
    }
  }

  private validateTimeDrift(timeline: TimelineEntry[]): void {
    const maxDrift = this.options.rules.maxTimeDriftMinutes;
    
    for (const entry of timeline) {
      if (Math.abs(entry.timeDriftMinutes) > maxDrift) {
        this.issues.push(this.createIssue(
          'time_drift',
          'high',
          entry.deviceId,
          `设备 ${entry.deviceId} 时间偏移超过阈值 (${entry.timeDriftMinutes.toFixed(2)} 分钟)`,
          {
            fileId: entry.fileId,
            fileName: entry.fileName,
            deviceTime: entry.startTime,
            normalizedTime: entry.normalizedTime,
            driftMinutes: entry.timeDriftMinutes,
            maxAllowedDrift: maxDrift
          },
          '添加时间校准点，或调整设备时间偏移配置',
          entry.fileId,
          entry.fileName
        ));
      }
    }
  }

  private validateMissingRecords(timeline: TimelineEntry[]): void {
    const byDevice = groupBy(timeline, t => t.deviceId);
    const maxMissing = this.options.rules.maxMissingIntervals;
    
    for (const [deviceId, entries] of Object.entries(byDevice)) {
      const device = this.options.devices.find(d => d.id === deviceId);
      if (!device) continue;
      
      const sorted = sortBy(entries, e => parseTimestamp(e.startTime)?.getTime() || 0);
      
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        
        const prevEnd = parseTimestamp(prev.endTime);
        const currStart = parseTimestamp(curr.startTime);
        
        if (!prevEnd || !currStart) continue;
        
        const gapMinutes = (currStart.getTime() - prevEnd.getTime()) / (1000 * 60);
        const missingIntervals = Math.floor(gapMinutes / device.expectedInterval);
        
        if (missingIntervals > maxMissing) {
          this.issues.push(this.createIssue(
            'missing_records',
            'critical',
            deviceId,
            `发现缺失数据段: ${prev.endTime} 到 ${curr.startTime}`,
            {
              gapFrom: prev.endTime,
              gapTo: curr.startTime,
              gapMinutes: Math.round(gapMinutes),
              missingIntervals,
              expectedInterval: device.expectedInterval,
              maxAllowedMissing: maxMissing,
              beforeFile: prev.fileName,
              afterFile: curr.fileName
            },
            '检查是否有未导入的文件，或确认设备在该时段是否正常工作',
            undefined,
            `${prev.fileName} -> ${curr.fileName}`
          ));
        }
      }
    }
  }

  private validateCrossDeviceConflicts(timeline: TimelineEntry[]): void {
    const byNormalizedTime = groupBy(timeline, t => t.normalizedTime.substring(0, 16));
    
    for (const [timeKey, entries] of Object.entries(byNormalizedTime)) {
      if (entries.length > 1) {
        const devices = [...new Set(entries.map(e => e.deviceId))];
        
        if (devices.length > 1) {
          for (const entry of entries) {
            this.issues.push(this.createIssue(
              'cross_device_conflict',
              'medium',
              entry.deviceId,
              `时间线冲突: ${devices.join(', ')} 多台设备在 ${timeKey} 有记录`,
              {
                conflictTime: timeKey,
                involvedDevices: devices,
                files: entries.map(e => ({
                  deviceId: e.deviceId,
                  fileName: e.fileName,
                  fileId: e.fileId,
                  deviceTime: e.startTime,
                  normalizedTime: e.normalizedTime
                }))
              },
              '检查设备时间校准，确认是否存在时间同步问题',
              entry.fileId,
              entry.fileName
            ));
          }
        }
      }
    }
  }

  getIssuesBySeverity(severity: Severity): ValidationIssue[] {
    return this.issues.filter(i => i.severity === severity);
  }

  getIssuesByType(type: IssueType): ValidationIssue[] {
    return this.issues.filter(i => i.type === type);
  }

  getIssuesByDevice(deviceId: string): ValidationIssue[] {
    return this.issues.filter(i => i.deviceId === deviceId);
  }

  getStatistics(): { 
    total: number; 
    bySeverity: Record<Severity, number>;
    byType: Record<IssueType, number>;
  } {
    const bySeverity: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    const byType: Record<string, number> = {};
    
    for (const issue of this.issues) {
      bySeverity[issue.severity]++;
      byType[issue.type] = (byType[issue.type] || 0) + 1;
    }
    
    return {
      total: this.issues.length,
      bySeverity,
      byType: byType as Record<IssueType, number>
    };
  }
}
