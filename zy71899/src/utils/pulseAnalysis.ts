import type {
  PressureDataPoint,
  AnalysisConclusion,
  ThresholdLevel,
  ShiftRecord,
  WorkLog,
  WorkLogVersion,
  MaintenanceOrder,
  DataSource,
  SourceType,
} from '@/types';
import { THRESHOLDS } from '@/types';
import { parseWorkLogContent } from './changeDetection';

export function detectPressurePeaks(
  data: PressureDataPoint[],
  windowSize: number = 50,
  sensitivity: number = 0.8
): PressureDataPoint[] {
  if (data.length < windowSize) return [];

  const peaks: PressureDataPoint[] = [];

  for (let i = windowSize; i < data.length - windowSize; i++) {
    const currentPoint = data[i];
    const windowBefore = data.slice(i - windowSize, i);
    const windowAfter = data.slice(i + 1, i + windowSize + 1);

    const avgBefore = windowBefore.reduce((sum, p) => sum + p.pressure, 0) / windowSize;
    const avgAfter = windowAfter.reduce((sum, p) => sum + p.pressure, 0) / windowSize;

    const avgNeighbors = (avgBefore + avgAfter) / 2;
    const threshold = avgNeighbors * (1 + sensitivity * 0.1);

    if (currentPoint.pressure > threshold) {
      const isLocalMax = windowBefore.every((p) => p.pressure <= currentPoint.pressure) &&
        windowAfter.every((p) => p.pressure <= currentPoint.pressure);

      if (isLocalMax) {
        peaks.push(currentPoint);
      }
    }
  }

  return peaks;
}

export function getThresholdLevel(pressure: number): ThresholdLevel {
  for (const threshold of THRESHOLDS) {
    if (pressure >= threshold.min && pressure < threshold.max) {
      return threshold.level;
    }
  }
  return 'danger';
}

export function isThresholdCrossed(pressure: number): boolean {
  return pressure >= THRESHOLDS[1].min;
}

export function detectCrossThresholds(
  data: PressureDataPoint[],
  consecutivePoints: number = 3
): PressureDataPoint[] {
  const crossingPoints: PressureDataPoint[] = [];
  let consecutiveCount = 0;
  let lastCrossLevel: ThresholdLevel | null = null;

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const level = getThresholdLevel(point.pressure);
    const crossed = isThresholdCrossed(point.pressure);

    if (crossed) {
      consecutiveCount++;
      if (level !== lastCrossLevel) {
        consecutiveCount = 1;
        lastCrossLevel = level;
      }

      if (consecutiveCount >= consecutivePoints) {
        const alreadyAdded = crossingPoints.some(
          (p) => Math.abs(p.timestamp - point.timestamp) < 60000
        );
        if (!alreadyAdded) {
          crossingPoints.push(point);
        }
        consecutiveCount = 0;
      }
    } else {
      consecutiveCount = 0;
      lastCrossLevel = null;
    }
  }

  return crossingPoints;
}

export function alignDataByTime(
  sources: { data: PressureDataPoint[]; type: SourceType; id: string }[],
  startTime: number,
  endTime: number,
  intervalMs: number = 60000
): PressureDataPoint[] {
  const alignedData: PressureDataPoint[] = [];
  const numPoints = Math.ceil((endTime - startTime) / intervalMs);

  for (let i = 0; i < numPoints; i++) {
    const targetTime = startTime + i * intervalMs;
    let totalPressure = 0;
    let count = 0;
    let temperature: number | undefined;
    let flowRate: number | undefined;

    for (const source of sources) {
      const closestPoint = findClosestPoint(source.data, targetTime);
      if (closestPoint && Math.abs(closestPoint.timestamp - targetTime) < intervalMs * 2) {
        totalPressure += closestPoint.pressure;
        count++;
        if (closestPoint.temperature !== undefined) {
          temperature = closestPoint.temperature;
        }
        if (closestPoint.flowRate !== undefined) {
          flowRate = closestPoint.flowRate;
        }
      }
    }

    if (count > 0) {
      alignedData.push({
        timestamp: targetTime,
        pressure: totalPressure / count,
        temperature,
        flowRate,
      });
    }
  }

  return alignedData;
}

function findClosestPoint(
  data: PressureDataPoint[],
  targetTime: number
): PressureDataPoint | null {
  if (!data || data.length === 0) return null;

  let low = 0;
  let high = data.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (data[mid].timestamp === targetTime) {
      return data[mid];
    } else if (data[mid].timestamp < targetTime) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (low >= data.length) return data[data.length - 1];
  if (high < 0) return data[0];

  return Math.abs(data[high].timestamp - targetTime) <= Math.abs(data[low].timestamp - targetTime)
    ? data[high]
    : data[low];
}

