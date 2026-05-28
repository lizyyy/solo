import type {
  VRSession,
  AccelerationSample,
  FrameSample,
  PoseSample,
  PlayerFeedback,
  CameraSegment,
  AnomalyEvent,
  SourceMaterial,
  RuleConfig,
  RiskScoreFormula,
} from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function gaussianNoise(std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * std;
}

export function generateAccelerationData(
  duration: number,
  sampleRate: number = 90
): AccelerationSample[] {
  const samples: AccelerationSample[] = [];
  const totalSamples = Math.floor(duration * sampleRate);

  for (let i = 0; i < totalSamples; i++) {
    const timestamp = i / sampleRate;
    const t = timestamp;

    let ax = gaussianNoise(0.1);
    let ay = 0.5 + gaussianNoise(0.1);
    let az = gaussianNoise(0.1);

    if (t > 10 && t < 15) {
      const intensity = Math.sin((t - 10) * Math.PI / 5) * 8;
      ax += intensity;
      az += intensity * 0.5;
    }

    if (t > 35 && t < 40) {
      const intensity = Math.sin((t - 35) * Math.PI / 5) * 12;
      ay += intensity;
    }

    if (t > 55 && t < 60) {
      const intensity = Math.sin((t - 55) * Math.PI / 5) * 6;
      ax += intensity * 0.8;
      ay += intensity * 0.6;
      az += intensity;
    }

    if (t > 80 && t < 85) {
      const intensity = Math.sin((t - 80) * Math.PI / 5) * 15;
      ax += intensity;
      ay += intensity * 0.3;
    }

    const wx = gaussianNoise(0.05) + (t > 20 && t < 25 ? Math.sin(t * 4) * 0.8 : 0);
    const wy = gaussianNoise(0.05);
    const wz = gaussianNoise(0.05) + (t > 45 && t < 52 ? Math.sin(t * 3) * 0.6 : 0);

    const jx = i > 0 ? ax - samples[samples.length - 1].linearAccel.x : 0;
    const jy = i > 0 ? ay - samples[samples.length - 1].linearAccel.y : 0;
    const jz = i > 0 ? az - samples[samples.length - 1].linearAccel.z : 0;

    const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);

    samples.push({
      timestamp,
      linearAccel: { x: ax, y: ay, z: az },
      angularVel: { x: wx, y: wy, z: wz },
      jerk: { x: jx, y: jy, z: jz },
      magnitude,
    });
  }

  return samples;
}

export function generateFrameData(duration: number, sampleRate: number = 30): FrameSample[] {
  const samples: FrameSample[] = [];
  const totalSamples = Math.floor(duration * sampleRate);

  for (let i = 0; i < totalSamples; i++) {
    const timestamp = i / sampleRate;
    const t = timestamp;

    let fps = 90 + gaussianNoise(2);
    let droppedFrames = 0;

    if (t > 12 && t < 14) {
      fps = 30 + gaussianNoise(5);
      droppedFrames = Math.floor(Math.random() * 5) + 2;
    }

    if (t > 37 && t < 39) {
      fps = 45 + gaussianNoise(8);
      droppedFrames = Math.floor(Math.random() * 3) + 1;
    }

    if (t > 58 && t < 59) {
      fps = 15 + gaussianNoise(3);
      droppedFrames = Math.floor(Math.random() * 8) + 5;
    }

    if (Math.random() < 0.02) {
      fps = Math.max(20, fps - Math.random() * 40);
      droppedFrames++;
    }

    samples.push({
      timestamp,
      fps: clamp(Math.round(fps), 10, 120),
      frameTime: 1000 / fps,
      droppedFrames,
    });
  }

  return samples;
}

export function generatePoseData(duration: number, sampleRate: number = 60): PoseSample[] {
  const samples: PoseSample[] = [];
  const totalSamples = Math.floor(duration * sampleRate);

  let basePitch = 0;
  let baseYaw = 0;
  let baseRoll = 0;

  for (let i = 0; i < totalSamples; i++) {
    const timestamp = i / sampleRate;
    const t = timestamp;

    basePitch += gaussianNoise(0.5);
    baseYaw += gaussianNoise(0.8);
    baseRoll += gaussianNoise(0.2);

    basePitch = clamp(basePitch, -45, 45);
    baseYaw = clamp(baseYaw, -180, 180);
    baseRoll = clamp(baseRoll, -15, 15);

    let pitch = basePitch + gaussianNoise(0.3);
    let yaw = baseYaw + gaussianNoise(0.3);
    let roll = baseRoll + gaussianNoise(0.1);

    if (t > 22 && t < 23) {
      pitch += Math.random() * 30 - 15;
      yaw += Math.random() * 40 - 20;
    }

    if (t > 48 && t < 48.5) {
      roll += Math.random() * 20 - 10;
    }

    const px = Math.sin(t * 0.5) * 2 + gaussianNoise(0.05);
    const py = 1.6 + Math.sin(t * 0.3) * 0.2 + gaussianNoise(0.02);
    const pz = Math.cos(t * 0.5) * 2 + gaussianNoise(0.05);

    samples.push({
      timestamp,
      position: { x: px, y: py, z: pz },
      rotation: {
        pitch: clamp(pitch, -90, 90),
        yaw: yaw % 360,
        roll: clamp(roll, -45, 45),
      },
    });
  }

  return samples;
}

