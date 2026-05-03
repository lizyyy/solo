import {
  ParsedFrame,
  DeviceProfile,
  CalibrationRecord,
  BatchRecord,
  Issue,
  StationState,
  WeighingEvent,
  AnalysisResult,
  AnalysisSummary,
  IssueType,
} from '../types';

interface RuleContext {
  frames: ParsedFrame[];
  deviceProfiles: DeviceProfile[];
  calibrationRecords: CalibrationRecord[];
  batchRecords: BatchRecord[];
  currentTime: Date;
}

interface RuleResult {
  issues: Issue[];
  stationStates: Record<string, StationState>;
  weighingEvents: WeighingEvent[];
}

export function runAnalysis(context: RuleContext): AnalysisResult {
  const stationStates = initializeStationStates(context.deviceProfiles);
  const allIssues: Issue[] = [];
  const weighingEvents: WeighingEvent[] = [];
  
  const sortedFrames = [...context.frames].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const calibrationIssues = checkCalibrationExpiration(
    context.calibrationRecords,
    context.currentTime
  );
  allIssues.push(...calibrationIssues);

  const stationFrames = groupFramesByStation(sortedFrames);
  
  for (const [stationId, frames] of Object.entries(stationFrames)) {
    const state = stationStates[stationId];
    if (!state) continue;

    const profile = context.deviceProfiles.find(p => p.stationId === stationId);
    if (!profile) continue;

    const stationResult = processStationFrames(
      stationId,
      frames,
      state,
      profile,
      context
    );
    
    allIssues.push(...stationResult.issues);
    weighingEvents.push(...stationResult.events);
  }

  const midnightIssues = checkMidnightBatchMisalignment(
    weighingEvents,
    context.batchRecords
  );
  allIssues.push(...midnightIssues);

  const summary = buildSummary(
    sortedFrames,
    allIssues,
    weighingEvents,
    Object.keys(stationStates),
    context.currentTime
  );

  return {
    stationStates,
    issues: allIssues.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    weighingEvents,
    summary,
  };
}

function initializeStationStates(profiles: DeviceProfile[]): Record<string, StationState> {
  const states: Record<string, StationState> = {};
  
  for (const profile of profiles) {
    states[profile.stationId] = {
      stationId: profile.stationId,
      currentWeight: 0,
      stableWeight: null,
      tare: profile.tare,
      unit: profile.unit,
      lastStableTime: null,
      frames: [],
      consecutiveStable: 0,
    };
  }
  
  return states;
}

function groupFramesByStation(frames: ParsedFrame[]): Record<string, ParsedFrame[]> {
  const groups: Record<string, ParsedFrame[]> = {};
  
  for (const frame of frames) {
    if (!groups[frame.stationId]) {
      groups[frame.stationId] = [];
    }
    groups[frame.stationId].push(frame);
  }
  
  return groups;
}

function checkCalibrationExpiration(
  records: CalibrationRecord[],
  currentTime: Date
): Issue[] {
  const issues: Issue[] = [];
  const stationToLatestCal = new Map<string, CalibrationRecord>();

  for (const record of records) {
    const existing = stationToLatestCal.get(record.stationId);
    if (!existing || record.calibrationDate > existing.calibrationDate) {
      stationToLatestCal.set(record.stationId, record);
    }
  }

  for (const [stationId, cal] of stationToLatestCal) {
    if (currentTime > cal.expireDate) {
      issues.push({
        id: `issue_cal_exp_${Date.now()}_${stationId}`,
        type: 'calibration_expired',
        severity: 'critical',
        timestamp: currentTime,
        stationId,
        description: `Calibration for station ${stationId} has expired`,
        details: {
          calibrationDate: cal.calibrationDate.toISOString(),
          expireDate: cal.expireDate.toISOString(),
          certificateNumber: cal.certificateNumber,
          calibratedBy: cal.calibratedBy,
          daysOverdue: Math.floor((currentTime.getTime() - cal.expireDate.getTime()) / (1000 * 60 * 60 * 24)),
        },
      });
    }
  }

  return issues;
}

