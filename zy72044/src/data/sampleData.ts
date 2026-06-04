import type { GameConfig, GameRecord } from '@/types/gameTypes';

export const sampleConfig: GameConfig = {
  id: 'green-wave-standard',
  name: '城市绿波信号赛',
  initialResources: {
    time: 120,
    energy: 100,
    budget: 500,
  },
  resourceBoundaries: {
    time: { min: 0, max: 300 },
    energy: { min: 0, max: 100 },
    budget: { min: 0, max: 1000 },
  },
  levels: [
    {
      id: 'level-1',
      name: '路口1-信号初始化',
      events: [
        {
          id: 'evt-1-1',
          name: '绿灯启动',
          type: 'traffic_light',
          description: '第一个路口的信号灯进入绿灯状态，车辆开始通行',
          resourceChanges: { time: -10, energy: -5 },
          source: '城市绿波信号赛-路口1-绿灯启动',
        },
        {
          id: 'evt-1-2',
          name: '车辆通行',
          type: 'road_condition',
          description: '车流顺利通过路口，耗时正常',
          resourceChanges: { time: -15, energy: -8, budget: -20 },
          source: '城市绿波信号赛-路口1-车辆通行',
        },
      ],
    },
    {
      id: 'level-2',
      name: '路口2-协调配时',
      events: [
        {
          id: 'evt-2-1',
          name: '信号联动',
          type: 'traffic_light',
          description: '与上游路口信号联动，绿波带形成',
          resourceChanges: { time: -8, energy: -3 },
          source: '城市绿波信号赛-路口2-信号联动',
        },
        {
          id: 'evt-2-2',
          name: '行人过街',
          type: 'road_condition',
          description: '行人过街信号触发，需短暂等待',
          resourceChanges: { time: -12, energy: -5, budget: -30 },
          source: '城市绿波信号赛-路口2-行人过街',
        },
      ],
    },
    {
      id: 'level-3-empty',
      name: '路口3-预留（空关卡）',
      events: [],
      isEmpty: true,
    },
    {
      id: 'level-4',
      name: '路口4-高峰应对',
      events: [
        {
          id: 'evt-4-1',
          name: '高峰拥堵',
          type: 'road_condition',
          description: '早高峰车流量大增，信号配时需要调整',
          resourceChanges: { time: -20, energy: -15, budget: -50 },
          source: '城市绿波信号赛-路口4-高峰拥堵',
        },
        {
          id: 'evt-4-1',
          name: '高峰拥堵',
          type: 'road_condition',
          description: '重复检测到拥堵事件（重复项）',
          resourceChanges: { time: -15, energy: -10, budget: -40 },
          source: '城市绿波信号赛-路口4-高峰拥堵(重复)',
        },
      ],
    },
    {
      id: 'level-5',
      name: '路口5-终点结算',
      events: [
        {
          id: 'evt-5-1',
          name: '终点到达',
          type: 'other',
          description: '成功到达终点，绿波带全程协调完成',
          resourceChanges: { time: -5, energy: -3, budget: -10 },
          source: '城市绿波信号赛-路口5-终点到达',
        },
      ],
    },
  ],
  source: '城市绿波信号赛-标准配置',
};

export const edgeTestConfig: GameConfig = {
  id: 'green-wave-edge',
  name: '城市绿波信号赛（边界测试）',
  initialResources: {
    time: 50,
    energy: 20,
    budget: 80,
  },
  resourceBoundaries: {
    time: { min: 0, max: 200 },
    energy: { min: 0, max: 100 },
    budget: { min: 0, max: 500 },
  },
  levels: [
    {
      id: 'edge-1',
      name: '路口1-低资源起步',
      events: [
        {
          id: 'edge-evt-1',
          name: '信号启动',
          type: 'traffic_light',
          description: '资源紧张情况下的信号启动',
          resourceChanges: { time: -15, energy: -12, budget: -30 },
          source: '城市绿波信号赛-边缘测试-路口1-信号启动',
        },
        {
          id: 'edge-evt-2',
          name: '设备故障',
          type: 'other',
          description: '检测器故障，需要紧急调配资源',
          resourceChanges: { time: -25, energy: -15, budget: -60 },
          source: '城市绿波信号赛-边缘测试-路口1-设备故障',
        },
      ],
    },
    {
      id: 'edge-2',
      name: '路口2-资源耗尽',
      events: [
        {
          id: 'edge-evt-3',
          name: '紧急调度',
          type: 'traffic_light',
          description: '资源接近耗尽时的紧急调度',
          resourceChanges: { time: -20, energy: -8, budget: -25 },
          source: '城市绿波信号赛-边缘测试-路口2-紧急调度',
        },
      ],
    },
  ],
  source: '城市绿波信号赛-边缘测试配置',
};

