import { db } from '../db';
import type { ImportBatch, RawSample, SampleSource, Calibration } from '../types';
import { parseFile, type ParsedData, type ParseOptions } from '../utils/parsers';
import { createHistoryRecord } from './historyService';
import { DEFAULT_CALIBRATION } from '../core/torque';

export interface ImportResult {
  batchId: string;
  sampleCount: number;
  deviceId: string;
  duplicates: number;
  overlaps: string[];
}

export async function importDataFile(
  file: File,
  options: ParseOptions & {
    operator: string;
    calibration?: Calibration;
    relatedBatchId?: string;
  }
): Promise<ImportResult> {
  const { operator, relatedBatchId, ...parseOptions } = options;
  
  const parsed = await parseFile(file, parseOptions);
  
  return await importParsedData(parsed, {
    operator,
    source: options.source ?? 'direct',
    relatedBatchId,
    calibration: options.calibration
  });
}

export async function importParsedData(
  parsed: ParsedData,
  options: {
    operator: string;
    source: SampleSource;
    relatedBatchId?: string;
    calibration?: Calibration;
  }
): Promise<ImportResult> {
  const { operator, source, relatedBatchId, calibration = DEFAULT_CALIBRATION } = options;
  
  const importId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return await db.transaction('rw', db.importBatches, db.rawSamples, db.history, async () => {
    const existingBatches = await db.importBatches
      .where('deviceId')
      .equals(parsed.deviceId)
      .toArray();
    
    const overlaps: string[] = [];
    const parsedStart = Math.min(...parsed.samples.map(s => s.timestamp));
    const parsedEnd = Math.max(...parsed.samples.map(s => s.timestamp));
    
    for (const batch of existingBatches) {
      const batchSamples = await db.rawSamples
        .where('batchId')
        .equals(batch.id!)
        .toArray();
      
      if (batchSamples.length > 0) {
        const batchStart = Math.min(...batchSamples.map(s => s.timestamp));
        const batchEnd = Math.max(...batchSamples.map(s => s.timestamp));
        
        if (parsedStart <= batchEnd && parsedEnd >= batchStart) {
          overlaps.push(batch.id!);
        }
      }
    }
    
    const batch: ImportBatch = {
      deviceId: parsed.deviceId,
      fileName: parsed.fileName,
      sampleCount: parsed.samples.length,
      importedAt: Date.now(),
      importedBy: operator,
      source,
      relatedBatchId
    };
    
    const batchId = await db.importBatches.add(batch);
    const batchIdStr = String(batchId);
    
    let duplicates = 0;
    const rawSamples: Omit<RawSample, 'id'>[] = [];
    
    for (let i = 0; i < parsed.samples.length; i++) {
      const s = parsed.samples[i];
      
      const existing = await db.rawSamples
        .where('[deviceId+timestamp]')
        .equals([parsed.deviceId, s.timestamp])
        .first();
      
      if (existing && source !== 'supplement') {
        duplicates++;
        continue;
      }
      
      rawSamples.push({
        batchId: batchIdStr,
        importId,
        timestamp: s.timestamp,
        deviceId: parsed.deviceId,
        speed: s.speed,
        torqueRaw: s.torqueRaw,
        temperature: s.temperature,
        loadLevel: s.loadLevel,
        source,
        rawLineNumber: i + 1,
        createdAt: Date.now()
      });
    }
    
    if (rawSamples.length > 0) {
      await db.rawSamples.bulkAdd(rawSamples);
    }
    
    await createHistoryRecord(
      'batch',
      batchIdStr,
      'imported',
      operator,
      null,
      { batchId: batchIdStr, sampleCount: rawSamples.length, source, fileName: parsed.fileName }
    );
    
    return {
      batchId: batchIdStr,
      sampleCount: rawSamples.length,
      deviceId: parsed.deviceId,
      duplicates,
      overlaps
    };
  });
}

export async function getImportBatches(deviceId?: string): Promise<ImportBatch[]> {
  if (deviceId) {
    return db.importBatches
      .where('deviceId')
      .equals(deviceId)
      .reverse()
      .sortBy('importedAt');
  }
  return db.importBatches.orderBy('importedAt').reverse().toArray();
}

export async function deleteImportBatch(batchId: string, operator: string): Promise<void> {
  await db.transaction('rw', db.importBatches, db.rawSamples, db.history, async () => {
    const batch = await db.importBatches.get(batchId);
    if (!batch) return;
    
    const sampleCount = await db.rawSamples.where('batchId').equals(batchId).delete();
    
    await db.importBatches.delete(batchId);
    
    await createHistoryRecord(
      'batch',
      batchId,
      'deleted',
      operator,
      batch,
      null,
      `删除批次，包含 ${sampleCount} 条采样数据`
    );
  });
}