interface StationProcessResult {
  issues: Issue[];
  events: WeighingEvent[];
}

function processStationFrames(
  stationId: string,
  frames: ParsedFrame[],
  state: StationState,
  profile: DeviceProfile,
  context: RuleContext
): StationProcessResult {
  const issues: Issue[] = [];
  const events: WeighingEvent[] = [];
  let currentEventFrames: ParsedFrame[] = [];
  let eventStartTime: Date | null = null;
  let eventFirstStableWeight: number | null = null;

  for (const frame of frames) {
    if (frame.isDuplicate) continue;

    state.frames.push(frame);
    state.currentWeight = frame.weight;

    if (frame.status === 'stable') {
      state.consecutiveStable++;
      
      if (state.consecutiveStable >= 3) {
        state.stableWeight = frame.weight;
        state.lastStableTime = frame.timestamp;

        if (eventStartTime === null) {
          eventStartTime = frame.timestamp;
          eventFirstStableWeight = frame.weight;
        }
        currentEventFrames.push(frame);
      }
    } else {
      if (state.consecutiveStable >= 3 && currentEventFrames.length > 0 && eventStartTime && eventFirstStableWeight !== null) {
        const event = createWeighingEvent(
          stationId,
          eventStartTime,
          frame.timestamp,
          eventFirstStableWeight,
          state.tare,
          state.unit,
          currentEventFrames,
          context.batchRecords
        );
        events.push(event);
        
        const toleranceIssues = checkWeightTolerance(event, context.batchRecords);
        issues.push(...toleranceIssues);
      }

      state.consecutiveStable = 0;
      state.stableWeight = null;
      currentEventFrames = [];
      eventStartTime = null;
      eventFirstStableWeight = null;
    }

    const jumpIssue = checkWeightJump(frame, state, profile);
    if (jumpIssue) {
      issues.push(jumpIssue);
    }
  }

  if (currentEventFrames.length > 0 && eventStartTime && eventFirstStableWeight !== null) {
    const lastFrame = frames[frames.length - 1];
    const event = createWeighingEvent(
      stationId,
      eventStartTime,
      lastFrame.timestamp,
      eventFirstStableWeight,
      state.tare,
      state.unit,
      currentEventFrames,
      context.batchRecords
    );
    events.push(event);
    
    const toleranceIssues = checkWeightTolerance(event, context.batchRecords);
    issues.push(...toleranceIssues);
  }

  return { issues, events };
}

function checkWeightJump(
  frame: ParsedFrame,
  state: StationState,
  profile: DeviceProfile
): Issue | null {
  if (state.stableWeight === null) return null;
  
  const threshold = profile.tare > 0 ? profile.tare * 0.5 : 10;
  const jump = Math.abs(frame.weight - state.stableWeight);
  
  if (jump > threshold && frame.status === 'stable') {
    return {
      id: `issue_jump_${Date.now()}_${frame.timestamp.getTime()}`,
      type: 'weight_jump',
      severity: 'high',
      timestamp: frame.timestamp,
      stationId: frame.stationId,
      description: `Significant weight jump detected for station ${frame.stationId}`,
      details: {
        previousWeight: state.stableWeight,
        newWeight: frame.weight,
        jumpAmount: jump,
        threshold,
        unit: frame.unit,
      },
      relatedFrame: frame,
    };
  }
  
  return null;
}

function createWeighingEvent(
  stationId: string,
  startTime: Date,
  endTime: Date,
  stableWeight: number,
  tare: number,
  unit: string,
  frames: ParsedFrame[],
  batches: BatchRecord[]
): WeighingEvent {
  const batch = findBatchForEvent(stationId, startTime, endTime, batches);
  const netWeight = Math.max(0, stableWeight - tare);

  return {
    id: `event_${Date.now()}_${startTime.getTime()}`,
    stationId,
    batchId: batch?.batchId || null,
    startTime,
    endTime,
    stableWeight,
    netWeight,
    unit,
    frames,
    status: 'ok',
  };
}

