import type {
  AccelerationSample,
  FrameSample,
  PoseSample,
  PlayerFeedback,
  RuleConfig,
  AnomalyEvent,
  AnomalyType,
  SeverityLevel,
  ReviewStatus,
  DominantAxis,
} from '../types';

interface DetectionResult {
  anomalies: AnomalyEvent[];
  processed: boolean;
}

interface WindowResult {
  startTime: number;
  endTime: number;
  peakTime: number;
  peakValue: number;
  avgValue: number;
  duration: number;
  samples: number;
}

function getSeverity(
  value: number,
  mapping: Record<SeverityLevel, number>
): SeverityLevel {
  if (value >= mapping.critical) return 'critical';
  if (value >= mapping.high) return 'high';
  if (value >= mapping.medium) return 'medium';
  return 'low';
}

function getDominantAxis(
  x: number,
  y: number,
  z: number
): DominantAxis {
  const max = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
  if (Math.abs(x) === max) return 'x';
  if (Math.abs(y) === max) return 'y';
  if (Math.abs(z) === max) return 'z';
  return 'combined';
}

function slidingWindowDetection(
  data: number[],
  timestamps: number[],
  threshold: number,
  minDuration: number,
  minSamples: number,
  isBelowThreshold: boolean = false
): WindowResult[] {
  const results: WindowResult[] = [];
  let inWindow = false;
  let windowStart = 0;
  let peakIndex = 0;
  let peakValue = 0;
  let sumValue = 0;
  let sampleCount = 0;

  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    const exceeds = isBelowThreshold ? value < threshold : value > threshold;

    if (exceeds && !inWindow) {
      inWindow = true;
      windowStart = i;
      peakIndex = i;
      peakValue = value;
      sumValue = value;
      sampleCount = 1;
    } else if (exceeds && inWindow) {
      sumValue += value;
      sampleCount++;
      if (isBelowThreshold ? value < peakValue : value > peakValue) {
        peakValue = value;
        peakIndex = i;
      }
    } else if (!exceeds && inWindow) {
      const duration = timestamps[i - 1] - timestamps[windowStart];
      if (duration >= minDuration && sampleCount >= minSamples) {
        results.push({
          startTime: timestamps[windowStart],
          endTime: timestamps[i - 1],
          peakTime: timestamps[peakIndex],
          peakValue,
          avgValue: sumValue / sampleCount,
          duration,
          samples: sampleCount,
        });
      }
      inWindow = false;
    }
  }

  if (inWindow) {
    const duration = timestamps[data.length - 1] - timestamps[windowStart];
    if (duration >= minDuration && sampleCount >= minSamples) {
      results.push({
        startTime: timestamps[windowStart],
        endTime: timestamps[data.length - 1],
        peakTime: timestamps[peakIndex],
        peakValue,
        avgValue: sumValue / sampleCount,
        duration,
        samples: sampleCount,
      });
    }
  }

  return results;
}

export function detectHighAcceleration(
  accelerationData: AccelerationSample[],
  rule: RuleConfig
): AnomalyEvent[] {
  if (!rule.enabled || rule.category !== 'acceleration') return [];

  const timestamps = accelerationData.map((s) => s.timestamp);
  const magnitudes = accelerationData.map((s) => s.magnitude);

  const windows = slidingWindowDetection(
    magnitudes,
    timestamps,
    rule.thresholds.minValue || 5,
    rule.thresholds.duration || 0.5,
    rule.thresholds.consecutiveSamples || 10
  );

  return windows.map((window, idx) => {
    const peakSample = accelerationData.find(
      (s) => Math.abs(s.timestamp - window.peakTime) < 0.01
    );
    const confidence = Math.min(1, (window.peakValue / (rule.thresholds.minValue || 5) - 1) * 0.5 + 0.5);

    return {
      id: `accel_${Date.now()}_${idx}`,
      sessionId: '',
      startTime: window.startTime,
      endTime: window.endTime,
      peakTime: window.peakTime,
      type: 'high_accel' as AnomalyType,
      severity: getSeverity(window.peakValue, rule.severityMapping),
      riskScore: 0,
      confidence,
      peakAcceleration: window.peakValue,
      avgAcceleration: window.avgValue,
      duration: window.duration,
      frequency: window.samples / window.duration,
      dominantAxis: peakSample
        ? getDominantAxis(
            peakSample.linearAccel.x,
            peakSample.linearAccel.y,
            peakSample.linearAccel.z
          )
        : 'combined',
      reviewStatus: (confidence < 0.7 ? 'needs_review' : 'pending') as ReviewStatus,
      reviewNotes: confidence < 0.7 ? '置信度较低，建议人工复核' : '',
      reviewedBy: '',
      reviewedAt: 0,
      matchedRules: [rule.id],
      sourceMaterials: [],
    };
  });
}