export function generatePlayerFeedback(sessionId: string): PlayerFeedback[] {
  return [
    {
      id: generateId(),
      sessionId,
      timestamp: 14.5,
      type: 'dizziness',
      severity: 3,
      description: '这里突然转得有点快，有点晕',
      syncOffset: -0.3,
    },
    {
      id: generateId(),
      sessionId,
      timestamp: 38.2,
      type: 'nausea',
      severity: 4,
      description: '上下颠簸太厉害，有点恶心',
      syncOffset: 0.8,
    },
    {
      id: generateId(),
      sessionId,
      timestamp: 59.0,
      type: 'discomfort',
      severity: 2,
      description: '画面卡了一下，有点不舒服',
      syncOffset: -0.5,
    },
    {
      id: generateId(),
      sessionId,
      timestamp: 82.5,
      type: 'dizziness',
      severity: 5,
      description: '这个加速太猛了，晕得厉害',
      syncOffset: 1.2,
    },
  ];
}

export function generateCameraSegments(sessionId: string, duration: number): CameraSegment[] {
  const segments: CameraSegment[] = [
    {
      id: generateId(),
      sessionId,
      startTime: 0,
      endTime: 25,
      segmentName: '开场漫游',
      levelName: '新手村',
      cameraMode: '跟随',
      movementType: '平滑移动',
      color: '#3B82F6',
    },
    {
      id: generateId(),
      sessionId,
      startTime: 25,
      endTime: 50,
      segmentName: '快速转场',
      levelName: '森林',
      cameraMode: '第一人称',
      movementType: '快速转向',
      color: '#10B981',
    },
    {
      id: generateId(),
      sessionId,
      startTime: 50,
      endTime: 75,
      segmentName: '颠簸路段',
      levelName: '山路',
      cameraMode: '载具',
      movementType: '高频振动',
      color: '#F59E0B',
    },
    {
      id: generateId(),
      sessionId,
      startTime: 75,
      endTime: duration,
      segmentName: '冲刺关卡',
      levelName: '赛道',
      cameraMode: '低角度',
      movementType: '剧烈加速',
      color: '#EF4444',
    },
  ];
  return segments;
}

export function generateSourceMaterials(): SourceMaterial[] {
  return [
    {
      id: generateId(),
      type: 'video',
      name: '游戏录制视频.mp4',
      url: '/videos/gameplay.mp4',
      startTime: 0,
      endTime: 100,
    },
    {
      id: generateId(),
      type: 'log',
      name: 'HMD日志.log',
      url: '/logs/hmd.log',
      startTime: 0,
      endTime: 100,
    },
    {
      id: generateId(),
      type: 'screenshot',
      name: '异常帧截图.png',
      url: '/screenshots/anomaly.png',
      startTime: 12.5,
      endTime: 12.5,
    },
    {
      id: generateId(),
      type: 'questionnaire',
      name: '玩家问卷.pdf',
      url: '/questionnaire/survey.pdf',
      startTime: 0,
      endTime: 0,
    },
    {
      id: generateId(),
      type: 'telemetry',
      name: '遥测数据包.json',
      url: '/telemetry/data.json',
      startTime: 0,
      endTime: 100,
    },
  ];
}

