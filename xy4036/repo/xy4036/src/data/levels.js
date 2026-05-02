import { Level, LevelDifficulty } from '../models/Level'
import { ShipTypes } from '../models/Ship'
import { ChannelDirection } from '../models/Channel'

export const level1 = {
  id: 'level_1',
  name: '夜间入门训练',
  description: '这是一个入门级训练场景，适合新手调度员熟悉基本操作流程。场景包含少量船舶和简单的航道布局。',
  difficulty: LevelDifficulty.EASY,
  
  mapConfig: {
    width: 1200,
    height: 800,
    gridSize: 20
  },

  channels: [
    {
      id: 'channel_main',
      name: '主航道',
      startPoint: { x: 50, y: 400 },
      endPoint: { x: 600, y: 400 },
      points: [
        { x: 50, y: 400 },
        { x: 200, y: 400 },
        { x: 400, y: 380 },
        { x: 600, y: 400 }
      ],
      width: 120,
      minDraft: 5,
      maxDraft: 15,
      speedLimit: 12,
      direction: ChannelDirection.BIDIRECTIONAL,
      closedTimeWindows: []
    },
    {
      id: 'channel_berth_a',
      name: 'A区航道',
      startPoint: { x: 600, y: 400 },
      endPoint: { x: 800, y: 250 },
      points: [
        { x: 600, y: 400 },
        { x: 700, y: 320 },
        { x: 800, y: 250 }
      ],
      width: 80,
      minDraft: 6,
      maxDraft: 14,
      speedLimit: 8,
      direction: ChannelDirection.BIDIRECTIONAL,
      closedTimeWindows: []
    },
    {
      id: 'channel_berth_b',
      name: 'B区航道',
      startPoint: { x: 600, y: 400 },
      endPoint: { x: 800, y: 550 },
      points: [
        { x: 600, y: 400 },
        { x: 700, y: 480 },
        { x: 800, y: 550 }
      ],
      width: 80,
      minDraft: 6,
      maxDraft: 14,
      speedLimit: 8,
      direction: ChannelDirection.BIDIRECTIONAL,
      closedTimeWindows: [
        { start: 60, end: 120, reason: '临时施工' }
      ]
    }
  ],

  berths: [
    {
      id: 'berth_a1',
      name: 'A1泊位',
      position: { x: 900, y: 200 },
      length: 250,
      width: 40,
      maxDraft: 14,
      minDraft: 6,
      isPassengerBerth: true,
      isDangerousBerth: false,
      channelId: 'channel_berth_a'
    },
    {
      id: 'berth_a2',
      name: 'A2泊位',
      position: { x: 900, y: 300 },
      length: 300,
      width: 40,
      maxDraft: 14,
      minDraft: 6,
      isPassengerBerth: false,
      isDangerousBerth: false,
      channelId: 'channel_berth_a'
    },
    {
      id: 'berth_b1',
      name: 'B1泊位',
      position: { x: 900, y: 500 },
      length: 350,
      width: 45,
      maxDraft: 15,
      minDraft: 7,
      isPassengerBerth: false,
      isDangerousBerth: false,
      channelId: 'channel_berth_b'
    },
    {
      id: 'berth_b2',
      name: 'B2泊位',
      position: { x: 900, y: 600 },
      length: 200,
      width: 35,
      maxDraft: 12,
      minDraft: 5,
      isPassengerBerth: false,
      isDangerousBerth: true,
      channelId: 'channel_berth_b'
    }
  ],

  waitingZones: [
    {
      id: 'waiting_entry',
      name: '进港等待区',
      position: { x: 100, y: 250 },
      radius: 80,
      maxCapacity: 3,
      isEntryZone: true,
      isExitZone: false
    },
    {
      id: 'waiting_exit',
      name: '离港等待区',
      position: { x: 100, y: 550 },
      radius: 80,
      maxCapacity: 3,
      isEntryZone: false,
      isExitZone: true
    }
  ],

  entryVessels: [
    {
      id: 'ship_e1',
      name: '东方之星',
      type: ShipTypes.PASSENGER,
      length: 200,
      width: 28,
      draft: 8,
      turningRadius: 80,
      priority: 1,
      tugsRequired: 2,
      arrivalTime: 0,
      deadlineTime: 180,
      berthTime: 90,
      currentPosition: { x: 30, y: 400 },
      speed: 10,
      isDangerous: false
    },
    {
      id: 'ship_e2',
      name: '中远集运一号',
      type: ShipTypes.CONTAINER,
      length: 280,
      width: 32,
      draft: 12,
      turningRadius: 100,
      priority: 2,
      tugsRequired: 2,
      arrivalTime: 30,
      deadlineTime: 240,
      berthTime: 120,
      currentPosition: { x: 20, y: 380 },
      speed: 8,
      isDangerous: false
    },
    {
      id: 'ship_e3',
      name: '化学品运输号',
      type: ShipTypes.DANGEROUS,
      length: 180,
      width: 26,
      draft: 9,
      turningRadius: 70,
      priority: 2,
      tugsRequired: 3,
      arrivalTime: 60,
      deadlineTime: 300,
      berthTime: 150,
      currentPosition: { x: 15, y: 420 },
      speed: 7,
      isDangerous: true
    }
  ],

  departureVessels: [
    {
      id: 'ship_d1',
      name: '海远散货号',
      type: ShipTypes.BULK,
      length: 260,
      width: 38,
      draft: 13,
      turningRadius: 90,
      priority: 2,
      tugsRequired: 2,
      arrivalTime: 0,
      deadlineTime: 200,
      berthTime: 60,
      currentPosition: { x: 900, y: 500 },
      speed: 9,
      isDangerous: false,
      assignedBerth: 'berth_b1'
    },
    {
      id: 'ship_d2',
      name: '和平客轮',
      type: ShipTypes.PASSENGER,
      length: 180,
      width: 25,
      draft: 7,
      turningRadius: 60,
      priority: 1,
      tugsRequired: 1,
      arrivalTime: 0,
      deadlineTime: 150,
      berthTime: 45,
      currentPosition: { x: 900, y: 200 },
      speed: 11,
      isDangerous: false,
      assignedBerth: 'berth_a1'
    }
  ],

  tugs: [
    {
      id: 'tug_1',
      name: '拖轮一号',
      power: 6000,
      homePosition: { x: 500, y: 350 },
      position: { x: 500, y: 350 },
      speed: 15
    },
    {
      id: 'tug_2',
      name: '拖轮二号',
      power: 5000,
      homePosition: { x: 500, y: 450 },
      position: { x: 500, y: 450 },
      speed: 14
    },
    {
      id: 'tug_3',
      name: '拖轮三号',
      power: 5500,
      homePosition: { x: 550, y: 400 },
      position: { x: 550, y: 400 },
      speed: 13
    },
    {
      id: 'tug_4',
      name: '拖轮四号',
      power: 4500,
      homePosition: { x: 450, y: 400 },
      position: { x: 450, y: 400 },
      speed: 12
    }
  ],

  weatherConditions: [
    {
      id: 'weather_1',
      visibility: 100,
      windSpeed: 5,
      waveHeight: 0.5,
      startTime: 0,
      endTime: 120,
      affectsNavigation: false
    },
    {
      id: 'weather_2',
      visibility: 70,
      windSpeed: 15,
      waveHeight: 1.5,
      startTime: 120,
      endTime: 240,
      affectsNavigation: false
    },
    {
      id: 'weather_3',
      visibility: 40,
      windSpeed: 25,
      waveHeight: 2.5,
      startTime: 240,
      endTime: 480,
      affectsNavigation: true
    }
  ],

  startTime: 0,
  maxTime: 480,

  objectives: [
    '安全调度所有进港船舶到指定泊位',
    '安全调度所有离港船舶驶出港口',
    '确保所有船舶准点率达到80%以上',
    '避免严重安全冲突'
  ],

  hints: [
    '客船和危险品船需要优先调度特别注意安全距离',
    'B区航道在60-120分钟时有临时封航',
    '危险品船必须停靠在B2泊位',
    '客船优先级最高，请优先安排'
  ],

  scoringRules: {
    onTimeBonus: 100,
    delayPenalty: 50,
    conflictPenalty: 200,
    tugUtilizationBonus: 50,
    safetyViolationPenalty: 500
  }
}