export function detectHighJerk(
  accelerationData: AccelerationSample[],
  rule: RuleConfig
): AnomalyEvent[] {
  if (!rule.enabled || rule.category !== 'jerk') return [];

  const timestamps = accelerationData.map((s) => s.timestamp);
  const jerkMagnitudes = accelerationData.map(
    (s) => Math.sqrt(s.jerk.x ** 2 + s.jerk.y ** 2 + s.jerk.z ** 2)
  );

  const windows = slidingWindowDetection(
    jerkMagnitudes,
    timestamps,
    rule.thresholds.minValue || 15,
    rule.thresholds.duration || 0.3,
    rule.thresholds.consecutiveSamples || 5
  );

  return windows.map((window, idx) => {
    const confidence = Math.min(1, (window.peakValue / (rule.thresholds.minValue || 15) - 1) * 0.3 + 0.7);

    return {
      id: `jerk_${Date.now()}_${idx}`,
      sessionId: '',
      startTime: window.startTime,
      endTime: window.endTime,
      peakTime: window.peakTime,
      type: 'high_jerk' as AnomalyType,
      severity: getSeverity(window.peakValue, rule.severityMapping),
      riskScore: 0,
      confidence,
      peakAcceleration: window.peakValue,
      avgAcceleration: window.avgValue,
      duration: window.duration,
      frequency: window.samples / window.duration,
      dominantAxis: 'combined',
      reviewStatus: (confidence < 0.7 ? 'needs_review' : 'pending') as ReviewStatus,
      reviewNotes: confidence < 0.7 ? '置信度较低，建议人工复核' : '',
      reviewedBy: '',
      reviewedAt: 0,
      matchedRules: [rule.id],
      sourceMaterials: [],
    };
  });
}

export function detectFpsDrop(
  frameData: FrameSample[],
  rule: RuleConfig
): AnomalyEvent[] {
  if (!rule.enabled || rule.category !== 'fps') return [];

  const timestamps = frameData.map((s) => s.timestamp);
  const fpsValues = frameData.map((s) => s.fps);

  const windows = slidingWindowDetection(
    fpsValues,
    timestamps,
    rule.thresholds.maxValue || 60,
    rule.thresholds.duration || 0.5,
    rule.thresholds.consecutiveSamples || 10,
    true
  );

  return windows.map((window, idx) => {
    const confidence = Math.min(1, ((rule.thresholds.maxValue || 60) / window.peakValue - 1) * 0.5 + 0.5);

    return {
      id: `fps_${Date.now()}_${idx}`,
      sessionId: '',
      startTime: window.startTime,
      endTime: window.endTime,
      peakTime: window.peakTime,
      type: 'fps_drop' as AnomalyType,
      severity: getSeverity(window.peakValue, rule.severityMapping),
      riskScore: 0,
      confidence,
      peakAcceleration: 0,
      avgAcceleration: 0,
      duration: window.duration,
      frequency: 0,
      dominantAxis: 'combined',
      reviewStatus: (confidence < 0.7 ? 'needs_review' : 'pending') as ReviewStatus,
      reviewNotes: confidence < 0.7 ? '置信度较低，建议人工复核' : '',
      reviewedBy: '',
      reviewedAt: 0,
      matchedRules: [rule.id],
      sourceMaterials: [],
    };
  });
}

export function detectPoseJump(
  poseData: PoseSample[],
  rule: RuleConfig
): AnomalyEvent[] {
  if (!rule.enabled || rule.category !== 'pose') return [];

  const diffs: { timestamp: number; delta: number }[] = [];
  for (let i = 1; i < poseData.length; i++) {
    const prev = poseData[i - 1];
    const curr = poseData[i];
    const deltaPitch = Math.abs(curr.rotation.pitch - prev.rotation.pitch);
    const deltaYaw = Math.abs(curr.rotation.yaw - prev.rotation.yaw);
    const deltaRoll = Math.abs(curr.rotation.roll - prev.rotation.roll);
    const maxDelta = Math.max(deltaPitch, deltaYaw, deltaRoll);

    diffs.push({
      timestamp: curr.timestamp,
      delta: maxDelta,
    });
  }

  const timestamps = diffs.map((d) => d.timestamp);
  const deltaValues = diffs.map((d) => d.delta);

  const windows = slidingWindowDetection(
    deltaValues,
    timestamps,
    rule.thresholds.minValue || 15,
    rule.thresholds.duration || 0.1,
    rule.thresholds.consecutiveSamples || 2
  );

  return windows.map((window, idx) => {
    const confidence = Math.min(1, (window.peakValue / (rule.thresholds.minValue || 15) - 1) * 0.3 + 0.5);

    return {
      id: `pose_${Date.now()}_${idx}`,
      sessionId: '',
      startTime: window.startTime,
      endTime: window.endTime,
      peakTime: window.peakTime,
      type: 'pose_jump' as AnomalyType,
      severity: getSeverity(window.peakValue, rule.severityMapping),
      riskScore: 0,
      confidence,
      peakAcceleration: 0,
      avgAcceleration: 0,
      duration: window.duration,
      frequency: 0,
      dominantAxis: 'combined',
      reviewStatus: 'needs_review' as ReviewStatus,
      reviewNotes: '姿态突跳需结合加速度数据复核，排除传感器噪声',
      reviewedBy: '',
      reviewedAt: 0,
      matchedRules: [rule.id],
      sourceMaterials: [],
    };
  });
}

