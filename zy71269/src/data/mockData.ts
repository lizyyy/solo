import { ChipPackage } from '../types';

export const mockChipPackage: ChipPackage = {
  id: 'chip-001',
  name: 'AI Accelerator Chip v2.0',
  dimensions: { width: 4, height: 0.5, depth: 4 },
  powerPoints: [
    {
      id: 'pp-001', name: 'CPU Core 0', position: { x: -1.2, y: 0.25, z: -1.2 },
      power: 25, temperature: 85, status: 'warning'
    },
    {
      id: 'pp-002', name: 'CPU Core 1', position: { x: 1.2, y: 0.25, z: -1.2 },
      power: 28, temperature: 92, status: 'critical'
    },
    {
      id: 'pp-003', name: 'GPU Core', position: { x: 0, y: 0.25, z: 0 },
      power: 45, temperature: 105, status: 'critical'
    },
    {
      id: 'pp-004', name: 'Memory Controller', position: { x: -1.5, y: 0.25, z: 1 },
      power: 12, temperature: 68, status: 'normal'
    },
    {
      id: 'pp-005', name: 'PCIe Controller', position: { x: 1.5, y: 0.25, z: 1 },
      power: 8, temperature: 62, status: 'normal'
    },
    {
      id: 'pp-006', name: 'NPU Engine', position: { x: 0, y: 0.25, z: -1.5 },
      power: 35, temperature: 98, status: 'critical'
    }
  ],
  tempSensors: [
    {
      id: 'ts-001', name: 'Sensor A1', position: { x: -1, y: 0.26, z: -1 },
      temperature: 78, isMissing: false,
      expectedLocation: 'Top-Left', lastCalibration: '2024-01-15'
    },
    {
      id: 'ts-002', name: 'Sensor A2', position: { x: 1, y: 0.26, z: -1 },
      temperature: 88, isMissing: false,
      expectedLocation: 'Top-Right', lastCalibration: '2024-01-15'
    },
    {
      id: 'ts-003', name: 'Sensor B1', position: { x: 0, y: 0.26, z: 0 },
      temperature: 0, isMissing: true,
      expectedLocation: 'Center', lastCalibration: '2024-01-10'
    },
    {
      id: 'ts-004', name: 'Sensor B2', position: { x: -1, y: 0.26, z: 1 },
      temperature: 65, isMissing: false,
      expectedLocation: 'Bottom-Left', lastCalibration: '2024-01-15'
    },
    {
      id: 'ts-005', name: 'Sensor C1', position: { x: 1, y: 0.26, z: 1 },
      temperature: 58, isMissing: false,
      expectedLocation: 'Bottom-Right', lastCalibration: '2024-01-15'
    }
  ],
  heatSinks: [
    {
      id: 'hs-001', type: 'Fin Type A', finCount: 48,
      baseThickness: 0.3, material: 'Copper', thermalResistance: 0.12
    }
  ],
  airChannels: [
    {
      id: 'ac-001', name: 'Main Intake',
      direction: { x: 0, y: 0, z: 1 },
      speed: 2.5, isReversed: false,
      inletTemp: 35, outletTemp: 72
    },
    {
      id: 'ac-002', name: 'Side Exhaust',
      direction: { x: 1, y: 0, z: 0 },
      speed: 1.8, isReversed: true,
      inletTemp: 68, outletTemp: 45
    }
  ],
  versionHistory: [
    {
      version: 'v1.0',
      timestamp: '2024-01-01T00:00:00Z',
      author: 'System',
      changes: 'Initial design'
    },
    {
      version: 'v1.1',
      timestamp: '2024-01-10T10:30:00Z',
      author: 'Engineer A',
      changes: 'Increased GPU power limit'
    },
    {
      version: 'v1.2',
      timestamp: '2024-01-20T15:45:00Z',
      author: 'Engineer B',
      changes: 'Added NPU module'
    }
  ]
};

export const temperatureColors = [
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#84cc16',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#dc2626'
];
