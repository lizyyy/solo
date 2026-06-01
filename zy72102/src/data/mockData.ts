import type { SensorData, DeviceParams, FieldNote, ManualCorrection } from '../types';

export function generateMockSensorData(): SensorData[] {
  const data: SensorData[] = [];
  const startTime = Date.now() - 3600000;
  const interval = 1000;

  for (let i = 0; i < 3600; i++) {
    const t = i / 3600;
    const velocity = 15 + Math.sin(t * Math.PI * 4) * 8 + Math.random() * 2;
    const acceleration = Math.cos(t * Math.PI * 4) * 3 + Math.random() * 0.5;
    
    let temperature = 45 + Math.sin(t * Math.PI * 2) * 10 + Math.random() * 3;
    if (i > 1800 && i < 1850) {
      temperature = 75 + Math.random() * 10;
    }
    
    let vibration = 2.5 + Math.sin(t * Math.PI * 6) * 1.5 + Math.random() * 0.5;
    if (i > 2400 && i < 2420) {
      vibration = 12 + Math.random() * 3;
    }
    
    const pressure = 101.3 + Math.sin(t * Math.PI * 3) * 5 + Math.random() * 1;

    data.push({
      timestamp: startTime + i * interval,
      velocity,
      acceleration,
      temperature,
      vibration,
      pressure,
    });
  }

  return data;
}

export const defaultDeviceParams: DeviceParams = {
  id: 'default-001',
  name: '滑雪测试设备 A-01',
  mass: 75,
  slopeAngle: 15,
  frictionCoeff: 0.05,
  gravity: 9.81,
  normalTempMin: 35,
  normalTempMax: 65,
  vibrationThreshold: 5.0,
  updatedAt: Date.now(),
};

export const mockFieldNotes: FieldNote[] = [
  {
    id: 'note-001',
    timestamp: Date.now() - 1800000,
    content: '10:30 开始测试，坡道表面有轻微结冰，注意摩擦力变化',
    author: '何工',
    createdAt: Date.now(),
  },
  {
    id: 'note-002',
    timestamp: Date.now() - 1200000,
    content: '11:00 观测到速度波动，可能与风阻有关',
    author: '何工',
    createdAt: Date.now(),
  },
];

export const mockManualCorrections: ManualCorrection[] = [
  {
    id: 'corr-001',
    dataPointIndex: 1825,
    field: 'temperature',
    originalValue: 78.5,
    correctedValue: 68.5,
    reason: '传感器受到阳光直射，修正10度',
    author: '何工',
    createdAt: Date.now(),
  },
];