export function detectFromFeedback(
  feedbacks: PlayerFeedback[],
  rule: RuleConfig
): AnomalyEvent[] {
  if (!rule.enabled || rule.category !== 'feedback') return [];

  return feedbacks
    .filter((fb) => fb.severity >= (rule.thresholds.minValue || 3))
    .map((fb, idx) => {
      return {
        id: `feedback_${Date.now()}_${idx}`,
        sessionId: fb.sessionId,
        startTime: fb.timestamp - 2,
        endTime: fb.timestamp + 1,
        peakTime: fb.timestamp,
        type: 'player_reported' as AnomalyType,
        severity: getSeverity(fb.severity, rule.severityMapping),
        riskScore: 0,
        confidence: 1.0,
        peakAcceleration: 0,
        avgAcceleration: 0,
        duration: 3,
        frequency: 0,
        dominantAxis: 'combined',
        reviewStatus: 'pending' as ReviewStatus,
        reviewNotes: fb.description,
        reviewedBy: '',
        reviewedAt: 0,
        matchedRules: [rule.id],
        sourceMaterials: [],
      };
    });
}

export function mergeOverlappingAnomalies(
  anomalies: AnomalyEvent[]
): AnomalyEvent[] {
  if (anomalies.length <= 1) return anomalies;

  const sorted = [...anomalies].sort((a, b) => a.startTime - b.startTime);
  const merged: AnomalyEvent[] = [];

  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    if (next.startTime <= current.endTime + 0.5) {
      current = {
        ...current,
        endTime: Math.max(current.endTime, next.endTime),
        peakTime: current.riskScore > next.riskScore ? current.peakTime : next.peakTime,
        riskScore: Math.max(current.riskScore, next.riskScore),
        confidence: Math.max(current.confidence, next.confidence),
        peakAcceleration: Math.max(current.peakAcceleration, next.peakAcceleration),
        severity: current.riskScore > next.riskScore ? current.severity : next.severity,
        matchedRules: [...new Set([...current.matchedRules, ...next.matchedRules])],
        reviewStatus:
          current.reviewStatus === 'needs_review' || next.reviewStatus === 'needs_review'
            ? 'needs_review'
            : current.reviewStatus,
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

export function runAnomalyDetection(
  accelerationData: AccelerationSample[],
  frameData: FrameSample[],
  poseData: PoseSample[],
  feedbacks: PlayerFeedback[],
  rules: RuleConfig[]
): DetectionResult {
  let anomalies: AnomalyEvent[] = [];

  const accelRule = rules.find((r) => r.id === 'rule_accel_001');
  const jerkRule = rules.find((r) => r.id === 'rule_jerk_001');
  const fpsRule = rules.find((r) => r.id === 'rule_fps_001');
  const poseRule = rules.find((r) => r.id === 'rule_pose_001');
  const feedbackRule = rules.find((r) => r.id === 'rule_feedback_001');

  if (accelRule) {
    anomalies = anomalies.concat(detectHighAcceleration(accelerationData, accelRule));
  }

  if (jerkRule) {
    anomalies = anomalies.concat(detectHighJerk(accelerationData, jerkRule));
  }

  if (fpsRule) {
    anomalies = anomalies.concat(detectFpsDrop(frameData, fpsRule));
  }

  if (poseRule) {
    anomalies = anomalies.concat(detectPoseJump(poseData, poseRule));
  }

  if (feedbackRule) {
    anomalies = anomalies.concat(detectFromFeedback(feedbacks, feedbackRule));
  }

  anomalies = mergeOverlappingAnomalies(anomalies);

  return {
    anomalies,
    processed: true,
  };
}
