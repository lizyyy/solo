const LEVELS = {
  'level-01': {
    id: 'level-01',
    name: '基础教学',
    description: '学习基本拖拽操作，完成3架航班的除冰调度',
    difficulty: 1,
    timeLimit: 60,
    startTime: 600,
    startDay: 1,
    objectives: {
      requiredDeicing: 3,
      targetScore: 300,
      bonusTime: 45
    },
    flights: [
      {
        id: 'CA1201',
        airline: '中国航空',
        aircraftType: 'A320',
        destination: '北京PEK',
        departureTime: 720,
        priority: 3,
        deicingRequired: true,
        fluidRequired: 150,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '12',
        specialEvent: null
      },
      {
        id: 'MU2305',
        airline: '东方航空',
        aircraftType: 'B737-800',
        destination: '上海SHA',
        departureTime: 780,
        priority: 2,
        deicingRequired: true,
        fluidRequired: 120,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '8',
        specialEvent: null
      },
      {
        id: 'HU5678',
        airline: '海南航空',
        aircraftType: 'A330',
        destination: '深圳SZX',
        departureTime: 840,
        priority: 1,
        deicingRequired: true,
        fluidRequired: 200,
        fluidType: 'TypeII',
        status: 'scheduled',
        gate: '15',
        specialEvent: null
      }
    ],
    vehicles: [
      {
        id: 'VEH-001',
        name: '除冰车1号',
        status: 'available',
        capacity: 2000,
        currentFluid: 1800,
        fluidType: 'TypeI',
        shiftEnd: 1200,
        operator: '李明',
        maintenanceDue: 1440
      },
      {
        id: 'VEH-002',
        name: '除冰车2号',
        status: 'available',
        capacity: 2000,
        currentFluid: 2000,
        fluidType: 'TypeII',
        shiftEnd: 1200,
        operator: '王芳',
        maintenanceDue: 1440
      }
    ],
    pads: [
      {
        id: 'PAD-01',
        name: '除冰位1号',
        status: 'available',
        fluidType: 'TypeI',
        processTime: 15
      },
      {
        id: 'PAD-02',
        name: '除冰位2号',
        status: 'available',
        fluidType: 'TypeI',
        processTime: 15
      }
    ],
    fluidInventory: {
      TypeI: { total: 10000, reserved: 0, available: 10000 },
      TypeII: { total: 5000, reserved: 0, available: 5000 },
      TypeIII: { total: 2000, reserved: 0, available: 2000 },
      TypeIV: { total: 3000, reserved: 0, available: 3000 }
    },
    events: []
  },

  'level-02': {
    id: 'level-02',
    name: '跨午夜挑战',
    description: '处理夜间跨午夜航班，应对低温环境下的除冰作业',
    difficulty: 2,
    timeLimit: 120,
    startTime: 1320,
    startDay: 1,
    objectives: {
      requiredDeicing: 4,
      targetScore: 500,
      bonusTime: 90
    },
    flights: [
      {
        id: 'CA9901',
        airline: '中国航空',
        aircraftType: 'B737-800',
        destination: '北京PEK',
        departureTime: 1380,
        priority: 2,
        deicingRequired: true,
        fluidRequired: 130,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '3',
        specialEvent: null
      },
      {
        id: 'MU5001',
        airline: '东方航空',
        aircraftType: 'A320',
        destination: '上海SHA',
        departureTime: 1410,
        priority: 3,
        deicingRequired: true,
        fluidRequired: 140,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '7',
        specialEvent: null
      },
      {
        id: 'CZ3105',
        airline: '南方航空',
        aircraftType: 'A330',
        destination: '广州CAN',
        departureTime: 60,
        priority: 1,
        deicingRequired: true,
        fluidRequired: 210,
        fluidType: 'TypeII',
        status: 'scheduled',
        gate: '11',
        specialEvent: 'midnight_flight'
      },
      {
        id: 'HU7879',
        airline: '海南航空',
        aircraftType: 'B737-800',
        destination: '三亚SYX',
        departureTime: 90,
        priority: 2,
        deicingRequired: true,
        fluidRequired: 125,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '5',
        specialEvent: 'midnight_flight'
      }
    ],
    vehicles: [
      {
        id: 'VEH-001',
        name: '除冰车1号',
        status: 'available',
        capacity: 2000,
        currentFluid: 1900,
        fluidType: 'TypeI',
        shiftEnd: 1440,
        operator: '张强',
        maintenanceDue: 1800
      },
      {
        id: 'VEH-002',
        name: '除冰车2号',
        status: 'available',
        capacity: 2000,
        currentFluid: 1500,
        fluidType: 'TypeII',
        shiftEnd: 1440,
        operator: '刘洋',
        maintenanceDue: 1800
      }
    ],
    pads: [
      {
        id: 'PAD-01',
        name: '除冰位1号',
        status: 'available',
        fluidType: 'TypeI',
        processTime: 18
      },
      {
        id: 'PAD-02',
        name: '除冰位2号',
        status: 'available',
        fluidType: 'TypeII',
        processTime: 18
      }
    ],
    fluidInventory: {
      TypeI: { total: 12000, reserved: 0, available: 12000 },
      TypeII: { total: 6000, reserved: 0, available: 6000 },
      TypeIII: { total: 2000, reserved: 0, available: 2000 },
      TypeIV: { total: 3000, reserved: 0, available: 3000 }
    },
    events: [
      {
        type: 'weather_change',
        time: 1350,
        description: '气温下降，除冰液消耗增加10%',
        effect: { fluidConsumption: 1.1 }
      }
    ],
    nightMode: true,
    nightEfficiency: 0.8
  },

  'level-03': {
    id: 'level-03',
    name: '车辆故障',
    description: '高峰期突发车辆故障，需要灵活调度资源',
    difficulty: 2,
    timeLimit: 90,
    startTime: 720,
    startDay: 1,
    objectives: {
      requiredDeicing: 6,
      targetScore: 600,
      bonusTime: 60
    },
    flights: [
      {
        id: 'CA1201',
        airline: '中国航空',
        aircraftType: 'A320',
        destination: '北京PEK',
        departureTime: 780,
        priority: 2,
        deicingRequired: true,
        fluidRequired: 145,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '12',
        specialEvent: null
      },
      {
        id: 'MU2305',
        airline: '东方航空',
        aircraftType: 'B737-800',
        destination: '上海SHA',
        departureTime: 810,
        priority: 3,
        deicingRequired: true,
        fluidRequired: 115,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '8',
        specialEvent: null
      },
      {
        id: 'HU5678',
        airline: '海南航空',
        aircraftType: 'A330',
        destination: '深圳SZX',
        departureTime: 840,
        priority: 1,
        deicingRequired: true,
        fluidRequired: 195,
        fluidType: 'TypeII',
        status: 'scheduled',
        gate: '15',
        specialEvent: null
      },
      {
        id: 'CZ3105',
        airline: '南方航空',
        aircraftType: 'B737-700',
        destination: '广州CAN',
        departureTime: 870,
        priority: 3,
        deicingRequired: true,
        fluidRequired: 95,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '4',
        specialEvent: null
      },
      {
        id: 'MF8001',
        airline: '厦门航空',
        aircraftType: 'A320',
        destination: '厦门XMN',
        departureTime: 900,
        priority: 2,
        deicingRequired: true,
        fluidRequired: 135,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '6',
        specialEvent: null
      },
      {
        id: 'KY8001',
        airline: '昆明航空',
        aircraftType: 'B737-800',
        destination: '昆明KMG',
        departureTime: 930,
        priority: 3,
        deicingRequired: true,
        fluidRequired: 120,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '9',
        specialEvent: null
      }
    ],
    vehicles: [
      {
        id: 'VEH-001',
        name: '除冰车1号',
        status: 'available',
        capacity: 2000,
        currentFluid: 1800,
        fluidType: 'TypeI',
        shiftEnd: 1200,
        operator: '李明',
        maintenanceDue: 1440
      },
      {
        id: 'VEH-002',
        name: '除冰车2号',
        status: 'available',
        capacity: 2000,
        currentFluid: 1600,
        fluidType: 'TypeI',
        shiftEnd: 1200,
        operator: '王芳',
        maintenanceDue: 1440
      },
      {
        id: 'VEH-003',
        name: '除冰车3号',
        status: 'available',
        capacity: 2000,
        currentFluid: 2000,
        fluidType: 'TypeII',
        shiftEnd: 1200,
        operator: '赵伟',
        maintenanceDue: 1440
      }
    ],
    pads: [
      {
        id: 'PAD-01',
        name: '除冰位1号',
        status: 'available',
        fluidType: 'TypeI',
        processTime: 15
      },
      {
        id: 'PAD-02',
        name: '除冰位2号',
        status: 'available',
        fluidType: 'TypeI',
        processTime: 15
      },
      {
        id: 'PAD-03',
        name: '除冰位3号',
        status: 'available',
        fluidType: 'TypeII',
        processTime: 15
      }
    ],
    fluidInventory: {
      TypeI: { total: 15000, reserved: 0, available: 15000 },
      TypeII: { total: 8000, reserved: 0, available: 8000 },
      TypeIII: { total: 2000, reserved: 0, available: 2000 },
      TypeIV: { total: 3000, reserved: 0, available: 3000 }
    },
    events: [
      {
        type: 'vehicle_breakdown',
        time: 750,
        vehicleId: 'VEH-002',
        description: '除冰车2号突发机械故障',
        repairTime: 15,
        effect: { vehicleOut: 'VEH-002' }
      }
    ]
  },

  'level-04': {
    id: 'level-04',
    name: '综合挑战',
    description: '全功能关卡：返场航班、液量紧张、车辆换班、跨午夜运营',
    difficulty: 3,
    timeLimit: 150,
    startTime: 1260,
    startDay: 1,
    objectives: {
      requiredDeicing: 10,
      targetScore: 800,
      bonusTime: 100
    },
    flights: [
      {
        id: 'CA9901',
        airline: '中国航空',
        aircraftType: 'A320',
        destination: '北京PEK',
        departureTime: 1320,
        priority: 2,
        deicingRequired: true,
        fluidRequired: 140,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '3',
        specialEvent: null
      },
      {
        id: 'MU5001',
        airline: '东方航空',
        aircraftType: 'B737-800',
        destination: '上海SHA',
        departureTime: 1350,
        priority: 3,
        deicingRequired: true,
        fluidRequired: 125,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '7',
        specialEvent: null
      },
      {
        id: 'CZ3105',
        airline: '南方航空',
        aircraftType: 'A330',
        destination: '广州CAN',
        departureTime: 1380,
        priority: 1,
        deicingRequired: true,
        fluidRequired: 200,
        fluidType: 'TypeII',
        status: 'scheduled',
        gate: '11',
        specialEvent: null
      },
      {
        id: 'HU7879',
        airline: '海南航空',
        aircraftType: 'A320',
        destination: '三亚SYX',
        departureTime: 30,
        priority: 2,
        deicingRequired: true,
        fluidRequired: 145,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '5',
        specialEvent: 'midnight_flight'
      },
      {
        id: 'MF8001',
        airline: '厦门航空',
        aircraftType: 'B737-800',
        destination: '厦门XMN',
        departureTime: 60,
        priority: 3,
        deicingRequired: true,
        fluidRequired: 115,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '9',
        specialEvent: 'midnight_flight'
      },
      {
        id: 'KY8001',
        airline: '昆明航空',
        aircraftType: 'A320',
        destination: '昆明KMG',
        departureTime: 90,
        priority: 2,
        deicingRequired: true,
        fluidRequired: 135,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '13',
        specialEvent: 'midnight_flight'
      },
      {
        id: 'SC4901',
        airline: '山东航空',
        aircraftType: 'B737-700',
        destination: '济南TNA',
        departureTime: 120,
        priority: 3,
        deicingRequired: true,
        fluidRequired: 100,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '2',
        specialEvent: 'midnight_flight'
      },
      {
        id: 'EU6661',
        airline: '成都航空',
        aircraftType: 'A320',
        destination: '成都CTU',
        departureTime: 150,
        priority: 2,
        deicingRequired: true,
        fluidRequired: 140,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '14',
        specialEvent: 'midnight_flight'
      },
      {
        id: '8L9901',
        airline: '祥鹏航空',
        aircraftType: 'B737-800',
        destination: '昆明KMG',
        departureTime: 180,
        priority: 3,
        deicingRequired: true,
        fluidRequired: 120,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '10',
        specialEvent: 'midnight_flight'
      },
      {
        id: 'BK3001',
        airline: '天津航空',
        aircraftType: 'E190',
        destination: '天津TSN',
        departureTime: 210,
        priority: 1,
        deicingRequired: true,
        fluidRequired: 80,
        fluidType: 'TypeI',
        status: 'scheduled',
        gate: '1',
        specialEvent: 'return_flight'
      }
    ],
    vehicles: [
      {
        id: 'VEH-001',
        name: '除冰车1号',
        status: 'available',
        capacity: 2000,
        currentFluid: 1500,
        fluidType: 'TypeI',
        shiftEnd: 1440,
        operator: '张强',
        maintenanceDue: 1800
      },
      {
        id: 'VEH-002',
        name: '除冰车2号',
        status: 'available',
        capacity: 2000,
        currentFluid: 800,
        fluidType: 'TypeI',
        shiftEnd: 1440,
        operator: '刘洋',
        maintenanceDue: 1800
      },
      {
        id: 'VEH-003',
        name: '除冰车3号',
        status: 'available',
        capacity: 2000,
        currentFluid: 2000,
        fluidType: 'TypeII',
        shiftEnd: 1380,
        operator: '陈刚',
        maintenanceDue: 1800
      }
    ],
    pads: [
      {
        id: 'PAD-01',
        name: '除冰位1号',
        status: 'available',
        fluidType: 'TypeI',
        processTime: 15
      },
      {
        id: 'PAD-02',
        name: '除冰位2号',
        status: 'available',
        fluidType: 'TypeI',
        processTime: 15
      },
      {
        id: 'PAD-03',
        name: '除冰位3号',
        status: 'available',
        fluidType: 'TypeII',
        processTime: 15
      }
    ],
    fluidInventory: {
      TypeI: { total: 6000, reserved: 0, available: 6000 },
      TypeII: { total: 3000, reserved: 0, available: 3000 },
      TypeIII: { total: 2000, reserved: 0, available: 2000 },
      TypeIV: { total: 3000, reserved: 0, available: 3000 }
    },
    events: [
      {
        type: 'vehicle_breakdown',
        time: 1320,
        vehicleId: 'VEH-002',
        description: '除冰车2号突发机械故障',
        repairTime: 15,
        effect: { vehicleOut: 'VEH-002' }
      },
      {
        type: 'shift_change',
        time: 1380,
        vehicleId: 'VEH-003',
        description: '除冰车3号操作员换班',
        shiftChangeTime: 5,
        effect: { vehiclePause: 'VEH-003' }
      },
      {
        type: 'fluid_shortage',
        time: 1350,
        description: 'TypeI除冰液库存不足，需要等待补给',
        refillTime: 10,
        effect: { fluidType: 'TypeI', refillAmount: 3000 }
      },
      {
        type: 'return_flight',
        time: 60,
        flightId: 'BK3001',
        description: 'BK3001航班因天气原因返场',
        effect: { flightReturn: 'BK3001' }
      }
    ],
    nightMode: true,
    nightEfficiency: 0.8
  }
};

const LEVEL_ORDER = ['level-01', 'level-02', 'level-03', 'level-04'];

const getLevel = (levelId) => {
  return LEVELS[levelId] || null;
};

const getNextLevel = (currentLevelId) => {
  const currentIndex = LEVEL_ORDER.indexOf(currentLevelId);
  if (currentIndex >= 0 && currentIndex < LEVEL_ORDER.length - 1) {
    return LEVELS[LEVEL_ORDER[currentIndex + 1]];
  }
  return null;
};

const getAllLevels = () => {
  return Object.values(LEVELS);
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LEVELS, LEVEL_ORDER, getLevel, getNextLevel, getAllLevels };
}

if (typeof window !== 'undefined') {
  window.LEVELS = LEVELS;
  window.LEVEL_ORDER = LEVEL_ORDER;
  window.getLevel = getLevel;
  window.getNextLevel = getNextLevel;
  window.getAllLevels = getAllLevels;
}