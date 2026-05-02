import type { Sensor } from '../types';

const baseTime = Date.now();
const oneHour = 60 * 60 * 1000;

function generateNormalReadings(sensorId: string, startTime: number, count: number, baseTemp: number, baseHumidity: number): Sensor['readings'] {
  const readings: Sensor['readings'] = [];
  
  for (let i = 0; i < count; i++) {
    const timeOffset = i * (oneHour / count);
    readings.push({
      sensorId,
      timestamp: startTime + timeOffset,
      temperature: baseTemp + (Math.random() - 0.5) * 2,
      humidity: baseHumidity + (Math.random() - 0.5) * 5,
      isOnline: true,
    });
  }
  
  return readings;
}

function generateOverheatingReadings(sensorId: string, startTime: number, count: number): Sensor['readings'] {
  const readings: Sensor['readings'] = [];
  
  for (let i = 0; i < count; i++) {
    const timeOffset = i * (oneHour / count);
    const progress = i / count;
    const overheatTemp = 26 + progress * 8 + (Math.random() - 0.5) * 1;
    
    readings.push({
      sensorId,
      timestamp: startTime + timeOffset,
      temperature: overheatTemp,
      humidity: 50 + (Math.random() - 0.5) * 3,
      isOnline: true,
    });
  }
  
  return readings;
}

function generateOfflineReadings(sensorId: string, startTime: number, count: number): Sensor['readings'] {
  const readings: Sensor['readings'] = [];
  const offlineStart = Math.floor(count * 0.6);
  
  for (let i = 0; i < count; i++) {
    const timeOffset = i * (oneHour / count);
    const isOffline = i >= offlineStart;
    
    readings.push({
      sensorId,
      timestamp: startTime + timeOffset,
      temperature: isOffline ? 0 : 22 + (Math.random() - 0.5) * 1.5,
      humidity: isOffline ? 0 : 45 + (Math.random() - 0.5) * 5,
      isOnline: !isOffline,
    });
  }
  
  return readings;
}

export const sampleSensors: Sensor[] = [
  {
    id: 'sensor_f1_1',
    name: '1F-东北-A01',
    floorId: 'floor_1',
    zoneId: 'zone_f1_1',
    x: 25,
    y: 15,
    readings: generateNormalReadings('sensor_f1_1', baseTime - oneHour, 24, 23.5, 52),
  },
  {
    id: 'sensor_f1_2',
    name: '1F-东北-A02',
    floorId: 'floor_1',
    zoneId: 'zone_f1_1',
    x: 40,
    y: 20,
    readings: [
      ...generateNormalReadings('sensor_f1_2', baseTime - 2 * oneHour, 12, 23, 50),
      ...generateOverheatingReadings('sensor_f1_2', baseTime - oneHour, 24),
    ],
  },
  {
    id: 'sensor_f1_3',
    name: '1F-西北-B01',
    floorId: 'floor_1',
    zoneId: 'zone_f1_2',
    x: 75,
    y: 15,
    readings: generateNormalReadings('sensor_f1_3', baseTime - oneHour, 24, 22.5, 48),
  },
  {
    id: 'sensor_f1_4',
    name: '1F-西北-B02',
    floorId: 'floor_1',
    zoneId: 'zone_f1_2',
    x: 60,
    y: 25,
    readings: generateOfflineReadings('sensor_f1_4', baseTime - oneHour, 24),
  },
  {
    id: 'sensor_f1_5',
    name: '1F-东南-C01',
    floorId: 'floor_1',
    zoneId: 'zone_f1_3',
    x: 25,
    y: 45,
    readings: generateNormalReadings('sensor_f1_5', baseTime - oneHour, 24, 24, 55),
  },
  {
    id: 'sensor_f1_6',
    name: '1F-西南-D01',
    floorId: 'floor_1',
    zoneId: 'zone_f1_4',
    x: 75,
    y: 45,
    readings: generateNormalReadings('sensor_f1_6', baseTime - oneHour, 24, 23, 50),
  },
  {
    id: 'sensor_f2_1',
    name: '2F-美食A-01',
    floorId: 'floor_2',
    zoneId: 'zone_f2_1',
    x: 25,
    y: 15,
    readings: [
      ...generateNormalReadings('sensor_f2_1', baseTime - 3 * oneHour, 12, 24, 55),
      ...generateOverheatingReadings('sensor_f2_1', baseTime - 2 * oneHour, 48),
    ],
  },
  {
    id: 'sensor_f2_2',
    name: '2F-美食A-02',
    floorId: 'floor_2',
    zoneId: 'zone_f2_1',
    x: 35,
    y: 20,
    readings: generateNormalReadings('sensor_f2_2', baseTime - oneHour, 24, 25, 58),
  },
  {
    id: 'sensor_f2_3',
    name: '2F-美食B-01',
    floorId: 'floor_2',
    zoneId: 'zone_f2_2',
    x: 75,
    y: 15,
    readings: generateNormalReadings('sensor_f2_3', baseTime - oneHour, 24, 24.5, 56),
  },
  {
    id: 'sensor_f2_4',
    name: '2F-休闲区-01',
    floorId: 'floor_2',
    zoneId: 'zone_f2_3',
    x: 50,
    y: 45,
    readings: generateNormalReadings('sensor_f2_4', baseTime - oneHour, 24, 23.5, 52),
  },
  {
    id: 'sensor_f3_1',
    name: '3F-办公-01',
    floorId: 'floor_3',
    zoneId: 'zone_f3_1',
    x: 35,
    y: 20,
    readings: generateNormalReadings('sensor_f3_1', baseTime - oneHour, 24, 24, 45),
  },
  {
    id: 'sensor_f3_2',
    name: '3F-办公-02',
    floorId: 'floor_3',
    zoneId: 'zone_f3_1',
    x: 55,
    y: 30,
    readings: generateNormalReadings('sensor_f3_2', baseTime - oneHour, 24, 23.5, 48),
  },
  {
    id: 'sensor_f3_3',
    name: '3F-机房-01',
    floorId: 'floor_3',
    zoneId: 'zone_f3_3',
    x: 85,
    y: 45,
    readings: [
      ...generateNormalReadings('sensor_f3_3', baseTime - 4 * oneHour, 12, 22, 40),
      ...generateOverheatingReadings('sensor_f3_3', baseTime - 3 * oneHour, 72),
    ],
  },
  {
    id: 'sensor_f3_4',
    name: '3F-会议室-01',
    floorId: 'floor_3',
    zoneId: 'zone_f3_2',
    x: 85,
    y: 18,
    readings: generateNormalReadings('sensor_f3_4', baseTime - oneHour, 24, 23, 46),
  },
];
