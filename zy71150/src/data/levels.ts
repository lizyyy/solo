import { LevelConfig } from '../types/game';

export const levelConfigs: LevelConfig[] = [
  {
    id: 'level_1',
    name: '入门训练',
    description: '熟悉基本分诊流程，患者数量适中，无复杂复评事件',
    difficulty: 'easy',
    patientSpawnRate: 25,
    targetPatients: 8,
    initialPatients: 3,
    rooms: [
      { id: 'room_1', name: '抢救室', canHandleEsi: [1, 2] },
      { id: 'room_2', name: '急诊诊室1', canHandleEsi: [2, 3, 4] },
      { id: 'room_3', name: '急诊诊室2', canHandleEsi: [3, 4, 5] }
    ],
    patientPool: [
      'mi_001',
      'asthma_001',
      'kidney_stone_001',
      'headache_001',
      'laceration_001',
      'sprain_001',
      'uti_001',
      'cold_001',
      'rash_001',
      'sleep_001'
    ]
  },
  {
    id: 'level_2',
    name: '进阶挑战',
    description: '患者数量增加，引入复评事件，考验持续监测能力',
    difficulty: 'medium',
    patientSpawnRate: 20,
    targetPatients: 12,
    initialPatients: 4,
    rooms: [
      { id: 'room_1', name: '抢救室', canHandleEsi: [1, 2] },
      { id: 'room_2', name: '急诊诊室1', canHandleEsi: [2, 3, 4] },
      { id: 'room_3', name: '急诊诊室2', canHandleEsi: [2, 3, 4] },
      { id: 'room_4', name: '普通诊室', canHandleEsi: [4, 5] }
    ],
    patientPool: [
      'mi_001',
      'stroke_001',
      'arrhythmia_001',
      'asthma_001',
      'abdominal_001',
      'pneumonia_001',
      'kidney_stone_001',
      'headache_001',
      'laceration_001',
      'sprain_001',
      'uti_001',
      'anxiety_001',
      'hidden_critical_001'
    ]
  },
  {
    id: 'level_3',
    name: '真实急诊',
    description: '患者持续涌入，多重复评事件，资源紧张局面',
    difficulty: 'hard',
    patientSpawnRate: 15,
    targetPatients: 15,
    initialPatients: 5,
    rooms: [
      { id: 'room_1', name: '抢救室', canHandleEsi: [1, 2] },
      { id: 'room_2', name: '急诊诊室1', canHandleEsi: [2, 3, 4] },
      { id: 'room_3', name: '急诊诊室2', canHandleEsi: [2, 3, 4] },
      { id: 'room_4', name: '普通诊室', canHandleEsi: [4, 5] }
    ],
    patientPool: [
      'mi_001',
      'stroke_001',
      'sepsis_001',
      'arrhythmia_001',
      'asthma_001',
      'abdominal_001',
      'pneumonia_001',
      'kidney_stone_001',
      'headache_001',
      'laceration_001',
      'sprain_001',
      'uti_001',
      'cold_001',
      'rash_001',
      'anxiety_001',
      'hidden_critical_001',
      'fever_child_001'
    ]
  }
];

export const esiRules = {
  1: {
    name: '立即抢救',
    description: '生命垂危，需要立即干预',
    color: '#F53F3F',
    bgColor: 'bg-red-500',
    borderColor: 'border-red-500',
    maxWaitMinutes: 0
  },
  2: {
    name: '紧急',
    description: '病情危重，需要快速处理',
    color: '#FF7D00',
    bgColor: 'bg-orange-500',
    borderColor: 'border-orange-500',
    maxWaitMinutes: 10
  },
  3: {
    name: '紧急',
    description: '病情较重，需要及时处理',
    color: '#FFAA00',
    bgColor: 'bg-yellow-500',
    borderColor: 'border-yellow-500',
    maxWaitMinutes: 30
  },
  4: {
    name: '次紧急',
    description: '病情稳定，可以等待处理',
    color: '#14C9C9',
    bgColor: 'bg-cyan-500',
    borderColor: 'border-cyan-500',
    maxWaitMinutes: 60
  },
  5: {
    name: '非紧急',
    description: '病情轻微，可以择期处理',
    color: '#00B42A',
    bgColor: 'bg-green-500',
    borderColor: 'border-green-500',
    maxWaitMinutes: 120
  }
};

export const scoringRules = {
  correctTriage: {
    1: 50,
    2: 40,
    3: 30,
    4: 20,
    5: 10
  },
  wrongTriage: -20,
  criticalTimeout: -100,
  normalTimeout: -30,
  reassessSuccess: 30,
  resourceWaste: -10
};
