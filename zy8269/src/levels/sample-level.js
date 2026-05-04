export default {
  name: 'Sample Level - 国贸站早高峰',
  description: '这是一个典型的换乘站早高峰场景。你需要管理A、B两个入口的客流，控制闸机和扶梯，确保乘客安全有序地换乘。',
  
  startTime: 7 * 60,
  endTime: 10 * 60 + 30,
  timeSpeed: 0.5,
  
  areas: [
    {
      name: '入口A区域',
      x: 50,
      y: 50,
      width: 200,
      height: 150,
      capacity: 80
    },
    {
      name: '入口B区域',
      x: 50,
      y: 250,
      width: 200,
      height: 150,
      capacity: 80
    },
    {
      name: '站厅',
      x: 300,
      y: 50,
      width: 400,
      height: 350,
      capacity: 200
    },
    {
      name: '站台1',
      x: 750,
      y: 50,
      width: 300,
      height: 150,
      capacity: 150
    },
    {
      name: '站台2',
      x: 750,
      y: 250,
      width: 300,
      height: 150,
      capacity: 150
    }
  ],
  
  objects: [
    {
      id: 'entrance_A',
      type: 'entrance',
      x: 60,
      y: 60,
      width: 80,
      height: 60,
      area: '入口A区域'
    },
    {
      id: 'entrance_B',
      type: 'entrance',
      x: 60,
      y: 260,
      width: 80,
      height: 60,
      area: '入口B区域'
    },
    
    {
      id: 'gate_A1',
      type: 'gate',
      x: 230,
      y: 80,
      width: 40,
      height: 60,
      state: 'open',
      accessibility: false,
      connectsTo: '站厅',
      area: '入口A区域'
    },
    {
      id: 'gate_A2',
      type: 'gate',
      x: 230,
      y: 150,
      width: 40,
      height: 60,
      state: 'closed',
      accessibility: true,
      connectsTo: '站厅',
      area: '入口A区域'
    },
    
    {
      id: 'gate_B1',
      type: 'gate',
      x: 230,
      y: 280,
      width: 40,
      height: 60,
      state: 'open',
      accessibility: false,
      connectsTo: '站厅',
      area: '入口B区域'
    },
    {
      id: 'gate_B2',
      type: 'gate',
      x: 230,
      y: 350,
      width: 40,
      height: 60,
      state: 'closed',
      accessibility: true,
      connectsTo: '站厅',
      area: '入口B区域'
    },
    
    {
      id: 'escalator_1_down',
      type: 'escalator',
      x: 620,
      y: 80,
      width: 60,
      height: 100,
      direction: 'down',
      connectsFrom: '站厅',
      connectsTo: '站台1'
    },
    {
      id: 'escalator_1_up',
      type: 'escalator',
      x: 700,
      y: 80,
      width: 60,
      height: 100,
      direction: 'up',
      connectsFrom: '站台1',
      connectsTo: '站厅'
    },
    
    {
      id: 'escalator_2_down',
      type: 'escalator',
      x: 620,
      y: 280,
      width: 60,
      height: 100,
      direction: 'down',
      connectsFrom: '站厅',
      connectsTo: '站台2'
    },
    {
      id: 'escalator_2_up',
      type: 'escalator',
      x: 700,
      y: 280,
      width: 60,
      height: 100,
      direction: 'up',
      connectsFrom: '站台2',
      connectsTo: '站厅'
    },
    
    {
      id: 'barrier_1',
      type: 'barrier',
      x: 400,
      y: 120,
      width: 100,
      height: 15,
      active: false,
      area: '站厅'
    },
    {
      id: 'barrier_2',
      type: 'barrier',
      x: 400,
      y: 320,
      width: 100,
      height: 15,
      active: false,
      area: '站厅'
    },
    {
      id: 'barrier_3',
      type: 'barrier',
      x: 500,
      y: 200,
      width: 15,
      height: 80,
      active: false,
      area: '站厅'
    },
    
    {
      id: 'waiting_1',
      type: 'waiting_area',
      x: 800,
      y: 80,
      width: 200,
      height: 80,
      platform: 'platform1',
      area: '站台1'
    },
    {
      id: 'waiting_2',
      type: 'waiting_area',
      x: 800,
      y: 280,
      width: 200,
      height: 80,
      platform: 'platform2',
      area: '站台2'
    }
  ],
  
  trainSchedule: [
    {
      id: 'train_1_1',
      line: '1号线',
      platform: '站台1',
      arrivalTime: 7 * 60 + 15,
      departureTime: 7 * 60 + 40,
      capacity: 300,
      isLastTrain: false
    },
    {
      id: 'train_1_2',
      line: '1号线',
      platform: '站台1',
      arrivalTime: 7 * 60 + 50,
      departureTime: 8 * 60 + 15,
      capacity: 300,
      isLastTrain: false
    },
    {
      id: 'train_1_3',
      line: '1号线',
      platform: '站台1',
      arrivalTime: 8 * 60 + 25,
      departureTime: 8 * 60 + 50,
      capacity: 300,
      isLastTrain: false
    },
    {
      id: 'train_1_4',
      line: '1号线',
      platform: '站台1',
      arrivalTime: 9 * 60,
      departureTime: 9 * 60 + 25,
      capacity: 300,
      isLastTrain: false
    },
    {
      id: 'train_1_last',
      line: '1号线（末班）',
      platform: '站台1',
      arrivalTime: 9 * 60 + 35,
      departureTime: 10 * 60,
      capacity: 300,
      isLastTrain: true
    },
    
    {
      id: 'train_2_1',
      line: '10号线',
      platform: '站台2',
      arrivalTime: 7 * 60 + 20,
      departureTime: 7 * 60 + 45,
      capacity: 300,
      isLastTrain: false
    },
    {
      id: 'train_2_2',
      line: '10号线',
      platform: '站台2',
      arrivalTime: 7 * 60 + 55,
      departureTime: 8 * 60 + 20,
      capacity: 300,
      isLastTrain: false
    },
    {
      id: 'train_2_3',
      line: '10号线',
      platform: '站台2',
      arrivalTime: 8 * 60 + 30,
      departureTime: 8 * 60 + 55,
      capacity: 300,
      isLastTrain: false
    },
    {
      id: 'train_2_4',
      line: '10号线',
      platform: '站台2',
      arrivalTime: 9 * 60 + 5,
      departureTime: 9 * 60 + 30,
      capacity: 300,
      isLastTrain: false
    },
    {
      id: 'train_2_last',
      line: '10号线（末班）',
      platform: '站台2',
      arrivalTime: 9 * 60 + 40,
      departureTime: 10 * 60 + 10,
      capacity: 300,
      isLastTrain: true
    }
  ],
  
  crowdWaves: [
    {
      id: 'wave_A_1',
      entrance: 'entrance_A',
      startTime: 7 * 60 + 5,
      count: 30,
      targetPlatform: 'platform1',
      intensity: 'low'
    },
    {
      id: 'wave_B_1',
      entrance: 'entrance_B',
      startTime: 7 * 60 + 10,
      count: 25,
      targetPlatform: 'platform2',
      intensity: 'low'
    },
    
    {
      id: 'wave_A_peak_1',
      entrance: 'entrance_A',
      startTime: 7 * 60 + 40,
      count: 80,
      targetPlatform: 'platform1',
      intensity: 'high'
    },
    {
      id: 'wave_B_peak_1',
      entrance: 'entrance_B',
      startTime: 7 * 60 + 45,
      count: 70,
      targetPlatform: 'platform2',
      intensity: 'high'
    },
    
    {
      id: 'wave_A_peak_2',
      entrance: 'entrance_A',
      startTime: 8 * 60 + 15,
      count: 100,
      targetPlatform: 'platform1',
      intensity: 'extreme'
    },
    {
      id: 'wave_B_peak_2',
      entrance: 'entrance_B',
      startTime: 8 * 60 + 20,
      count: 90,
      targetPlatform: 'platform2',
      intensity: 'extreme'
    },
    
    {
      id: 'wave_A_mid',
      entrance: 'entrance_A',
      startTime: 8 * 60 + 50,
      count: 50,
      targetPlatform: 'platform1',
      intensity: 'medium'
    },
    {
      id: 'wave_B_mid',
      entrance: 'entrance_B',
      startTime: 8 * 60 + 55,
      count: 45,
      targetPlatform: 'platform2',
      intensity: 'medium'
    },
    
    {
      id: 'wave_A_last',
      entrance: 'entrance_A',
      startTime: 9 * 60 + 20,
      count: 40,
      targetPlatform: 'platform1',
      intensity: 'medium'
    },
    {
      id: 'wave_B_last',
      entrance: 'entrance_B',
      startTime: 9 * 60 + 25,
      count: 35,
      targetPlatform: 'platform2',
      intensity: 'medium'
    }
  ],
  
  rules: {
    maxSafeCapacity: 0.85,
    warningCapacity: 0.7,
    gateThroughput: {
      normal: 1,
      accessibility: 2
    },
    escalatorThroughput: 2,
    penaltyForIncident: 100,
    bonusForSafeOperation: 50,
    accessibilityMustBeOpen: true
  },
  
  objectives: [
    '确保所有乘客安全乘车',
    '保持区域容量在安全范围内（<85%）',
    '无障碍通道必须保持开启',
    '尽可能减少乘客等待时间'
  ]
};
