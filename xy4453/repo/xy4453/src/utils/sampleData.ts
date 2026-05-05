import type {
  SeedlingTray,
  MoistureSensorData,
  NozzleCalibration,
  NutrientRecipe
} from '../types';

export const sampleSeedlingTrays: SeedlingTray[] = [
  {
    trayId: 'T001',
    bedId: 'B001',
    seedlingType: '番茄',
    quantity: 120,
    plantingDate: '2026-04-20',
    currentStage: '幼苗期',
    targetMoisture: 65,
    targetEc: 1.8,
    nozzles: ['N001', 'N002', 'N003']
  },
  {
    trayId: 'T002',
    bedId: 'B001',
    seedlingType: '番茄',
    quantity: 120,
    plantingDate: '2026-04-20',
    currentStage: '幼苗期',
    targetMoisture: 65,
    targetEc: 1.8,
    nozzles: ['N001', 'N002', 'N003']
  },
  {
    trayId: 'T003',
    bedId: 'B002',
    seedlingType: '黄瓜',
    quantity: 96,
    plantingDate: '2026-04-25',
    currentStage: '发芽期',
    targetMoisture: 70,
    targetEc: 1.2,
    nozzles: ['N004', 'N005']
  },
  {
    trayId: 'T004',
    bedId: 'B003',
    seedlingType: '辣椒',
    quantity: 100,
    plantingDate: '2026-04-15',
    currentStage: '成苗期',
    targetMoisture: 60,
    targetEc: 2.0,
    nozzles: ['N006', 'N007', 'N008']
  },
  {
    trayId: 'T005',
    bedId: 'B004',
    seedlingType: '番茄',
    quantity: 120,
    plantingDate: '2026-04-18',
    currentStage: '幼苗期',
    targetMoisture: 65,
    targetEc: 1.8,
    nozzles: ['N009', 'N010']
  }
];

export const sampleMoistureSensorData: MoistureSensorData[] = [
  {
    sensorId: 'S001',
    bedId: 'B001',
    timestamp: '2026-05-05T08:00:00Z',
    moisture: 48,
    ec: 2.3,
    temperature: 26.5
  },
  {
    sensorId: 'S002',
    bedId: 'B001',
    timestamp: '2026-05-05T08:00:00Z',
    moisture: 52,
    ec: 2.1,
    temperature: 26.2
  },
  {
    sensorId: 'S003',
    bedId: 'B002',
    timestamp: '2026-05-05T08:00:00Z',
    moisture: 78,
    ec: 1.1,
    temperature: 25.8
  },
  {
    sensorId: 'S004',
    bedId: 'B003',
    timestamp: '2026-05-05T08:00:00Z',
    moisture: 58,
    ec: 1.9,
    temperature: 27.0
  },
  {
    sensorId: 'S005',
    bedId: 'B004',
    timestamp: '2026-05-05T08:00:00Z',
    moisture: 55,
    ec: 2.0,
    temperature: 26.3
  }
];

export const sampleNozzleCalibrations: NozzleCalibration[] = [
  {
    nozzleId: 'N001',
    bedId: 'B001',
    flowRate: 0.8,
    lastCalibrationDate: '2026-04-01',
    status: 'normal',
    deviationPercentage: 2
  },
  {
    nozzleId: 'N002',
    bedId: 'B001',
    flowRate: 0.3,
    lastCalibrationDate: '2026-04-01',
    status: 'clogged',
    deviationPercentage: -62.5
  },
  {
    nozzleId: 'N003',
    bedId: 'B001',
    flowRate: 0.85,
    lastCalibrationDate: '2026-04-01',
    status: 'normal',
    deviationPercentage: 6
  },
  {
    nozzleId: 'N004',
    bedId: 'B002',
    flowRate: 0.78,
    lastCalibrationDate: '2026-04-15',
    status: 'normal',
    deviationPercentage: -2
  },
  {
    nozzleId: 'N005',
    bedId: 'B002',
    flowRate: 0.82,
    lastCalibrationDate: '2026-04-15',
    status: 'normal',
    deviationPercentage: 2
  },
  {
    nozzleId: 'N006',
    bedId: 'B003',
    flowRate: 0.75,
    lastCalibrationDate: '2026-04-10',
    status: 'normal',
    deviationPercentage: -6
  },
  {
    nozzleId: 'N007',
    bedId: 'B003',
    flowRate: 0.8,
    lastCalibrationDate: '2026-04-10',
    status: 'normal',
    deviationPercentage: 0
  },
  {
    nozzleId: 'N008',
    bedId: 'B003',
    flowRate: 0.78,
    lastCalibrationDate: '2026-04-10',
    status: 'normal',
    deviationPercentage: -2
  },
  {
    nozzleId: 'N009',
    bedId: 'B004',
    flowRate: 0.9,
    lastCalibrationDate: '2026-04-20',
    status: 'leaking',
    deviationPercentage: 12
  },
  {
    nozzleId: 'N010',
    bedId: 'B004',
    flowRate: 0.8,
    lastCalibrationDate: '2026-04-20',
    status: 'normal',
    deviationPercentage: 0
  }
];

export const sampleNutrientRecipes: NutrientRecipe[] = [
  {
    recipeId: 'R001',
    seedlingType: '番茄',
    stage: '发芽期',
    ecTarget: 1.2,
    phTarget: 5.8,
    nutrients: [
      { name: '氮', concentration: 100, unit: 'ppm' },
      { name: '磷', concentration: 50, unit: 'ppm' },
      { name: '钾', concentration: 150, unit: 'ppm' }
    ]
  },
  {
    recipeId: 'R002',
    seedlingType: '番茄',
    stage: '幼苗期',
    ecTarget: 1.8,
    phTarget: 5.8,
    nutrients: [
      { name: '氮', concentration: 150, unit: 'ppm' },
      { name: '磷', concentration: 80, unit: 'ppm' },
      { name: '钾', concentration: 200, unit: 'ppm' }
    ]
  },
  {
    recipeId: 'R003',
    seedlingType: '番茄',
    stage: '成苗期',
    ecTarget: 2.2,
    phTarget: 5.8,
    nutrients: [
      { name: '氮', concentration: 200, unit: 'ppm' },
      { name: '磷', concentration: 100, unit: 'ppm' },
      { name: '钾', concentration: 250, unit: 'ppm' }
    ]
  },
  {
    recipeId: 'R004',
    seedlingType: '黄瓜',
    stage: '发芽期',
    ecTarget: 1.0,
    phTarget: 5.6,
    nutrients: [
      { name: '氮', concentration: 80, unit: 'ppm' },
      { name: '磷', concentration: 40, unit: 'ppm' },
      { name: '钾', concentration: 120, unit: 'ppm' }
    ]
  },
  {
    recipeId: 'R005',
    seedlingType: '辣椒',
    stage: '成苗期',
    ecTarget: 2.0,
    phTarget: 6.0,
    nutrients: [
      { name: '氮', concentration: 180, unit: 'ppm' },
      { name: '磷', concentration: 90, unit: 'ppm' },
      { name: '钾', concentration: 220, unit: 'ppm' }
    ]
  }
];
