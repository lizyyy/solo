import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { Writable } from 'stream';
import { ManifestEntry } from '../types';

export class CsvParser {
  static async parseManifest(filePath: string): Promise<ManifestEntry[]> {
    const entries: ManifestEntry[] = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({
          mapHeaders: ({ header }: { header: string }) => header.trim(),
        }))
        .on('data', (row: Record<string, string>) => {
          const entry = this.parseRow(row);
          if (entry) {
            entries.push(entry);
          }
        })
        .on('end', () => {
          resolve(entries);
        })
        .on('error', (error: Error) => {
          reject(new Error(`解析 manifest.csv 失败: ${error.message}`));
        });
    });
  }

  static parseRow(row: Record<string, string>): ManifestEntry | null {
    try {
      return {
        filename: row.filename || row['filename'] || '',
        waypointId: row.waypointId || row['waypointId'] || row.waypoint_id || '',
        towerId: row.towerId || row['towerId'] || row.tower_id || '',
        flightSegment: row.flightSegment || row['flightSegment'] || row.flight_segment || 'main',
        timestamp: row.timestamp || row['timestamp'] || '',
        latitude: parseFloat(row.latitude || row['latitude'] || '0'),
        longitude: parseFloat(row.longitude || row['longitude'] || '0'),
        altitude: parseFloat(row.altitude || row['altitude'] || '0'),
        imageWidth: parseInt(row.imageWidth || row['imageWidth'] || row.image_width || '0', 10),
        imageHeight: parseInt(row.imageHeight || row['imageHeight'] || row.image_height || '0', 10),
        fileSize: parseInt(row.fileSize || row['fileSize'] || row.file_size || '0', 10),
        hash: row.hash || row['hash'] || undefined,
        flightIndex: row.flightIndex ? parseInt(row.flightIndex, 10) : undefined,
      };
    } catch {
      return null;
    }
  }

  static async parseManifestFromDir(inputDir: string): Promise<ManifestEntry[]> {
    const csvPath = path.join(inputDir, 'manifest.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error(`找不到清单文件: ${csvPath}`);
    }
    return this.parseManifest(csvPath);
  }

  static validateEntry(entry: ManifestEntry): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!entry.filename || entry.filename.trim() === '') {
      errors.push('文件名不能为空');
    }
    
    if (!entry.waypointId || entry.waypointId.trim() === '') {
      errors.push('航点ID不能为空');
    }
    
    if (!entry.timestamp || entry.timestamp.trim() === '') {
      errors.push('时间戳不能为空');
    }
    
    if (isNaN(entry.latitude) || entry.latitude === 0) {
      errors.push('纬度无效或为0');
    }
    
    if (isNaN(entry.longitude) || entry.longitude === 0) {
      errors.push('经度无效或为0');
    }
    
    if (entry.imageWidth <= 0 || entry.imageHeight <= 0) {
      errors.push('图像尺寸无效');
    }
    
    return { valid: errors.length === 0, errors };
  }
}
