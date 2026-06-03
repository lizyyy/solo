import { QueueCalculationResult, WindowConfig, QuestionnaireRow, ManualCounterExample } from '../types';

const MINUTES_PER_HOUR = 60;

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
}

function isTimeInRange(timeMinutes: number, startStr: string, endStr: string): boolean {
  const start = parseTimeToMinutes(startStr);
  const end = parseTimeToMinutes(endStr);
  return timeMinutes >= start && timeMinutes < end;
}

function getTimestampMinutes(timestamp: Date): number {
  return timestamp.getHours() * MINUTES_PER_HOUR + timestamp.getMinutes();
}

export function calculateQueueMetrics(
  sampleId: string,
  windowNumber: number,
  timestamp: Date,
  arrivalCount: number,
  serviceTime: number,
  windowConfig: WindowConfig,
  questionnaireData?: QuestionnaireRow,
  manualData?: ManualCounterExample
): QueueCalculationResult {
  const timeMinutes = getTimestampMinutes(timestamp);
  const windowCapacity = windowConfig.capacity;
  
  let lunchBreakImpact = 0;
  let temporaryClosureImpact = 0;
  let queueOverflowImpact = 0;
  
  if (windowConfig.hasLunchBreak && windowConfig.lunchStartTime && windowConfig.lunchEndTime) {
    if (isTimeInRange(timeMinutes, windowConfig.lunchStartTime, windowConfig.lunchEndTime)) {
      lunchBreakImpact = 0.5;
    }
  }
  
  if (questionnaireData?.isTemporaryClosed) {
    temporaryClosureImpact = 0.8;
  } else if (questionnaireData?.hasBreak && questionnaireData.breakStartTime && questionnaireData.breakEndTime) {
    if (isTimeInRange(timeMinutes, questionnaireData.breakStartTime, questionnaireData.breakEndTime)) {
      temporaryClosureImpact = 0.6;
    }
  }
  
  const effectiveCapacity = Math.max(1, windowCapacity * (1 - lunchBreakImpact) * (1 - temporaryClosureImpact));
  
  const arrivalRate = arrivalCount;
  const serviceRate = effectiveCapacity * (MINUTES_PER_HOUR / Math.max(1, serviceTime));
  
  const rho = arrivalRate / serviceRate;
  
  let averageWaitTime = 0;
  let queueLength = 0;
  let isOverflow = false;
  
  if (rho < 1 && serviceRate > 0) {
    averageWaitTime = (rho / (serviceRate * (1 - rho))) * MINUTES_PER_HOUR;
    queueLength = (rho * rho) / (1 - rho);
  } else {
    isOverflow = true;
    averageWaitTime = 30;
    queueLength = 20;
  }
  
  if (questionnaireData?.queueOverflow) {
    queueOverflowImpact = 0.3;
    averageWaitTime *= (1 + queueOverflowImpact);
    queueLength *= 1.5;
    isOverflow = true;
  }
  
  let actualWaitTime = averageWaitTime;
  if (questionnaireData) {
    actualWaitTime = questionnaireData.actualWaitTime;
  } else if (manualData) {
    actualWaitTime = manualData.waitTime;
  }
  
  return {
    sampleId,
    windowNumber,
    timestamp,
    arrivalRate,
    serviceRate,
    averageWaitTime: Math.round(averageWaitTime * 100) / 100,
    actualWaitTime,
    queueLength: Math.round(queueLength),
    isOverflow,
    factors: {
      lunchBreakImpact: Math.round(lunchBreakImpact * 100) / 100,
      temporaryClosureImpact: Math.round(temporaryClosureImpact * 100) / 100,
      queueOverflowImpact: Math.round(queueOverflowImpact * 100) / 100,
    },
  };
}

export function calculateWindowLoad(windowConfig: WindowConfig, timestamp: Date): number {
  const timeMinutes = getTimestampMinutes(timestamp);
  let loadFactor = 1;
  
  if (windowConfig.hasLunchBreak && windowConfig.lunchStartTime && windowConfig.lunchEndTime) {
    if (isTimeInRange(timeMinutes, windowConfig.lunchStartTime, windowConfig.lunchEndTime)) {
      loadFactor = 0.5;
    }
  }
  
  if (!windowConfig.isActive) {
    loadFactor = 0;
  }
  
  return loadFactor;
}

export function isWindowOpen(windowConfig: WindowConfig, timestamp: Date): boolean {
  const timeMinutes = getTimestampMinutes(timestamp);
  
  if (!isTimeInRange(timeMinutes, windowConfig.startTime, windowConfig.endTime)) {
    return false;
  }
  
  if (windowConfig.hasLunchBreak && windowConfig.lunchStartTime && windowConfig.lunchEndTime) {
    if (isTimeInRange(timeMinutes, windowConfig.lunchStartTime, windowConfig.lunchEndTime)) {
      return false;
    }
  }
  
  return windowConfig.isActive;
}
