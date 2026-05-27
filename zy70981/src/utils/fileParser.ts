import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { DataSourceType, LightAlarm, InspectionRecord, MaintenanceOrder, UnifiedRecord } from '../types';

export class FileParser {
  static async parseCSV(filePath: string, sourceType: DataSourceType): Promise<UnifiedRecord[]> {
    return new Promise((resolve, reject) => {
      const results: UnifiedRecord[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          try {
            const record = this.transformCSVRecord(data, sourceType);
            results.push(record);
          } catch (error) {
            console.warn('解析CSV行失败:', error);
          }
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  static parseJSON(filePath: string, sourceType: DataSourceType): UnifiedRecord[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    if (Array.isArray(data)) {
      return data.map((item, index) => this.transformJSONRecord(item, sourceType, index));
    }
    
    if (data.records && Array.isArray(data.records)) {
      return data.records.map((item: any, index: number) => 
        this.transformJSONRecord(item, sourceType, index)
      );
    }
    
    throw new Error('JSON文件格式不正确，应为数组或包含records数组的对象');
  }

  private static transformCSVRecord(data: any, sourceType: DataSourceType): UnifiedRecord {
    switch (sourceType) {
      case 'alarm':
        return {
          alarmId: data.alarmId || data.id || `CSV_ALARM_${Date.now()}_${Math.random()}`,
          poleId: data.poleId || data.杆号 || data.pole_id || '',
          lampId: data.lampId || data.灯号 || data.lamp_id || '',
          alarmTime: data.alarmTime || data.告警时间 || data.time || new Date().toISOString(),
          alarmType: data.alarmType || data.告警类型 || data.type || 'unknown',
          alarmLevel: (data.alarmLevel || data.告警级别 || data.level || 'low') as any,
          location: data.location || data.位置 || data.address || '',
          description: data.description || data.描述 || data.desc,
          source: data.source || data.来源 || 'CSV导入',
          ...data
        } as LightAlarm;

      case 'inspection':
        return {
          inspectionId: data.inspectionId || data.id || `CSV_INSP_${Date.now()}_${Math.random()}`,
          poleId: data.poleId || data.杆号 || data.pole_id || '',
          lampId: data.lampId || data.灯号 || data.lamp_id,
          inspector: data.inspector || data.巡查员 || data.person || '',
          inspectionTime: data.inspectionTime || data.巡查时间 || data.time || new Date().toISOString(),
          status: (data.status || data.状态 || 'normal') as any,
          issues: data.issues ? data.issues.split(';') : (data.问题?.split(';') || []),
          location: data.location || data.位置 || data.address || '',
          remarks: data.remarks || data.备注 || data.note,
          ...data
        } as InspectionRecord;

      case 'maintenance':
        return {
          orderId: data.orderId || data.id || `CSV_MAINT_${Date.now()}_${Math.random()}`,
          poleId: data.poleId || data.杆号 || data.pole_id || '',
          lampId: data.lampId || data.灯号 || data.lamp_id,
          repairType: data.repairType || data.维修类型 || data.type || '',
          reporter: data.reporter || data.报修人 || data.report_by || '',
          reportTime: data.reportTime || data.报修时间 || data.time || new Date().toISOString(),
          repairTime: data.repairTime || data.维修时间,
          repairer: data.repairer || data.维修员,
          status: (data.status || data.状态 || 'pending') as any,
          materials: data.materials ? data.materials.split(';') : [],
          cost: data.cost ? parseFloat(data.cost) : undefined,
          location: data.location || data.位置 || data.address || '',
          remarks: data.remarks || data.备注 || data.note,
          ...data
        } as MaintenanceOrder;

      default:
        throw new Error(`未知的数据源类型: ${sourceType}`);
    }
  }

  private static transformJSONRecord(data: any, sourceType: DataSourceType, index: number): UnifiedRecord {
    const defaultId = `JSON_${sourceType.toUpperCase()}_${Date.now()}_${index}`;
    
    switch (sourceType) {
      case 'alarm':
        return {
          alarmId: data.alarmId || data.id || defaultId,
          poleId: data.poleId || '',
          lampId: data.lampId || '',
          alarmTime: data.alarmTime || data.time || new Date().toISOString(),
          alarmType: data.alarmType || data.type || 'unknown',
          alarmLevel: data.alarmLevel || data.level || 'low',
          location: data.location || '',
          description: data.description,
          source: data.source || 'JSON导入',
          ...data
        } as LightAlarm;

      case 'inspection':
        return {
          inspectionId: data.inspectionId || data.id || defaultId,
          poleId: data.poleId || '',
          lampId: data.lampId,
          inspector: data.inspector || '',
          inspectionTime: data.inspectionTime || data.time || new Date().toISOString(),
          status: data.status || 'normal',
          issues: data.issues || [],
          photos: data.photos || [],
          location: data.location || '',
          remarks: data.remarks,
          ...data
        } as InspectionRecord;

      case 'maintenance':
        return {
          orderId: data.orderId || data.id || defaultId,
          poleId: data.poleId || '',
          lampId: data.lampId,
          repairType: data.repairType || data.type || '',
          reporter: data.reporter || '',
          reportTime: data.reportTime || data.time || new Date().toISOString(),
          repairTime: data.repairTime,
          repairer: data.repairer,
          status: data.status || 'pending',
          beforePhotos: data.beforePhotos || [],
          afterPhotos: data.afterPhotos || [],
          materials: data.materials || [],
          cost: data.cost,
          location: data.location || '',
          remarks: data.remarks,
          ...data
        } as MaintenanceOrder;

      default:
        throw new Error(`未知的数据源类型: ${sourceType}`);
    }
  }

  static calculateFileHash(filePath: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    const content = fs.readFileSync(filePath);
    hash.update(content);
    return hash.digest('hex');
  }

  static getTempDir(): string {
    const tempDir = path.join(process.cwd(), 'temp', 'uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
  }

  static cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn('清理临时文件失败:', error);
    }
  }
}