export const sampleRecords: GameRecord[] = [
  {
    id: 'record-smooth',
    configId: 'green-wave-standard',
    configName: '城市绿波信号赛',
    startTime: Date.now() - 3600000,
    endTime: Date.now() - 3540000,
    status: 'finished',
    finalResources: { time: 55, energy: 66, budget: 350 },
    eventLog: [
      {
        id: 'evt-1-1', name: '绿灯启动', type: 'traffic_light',
        description: '第一个路口信号灯进入绿灯状态',
        resourceChanges: { time: -10, energy: -5 },
        source: '城市绿波信号赛-路口1-绿灯启动',
        timestamp: Date.now() - 3600000,
      },
      {
        id: 'evt-1-2', name: '车辆通行', type: 'road_condition',
        description: '车流顺利通过',
        resourceChanges: { time: -15, energy: -8, budget: -20 },
        source: '城市绿波信号赛-路口1-车辆通行',
        timestamp: Date.now() - 3595000,
      },
      {
        id: 'evt-2-1', name: '信号联动', type: 'traffic_light',
        description: '绿波带形成',
        resourceChanges: { time: -8, energy: -3 },
        source: '城市绿波信号赛-路口2-信号联动',
        timestamp: Date.now() - 3580000,
      },
      {
        id: 'evt-2-2', name: '行人过街', type: 'road_condition',
        description: '短暂等待',
        resourceChanges: { time: -12, energy: -5, budget: -30 },
        source: '城市绿波信号赛-路口2-行人过街',
        timestamp: Date.now() - 3575000,
      },
      {
        id: 'evt-5-1', name: '终点到达', type: 'other',
        description: '绿波带全程协调完成',
        resourceChanges: { time: -5, energy: -3, budget: -10 },
        source: '城市绿波信号赛-路口5-终点到达',
        timestamp: Date.now() - 3560000,
      },
    ],
    anomalies: [],
    needsManualReview: false,
    dataFormatVersion: 'v2',
    source: '城市绿波信号赛-标准流程',
  },
  {
    id: 'record-edge',
    configId: 'green-wave-edge',
    configName: '城市绿波信号赛（边界测试）',
    startTime: Date.now() - 7200000,
    endTime: Date.now() - 7140000,
    status: 'finished',
    finalResources: { time: -10, energy: -15, budget: -35 },
    eventLog: [
      {
        id: 'edge-evt-1', name: '信号启动', type: 'traffic_light',
        description: '资源紧张情况下的信号启动',
        resourceChanges: { time: -15, energy: -12, budget: -30 },
        source: '城市绿波信号赛-边缘测试-路口1-信号启动',
        timestamp: Date.now() - 7200000,
      },
      {
        id: 'edge-evt-2', name: '设备故障', type: 'other',
        description: '检测器故障，资源快速消耗',
        resourceChanges: { time: -25, energy: -15, budget: -60 },
        source: '城市绿波信号赛-边缘测试-路口1-设备故障',
        timestamp: Date.now() - 7190000,
      },
      {
        id: 'edge-evt-3', name: '紧急调度', type: 'traffic_light',
        description: '资源接近耗尽',
        resourceChanges: { time: -20, energy: -8, budget: -25 },
        source: '城市绿波信号赛-边缘测试-路口2-紧急调度',
        timestamp: Date.now() - 7170000,
      },
    ],
    anomalies: [
      '资源"time"变为负数（-10），来源：城市绿波信号赛-边缘测试-路口2-紧急调度',
      '资源"energy"变为负数（-15），来源：城市绿波信号赛-边缘测试-路口2-紧急调度',
      '资源"budget"变为负数（-35），来源：城市绿波信号赛-边缘测试-路口2-紧急调度',
    ],
    needsManualReview: true,
    dataFormatVersion: 'v2',
    source: '城市绿波信号赛-边缘测试',
  },
  {
    id: 'record-legacy',
    configId: 'legacy-2024',
    configName: '城市绿波信号赛（2024秋季）',
    startTime: new Date('2024-11-15T14:30:00').getTime(),
    endTime: new Date('2024-11-15T14:42:00').getTime(),
    status: 'finished',
    finalResources: { time: 45, energy: 55, budget: 280 },
    eventLog: [
      {
        id: 'legacy-1', name: '绿灯放行', type: 'traffic_light',
        description: '路口信号灯变绿，车辆通行',
        resourceChanges: { time: -12, energy: -6 },
        source: '学生练习记录-2024秋季-学生A-练习01',
        timestamp: new Date('2024-11-15T14:31:00').getTime(),
      },
      {
        id: 'legacy-2', name: '车流通过', type: 'road_condition',
        description: '车流正常通过',
        resourceChanges: { time: -18, energy: -9, budget: -25 },
        source: '学生练习记录-2024秋季-学生A-练习01',
        timestamp: new Date('2024-11-15T14:33:00').getTime(),
      },
      {
        id: 'legacy-3', name: '联动协调', type: 'traffic_light',
        description: '绿波协调完成',
        resourceChanges: { time: -10, energy: -5, budget: -15 },
        source: '学生练习记录-2024秋季-学生A-练习01',
        timestamp: new Date('2024-11-15T14:38:00').getTime(),
      },
    ],
    anomalies: [],
    needsManualReview: false,
    dataFormatVersion: 'v1',
    source: '学生练习记录-2024秋季学期',
  },
];

export const allConfigs: GameConfig[] = [sampleConfig, edgeTestConfig];
