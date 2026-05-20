import * as fs from 'fs';
import csv from 'csv-parser';
import { RecordSource, PassengerRecord, DriverRecord, WarehouseRecord, RouteShift, ImageIndex } from '../types';

export async function parseCSV<T>(filePath: string): Promise<T[]> {
  const results: T[] = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: any) => results.push(data as T))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

export async function parseJSON<T>(filePath: string): Promise<T> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export function transformPassengerRecord(raw: Record<string, any>): PassengerRecord {
  return {
    id: raw.id || raw.记录编号 || `P${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
    itemName: raw.itemName || raw.物品名称 || '',
    description: raw.description || raw.物品描述 || '',
    date: raw.date || raw.遗失日期 || '',
    routeId: raw.routeId || raw.线路编号,
    shiftId: raw.shiftId || raw.班次编号,
    source: RecordSource.PASSENGER,
    passengerName: raw.passengerName || raw.乘客姓名 || '',
    passengerPhone: raw.passengerPhone || raw.乘客电话 || '',
    passengerId: raw.passengerId || raw.乘客身份证,
    claimDate: raw.claimDate || raw.认领日期
  };
}

export function transformDriverRecord(raw: Record<string, any>): DriverRecord {
  return {
    id: raw.id || raw.记录编号 || `D${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
    itemName: raw.itemName || raw.物品名称 || '',
    description: raw.description || raw.物品描述 || '',
    date: raw.date || raw.捡到日期 || '',
    routeId: raw.routeId || raw.线路编号,
    shiftId: raw.shiftId || raw.班次编号,
    source: RecordSource.DRIVER,
    driverName: raw.driverName || raw.司机姓名 || '',
    driverId: raw.driverId || raw.司机工号 || '',
    busNumber: raw.busNumber || raw.车牌号 || '',
    handoverDate: raw.handoverDate || raw.上交日期 || ''
  };
}

export function transformWarehouseRecord(raw: Record<string, any>): WarehouseRecord {
  return {
    id: raw.id || raw.记录编号 || `W${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
    itemName: raw.itemName || raw.物品名称 || '',
    description: raw.description || raw.物品描述 || '',
    date: raw.date || raw.入库日期 || '',
    routeId: raw.routeId || raw.线路编号,
    shiftId: raw.shiftId || raw.班次编号,
    source: RecordSource.WAREHOUSE,
    storageLocation: raw.storageLocation || raw.存放位置 || '',
    storageDate: raw.storageDate || raw.入库日期 || '',
    operator: raw.operator || raw.操作员 || ''
  };
}

export function transformRouteShift(raw: Record<string, any>): RouteShift {
  return {
    routeId: raw.routeId || raw.线路编号 || '',
    routeName: raw.routeName || raw.线路名称 || '',
    shiftId: raw.shiftId || raw.班次编号 || '',
    shiftTime: raw.shiftTime || raw.发车时间 || '',
    driverId: raw.driverId || raw.司机工号,
    busNumber: raw.busNumber || raw.车牌号
  };
}

export function transformImageIndex(raw: Record<string, any>): ImageIndex {
  return {
    itemId: raw.itemId || raw.物品编号 || '',
    imagePath: raw.imagePath || raw.图片路径 || '',
    uploadDate: raw.uploadDate || raw.上传日期 || '',
    source: (raw.source as RecordSource) || raw.来源 as RecordSource || RecordSource.WAREHOUSE
  };
}

export function calculateFileHash(content: Buffer): string {
  return require('crypto').createHash('md5').update(content).digest('hex');
}
