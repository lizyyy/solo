import { db } from '../db';
import type { 
  AlignedSample, 
  OperationSegment, 
  Anomaly,
  Calibration,
  RawSample 
} from '../types';
import { alignCurves } from '../core/alignment';
import { createSegments } from '../core/segmentation';
import { detectAllAnomalies, detectDuplicateDataAnomaly } from '../core/anomalyDetector';
import { DEFAULT_CALIBRATION } from '../core/torque';
import { createHistoryRecord } from './historyService';

export interface AnalysisResult {
  alignedSamples: AlignedSample[];
  segments: OperationSegment[];
  anomalies: Anomaly[];
  alignmentOffset: number;
  alignmentConfidence: number;
}

export interface AnalysisOptions {
  calibration?: Calibration;
  tempLimit?: number;
  tempRiseRateLimit?: number;
  shiftThresholdMs?: number;
  minSegmentDurationMs?: number;
  operator: string;
}

export async function runAnalysis(
  batchId: string,
  options: AnalysisOptions
): Promise<AnalysisResult> {
  const { 
    calibration = DEFAULT_CALIBRATION,
    tempLimit,
    tempRiseRateLimit,
    shiftThresholdMs,
    minSegmentDurationMs,
    operator
  } = options;
  
  return await db.transaction('rw', 
    db.rawSamples, 
    db.alignedSamples, 
    db.segments, 
    db.anomalies,
    db.history,
    async () => {
      const rawSamples = await db.rawSamples
        .where('batchId')
        .equals(batchId)
        .sortBy('timestamp');
      
      if (rawSamples.length === 0) {
        throw new Error('该批次没有采样数据');
      }
      
      await db.alignedSamples.where('rawSampleId').anyOf(rawSamples.map(s => s.id!)).delete();
      await db.segments.where('deviceId').equals(rawSamples[0].deviceId)
        .filter(seg => seg.startTime >= rawSamples[0].timestamp && seg.endTime <= rawSamples[rawSamples.length - 1].timestamp)
        .delete();
      await db.anomalies.where('deviceId').equals(rawSamples[0].deviceId)
        .filter(a => a.detectedAt >= rawSamples[0].timestamp && a.detectedAt <= rawSamples[rawSamples.length - 1].timestamp)
        .delete();
      
      const alignmentResult = alignCurves(rawSamples, calibration, shiftThresholdMs);
      
      const alignedSampleIds = await db.alignedSamples.bulkAdd(
        alignmentResult.alignedSamples.map(s => ({ ...s, id: undefined }))
      );
      
      const alignedSamplesWithIds = alignmentResult.alignedSamples.map((s, i) => ({
        ...s,
        id: String(alignedSampleIds[i])
      }));
      
      const segments = createSegments(alignedSamplesWithIds, minSegmentDurationMs);
      
      for (const segment of segments) {
        const segId = await db.segments.add({ ...segment, id: undefined });
        segment.id = String(segId);
        
        await db.alignedSamples
          .where('id')
          .anyOf(segment.sampleIds)
          .modify({ segmentId: segment.id });
      }
      
      const anomalies = detectAllAnomalies(
        rawSamples,
        alignedSamplesWithIds,
        segments,
        {
          shiftOffset: alignmentResult.shiftOffset,
          shiftConfidence: alignmentResult.shiftConfidence
        },
        { tempLimit, tempRiseRateLimit, shiftThresholdMs }
      );
      
      const batch = await db.importBatches.get(batchId);
      if (batch && batch.source === 'duplicate') {
        const dupAnomaly = detectDuplicateDataAnomaly(batchId, batch.relatedBatchId ? [batch.relatedBatchId] : []);
        if (dupAnomaly) {
          dupAnomaly.deviceId = rawSamples[0].deviceId;
          anomalies.push(dupAnomaly);
        }
      }
      
      for (const anomaly of anomalies) {
        const anomalyId = await db.anomalies.add({ ...anomaly, id: undefined });
        anomaly.id = String(anomalyId);
        
        for (const sampleId of anomaly.affectedSampleIds) {
          await db.alignedSamples
            .where('id')
            .equals(sampleId)
            .modify(s => {
              if (!s.anomalyIds.includes(anomaly.id!)) {
                s.anomalyIds.push(anomaly.id!);
              }
            });
        }
      }
      
      await createHistoryRecord(
        'batch',
        batchId,
        'updated',
        operator,
        null,
        { 
          action: 'analysis_completed',
          sampleCount: alignedSamplesWithIds.length,
          segmentCount: segments.length,
          anomalyCount: anomalies.length,
          alignmentOffset: alignmentResult.shiftOffset,
          alignmentConfidence: alignmentResult.shiftConfidence
        },
        '完成数据分析'
      );
      
      return {
        alignedSamples: alignedSamplesWithIds,
        segments,
        anomalies,
        alignmentOffset: alignmentResult.shiftOffset,
        alignmentConfidence: alignmentResult.shiftConfidence
      };
    }
  );
}

export async function getAnalysisData(
  deviceId: string,
  startTime: number,
  endTime: number
): Promise<{
  alignedSamples: AlignedSample[];
  segments: OperationSegment[];
  anomalies: Anomaly[];
}> {
  const [alignedSamples, segments, anomalies] = await Promise.all([
    db.alignedSamples
      .where('deviceId')
      .equals(deviceId)
      .filter(s => s.timestamp >= startTime && s.timestamp <= endTime)
      .sortBy('timestamp'),
    db.segments
      .where('deviceId')
      .equals(deviceId)
      .filter(s => s.endTime >= startTime && s.startTime <= endTime)
      .sortBy('startTime'),
    db.anomalies
      .where('deviceId')
      .equals(deviceId)
      .filter(a => a.detectedAt >= startTime && a.detectedAt <= endTime)
      .sortBy('detectedAt')
  ]);
  
  return { alignedSamples, segments, anomalies };
}

export async function getRawSamplesByBatch(batchId: string): Promise<RawSample[]> {
  return db.rawSamples
    .where('batchId')
    .equals(batchId)
    .sortBy('timestamp');
}

export async function runAnalysisForDevice(
  deviceId: string,
  options: Omit<AnalysisOptions, 'operator'> & { operator?: string }
): Promise<AnalysisResult> {
  const batches = await db.importBatches
    .where('deviceId')
    .equals(deviceId)
    .reverse()
    .sortBy('importedAt');
  
  if (batches.length === 0) {
    throw new Error('该设备没有导入的数据批次');
  }
  
  const latestBatch = batches[0];
  return runAnalysis(latestBatch.id!, {
    operator: options.operator || '系统自动',
    ...options
  });
}
