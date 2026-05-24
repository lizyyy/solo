import { DataCenter, TimeSeriesData, CameraView, RackStatus } from '../types';

const RACK_WIDTH = 0.6;
const RACK_DEPTH = 1.2;
const RACK_HEIGHT = 2.2;
const RACK_SPACING = 0.8;
const ROW_SPACING = 3.5;

const RACKS_PER_ROW = 8;
const NUM_ROWS = 4;

function generateId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(3, '0')}`;
}

function getStatusFromPower(power: number): RackStatus {
  if (power > 80) return 'critical';
  if (power > 60) return 'warning';
  if (power < 10) return 'offline';
  return 'normal';
}

export function generateSampleData(): {
  dataCenter: DataCenter;
  timeSeriesData: TimeSeriesData[];
  cameraViews: CameraView[];
} {
  const racks: DataCenter['racks'] = [];
  const rows: DataCenter['rows'] = [];

  for (let rowIdx = 0; rowIdx < NUM_ROWS; rowIdx++) {
    const rowId = generateId('row', rowIdx + 1);
    const rowRacks: string[] = [];
    const rowZ = rowIdx * ROW_SPACING - (NUM_ROWS * ROW_SPACING) / 2 + ROW_SPACING / 2;

    for (let rackIdx = 0; rackIdx < RACKS_PER_ROW; rackIdx++) {
      const rackId = generateId('rack', rowIdx * RACKS_PER_ROW + rackIdx + 1);
      const rackX = rackIdx * (RACK_WIDTH + RACK_SPACING) - (RACKS_PER_ROW * (RACK_WIDTH + RACK_SPACING)) / 2 + (RACK_WIDTH + RACK_SPACING) / 2;
      
      const basePower = 30 + rowIdx * 15 + Math.sin(rackIdx * 0.8) * 25;
      
      racks.push({
        id: rackId,
        name: `机柜 ${rowIdx + 1}-${rackIdx + 1}`,
        position: { x: rackX, y: RACK_HEIGHT / 2, z: rowZ },
        dimensions: { width: RACK_WIDTH, depth: RACK_DEPTH, height: RACK_HEIGHT },
        power: basePower,
        temperature: 22 + basePower * 0.35,
        status: getStatusFromPower(basePower),
        rowId,
        sensors: [
          {
            id: `${rackId}-temp-1`,
            type: 'temperature',
            value: 22 + basePower * 0.35,
            online: rackIdx !== 3 || rowIdx !== 1,
            lastUpdate: new Date().toISOString(),
          },
          {
            id: `${rackId}-power-1`,
            type: 'power',
            value: basePower,
            online: true,
            lastUpdate: new Date().toISOString(),
          },
        ],
      });
      
      rowRacks.push(rackId);
    }

    rows.push({
      id: rowId,
      name: `第 ${rowIdx + 1} 排`,
      position: { x: 0, z: rowZ },
      airDirection: rowIdx % 2 === 0 ? 'front-to-back' : 'back-to-front',
      racks: rowRacks,
    });
  }

  const acUnits: DataCenter['acUnits'] = [
    {
      id: 'ac-001',
      name: '精密空调 A1',
      position: { x: -10, z: 0 },
      direction: 'east',
      airflow: 8000,
      status: 'running',
    },
    {
      id: 'ac-002',
      name: '精密空调 A2',
      position: { x: 10, z: 0 },
      direction: 'west',
      airflow: 8000,
      status: 'running',
    },
  ];

  const dataCenter: DataCenter = {
    id: 'dc-001',
    name: '主数据中心 A 区',
    dimensions: { width: 25, depth: 18, height: 4 },
    rows,
    racks,
    acUnits,
  };

  const timeSeriesData: TimeSeriesData[] = [];
  const baseTime = Date.now() - 24 * 60 * 60 * 1000;
  
  for (let t = 0; t < 48; t++) {
    const timestamp = new Date(baseTime + t * 30 * 60 * 1000).toISOString();
    const timeRacks = racks.map((rack, rackIndex) => {
      const rowIdx = Math.floor(rackIndex / RACKS_PER_ROW);
      const rackIdx = rackIndex % RACKS_PER_ROW;
      
      let powerVariation = Math.sin(t * 0.3 + rackIdx * 0.5) * 15;
      
      if (rowIdx === 2 && rackIdx >= 4 && rackIdx <= 6 && t > 20) {
        powerVariation += 35 + (t - 20) * 2;
      }
      
      if (rowIdx === 0 && rackIdx === 2 && t > 30) {
        powerVariation = -30;
      }
      
      const power = Math.max(5, Math.min(100, 35 + rowIdx * 12 + Math.sin(rackIdx * 0.8) * 20 + powerVariation));
      const temperature = 22 + power * 0.35;
      
      return {
        id: rack.id,
        power,
        temperature,
        status: getStatusFromPower(power),
      };
    });

    const alerts: TimeSeriesData['alerts'] = [];
    timeRacks.forEach((r) => {
      if (r.status === 'critical') {
        alerts.push({
          id: `alert-${t}-${r.id}`,
          rackId: r.id,
          level: 'critical',
          message: `机柜功耗过高: ${r.power.toFixed(1)} kW`,
          timestamp,
          active: true,
        });
      } else if (r.status === 'warning') {
        alerts.push({
          id: `alert-${t}-${r.id}`,
          rackId: r.id,
          level: 'warning',
          message: `机柜功耗预警: ${r.power.toFixed(1)} kW`,
          timestamp,
          active: true,
        });
      } else if (r.status === 'offline') {
        alerts.push({
          id: `alert-${t}-${r.id}`,
          rackId: r.id,
          level: 'critical',
          message: '机柜设备离线',
          timestamp,
          active: true,
        });
      }
    });

    timeSeriesData.push({
      timestamp,
      racks: timeRacks,
      alerts,
    });
  }

  const cameraViews: CameraView[] = [
    {
      id: 'overview',
      name: '总览视角',
      position: [0, 15, 15],
      target: [0, 0, 0],
    },
    {
      id: 'front',
      name: '正面视角',
      position: [0, 5, 18],
      target: [0, 1, 0],
    },
    {
      id: 'side',
      name: '侧面视角',
      position: [18, 5, 0],
      target: [0, 1, 0],
    },
    {
      id: 'topdown',
      name: '俯视视角',
      position: [0, 20, 0.1],
      target: [0, 0, 0],
    },
    {
      id: 'hotzone',
      name: '热区特写',
      position: [2, 6, 2],
      target: [2, 1, -2],
    },
  ];

  return { dataCenter, timeSeriesData, cameraViews };
}

export const sampleData = generateSampleData();