export function generateAnomalyEvents(
  sessionId: string,
  sourceMaterials: SourceMaterial[]
): AnomalyEvent[] {
  return [
    {
      id: generateId(),
      sessionId,
      startTime: 10,
      endTime: 15,
      peakTime: 12.5,
      type: 'high_accel',
      severity: 'high',
      riskScore: 78,
      confidence: 0.92,
      peakAcceleration: 8.5,
      avgAcceleration: 5.2,
      duration: 5,
      frequency: 0.5,
      dominantAxis: 'x',
      reviewStatus: 'pending',
      reviewNotes: '',
      reviewedBy: '',
      reviewedAt: 0,
      matchedRules: ['rule_accel_001', 'rule_jerk_001'],
      sourceMaterials: [sourceMaterials[0], sourceMaterials[2]],
    },
    {
      id: generateId(),
      sessionId,
      startTime: 22,
      endTime: 23,
      peakTime: 22.3,
      type: 'pose_jump',
      severity: 'medium',
      riskScore: 45,
      confidence: 0.65,
      peakAcceleration: 3.2,
      avgAcceleration: 2.1,
      duration: 1,
      frequency: 0,
      dominantAxis: 'y',
      reviewStatus: 'needs_review',
      reviewNotes: '姿态突跳但没有对应的加速度变化，可能是传感器噪声',
      reviewedBy: '',
      reviewedAt: 0,
      matchedRules: ['rule_pose_001'],
      sourceMaterials: [sourceMaterials[0], sourceMaterials[1]],
    },
    {
      id: generateId(),
      sessionId,
      startTime: 35,
      endTime: 40,
      peakTime: 37.5,
      type: 'high_accel',
      severity: 'critical',
      riskScore: 92,
      confidence: 0.95,
      peakAcceleration: 12.8,
      avgAcceleration: 8.4,
      duration: 5,
      frequency: 0.6,
      dominantAxis: 'y',
      reviewStatus: 'confirmed',
      reviewNotes: '已确认，垂直方向剧烈振动导致玩家不适',
      reviewedBy: 'analyst_01',
      reviewedAt: Date.now() - 86400000,
      matchedRules: ['rule_accel_001', 'rule_accel_002', 'rule_feedback_001'],
      sourceMaterials: sourceMaterials,
    },
    {
      id: generateId(),
      sessionId,
      startTime: 57.5,
      endTime: 59.5,
      peakTime: 58.2,
      type: 'fps_drop',
      severity: 'high',
      riskScore: 68,
      confidence: 0.88,
      peakAcceleration: 4.1,
      avgAcceleration: 2.8,
      duration: 2,
      frequency: 0,
      dominantAxis: 'combined',
      reviewStatus: 'pending',
      reviewNotes: '',
      reviewedBy: '',
      reviewedAt: 0,
      matchedRules: ['rule_fps_001'],
      sourceMaterials: [sourceMaterials[0], sourceMaterials[1]],
    },
    {
      id: generateId(),
      sessionId,
      startTime: 80,
      endTime: 85,
      peakTime: 82.5,
      type: 'player_reported',
      severity: 'critical',
      riskScore: 95,
      confidence: 1.0,
      peakAcceleration: 15.2,
      avgAcceleration: 10.1,
      duration: 5,
      frequency: 0.8,
      dominantAxis: 'x',
      reviewStatus: 'pending',
      reviewNotes: '',
      reviewedBy: '',
      reviewedAt: 0,
      matchedRules: ['rule_accel_002', 'rule_feedback_001'],
      sourceMaterials: sourceMaterials,
    },
  ];
}

export function generateMockSession(): {
  session: VRSession;
  accelerationData: AccelerationSample[];
  frameData: FrameSample[];
  poseData: PoseSample[];
  feedbackData: PlayerFeedback[];
  segmentData: CameraSegment[];
  anomalyData: AnomalyEvent[];
} {
  const sessionId = generateId();
  const duration = 100;
  const sourceMaterials = generateSourceMaterials();

  return {
    session: {
      id: sessionId,
      sessionName: '测试会话 - 关卡A',
      playerId: 'player_001',
      startTime: Date.now() - 3600000,
      duration,
      gameVersion: 'v1.2.3',
      importedAt: Date.now(),
      status: 'ready',
      accelerationDataId: generateId(),
      frameDataId: generateId(),
      poseDataId: generateId(),
      feedbackIds: [],
      segmentIds: [],
      anomalyIds: [],
    },
    accelerationData: generateAccelerationData(duration),
    frameData: generateFrameData(duration),
    poseData: generatePoseData(duration),
    feedbackData: generatePlayerFeedback(sessionId),
    segmentData: generateCameraSegments(sessionId, duration),
    anomalyData: generateAnomalyEvents(sessionId, sourceMaterials),
  };
}

export function generateMockSessionList(): VRSession[] {
  const sessions: VRSession[] = [];
  const names = ['关卡A - 新手教程', '关卡B - 森林探险', '关卡C - 山路竞速', '关卡D - 城市追逐', '关卡E - BOSS战'];

  for (let i = 0; i < 5; i++) {
    sessions.push({
      id: generateId(),
      sessionName: names[i],
      playerId: `player_${String(i + 1).padStart(3, '0')}`,
      startTime: Date.now() - (i + 1) * 3600000,
      duration: 90 + Math.random() * 30,
      gameVersion: `v1.2.${i}`,
      importedAt: Date.now() - i * 1800000,
      status: i === 3 ? 'processing' : 'ready',
      accelerationDataId: generateId(),
      frameDataId: generateId(),
      poseDataId: generateId(),
      feedbackIds: [generateId(), generateId()],
      segmentIds: [generateId(), generateId(), generateId(), generateId()],
      anomalyIds: [generateId(), generateId()],
    });
  }

  return sessions;
}

