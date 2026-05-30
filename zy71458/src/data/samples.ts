import { SampleData } from '../types/simulation';

export const sampleData: SampleData[] = [
  {
    id: 'sample-1',
    name: '常规给药方案',
    description: '半衰期6小时，每6小时给药一次的标准方案',
    config: {
      drug: {
        id: 'drug-1',
        name: '示例药物A',
        halfLife: 6,
        volumeOfDistribution: 40,
        therapeuticMin: 5,
        therapeuticMax: 20,
        unit: 'mg/L',
      },
      dosing: {
        dose: 500,
        interval: 6,
        dosesCount: 10,
        startTime: 0,
      },
      simulationDuration: 72,
      timeStep: 0.1,
    },
  },
  {
    id: 'sample-2',
    name: '频繁给药-浓度累积',
    description: '给药间隔短于半衰期，观察浓度累积效应',
    config: {
      drug: {
        id: 'drug-2',
        name: '示例药物B',
        halfLife: 8,
        volumeOfDistribution: 50,
        therapeuticMin: 8,
        therapeuticMax: 25,
        unit: 'mg/L',
      },
      dosing: {
        dose: 400,
        interval: 3,
        dosesCount: 15,
        startTime: 0,
      },
      simulationDuration: 48,
      timeStep: 0.1,
    },
  },
  {
    id: 'sample-3',
    name: '间隔过长-谷浓度过低',
    description: '给药间隔长于半衰期，观察谷浓度低于治疗窗',
    config: {
      drug: {
        id: 'drug-3',
        name: '示例药物C',
        halfLife: 4,
        volumeOfDistribution: 30,
        therapeuticMin: 10,
        therapeuticMax: 30,
        unit: 'mg/L',
      },
      dosing: {
        dose: 600,
        interval: 12,
        dosesCount: 8,
        startTime: 0,
      },
      simulationDuration: 96,
      timeStep: 0.1,
    },
  },
  {
    id: 'sample-4',
    name: '持续输注(间隔=0)',
    description: '给药间隔为0，模拟持续静脉输注',
    config: {
      drug: {
        id: 'drug-4',
        name: '示例药物D',
        halfLife: 5,
        volumeOfDistribution: 35,
        therapeuticMin: 15,
        therapeuticMax: 40,
        unit: 'mg/L',
      },
      dosing: {
        dose: 100,
        interval: 0,
        dosesCount: 50,
        startTime: 0,
      },
      simulationDuration: 48,
      timeStep: 0.1,
    },
  },
  {
    id: 'sample-5',
    name: '剂量与半衰期不匹配',
    description: '给药间隔与半衰期比值偏离正常范围',
    config: {
      drug: {
        id: 'drug-5',
        name: '示例药物E',
        halfLife: 12,
        volumeOfDistribution: 45,
        therapeuticMin: 6,
        therapeuticMax: 18,
        unit: 'mg/L',
      },
      dosing: {
        dose: 800,
        interval: 3,
        dosesCount: 12,
        startTime: 0,
      },
      simulationDuration: 36,
      timeStep: 0.1,
    },
  },
];

export const defaultConfig = sampleData[0].config;
