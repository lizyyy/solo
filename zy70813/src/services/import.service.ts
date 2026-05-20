import * as fs from 'fs';
import csv from 'csv-parser';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { VesselSchedule, Berth, TideRecord, ImportResult, ImportResultItem, ImportBatch } from '../types';
import { validateSchedule } from './validation.service';

const importBatches: Map<string, ImportBatch> = new Map();
const processedHashes: Set<string> = new Set();

export function generateRecordHash(record: Partial<VesselSchedule>): string {
  const hashData = [
    record.vesselImo,
    record.vesselName,
    record.arrivalTime,
    record.departureTime,
    record.berthId,
    record.draft
  ].join('|');
  
  return createHash('md5').update(hashData).digest('hex');
}

export function isDuplicate(hash: string): boolean {
  return processedHashes.has(hash);
}

export function parseCSV(filePath: string): Promise<Partial<VesselSchedule>[]> {
  return new Promise((resolve, reject) => {
    const results: Partial<VesselSchedule>[] = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        const schedule: Partial<VesselSchedule> = {
          vesselName: data.vesselName || data['船名'],
          vesselImo: data.vesselImo || data.imo || data['IMO编号'],
          vesselAgent: data.vesselAgent || data.agent || data['船代'],
          arrivalTime: data.arrivalTime || data.arrival || data['到港时间'],
          departureTime: data.departureTime || data.departure || data['离港时间'],
          berthId: data.berthId || data.berth || data['泊位ID'],
          draft: parseFloat(data.draft || data['吃水']) || 0,
          cargoType: data.cargoType || data['货种'],
          isPriority: (data.isPriority || data['优先级']) === 'true' || 
                      (data.isPriority || data['优先级']) === '是',
          confirmedByAgent: (data.confirmedByAgent || data['船代确认']) === 'true' ||
                           (data.confirmedByAgent || data['船代确认']) === '是'
        };
        results.push(schedule);
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

export function parseBerthsJSON(filePath: string): Promise<Berth[]> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err);
      try {
        const berths = JSON.parse(data);
        resolve(berths);
      } catch (e) {
        reject(e);
      }
    });
  });
}

export function parseTidesCSV(filePath: string): Promise<TideRecord[]> {
  return new Promise((resolve, reject) => {
    const results: TideRecord[] = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        results.push({
          date: data.date || data['日期'],
          time: data.time || data['时间'],
          height: parseFloat(data.height || data['潮高']) || 0,
          type: (data.type || data['潮型']) as 'HIGH' | 'LOW'
        });
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

export async function processImport(
  schedules: Partial<VesselSchedule>[],
  berths: Berth[],
  tides: TideRecord[]
): Promise<ImportResult> {
  const batchId = uuidv4();
  const normal: ImportResultItem[] = [];
  const pending: ImportResultItem[] = [];
  const failed: ImportResultItem[] = [];
  const recordHashes: string[] = [];
  let duplicates = 0;

  const existingSchedules: VesselSchedule[] = [];
  importBatches.forEach(batch => {
    batch.result.normal.forEach(item => {
      existingSchedules.push(item.record as VesselSchedule);
    });
    batch.result.pending.forEach(item => {
      if (item.record.status !== 'failed') {
        existingSchedules.push(item.record as VesselSchedule);
      }
    });
  });

  const currentBatchValidSchedules: VesselSchedule[] = [];

  for (const schedule of schedules) {
    const recordHash = generateRecordHash(schedule);
    recordHashes.push(recordHash);

    if (isDuplicate(recordHash)) {
      duplicates++;
      continue;
    }

    const fullSchedule: VesselSchedule = {
      vesselName: schedule.vesselName || '',
      vesselImo: schedule.vesselImo || '',
      vesselAgent: schedule.vesselAgent || '',
      arrivalTime: schedule.arrivalTime || '',
      departureTime: schedule.departureTime || '',
      berthId: schedule.berthId || '',
      draft: schedule.draft || 0,
      cargoType: schedule.cargoType || '',
      isPriority: schedule.isPriority || false,
      confirmedByAgent: schedule.confirmedByAgent || false,
      importHash: recordHash,
      batchId
    };

    const allSchedulesForValidation = [...existingSchedules, ...currentBatchValidSchedules];
    const validation = validateSchedule(fullSchedule, berths, tides, allSchedulesForValidation);
    fullSchedule.status = validation.status;

    const resultItem: ImportResultItem = {
      record: fullSchedule,
      originalData: { ...schedule },
      suggestions: validation.suggestions,
      errorReason: validation.errorReason
    };

    processedHashes.add(recordHash);

    if (validation.status !== 'failed') {
      currentBatchValidSchedules.push(fullSchedule);
    }

    switch (validation.status) {
      case 'normal':
        normal.push(resultItem);
        break;
      case 'pending':
        pending.push(resultItem);
        break;
      case 'failed':
        failed.push(resultItem);
        break;
    }
  }

  const result: ImportResult = {
    batchId,
    totalProcessed: schedules.length,
    normal,
    pending,
    failed,
    duplicates,
    importTime: new Date().toISOString()
  };

  importBatches.set(batchId, {
    batchId,
    importTime: result.importTime,
    recordHashes,
    result
  });

  return result;
}

export function getImportBatch(batchId: string): ImportBatch | undefined {
  return importBatches.get(batchId);
}

export function getAllBatches(): ImportBatch[] {
  return Array.from(importBatches.values());
}

export function clearBatch(batchId: string): boolean {
  const batch = importBatches.get(batchId);
  if (batch) {
    batch.recordHashes.forEach(hash => processedHashes.delete(hash));
    importBatches.delete(batchId);
    return true;
  }
  return false;
}