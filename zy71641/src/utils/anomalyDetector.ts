import { Anomaly, SwingFrame, SwingSession, Severity, AnomalyType } from '@/types';
import { computeAcceleration, computeStandardDeviation, findImpactFrame, computeFaceAngleChangeRate } from './swingMath';

const generateId = (): string => 
  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

interface DetectionConfig {
  jitterThreshold: number;
  angleChangeThreshold: number;
  maxFrameGap: number;
  sigmaMultiplier: number;
}

const defaultConfig: DetectionConfig = {
  jitterThreshold: 3,
  angleChangeThreshold: 900,
  maxFrameGap: 50,
  sigmaMultiplier: 3,
};

export const detectJitter = (frames: SwingFrame[], config: DetectionConfig = defaultConfig): Anomaly[] => {
  const anomalies: Anomaly[] = [];
  
  if (frames.length < 5) return anomalies;
  
  const accelerations = frames.map((_, i) => computeAcceleration(frames, i));
  const validAccels = accelerations.filter(a => !isNaN(a) && isFinite(a));
  const stdDev = computeStandardDeviation(validAccels);
  const mean = validAccels.reduce((a, b) => a + b, 0) / validAccels.length;
  const threshold = mean + config.sigmaMultiplier * stdDev;
  
  let jitterStart = -1;
  let consecutiveJitters = 0;
  
  for (let i = 2; i < frames.length - 2; i++) {
    const accel = Math.abs(accelerations[i]);
    
    if (accel > threshold) {
      if (jitterStart === -1) {
        jitterStart = i;
      }
      consecutiveJitters++;
    } else {
      if (jitterStart !== -1 && consecutiveJitters >= 3) {
        anomalies.push({
          anomalyId: generateId(),
          type: 'jitter',
          severity: consecutiveJitters > 10 ? 'high' : consecutiveJitters > 5 ? 'medium' : 'low',
          frameRange: { start: jitterStart, end: i - 1 },
          description: `检测到坐标抖动: 帧 ${jitterStart} - ${i - 1}，持续 ${consecutiveJitters} 帧，最大加速度 ${(Math.max(...accelerations.slice(jitterStart, i)) / 1000).toFixed(2)} m/s²`,
          isConfirmed: false,
          isFalsePositive: false,
          detectedAt: new Date(),
        });
      }
      jitterStart = -1;
      consecutiveJitters = 0;
    }
  }
  
  if (jitterStart !== -1 && consecutiveJitters >= 3) {
    anomalies.push({
      anomalyId: generateId(),
      type: 'jitter',
      severity: consecutiveJitters > 10 ? 'high' : consecutiveJitters > 5 ? 'medium' : 'low',
      frameRange: { start: jitterStart, end: frames.length - 1 },
      description: `检测到坐标抖动: 帧 ${jitterStart} - ${frames.length - 1}，持续 ${consecutiveJitters} 帧`,
      isConfirmed: false,
      isFalsePositive: false,
      detectedAt: new Date(),
    });
  }
  
  return anomalies;
};

export const detectFaceAngleReverse = (frames: SwingFrame[], config: DetectionConfig = defaultConfig): Anomaly[] => {
  const anomalies: Anomaly[] = [];
  
  if (frames.length < 10) return anomalies;
  
  const impactIndex = findImpactFrame(frames);
  const windowBefore = Math.max(0, impactIndex - 10);
  const windowAfter = Math.min(frames.length - 1, impactIndex + 10);
  
  const changeRateBefore = computeFaceAngleChangeRate(frames, windowBefore, impactIndex);
  const changeRateAfter = computeFaceAngleChangeRate(frames, impactIndex, windowAfter);
  
  if (changeRateBefore > config.angleChangeThreshold) {
    anomalies.push({
      anomalyId: generateId(),
      type: 'faceAngleReverse',
      severity: 'high',
      frameId: frames[impactIndex].frameId,
      frameRange: { start: windowBefore, end: impactIndex },
      description: `检测到杆面角异常: 击球前杆面角变化率 ${changeRateBefore.toFixed(1)}°/s，可能存在杆面角反向`,
      isConfirmed: false,
      isFalsePositive: false,
      detectedAt: new Date(),
    });
  }
  
  if (changeRateAfter > config.angleChangeThreshold) {
    anomalies.push({
      anomalyId: generateId(),
      type: 'faceAngleReverse',
      severity: 'medium',
      frameId: frames[impactIndex].frameId,
      frameRange: { start: impactIndex, end: windowAfter },
      description: `检测到杆面角异常: 击球后杆面角变化率 ${changeRateAfter.toFixed(1)}°/s`,
      isConfirmed: false,
      isFalsePositive: false,
      detectedAt: new Date(),
    });
  }
  
  for (let i = 1; i < frames.length; i++) {
    const prevAngle = frames[i - 1].faceAngle.z;
    const currAngle = frames[i].faceAngle.z;
    const delta = Math.abs(currAngle - prevAngle);
    
    if (delta > 45) {
      anomalies.push({
        anomalyId: generateId(),
        type: 'faceAngleReverse',
        severity: delta > 90 ? 'high' : 'medium',
        frameId: frames[i].frameId,
        frameRange: { start: i - 1, end: i },
        description: `帧 ${i} 杆面角突变 ${delta.toFixed(1)}°，可能存在反向`,
        isConfirmed: false,
        isFalsePositive: false,
        detectedAt: new Date(),
      });
    }
  }
  
  return anomalies;
};

