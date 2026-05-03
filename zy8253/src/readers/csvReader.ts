import * as fs from 'fs';
import csv from 'csv-parser';
import { SlotTemperature, BatteryRegistry } from '../types';

export async function readCsvFile<T>(filePath: string): Promise<T[]> {
  const results: T[] = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: T) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

export async function readSlotTemperature(filePath: string): Promise<SlotTemperature[]> {
  const rawData = await readCsvFile<Record<string, string>>(filePath);
  return rawData.map((row, index) => ({
    timestamp: row.timestamp,
    cabinetId: row.cabinetId,
    slotId: parseInt(row.slotId, 10),
    temperature: row.temperature === '' || row.temperature === null ? null : parseFloat(row.temperature),
  }));
}

export async function readBatteryRegistry(filePath: string): Promise<BatteryRegistry[]> {
  const rawData = await readCsvFile<Record<string, string>>(filePath);
  return rawData.map((row) => ({
    batteryId: row.batteryId,
    model: row.model,
    manufacturer: row.manufacturer,
    productionDate: row.productionDate,
    capacity: parseInt(row.capacity, 10),
    status: row.status as 'active' | 'retired' | 'maintenance',
  }));
}