export const level2 = {
  id: 'level_2',
  name: '复杂场景训练',
  description: '这是一个复杂的调度场景，包含航道施工、多艘船舶同时调度、天气变化等复杂情况。需要调度员熟练掌握各种调度策略。',
  difficulty: LevelDifficulty.HARD,
  
  mapConfig: {
    width: 1400,
    height: 900,
    gridSize: 20
  },

  channels: [
    {
      id: 'channel_main',
      name: '主航道',
      startPoint: { x: 50, y: 450 },
      endPoint: { x: 700, y: 450 },
      points: [
        { x: 50, y: 450 },
        { x: 200, y: 450 },
        { x: 350, y: 420 },
        { x: 500, y: 480 },
        { x: 700, y: 450 }
      ],
      width: 100,
      minDraft: 6,
      maxDraft: 16,
      speedLimit: 10,
      direction: ChannelDirection.BIDIRECTIONAL,
      closedTimeWindows: [
        { start: 0, end: 180, reason: '航道疏浚施工' }
      ],
      isRestricted: true,
      restrictionReason: '施工期间只能单向通行'
    },
    {
      id: 'channel_north',
      name: '北航道',
      startPoint: { x: 700, y: 450 },
      endPoint: { x: 900, y: 200 },
      points: [
        { x: 700, y: 450 },
        { x: 800, y: 350 },
        { x: 900, y: 200 }
      ],
      width: 70,
      minDraft: 5,
      maxDraft: 12,
      speedLimit: 8,
      direction: ChannelDirection.ONE_WAY_IN,
      closedTimeWindows: []
    },
    {
      id: 'channel_south',
      name: '南航道',
      startPoint: { x: 700, y: 450 },
      endPoint: { x: 900, y: 700 },
      points: [
        { x: 700, y: 450 },
        { x: 800, y: 550 },
        { x: 900, y: 700 }
      ],
      width: 70,
      minDraft: 5,
      maxDraft: 12,
      speedLimit: 8,
      direction: ChannelDirection.ONE_WAY_OUT,
      closedTimeWindows: []
    },
    {
      id: 'channel_east',
      name: '东航道',
      startPoint: { x: 700, y: 450 },
      endPoint: { x: 1100, y: 450 },
      points: [
        { x: 700, y: 450 },
        { x: 900, y: 450 },
        { x: 1100, y: 450 }
      ],
      width: 90,
      minDraft: 7,
      maxDraft: 15,
      speedLimit: 10,
      direction: ChannelDirection.BIDIRECTIONAL,
      closedTimeWindows: []
    }
  ],

  berths: [
    {
      id: 'berth_n1',
      name: 'N1泊位',
      position: { x: 1000, y: 150 },
      length: 200,
      width: 35,
      maxDraft: 10,
      minDraft: 5,
      isPassengerBerth: true,
      isDangerousBerth: false,
      channelId: 'channel_north'
    },
    {
      id: 'berth_n2',
      name: 'N2泊位',
      position: { x: 1000, y: 250 },
      length: 250,
      width: 40,
      maxDraft: 12,
      minDraft: 6,
      isPassengerBerth: false,
      isDangerousBerth: false,
      channelId: 'channel_north'
    },
    {
      id: 'berth_s1',
      name: 'S1泊位',
      position: { x: 1000, y: 650 },
      length: 300,
      width: 45,
      maxDraft: 13,
      minDraft: 7,
      isPassengerBerth: false,
      isDangerousBerth: true,
      channelId: 'channel_south'
    },
    {
      id: 'berth_s2',
      name: 'S2泊位',
      position: { x: 1000, y: 750 },
      length: 280,
      width: 42,
      maxDraft: 11,
      minDraft: 6,
      isPassengerBerth: false,
      isDangerousBerth: false,
      channelId: 'channel_south'
    },
    {
      id: 'berth_e1',
      name: 'E1泊位',
      position: { x: 1200, y: 400 },
      length: 350,
      width: 50,
      maxDraft: 15,
      minDraft: 8,
      isPassengerBerth: false,
      isDangerousBerth: false,
      channelId: 'channel_east'
    },
    {
      id: 'berth_e2',
      name: 'E2泊位',
      position: { x: 1200, y: 500 },
      length: 320,
      width: 48,
      maxDraft: 14,
      minDraft: 7,
      isPassengerBerth: false,
      isDangerousBerth: false,
      channelId: 'channel_east'
    }
  ],

  waitingZones: [
    {
      id: 'waiting_entry_1',
      name: '进港等待区A',
      position: { x: 150, y: 300 },
      radius: 100,
      maxCapacity: 4,
      isEntryZone: true,
      isExitZone: false
    },
    {
      id: 'waiting_entry_2',
      name: '进港等待区B',
      position: { x: 150, y: 600 },
      radius: 80,
      maxCapacity: 3,
      isEntryZone: true,
      isExitZone: false
    },
    {
      id: 'waiting_exit',
      name: '离港等待区',
      position: { x: 600, y: 300 },
      radius: 90,
      maxCapacity: 4,
      isEntryZone: false,
      isExitZone: true
    }
  ],

  entryVessels: [
    {
      id: 'ship_e1',
      name: '豪华客轮',
      type: ShipTypes.PASSENGER,
      length: 220,
      width: 30,
      draft: 8.5,
      turningRadius: 85,
      priority: 1,
      tugsRequired: 2,
      arrivalTime: 0,
      deadlineTime: 120,
      berthTime: 80,
      currentPosition: { x: 30, y: 450 },
      speed: 12,
      isDangerous: false
    },
    {
      id: 'ship_e2',
      name: '超级集装箱',
      type: ShipTypes.CONTAINER,
      length: 320,
      width: 42,
      draft: 14,
      turningRadius: 120,
      priority: 2,
      tugsRequired: 3,
      arrivalTime: 20,
      deadlineTime: 200,
      berthTime: 150,
      currentPosition: { x: 20, y: 420 },
      speed: 7,
      isDangerous: false
    },
    {
      id: 'ship_e3',
      name: '液化天然气船',
      type: ShipTypes.DANGEROUS,
      length: 290,
      width: 40,
      draft: 11,
      turningRadius: 100,
      priority: 2,
      tugsRequired: 4,
      arrivalTime: 50,
      deadlineTime: 280,
      berthTime: 180,
      currentPosition: { x: 15, y: 480 },
      speed: 6,
      isDangerous: true
    },
    {
      id: 'ship_e4',
      name: '粮食散货船',
      type: ShipTypes.BULK,
      length: 250,
      width: 36,
      draft: 12,
      turningRadius: 90,
      priority: 2,
      tugsRequired: 2,
      arrivalTime: 80,
      deadlineTime: 320,
      berthTime: 120,
      currentPosition: { x: 10, y: 400 },
      speed: 8,
      isDangerous: false
    },
    {
      id: 'ship_e5',
      name: '快速渡轮',
      type: ShipTypes.PASSENGER,
      length: 120,
      width: 20,
      draft: 5,
      turningRadius: 50,
      priority: 1,
      tugsRequired: 1,
      arrivalTime: 100,
      deadlineTime: 180,
      berthTime: 40,
      currentPosition: { x: 25, y: 500 },
      speed: 15,
      isDangerous: false
    }
  ],

  departureVessels: [
    {
      id: 'ship_d1',
      name: '油轮出海',
      type: ShipTypes.TANKER,
      length: 280,
      width: 38,
      draft: 13,
      turningRadius: 100,
      priority: 2,
      tugsRequired: 3,
      arrivalTime: 0,
      deadlineTime: 160,
      berthTime: 60,
      currentPosition: { x: 1200, y: 400 },
      speed: 9,
      isDangerous: true,
      assignedBerth: 'berth_e1'
    },
    {
      id: 'ship_d2',
      name: '客轮离港',
      type: ShipTypes.PASSENGER,
      length: 190,
      width: 27,
      draft: 7.5,
      turningRadius: 70,
      priority: 1,
      tugsRequired: 2,
      arrivalTime: 0,
      deadlineTime: 140,
      berthTime: 50,
      currentPosition: { x: 1000, y: 150 },
      speed: 13,
      isDangerous: false,
      assignedBerth: 'berth_n1'
    },
    {
      id: 'ship_d3',
      name: '集装箱离港',
      type: ShipTypes.CONTAINER,
      length: 260,
      width: 35,
      draft: 11,
      turningRadius: 95,
      priority: 2,
      tugsRequired: 2,
      arrivalTime: 0,
      deadlineTime: 220,
      berthTime: 55,
      currentPosition: { x: 1000, y: 250 },
      speed: 8,
      isDangerous: false,
      assignedBerth: 'berth_n2'
    }
  ],

  tugs: [
    {
      id: 'tug_1',
      name: '拖轮一号',
      power: 6500,
      homePosition: { x: 600, y: 400 },
      position: { x: 600, y: 400 },
      speed: 14
    },
    {
      id: 'tug_2',
      name: '拖轮二号',
      power: 6000,
      homePosition: { x: 600, y: 500 },
      position: { x: 600, y: 500 },
      speed: 13
    },
    {
      id: 'tug_3',
      name: '拖轮三号',
      power: 5500,
      homePosition: { x: 650, y: 450 },
      position: { x: 650, y: 450 },
      speed: 12
    },
    {
      id: 'tug_4',
      name: '拖轮四号',
      power: 7000,
      homePosition: { x: 550, y: 450 },
      position: { x: 550, y: 450 },
      speed: 15
    },
    {
      id: 'tug_5',
      name: '拖轮五号',
      power: 5000,
      homePosition: { x: 700, y: 350 },
      position: { x: 700, y: 350 },
      speed: 11
    }
  ],

  weatherConditions: [
    {
      id: 'weather_1',
      visibility: 80,
      windSpeed: 12,
      waveHeight: 1.2,
      startTime: 0,
      endTime: 120,
      affectsNavigation: false
    },
    {
      id: 'weather_2',
      visibility: 50,
      windSpeed: 22,
      waveHeight: 2.0,
      startTime: 120,
      endTime: 240,
      affectsNavigation: true
    },
    {
      id: 'weather_3',
      visibility: 30,
      windSpeed: 30,
      waveHeight: 3.0,
      startTime: 240,
      endTime: 360,
      affectsNavigation: true
    },
    {
      id: 'weather_4',
      visibility: 60,
      windSpeed: 18,
      waveHeight: 1.8,
      startTime: 360,
      endTime: 600,
      affectsNavigation: false
    }
  ],

  startTime: 0,
  maxTime: 600,

  objectives: [
    '在航道施工限制下完成所有船舶调度',
    '处理天气变化带来的挑战',
    '确保危险品船与客船的安全距离',
    '高效利用拖轮资源'
  ],

  hints: [
    '主航道0-180分钟时施工，只能单向通行',
    '北航道只能进港，南航道只能离港',
    '危险品船需要4艘拖轮护航',
    '有2艘客船需要优先调度',
    '注意天气变化对航行速度的影响'
  ],

  scoringRules: {
    onTimeBonus: 120,
    delayPenalty: 60,
    conflictPenalty: 250,
    tugUtilizationBonus: 60,
    safetyViolationPenalty: 600
  }
}

export const levels = [level1, level2]

export default levels