export const detectImpactPointMissing = (session: SwingSession): Anomaly[] => {
  const anomalies: Anomaly[] = [];
  const frames = session.frames;
  
  if (frames.length === 0) {
    anomalies.push({
      anomalyId: generateId(),
      type: 'impactPointMissing',
      severity: 'high',
      description: '无挥杆帧数据，无法检测击球点',
      isConfirmed: false,
      isFalsePositive: false,
      detectedAt: new Date(),
    });
    return anomalies;
  }
  
  if (!session.impactPoint) {
    const impactIndex = findImpactFrame(frames);
    anomalies.push({
      anomalyId: generateId(),
      type: 'impactPointMissing',
      severity: 'high',
      frameId: frames[Math.min(impactIndex, frames.length - 1)].frameId,
      description: '击球点数据缺失，请补录击球点位置、杆面角和击球速度',
      isConfirmed: false,
      isFalsePositive: false,
      detectedAt: new Date(),
    });
  }
  
  const impactIndex = findImpactFrame(frames);
  const impactFrame = frames[impactIndex];
  
  if (impactFrame) {
    if (impactFrame.velocity === 0 || isNaN(impactFrame.velocity)) {
      anomalies.push({
        anomalyId: generateId(),
        type: 'impactPointMissing',
        severity: 'medium',
        frameId: impactFrame.frameId,
        description: `击球帧 (${impactIndex}) 速度数据异常`,
        isConfirmed: false,
        isFalsePositive: false,
        detectedAt: new Date(),
      });
    }
    
    if (Math.abs(impactFrame.faceAngle.z) === 0 && Math.abs(impactFrame.faceAngle.x) === 0) {
      anomalies.push({
        anomalyId: generateId(),
        type: 'impactPointMissing',
        severity: 'medium',
        frameId: impactFrame.frameId,
        description: `击球帧 (${impactIndex}) 杆面角数据缺失`,
        isConfirmed: false,
        isFalsePositive: false,
        detectedAt: new Date(),
      });
    }
  }
  
  return anomalies;
};

export const detectDataGap = (frames: SwingFrame[], config: DetectionConfig = defaultConfig): Anomaly[] => {
  const anomalies: Anomaly[] = [];
  
  for (let i = 1; i < frames.length; i++) {
    const gap = frames[i].timestamp - frames[i - 1].timestamp;
    
    if (gap > config.maxFrameGap) {
      anomalies.push({
        anomalyId: generateId(),
        type: 'dataGap',
        severity: gap > config.maxFrameGap * 3 ? 'high' : gap > config.maxFrameGap * 2 ? 'medium' : 'low',
        frameRange: { start: i - 1, end: i },
        description: `帧 ${i - 1} 与 ${i} 之间存在数据断层，时间间隔 ${gap}ms（阈值 ${config.maxFrameGap}ms）`,
        isConfirmed: false,
        isFalsePositive: false,
        detectedAt: new Date(),
      });
    }
  }
  
  return anomalies;
};

export const detectDataCompleteness = (session: SwingSession): number => {
  const frames = session.frames;
  if (frames.length === 0) return 0;
  
  let score = 0;
  const totalChecks = 5;
  
  if (frames.length >= 50) score += 1;
  else if (frames.length >= 30) score += 0.5;
  
  const validPositions = frames.filter(f => 
    !isNaN(f.position.x) && !isNaN(f.position.y) && !isNaN(f.position.z)
  ).length;
  if (validPositions === frames.length) score += 1;
  else if (validPositions >= frames.length * 0.8) score += 0.5;
  
  const validAngles = frames.filter(f => 
    !isNaN(f.faceAngle.x) && !isNaN(f.faceAngle.y) && !isNaN(f.faceAngle.z)
  ).length;
  if (validAngles === frames.length) score += 1;
  else if (validAngles >= frames.length * 0.8) score += 0.5;
  
  const validVelocities = frames.filter(f => !isNaN(f.velocity) && f.velocity > 0).length;
  if (validVelocities >= frames.length * 0.9) score += 1;
  else if (validVelocities >= frames.length * 0.7) score += 0.5;
  
  if (session.impactPoint) score += 1;
  else score += 0;
  
  return Math.round((score / totalChecks) * 100);
};

export const detectAllAnomalies = (session: SwingSession, config: DetectionConfig = defaultConfig): Anomaly[] => {
  const anomalies: Anomaly[] = [];
  
  anomalies.push(...detectJitter(session.frames, config));
  anomalies.push(...detectFaceAngleReverse(session.frames, config));
  anomalies.push(...detectImpactPointMissing(session));
  anomalies.push(...detectDataGap(session.frames, config));
  
  return anomalies;
};

export const getAnomalyTypeLabel = (type: AnomalyType): string => {
  const labels: Record<AnomalyType, string> = {
    jitter: '坐标抖动',
    faceAngleReverse: '杆面角反向',
    impactPointMissing: '击球点丢失',
    dataGap: '数据断层',
  };
  return labels[type];
};

export const getSeverityLabel = (severity: Severity): string => {
  const labels: Record<Severity, string> = {
    low: '低',
    medium: '中',
    high: '高',
  };
  return labels[severity];
};

export const getSeverityColor = (severity: Severity): string => {
  const colors: Record<Severity, string> = {
    low: 'golf-orange',
    medium: 'golf-orange',
    high: 'golf-red',
  };
  return colors[severity];
};
