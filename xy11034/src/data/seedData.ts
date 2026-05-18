import { v4 as uuidv4 } from 'uuid';
import {
  GreenCoffee,
  RoastingCurve,
  RoastingBatch,
  CoffeeOrigin,
  RoastLevel,
  ProcessingMethod,
  BatchStatus
} from '../types';

export const generateGreenCoffees = (): GreenCoffee[] => [
  {
    id: uuidv4(),
    batchNumber: 'GC-2024-ETH-001',
    origin: CoffeeOrigin.ETHIOPIA_YIRGACHEFFE,
    farm: 'Kochere Estate',
    altitude: 1950,
    variety: 'Heirloom',
    processingMethod: ProcessingMethod.WASHED,
    harvestYear: 2024,
    moistureContent: 10.8,
    screenSize: '17/18',
    cuppingScore: 88.5,
    quantityKg: 5000,
    receivedDate: new Date('2024-03-15'),
    supplier: 'Ethiopian Coffee Exporters Union',
    notes: '优质耶加雪菲，花香和柑橘风味突出'
  },
  {
    id: uuidv4(),
    batchNumber: 'GC-2024-COL-002',
    origin: CoffeeOrigin.COLOMBIA_SUPREMO,
    farm: 'Hacienda La Esmeralda',
    altitude: 1700,
    variety: 'Castillo',
    processingMethod: ProcessingMethod.WASHED,
    harvestYear: 2024,
    moistureContent: 11.2,
    screenSize: '16/17',
    cuppingScore: 86.0,
    quantityKg: 8000,
    receivedDate: new Date('2024-03-20'),
    supplier: 'Colombian Coffee Growers Federation',
    notes: '哥伦比亚苏普雷莫，焦糖和坚果风味'
  },
  {
    id: uuidv4(),
    batchNumber: 'GC-2024-BRA-003',
    origin: CoffeeOrigin.BRAZIL_CERRADO,
    farm: 'Fazenda Santa Ines',
    altitude: 1100,
    variety: 'Bourbon',
    processingMethod: ProcessingMethod.NATURAL,
    harvestYear: 2024,
    moistureContent: 11.5,
    screenSize: '15/16',
    cuppingScore: 84.5,
    quantityKg: 12000,
    receivedDate: new Date('2024-04-01'),
    supplier: 'Brazilian Specialty Coffee Association',
    notes: '巴西塞拉多，适合做意式拼配基底'
  }
];

export const generateRoastingCurves = (): RoastingCurve[] => [
  {
    id: uuidv4(),
    name: '标准中烘焙曲线',
    description: '适用于大多数单品咖啡的12分钟标准中烘焙曲线',
    targetFirstCrackTime: 480,
    targetSecondCrackTime: 720,
    targetDropTemperature: 215,
    temperaturePoints: [
      { time: 0, temperature: 20, airflow: 50 },
      { time: 60, temperature: 100, airflow: 50 },
      { time: 180, temperature: 160, airflow: 60 },
      { time: 300, temperature: 185, airflow: 70 },
      { time: 480, temperature: 200, airflow: 80 },
      { time: 600, temperature: 210, airflow: 80 },
      { time: 720, temperature: 215, airflow: 90 }
    ],
    createdAt: new Date('2024-01-01')
  },
  {
    id: uuidv4(),
    name: '浅烘焙风味曲线',
    description: '突出花香和果酸的9分钟浅烘焙曲线',
    targetFirstCrackTime: 420,
    targetSecondCrackTime: 600,
    targetDropTemperature: 205,
    temperaturePoints: [
      { time: 0, temperature: 20, airflow: 60 },
      { time: 60, temperature: 120, airflow: 60 },
      { time: 180, temperature: 170, airflow: 70 },
      { time: 300, temperature: 190, airflow: 80 },
      { time: 420, temperature: 200, airflow: 85 },
      { time: 540, temperature: 205, airflow: 90 }
    ],
    createdAt: new Date('2024-01-15')
  },
  {
    id: uuidv4(),
    name: '深烘焙意式曲线',
    description: '15分钟深烘焙，适合意式浓缩',
    targetFirstCrackTime: 540,
    targetSecondCrackTime: 780,
    targetDropTemperature: 230,
    temperaturePoints: [
      { time: 0, temperature: 20, airflow: 40 },
      { time: 120, temperature: 100, airflow: 40 },
      { time: 300, temperature: 150, airflow: 50 },
      { time: 540, temperature: 195, airflow: 60 },
      { time: 720, temperature: 215, airflow: 70 },
      { time: 900, temperature: 230, airflow: 80 }
    ],
    createdAt: new Date('2024-02-01')
  }
];