export function extractPressureFromShiftRecord(record: ShiftRecord): PressureDataPoint[] {
  return record.pressureReadings.map((r) => ({
    timestamp: r.timestamp,
    pressure: r.pressure,
  }));
}

export function extractPressureFromWorkLog(version: WorkLogVersion): PressureDataPoint[] {
  if (version.parsedData && Array.isArray(version.parsedData)) {
    return version.parsedData;
  }
  if (version.content) {
    return parseWorkLogContent(version.content);
  }
  return [];
}

export function generateConclusions(
  crossingPoints: PressureDataPoint[],
  sources: {
    shiftRecords: ShiftRecord[];
    workLogs: WorkLog[];
    maintenanceOrders: MaintenanceOrder[];
  },
  analysisRunId: string
): AnalysisConclusion[] {
  const conclusions: AnalysisConclusion[] = [];

  for (const point of crossingPoints) {
    const { sourceType, sourceId, sourceVersion, sourceLine, description } = findSourceForPoint(
      point,
      sources
    );

    conclusions.push({
      id: `conc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      analysisRunId,
      timestamp: point.timestamp,
      pressure: point.pressure,
      thresholdCrossed: true,
      thresholdLevel: getThresholdLevel(point.pressure),
      sourceType,
      sourceId,
      sourceVersion,
      sourceLine,
      description,
      createdAt: Date.now(),
    });
  }

  return conclusions;
}

function findSourceForPoint(
  point: PressureDataPoint,
  sources: {
    shiftRecords: ShiftRecord[];
    workLogs: WorkLog[];
    maintenanceOrders: MaintenanceOrder[];
  }
): {
  sourceType: SourceType;
  sourceId: string;
  sourceVersion?: number;
  sourceLine?: number;
  description: string;
} {
  for (const log of sources.workLogs) {
    if (!log.versions || log.versions.length === 0) continue;
    for (const version of log.versions) {
      const parsedData = version.parsedData || (version.content ? parseWorkLogContent(version.content) : []);
      for (let i = 0; i < parsedData.length; i++) {
        const dataPoint = parsedData[i];
        if (Math.abs(dataPoint.timestamp - point.timestamp) < 30000) {
          return {
            sourceType: 'work_log',
            sourceId: log.id,
            sourceVersion: version.version,
            sourceLine: i + 1,
            description: `工况日志检测到压力异常，压力值 ${point.pressure.toFixed(2)} MPa，已跨阈值`,
          };
        }
      }
    }
  }

  for (const record of sources.shiftRecords) {
    for (const reading of record.pressureReadings) {
      if (Math.abs(reading.timestamp - point.timestamp) < 60000) {
        return {
          sourceType: 'shift_record',
          sourceId: record.id,
          description: `班组记录检测到压力异常，${reading.location} 压力值 ${point.pressure.toFixed(2)} MPa`,
        };
      }
    }
  }

  for (const order of sources.maintenanceOrders) {
    if (order.startTime <= point.timestamp && (order.endTime || Date.now()) >= point.timestamp) {
      return {
        sourceType: 'maintenance',
        sourceId: order.id,
        description: `维修期间检测到压力波动，压力值 ${point.pressure.toFixed(2)} MPa`,
      };
    }
  }

  return {
    sourceType: 'work_log',
    sourceId: sources.workLogs[0]?.id || sources.shiftRecords[0]?.id || 'unknown',
    description: `检测到压力异常，压力值 ${point.pressure.toFixed(2)} MPa`,
  };
}

export function createDataSource(
  analysisRunId: string,
  shiftRecords: ShiftRecord[],
  workLogs: WorkLog[],
  maintenanceOrders: MaintenanceOrder[],
  timeRangeStart: number,
  timeRangeEnd: number
): DataSource {
  return {
    id: `ds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    analysisRunId,
    shiftRecordIds: shiftRecords.map((r) => r.id),
    workLogIds: workLogs.map((l) => l.id),
    maintenanceOrderIds: maintenanceOrders.map((o) => o.id),
    timeRangeStart,
    timeRangeEnd,
  };
}

export function generateOverallResult(conclusions: AnalysisConclusion[]): string {
  if (conclusions.length === 0) {
    return '本次分析未检测到阈值跨档，压力运行正常';
  }

  const dangerCount = conclusions.filter((c) => c.thresholdLevel === 'danger').length;
  const warningCount = conclusions.filter((c) => c.thresholdLevel === 'warning').length;

  let result = `本次分析检测到 ${conclusions.length} 处阈值跨档：`;
  if (dangerCount > 0) {
    result += `危险阈值跨档 ${dangerCount} 处，`;
  }
  if (warningCount > 0) {
    result += `警戒阈值跨档 ${warningCount} 处，`;
  }
  result += '建议立即检修相关管线设备。';

  return result;
}