export function generateDefaultRules(): RuleConfig[] {
  return [
    {
      id: 'rule_accel_001',
      name: '高加速度阈值',
      description: '检测线性加速度超过安全阈值的时间段',
      category: 'acceleration',
      thresholds: {
        minValue: 5,
        maxValue: 20,
        duration: 0.5,
        consecutiveSamples: 10,
      },
      weight: 1.0,
      severityMapping: { low: 5, medium: 8, high: 12, critical: 16 },
      explanation: '根据VR晕动症研究文献，持续的高加速度（>5m/s²）是导致晕动的主要因素之一。阈值基于ISO 14500标准和现有行业最佳实践设定。',
      references: ['ISO 14500:2019', 'VR Motion Sickness Guidelines v2.1'],
      enabled: true,
      isPreset: true,
    },
    {
      id: 'rule_accel_002',
      name: '峰值加速度检测',
      description: '检测瞬时加速度峰值',
      category: 'acceleration',
      thresholds: {
        minValue: 10,
        duration: 0.1,
        consecutiveSamples: 3,
      },
      weight: 1.2,
      severityMapping: { low: 10, medium: 14, high: 18, critical: 22 },
      explanation: '瞬时的加速度冲击虽然持续时间短，但也会引发前庭系统的不适反应。',
      references: ['Oculus Comfort Rating Guidelines'],
      enabled: true,
      isPreset: true,
    },
    {
      id: 'rule_jerk_001',
      name: '加加速度阈值',
      description: '检测加速度的变化率（Jerk）',
      category: 'jerk',
      thresholds: {
        minValue: 15,
        duration: 0.3,
        consecutiveSamples: 5,
      },
      weight: 0.8,
      severityMapping: { low: 15, medium: 25, high: 35, critical: 50 },
      explanation: '加加速度（Jerk）反映了运动的平滑程度。人体对加速度的突变比恒定加速度更敏感。',
      references: ['Motion Sickness and Jerk: A Review'],
      enabled: true,
      isPreset: true,
    },
    {
      id: 'rule_fps_001',
      name: '帧率下降检测',
      description: '检测帧率低于目标值的情况',
      category: 'fps',
      thresholds: {
        maxValue: 60,
        duration: 0.5,
        consecutiveSamples: 10,
      },
      weight: 0.9,
      severityMapping: { low: 60, medium: 45, high: 30, critical: 15 },
      explanation: '低帧率会破坏视觉-前庭同步，是晕动症的重要诱因。目标帧率通常为90Hz。',
      references: ['VR Performance Best Practices'],
      enabled: true,
      isPreset: true,
    },
    {
      id: 'rule_pose_001',
      name: '姿态突跳检测',
      description: '检测头显姿态的异常突变',
      category: 'pose',
      thresholds: {
        minValue: 15,
        duration: 0.1,
        consecutiveSamples: 2,
      },
      weight: 0.7,
      severityMapping: { low: 10, medium: 20, high: 30, critical: 45 },
      explanation: '姿态数据的突然跳变可能是跟踪丢失或传感器噪声导致，但也会造成视觉上的不连续感。',
      references: ['HTC Vive Tracking Whitepaper'],
      enabled: true,
      isPreset: true,
    },
    {
      id: 'rule_feedback_001',
      name: '玩家反馈关联',
      description: '将玩家主观反馈与客观数据关联',
      category: 'feedback',
      thresholds: {
        minValue: 3,
      },
      weight: 1.5,
      severityMapping: { low: 2, medium: 3, high: 4, critical: 5 },
      explanation: '玩家的主观反馈是晕动症的最终判定依据。将客观数据与主观反馈关联可以提高模型准确性。',
      references: ['Subjective-Objective Correlation in VR Sickness'],
      enabled: true,
      isPreset: true,
    },
  ];
}

export function generateDefaultScoreFormula(): RiskScoreFormula {
  return {
    version: 'v1.0',
    description: '默认风险评分公式',
    components: [
      { ruleId: 'rule_accel_001', weight: 0.25, normalization: 'linear' },
      { ruleId: 'rule_accel_002', weight: 0.2, normalization: 'sqrt' },
      { ruleId: 'rule_jerk_001', weight: 0.15, normalization: 'linear' },
      { ruleId: 'rule_fps_001', weight: 0.15, normalization: 'log' },
      { ruleId: 'rule_pose_001', weight: 0.1, normalization: 'linear' },
      { ruleId: 'rule_feedback_001', weight: 0.15, normalization: 'linear' },
    ],
    explanation: `综合评分公式基于加权平均：
      1. 加速度因素权重最高（45%），是晕动的主要物理诱因
      2. 帧率和加加速度各占15%，反映视觉流畅度和运动平滑度
      3. 姿态突跳占10%，处理跟踪问题
      4. 玩家反馈占15%，主观反馈修正客观数据`,
  };
}