function findBatchForEvent(
  stationId: string,
  startTime: Date,
  endTime: Date,
  batches: BatchRecord[]
): BatchRecord | null {
  for (const batch of batches) {
    if (batch.stationId !== stationId) continue;
    
    if (startTime >= batch.startTime && endTime <= batch.endTime) {
      return batch;
    }
  }
  return null;
}

function checkWeightTolerance(
  event: WeighingEvent,
  batches: BatchRecord[]
): Issue[] {
  const issues: Issue[] = [];
  
  if (!event.batchId) return issues;
  
  const batch = batches.find(b => b.batchId === event.batchId);
  if (!batch) return issues;

  const minWeight = batch.targetWeight + batch.toleranceMin;
  const maxWeight = batch.targetWeight + batch.toleranceMax;

  if (event.netWeight < minWeight || event.netWeight > maxWeight) {
    issues.push({
      id: `issue_tol_${Date.now()}_${event.startTime.getTime()}`,
      type: 'weight_out_of_tolerance',
      severity: 'high',
      timestamp: event.endTime,
      stationId: event.stationId,
      description: `Weight out of tolerance for batch ${event.batchId}`,
      details: {
        batchId: event.batchId,
        productName: batch.productName,
        targetWeight: batch.targetWeight,
        toleranceMin: batch.toleranceMin,
        toleranceMax: batch.toleranceMax,
        minAllowed: minWeight,
        maxAllowed: maxWeight,
        actualWeight: event.netWeight,
        deviation: event.netWeight - batch.targetWeight,
        unit: event.unit,
      },
    });
  }

  return issues;
}

function checkMidnightBatchMisalignment(
  events: WeighingEvent[],
  batches: BatchRecord[]
): Issue[] {
  const issues: Issue[] = [];
  
  for (const event of events) {
    const startHour = event.startTime.getHours();
    const endHour = event.endTime.getHours();
    
    if ((startHour >= 23 && endHour <= 1) || (startHour <= 1 && endHour >= 23)) {
      const assignedBatch = batches.find(b => b.batchId === event.batchId);
      
      const otherBatches = batches.filter(b => 
        b.stationId === event.stationId &&
        b.batchId !== event.batchId
      );
      
      const likelyBatch = otherBatches.find(b =>
        (event.startTime >= b.startTime && event.startTime <= b.endTime) ||
        (event.endTime >= b.startTime && event.endTime <= b.endTime)
      );
      
      issues.push({
        id: `issue_midnight_${Date.now()}_${event.startTime.getTime()}`,
        type: 'midnight_batch_misalignment',
        severity: 'medium',
        timestamp: event.startTime,
        stationId: event.stationId,
        description: `Event crosses midnight boundary - potential batch misalignment`,
        details: {
          eventStartTime: event.startTime.toISOString(),
          eventEndTime: event.endTime.toISOString(),
          assignedBatchId: event.batchId,
          assignedBatchName: assignedBatch?.productName,
          likelyBatchId: likelyBatch?.batchId || null,
          likelyBatchName: likelyBatch?.productName || null,
          weight: event.netWeight,
          unit: event.unit,
        },
      });
    }
  }
  
  return issues;
}

function buildSummary(
  frames: ParsedFrame[],
  issues: Issue[],
  events: WeighingEvent[],
  stations: string[],
  analysisTime: Date
): AnalysisSummary {
  const issuesByType: Record<IssueType, number> = {
    calibration_expired: 0,
    weight_jump: 0,
    duplicate_frame: 0,
    midnight_batch_misalignment: 0,
    bad_frame: 0,
    weight_out_of_tolerance: 0,
    unstable_reading: 0,
    missing_data: 0,
  };

  for (const issue of issues) {
    issuesByType[issue.type]++;
  }

  const validFrames = frames.filter(f => f.status !== 'error').length;
  const duplicateFrames = frames.filter(f => f.isDuplicate).length;

  return {
    totalFrames: frames.length,
    validFrames,
    invalidFrames: frames.length - validFrames,
    duplicateFrames,
    totalIssues: issues.length,
    issuesByType,
    weighingEvents: events.length,
    stationsAnalyzed: stations,
    analysisTime,
  };
}