export const generateRoastingBatches = (
  greenCoffees: GreenCoffee[],
  roastingCurves: RoastingCurve[]
): RoastingBatch[] => {
  const ethCoffee = greenCoffees.find(c => c.origin === CoffeeOrigin.ETHIOPIA_YIRGACHEFFE)!;
  const colCoffee = greenCoffees.find(c => c.origin === CoffeeOrigin.COLOMBIA_SUPREMO)!;
  const braCoffee = greenCoffees.find(c => c.origin === CoffeeOrigin.BRAZIL_CERRADO)!;

  const mediumCurve = roastingCurves.find(c => c.name === '标准中烘焙曲线')!;
  const lightCurve = roastingCurves.find(c => c.name === '浅烘焙风味曲线')!;
  const darkCurve = roastingCurves.find(c => c.name === '深烘焙意式曲线')!;

  const parentBatchId = uuidv4();

  return [
    {
      id: uuidv4(),
      batchNumber: 'RB-2024-05-001',
      greenCoffeeId: ethCoffee.id,
      greenCoffee: ethCoffee,
      roastingCurveId: lightCurve.id,
      roastingCurve: lightCurve,
      roastMaster: '李明辉',
      machineId: 'PROBAT-P12-001',
      machineName: 'Probat P12 烘焙机',
      plannedWeightKg: 100,
      actualWeightKg: 100,
      roastLevel: RoastLevel.LIGHT,
      status: BatchStatus.COMPLETED,
      startTime: new Date('2024-05-10T08:00:00'),
      endTime: new Date('2024-05-10T08:09:00'),
      firstCrackTime: 425,
      secondCrackTime: null,
      dropTemperature: 204,
      weightLossPercentage: 12.5,
      actualTemperaturePoints: [
        { time: 0, temperature: 22, airflow: 60 },
        { time: 60, temperature: 118, airflow: 60 },
        { time: 180, temperature: 168, airflow: 70 },
        { time: 300, temperature: 188, airflow: 80 },
        { time: 425, temperature: 199, airflow: 85 },
        { time: 540, temperature: 204, airflow: 90 }
      ],
      cuppingResult: {
        aroma: 9,
        flavor: 9,
        acidity: 8.5,
        body: 7.5,
        balance: 8.5,
        aftertaste: 8.5,
        uniformity: 9,
        cleanCup: 9,
        sweetness: 8.5,
        overall: 87.5,
        notes: '茉莉花香明显，柑橘酸质明亮，干净度极佳',
        cuppedBy: '王品测',
        cuppedAt: new Date('2024-05-11T10:00:00')
      },
      qualityAssessor: '王品测',
      rejectionReason: null,
      attentionReasons: [],
      traceabilityNotes: '正常批次，无异常',
      parentBatchId: null,
      childBatchIds: [],
      version: 1,
      createdAt: new Date('2024-05-10T07:30:00'),
      updatedAt: new Date('2024-05-11T11:00:00')
    },
    {
      id: parentBatchId,
      batchNumber: 'RB-2024-05-002-PARENT',
      greenCoffeeId: colCoffee.id,
      greenCoffee: colCoffee,
      roastingCurveId: mediumCurve.id,
      roastingCurve: mediumCurve,
      roastMaster: '张伟',
      machineId: 'PROBAT-P12-001',
      machineName: 'Probat P12 烘焙机',
      plannedWeightKg: 200,
      actualWeightKg: 200,
      roastLevel: RoastLevel.MEDIUM,
      status: BatchStatus.NEEDS_ATTENTION,
      startTime: new Date('2024-05-11T09:00:00'),
      endTime: new Date('2024-05-11T09:12:00'),
      firstCrackTime: 485,
      secondCrackTime: 725,
      dropTemperature: 216,
      weightLossPercentage: 13.2,
      actualTemperaturePoints: [
        { time: 0, temperature: 21, airflow: 50 },
        { time: 60, temperature: 102, airflow: 50 },
        { time: 180, temperature: 162, airflow: 60 },
        { time: 300, temperature: 187, airflow: 70 },
        { time: 485, temperature: 201, airflow: 80 },
        { time: 600, temperature: 211, airflow: 80 },
        { time: 725, temperature: 216, airflow: 90 }
      ],
      cuppingResult: null,
      qualityAssessor: null,
      rejectionReason: null,
      attentionReasons: [
        '同一批生豆被拆分为多个烘焙批次使用不同烘焙曲线',
        '需要确认批次追溯一致性',
        '建议品质部门进行杯测确认'
      ],
      traceabilityNotes: '该批次200kg哥伦比亚生豆被拆分为3个烘焙批次，分别使用中烘焙、浅烘焙和深烘焙曲线进行试验性烘焙',
      parentBatchId: null,
      childBatchIds: [],
      version: 2,
      createdAt: new Date('2024-05-11T08:30:00'),
      updatedAt: new Date('2024-05-11T09:30:00')
    },
    {
      id: uuidv4(),
      batchNumber: 'RB-2024-05-002-CHILD-1',
      greenCoffeeId: colCoffee.id,
      greenCoffee: colCoffee,
      roastingCurveId: lightCurve.id,
      roastingCurve: lightCurve,
      roastMaster: '张伟',
      machineId: 'PROBAT-P12-002',
      machineName: 'Probat P12 烘焙机',
      plannedWeightKg: 60,
      actualWeightKg: 60,
      roastLevel: RoastLevel.LIGHT,
      status: BatchStatus.NEEDS_ATTENTION,
      startTime: new Date('2024-05-11T10:00:00'),
      endTime: new Date('2024-05-11T10:09:00'),
      firstCrackTime: 420,
      secondCrackTime: null,
      dropTemperature: 205,
      weightLossPercentage: 11.8,
      actualTemperaturePoints: [
        { time: 0, temperature: 20, airflow: 60 },
        { time: 60, temperature: 120, airflow: 60 },
        { time: 180, temperature: 170, airflow: 70 },
        { time: 300, temperature: 190, airflow: 80 },
        { time: 420, temperature: 200, airflow: 85 },
        { time: 540, temperature: 205, airflow: 90 }
      ],
      cuppingResult: null,
      qualityAssessor: null,
      rejectionReason: null,
      attentionReasons: [
        '属于拆分批次，需要与父批次RB-2024-05-002-PARENT进行追溯确认'
      ],
      traceabilityNotes: '从RB-2024-05-002-PARENT批次拆分出的60kg浅烘焙试验批次',
      parentBatchId: parentBatchId,
      childBatchIds: [],
      version: 1,
      createdAt: new Date('2024-05-11T09:45:00'),
      updatedAt: new Date('2024-05-11T10:15:00')
    },
    {
      id: uuidv4(),
      batchNumber: 'RB-2024-05-002-CHILD-2',
      greenCoffeeId: colCoffee.id,
      greenCoffee: colCoffee,
      roastingCurveId: darkCurve.id,
      roastingCurve: darkCurve,
      roastMaster: '张伟',
      machineId: 'PROBAT-P12-003',
      machineName: 'Probat P12 烘焙机',
      plannedWeightKg: 40,
      actualWeightKg: 40,
      roastLevel: RoastLevel.DARK,
      status: BatchStatus.NEEDS_ATTENTION,
      startTime: new Date('2024-05-11T11:00:00'),
      endTime: new Date('2024-05-11T11:15:00'),
      firstCrackTime: 545,
      secondCrackTime: 785,
      dropTemperature: 229,
      weightLossPercentage: 14.5,
      actualTemperaturePoints: [
        { time: 0, temperature: 22, airflow: 40 },
        { time: 120, temperature: 102, airflow: 40 },
        { time: 300, temperature: 152, airflow: 50 },
        { time: 545, temperature: 196, airflow: 60 },
        { time: 720, temperature: 216, airflow: 70 },
        { time: 900, temperature: 229, airflow: 80 }
      ],
      cuppingResult: null,
      qualityAssessor: null,
      rejectionReason: null,
      attentionReasons: [
        '属于拆分批次，需要与父批次RB-2024-05-002-PARENT进行追溯确认',
        '深烘焙重量损耗超过预期（14.5% > 14%阈值）'
      ],
      traceabilityNotes: '从RB-2024-05-002-PARENT批次拆分出的40kg深烘焙试验批次',
      parentBatchId: parentBatchId,
      childBatchIds: [],
      version: 1,
      createdAt: new Date('2024-05-11T10:45:00'),
      updatedAt: new Date('2024-05-11T11:20:00')
    },
    {
      id: uuidv4(),
      batchNumber: 'RB-2024-05-003',
      greenCoffeeId: braCoffee.id,
      greenCoffee: braCoffee,
      roastingCurveId: darkCurve.id,
      roastingCurve: darkCurve,
      roastMaster: '王强',
      machineId: 'PROBAT-P25-001',
      machineName: 'Probat P25 烘焙机',
      plannedWeightKg: 200,
      actualWeightKg: 200,
      roastLevel: RoastLevel.DARK,
      status: BatchStatus.REJECTED,
      startTime: new Date('2024-05-12T14:00:00'),
      endTime: new Date('2024-05-12T14:16:00'),
      firstCrackTime: 560,
      secondCrackTime: 800,
      dropTemperature: 235,
      weightLossPercentage: 16.8,
      actualTemperaturePoints: [
        { time: 0, temperature: 25, airflow: 40 },
        { time: 120, temperature: 105, airflow: 40 },
        { time: 300, temperature: 155, airflow: 50 },
        { time: 560, temperature: 198, airflow: 60 },
        { time: 720, temperature: 220, airflow: 70 },
        { time: 960, temperature: 235, airflow: 80 }
      ],
      cuppingResult: {
        aroma: 6,
        flavor: 5.5,
        acidity: 4,
        body: 7,
        balance: 5,
        aftertaste: 5,
        uniformity: 6,
        cleanCup: 5,
        sweetness: 5.5,
        overall: 59,
        notes: '烘焙过度，有明显焦苦味，烟熏味过重，杯测分数低于60分合格线',
        cuppedBy: '李品控',
        cuppedAt: new Date('2024-05-13T09:00:00')
      },
      qualityAssessor: '李品控',
      rejectionReason: '烘焙过度，杯测分数59分低于60分合格线，建议重新烘焙或降级使用',
      attentionReasons: [],
      traceabilityNotes: '该批次因烘焙温度控制失误导致烘焙过度，已驳回，需要重新安排烘焙计划',
      parentBatchId: null,
      childBatchIds: [],
      version: 3,
      createdAt: new Date('2024-05-12T13:30:00'),
      updatedAt: new Date('2024-05-13T10:00:00')
    },
    {
      id: uuidv4(),
      batchNumber: 'RB-2024-05-004',
      greenCoffeeId: braCoffee.id,
      greenCoffee: braCoffee,
      roastingCurveId: mediumCurve.id,
      roastingCurve: mediumCurve,
      roastMaster: '王强',
      machineId: 'PROBAT-P25-001',
      machineName: 'Probat P25 烘焙机',
      plannedWeightKg: 150,
      actualWeightKg: 150,
      roastLevel: RoastLevel.MEDIUM,
      status: BatchStatus.PROCESSING,
      startTime: new Date('2024-05-13T08:30:00'),
      endTime: null,
      firstCrackTime: null,
      secondCrackTime: null,
      dropTemperature: null,
      weightLossPercentage: null,
      actualTemperaturePoints: [
        { time: 0, temperature: 22, airflow: 50 },
        { time: 60, temperature: 100, airflow: 50 },
        { time: 180, temperature: 160, airflow: 60 },
        { time: 300, temperature: 185, airflow: 70 }
      ],
      cuppingResult: null,
      qualityAssessor: null,
      rejectionReason: null,
      attentionReasons: [],
      traceabilityNotes: '正在烘焙中',
      parentBatchId: null,
      childBatchIds: [],
      version: 1,
      createdAt: new Date('2024-05-13T08:00:00'),
      updatedAt: new Date('2024-05-13T08:35:00')
    }
  ];
};
