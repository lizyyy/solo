import type { 
  RawSample, 
  AlignedSample, 
  Anomaly, 
  AnomalyType, 
  AnomalySeverity,
  OperationSegment 
} from '../types';

export const DEFAULT_TEMP_LIMIT = 125;
export const DEFAULT_TEMP_RISE_RATE_LIMIT = 2;
export const DEFAULT_SHIFT_THRESHOLD_MS = 50;

export function detectSamplingShiftAnomaly(
  alignedSamples: AlignedSample[],
  shiftOffset: number,
  shiftConfidence: number,
  thresholdMs: number = DEFAULT_SHIFT_THRESHOLD_MS
): Anomaly | null {
  if (Math.abs(shiftOffset) <= thresholdMs || shiftConfidence < 0.7) {
    return null;
  }
  
  const severity: AnomalySeverity = Math.abs(shiftOffset) > thresholdMs * 2 ? 'critical' : 'error';
  
  const affectedSampleIds = alignedSamples
    .filter(s => s.alignmentStatus === 'shifted')
    .map(s => s.id!);
  
  return {
    type: 'sampling_shift',
    severity,
    status: 'detected',
    deviceId: alignedSamples[0]?.deviceId ?? 'unknown',
    detectedAt: Date.now(),
    description: `检测到采样通道时间错位，偏移量 ${shiftOffset > 0 ? '+' : ''}${shiftOffset}ms`,
    detail: {
      shiftOffset,
      shiftConfidence
    },
    affectedSampleIds,
    affectedSegmentIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function detectTemperatureAnomalies(
  samples: AlignedSample[],
  tempLimit: number = DEFAULT_TEMP_LIMIT,
  riseRateLimit: number = DEFAULT_TEMP_RISE_RATE_LIMIT
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  if (samples.length < 2) return anomalies;
  
  let overLimitStart: number | null = null;
  let maxTempInPeriod = 0;
  const overLimitSamples: string[] = [];
  
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    
    if (sample.temperature > tempLimit) {
      if (overLimitStart === null) {
        overLimitStart = sample.timestamp;
        maxTempInPeriod = sample.temperature;
      } else {
        maxTempInPeriod = Math.max(maxTempInPeriod, sample.temperature);
      }
      overLimitSamples.push(sample.id!);
    } else if (overLimitStart !== null) {
      const duration = sample.timestamp - overLimitStart;
      
      if (duration >= 10000) {
        const severity: AnomalySeverity = duration > 60000 ? 'critical' : duration > 30000 ? 'error' : 'warning';
        
        anomalies.push({
          type: 'temp_over_limit',
          severity,
          status: 'detected',
          deviceId: sample.deviceId,
          detectedAt: Date.now(),
          description: `温度持续超过 ${tempLimit}°C，持续时间 ${(duration / 1000).toFixed(1)}s，最高温度 ${maxTempInPeriod.toFixed(1)}°C`,
          detail: {
            tempValue: maxTempInPeriod,
            tempLimit,
            tempDuration: duration
          },
          affectedSampleIds: [...overLimitSamples],
          affectedSegmentIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      
      overLimitStart = null;
      maxTempInPeriod = 0;
      overLimitSamples.length = 0;
    }
  }
  
  if (overLimitStart !== null) {
    const lastSample = samples[samples.length - 1];
    const duration = lastSample.timestamp - overLimitStart;
    
    if (duration >= 10000) {
      const severity: AnomalySeverity = duration > 60000 ? 'critical' : duration > 30000 ? 'error' : 'warning';
      
      anomalies.push({
        type: 'temp_over_limit',
        severity,
        status: 'detected',
        deviceId: lastSample.deviceId,
        detectedAt: Date.now(),
        description: `温度持续超过 ${tempLimit}°C，持续时间 ${(duration / 1000).toFixed(1)}s，最高温度 ${maxTempInPeriod.toFixed(1)}°C`,
        detail: {
          tempValue: maxTempInPeriod,
          tempLimit,
          tempDuration: duration
        },
        affectedSampleIds: [...overLimitSamples],
        affectedSegmentIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  }
  
  for (let i = 1; i < samples.length; i++) {
    const timeDiff = (samples[i].timestamp - samples[i - 1].timestamp) / 60000;
    if (timeDiff > 0) {
      const tempDiff = samples[i].temperature - samples[i - 1].temperature;
      const riseRate = tempDiff / timeDiff;
      
      if (riseRate > riseRateLimit) {
        anomalies.push({
          type: 'temp_over_limit',
          severity: 'warning',
          status: 'detected',
          deviceId: samples[i].deviceId,
          detectedAt: Date.now(),
          description: `温度上升速率过快：${riseRate.toFixed(2)}°C/min`,
          detail: {
            tempValue: samples[i].temperature,
            tempLimit,
            tempRiseRate: riseRate
          },
          affectedSampleIds: [samples[i - 1].id!, samples[i].id!],
          affectedSegmentIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    }
  }
  
  return anomalies;
}

export function detectMissingLoadAnomalies(
  rawSamples: RawSample[],
  alignedSamples: AlignedSample[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const missingRanges: Array<{ start: number; end: number; samples: string[] }> = [];
  
  let currentRange: { start: number; end: number; samples: string[] } | null = null;
  
  for (let i = 0; i < rawSamples.length; i++) {
    const raw = rawSamples[i];
    const aligned = alignedSamples[i];
    
    if (raw.loadLevel === undefined || raw.loadLevel === null) {
      if (currentRange === null) {
        currentRange = {
          start: raw.timestamp,
          end: raw.timestamp,
          samples: [aligned.id!]
        };
      } else {
        currentRange.end = raw.timestamp;
        currentRange.samples.push(aligned.id!);
      }
    } else if (currentRange !== null) {
      if (currentRange.samples.length >= 3) {
        missingRanges.push(currentRange);
      }
      currentRange = null;
    }
  }
  
  if (currentRange !== null && currentRange.samples.length >= 3) {
    missingRanges.push(currentRange);
  }
  
  for (const range of missingRanges) {
    const firstSampleIdx = alignedSamples.findIndex(s => s.id === range.samples[0]);
    const inferredLevel = firstSampleIdx >= 0 ? alignedSamples[firstSampleIdx].loadLevel : 0;
    
    anomalies.push({
      type: 'missing_load',
      severity: 'warning',
      status: 'detected',
      deviceId: rawSamples[0]?.deviceId ?? 'unknown',
      detectedAt: Date.now(),
      description: `检测到 ${range.samples.length} 个采样点缺少负载档位，已自动推断为 ${inferredLevel} 档`,
      detail: {
        missingLoadRange: [range.start, range.end],
        inferredLoadLevel: inferredLevel,
        inferenceConfidence: 0.85
      },
      affectedSampleIds: range.samples,
      affectedSegmentIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
  
  return anomalies;
}

export function detectDuplicateDataAnomaly(
  batchId: string,
  existingBatchIds: string[]
): Anomaly | null {
  if (existingBatchIds.length === 0) return null;
  
  return {
    type: 'duplicate_data',
    severity: 'warning',
    status: 'detected',
    deviceId: 'unknown',
    detectedAt: Date.now(),
    description: `检测到重复导入数据，与已有批次 ${existingBatchIds.join(', ')} 存在时间重叠`,
    detail: {
      duplicateBatchIds: existingBatchIds
    },
    affectedSampleIds: [],
    affectedSegmentIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function detectSupplementDataAnomaly(
  batchId: string,
  supplementForBatchId: string
): Anomaly {
  return {
    type: 'supplement_data',
    severity: 'warning',
    status: 'detected',
    deviceId: 'unknown',
    detectedAt: Date.now(),
    description: `补录数据批次，用于补充批次 ${supplementForBatchId} 的缺失数据`,
    detail: {
      supplementBatchId: supplementForBatchId
    },
    affectedSampleIds: [],
    affectedSegmentIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function linkAnomaliesToSegments(
  anomalies: Anomaly[],
  segments: OperationSegment[]
): Anomaly[] {
  return anomalies.map(anomaly => {
    const affectedSegments = segments.filter(segment => {
      const segmentSampleSet = new Set(segment.sampleIds);
      return anomaly.affectedSampleIds.some(id => segmentSampleSet.has(id));
    });
    
    return {
      ...anomaly,
      affectedSegmentIds: affectedSegments.map(s => s.id!)
    };
  });
}

export function detectAllAnomalies(
  rawSamples: RawSample[],
  alignedSamples: AlignedSample[],
  segments: OperationSegment[],
  alignmentResult: { shiftOffset: number; shiftConfidence: number },
  options: {
    tempLimit?: number;
    tempRiseRateLimit?: number;
    shiftThresholdMs?: number;
  } = {}
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  const shiftAnomaly = detectSamplingShiftAnomaly(
    alignedSamples,
    alignmentResult.shiftOffset,
    alignmentResult.shiftConfidence,
    options.shiftThresholdMs
  );
  if (shiftAnomaly) anomalies.push(shiftAnomaly);
  
  const tempAnomalies = detectTemperatureAnomalies(
    alignedSamples,
    options.tempLimit,
    options.tempRiseRateLimit
  );
  anomalies.push(...tempAnomalies);
  
  const loadAnomalies = detectMissingLoadAnomalies(rawSamples, alignedSamples);
  anomalies.push(...loadAnomalies);
  
  return linkAnomaliesToSegments(anomalies, segments);
}
