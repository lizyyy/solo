import { SamplePreset } from '../types';

export const samplePresets: SamplePreset[] = [
  {
    id: 'tomato-standard',
    name: '番茄标准种植',
    description: '适合大多数温室的番茄种植方案',
    greenhouse: {
      width: 12,
      length: 20,
      height: 4.5,
    },
    plants: {
      rowSpacing: 160,
      plantSpacing: 50,
      plantHeight: 200,
      canopyDiameter: 80,
      rowsCount: 6,
      plantsPerRow: 30,
    },
    robotPath: {
      enabled: true,
      width: 80,
      position: 3,
    },
  },
  {
    id: 'cucumber-dense',
    name: '黄瓜密植方案',
    description: '高密度种植，需注意通风和光照',
    greenhouse: {
      width: 10,
      length: 25,
      height: 5,
    },
    plants: {
      rowSpacing: 120,
      plantSpacing: 40,
      plantHeight: 250,
      canopyDiameter: 70,
      rowsCount: 7,
      plantsPerRow: 50,
    },
    robotPath: {
      enabled: true,
      width: 60,
      position: 3,
    },
  },
  {
    id: 'lettuce-hydroponic',
    name: '生菜水培模式',
    description: '水培生菜，株距较小',
    greenhouse: {
      width: 8,
      length: 15,
      height: 3.5,
    },
    plants: {
      rowSpacing: 90,
      plantSpacing: 25,
      plantHeight: 30,
      canopyDiameter: 20,
      rowsCount: 8,
      plantsPerRow: 40,
    },
    robotPath: {
      enabled: false,
      width: 50,
      position: 4,
    },
  },
  {
    id: 'pepper-wide',
    name: '辣椒宽行种植',
    description: '宽行种植便于人工操作',
    greenhouse: {
      width: 15,
      length: 30,
      height: 4,
    },
    plants: {
      rowSpacing: 200,
      plantSpacing: 60,
      plantHeight: 120,
      canopyDiameter: 60,
      rowsCount: 6,
      plantsPerRow: 40,
    },
    robotPath: {
      enabled: true,
      width: 100,
      position: 3,
    },
  },
];

export const defaultState = {
  greenhouse: {
    width: 12,
    length: 20,
    height: 4.5,
  },
  plants: {
    rowSpacing: 160,
    plantSpacing: 50,
    plantHeight: 200,
    canopyDiameter: 80,
    rowsCount: 6,
    plantsPerRow: 30,
  },
  robotPath: {
    enabled: true,
    width: 80,
    position: 3,
  },
  light: {
    sunAngle: 45,
    sunIntensity: 1,
    timeOfDay: 12,
  },
  camera: {
    position: [15, 12, 15] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  },
  showHeatmap: false,
  currentView: 'overview' as const,
};
