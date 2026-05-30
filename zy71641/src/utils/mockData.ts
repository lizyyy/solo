import { SwingFrame, SwingSession, Vector3, Keyframe, Anomaly } from '@/types';
import { toRadians } from './swingMath';

const generateId = (): string => 
  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const generateSwingPath = (frameCount: number): Vector3[] => {
  const points: Vector3[] = [];
  const startHeight = 1.5;
  const backswingRadius = 1.2;
  const downswingRadius = 1.0;
  
  for (let i = 0; i < frameCount; i++) {
    const t = i / (frameCount - 1);
    let x, y, z;
    
    if (t < 0.4) {
      const backT = t / 0.4;
      const angle = Math.PI * 0.1 + backT * Math.PI * 0.8;
      x = Math.cos(angle) * backswingRadius - 0.5;
      y = startHeight + Math.sin(angle) * backswingRadius * 0.6;
      z = Math.sin(angle * 0.5) * 0.3;
    } else if (t < 0.75) {
      const downT = (t - 0.4) / 0.35;
      const angle = Math.PI * 0.9 - downT * Math.PI * 1.2;
      x = Math.cos(angle) * downswingRadius - 0.3;
      y = startHeight * 0.3 + Math.sin(angle) * downswingRadius * 0.4;
      z = downT * 0.2 - 0.1;
    } else {
      const followT = (t - 0.75) / 0.25;
      const angle = -Math.PI * 0.3 + followT * Math.PI * 0.6;
      x = Math.cos(angle) * 0.8 + 0.2;
      y = startHeight * 0.5 + followT * 0.8;
      z = 0.1 + followT * 0.3;
    }
    
    if (i === 20 || i === 21 || i === 22) {
      x += (Math.random() - 0.5) * 0.08;
      y += (Math.random() - 0.5) * 0.08;
      z += (Math.random() - 0.5) * 0.08;
    }
    
    points.push({ x, y, z });
  }
  
  return points;
};

const generateFaceAngles = (frameCount: number): Vector3[] => {
  const angles: Vector3[] = [];
  
  for (let i = 0; i < frameCount; i++) {
    const t = i / (frameCount - 1);
    let x = 0, y = 0, z = 0;
    
    if (t < 0.4) {
      const backT = t / 0.4;
      z = toRadians(30 - backT * 60);
      x = toRadians(10 - backT * 20);
    } else if (t < 0.75) {
      const downT = (t - 0.4) / 0.35;
      z = toRadians(-30 + downT * 25);
      x = toRadians(-10 + downT * 15);
    } else {
      const followT = (t - 0.75) / 0.25;
      z = toRadians(-5 + followT * 40);
      x = toRadians(5 + followT * 30);
    }
    
    if (i === 45) {
      z = toRadians(95);
    }
    
    angles.push({ x, y, z });
  }
  
  return angles;
};

const generateVelocities = (frameCount: number): number[] => {
  const velocities: number[] = [];
  
  for (let i = 0; i < frameCount; i++) {
    const t = i / (frameCount - 1);
    let v;
    
    if (t < 0.4) {
      v = 5 + t * 15;
    } else if (t < 0.75) {
      const downT = (t - 0.4) / 0.35;
      v = 20 + downT * 30;
    } else {
      const followT = (t - 0.75) / 0.25;
      v = 50 - followT * 30;
    }
    
    velocities.push(v);
  }
  
  return velocities;
};

export const generateMockFrames = (frameCount: number = 80): SwingFrame[] => {
  const positions = generateSwingPath(frameCount);
  const faceAngles = generateFaceAngles(frameCount);
  const velocities = generateVelocities(frameCount);
  const frames: SwingFrame[] = [];
  
  for (let i = 0; i < frameCount; i++) {
    const timestamp = i * 16.67;
    const prevV = i > 0 ? velocities[i - 1] : 0;
    const acceleration = (velocities[i] - prevV) / (16.67 / 1000);
    
    frames.push({
      frameId: generateId(),
      timestamp,
      position: positions[i],
      faceAngle: faceAngles[i],
      velocity: velocities[i],
      acceleration,
    });
  }
  
  return frames;
};

export const generateMockSession = (studentName: string = '学员张三'): SwingSession => {
  const frames = generateMockFrames(80);
  const impactIndex = Math.floor(frames.length * 0.7);
  
  const keyframes: Keyframe[] = [
    {
      keyframeId: generateId(),
      frameId: frames[0].frameId,
      label: '上杆顶点',
      color: '#00AAFF',
      note: '上杆至顶点位置，注意左肩转动',
      createdAt: new Date(),
    },
    {
      keyframeId: generateId(),
      frameId: frames[impactIndex].frameId,
      label: '击球瞬间',
      color: '#00FF88',
      note: '击球瞬间，杆面角度正常',
      createdAt: new Date(),
    },
    {
      keyframeId: generateId(),
      frameId: frames[frames.length - 1].frameId,
      label: '收杆结束',
      color: '#FF8800',
      note: '收杆平衡良好',
      createdAt: new Date(),
    },
  ];
  
  const anomalies: Anomaly[] = [];
  
  const session: SwingSession = {
    sessionId: generateId(),
    studentName,
    recordedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    importedAt: new Date(),
    importSource: 'TrackMan 4',
    dataFingerprint: '',
    dataCompleteness: 85,
    frames,
    impactPoint: {
      position: { ...frames[impactIndex].position },
      faceAngle: 2.5,
      velocity: 48.5,
    },
    metadata: {
      club: '7号铁',
      target: '150码',
      conditions: '晴朗，无风',
    },
    supplements: [],
    versions: [],
    anomalies,
    keyframes,
    status: 'draft',
  };
  
  return session;
};

export const generateMockSessions = (count: number = 5): SwingSession[] => {
  const names = ['学员张三', '学员李四', '学员王五', '学员赵六', '学员钱七'];
  return names.slice(0, count).map(name => generateMockSession(name));
};

export const generateDuplicateSession = (original: SwingSession): SwingSession => {
  return {
    ...original,
    sessionId: generateId(),
    importedAt: new Date(),
    importSource: original.importSource,
    versions: [],
    supplements: [],
  };
};

export const generateUpdatedSession = (original: SwingSession): SwingSession => {
  const updatedFrames = original.frames.map((frame, i) => ({
    ...frame,
    velocity: frame.velocity + (Math.random() - 0.5) * 2,
  }));
  
  return {
    ...original,
    sessionId: generateId(),
    importedAt: new Date(),
    importSource: `${original.importSource} (更新)`,
    frames: updatedFrames,
    versions: [],
    supplements: [],
    metadata: {
      ...original.metadata,
      updated: true,
    },
  };
};

export const generateConflictSession = (original: SwingSession): SwingSession => {
  const impactIndex = Math.floor(original.frames.length * 0.7);
  
  return {
    ...original,
    sessionId: generateId(),
    importedAt: new Date(),
    importSource: `${original.importSource} (冲突)`,
    impactPoint: original.impactPoint ? {
      ...original.impactPoint,
      faceAngle: original.impactPoint.faceAngle + 15,
      velocity: original.impactPoint.velocity - 10,
    } : undefined,
    frames: original.frames.map((frame, i) => ({
      ...frame,
      velocity: i === impactIndex ? frame.velocity - 15 : frame.velocity,
    })),
    versions: [],
    supplements: [],
  };
};
