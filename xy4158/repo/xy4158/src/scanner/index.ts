import * as fs from 'fs';
import * as path from 'path';
import * as fastGlob from 'fast-glob';
import { ScannedFile, FileType, ValidationRules, DeviceConfig } from '../types';
import { 
  generateId, 
  generateFileHash, 
  getFileTypeFromExtension,
  extractDeviceIdFromFilename,
  extractTimeFromFilename
} from '../utils';

export interface ScannerOptions {
  basePath: string;
  rules: ValidationRules;
  devices: DeviceConfig[];
}

export class FileScanner {
  private options: ScannerOptions;
  private scannedFiles: ScannedFile[] = [];

  constructor(options: ScannerOptions) {
    this.options = options;
  }

  async scan(): Promise<ScannedFile[]> {
    this.scannedFiles = [];
    
    const extensions = this.options.rules.allowedExtensions
      .map(ext => ext.startsWith('.') ? ext : `.${ext}`)
      .join(',');
    
    const pattern = path.join(this.options.basePath, `**/*{${extensions}}`);
    
    const files = await fastGlob(pattern, {
      absolute: true,
      dot: false,
      onlyFiles: true
    });

    for (const filePath of files) {
      const scannedFile = await this.scanFile(filePath);
      this.scannedFiles.push(scannedFile);
    }

    return this.scannedFiles;
  }

  private async scanFile(filePath: string): Promise<ScannedFile> {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath);
    const deviceIds = this.options.devices.map(d => d.id);
    
    const errors: string[] = [];
    let isValid = true;
    let fileContent: Buffer | null = null;
    
    try {
      fileContent = fs.readFileSync(filePath);
    } catch (error) {
      errors.push('无法读取文件内容');
      isValid = false;
    }

    if (stat.size < this.options.rules.minFileSize) {
      errors.push(`文件过小 (${stat.size} 字节, 最小要求 ${this.options.rules.minFileSize} 字节)`);
      isValid = false;
    }

    if (!this.isAllowedExtension(ext)) {
      errors.push(`不支持的文件扩展名: ${ext}`);
      isValid = false;
    }

    const fileType = getFileTypeFromExtension(ext);
    let deviceId = extractDeviceIdFromFilename(name, deviceIds);
    let detectedTime = extractTimeFromFilename(name);

    if (fileType === 'csv' && fileContent) {
      const metadata = this.parseCsvMetadata(fileContent.toString('utf-8'));
      if (metadata.deviceId && !deviceId) {
        deviceId = metadata.deviceId;
      }
      if (metadata.startTime && !detectedTime) {
        detectedTime = metadata.startTime;
      }
    }

    if (this.options.rules.requireDeviceIdInFilename && !deviceId) {
      errors.push('文件名中未找到设备ID');
      isValid = false;
    }

    const hash = fileContent ? generateFileHash(filePath, fileContent) : '';

    return {
      id: generateId(),
      path: filePath,
      name: name,
      extension: ext,
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
      deviceId,
      detectedTime,
      fileType,
      hash,
      isValid,
      validationErrors: errors
    };
  }

  private isAllowedExtension(ext: string): boolean {
    return this.options.rules.allowedExtensions.some(
      allowed => allowed.toLowerCase() === ext.toLowerCase() || 
                 `.${allowed.toLowerCase()}` === ext.toLowerCase()
    );
  }

  private parseCsvMetadata(content: string): { deviceId?: string; startTime?: string } {
    const lines = content.split('\n').slice(0, 20);
    const result: { deviceId?: string; startTime?: string } = {};

    for (const line of lines) {
      if (line.includes('Device ID') || line.includes('DeviceID') || line.includes('device_id')) {
        const match = line.match(/(?:Device ID|DeviceID|device_id)[,:;]?\s*([A-Za-z0-9_-]+)/i);
        if (match) {
          result.deviceId = match[1];
        }
      }

      if (line.includes('Start Time') || line.includes('StartTime') || line.includes('timestamp')) {
        const match = line.match(/(?:Start Time|StartTime|timestamp)[,:;]?\s*([0-9T:.-]+)/i);
        if (match) {
          result.startTime = match[1];
        }
      }

      const timePattern = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/;
      const timeMatch = line.match(timePattern);
      if (timeMatch && !result.startTime) {
        result.startTime = timeMatch[1];
      }
    }

    return result;
  }

  getFilesByDevice(deviceId: string): ScannedFile[] {
    return this.scannedFiles.filter(f => f.deviceId === deviceId);
  }

  getFilesByType(type: FileType): ScannedFile[] {
    return this.scannedFiles.filter(f => f.fileType === type);
  }

  getInvalidFiles(): ScannedFile[] {
    return this.scannedFiles.filter(f => !f.isValid);
  }

  getDuplicateFiles(): ScannedFile[][] {
    const hashGroups = new Map<string, ScannedFile[]>();
    
    for (const file of this.scannedFiles) {
      if (!hashGroups.has(file.hash)) {
        hashGroups.set(file.hash, []);
      }
      hashGroups.get(file.hash)!.push(file);
    }

    return Array.from(hashGroups.values()).filter(group => group.length > 1);
  }
}
