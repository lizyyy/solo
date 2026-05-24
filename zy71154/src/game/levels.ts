import type { LevelConfig } from './types';

export const LEVELS: LevelConfig[] = [
  {
    id: 'tutorial',
    name: '新手教程',
    description: '学习基本的抢修流程和优先级规则',
    maxTurns: 12,
    difficulty: 'easy',
    initialWeather: 'clear',
    weatherSequence: ['clear', 'clear', 'rain', 'clear', 'clear', 'storm', 'clear', 'clear', 'clear', 'clear', 'clear', 'clear'],
    nodes: [
      { id: 'substation-1', type: 'substation', name: '主变电站A', position: { x: 0, y: 1, z: 0 }, maxHealth: 100, health: 80, repairTime: 2, status: 'damaged', powered: false, connectedTo: ['line-1', 'line-2', 'line-3'] },
      { id: 'line-1', type: 'powerline', name: '1号电线', position: { x: -4, y: 0.5, z: 0 }, maxHealth: 100, health: 100, repairTime: 1, status: 'operational', powered: false, connectedTo: ['substation-1', 'user-hospital'] },
      { id: 'line-2', type: 'powerline', name: '2号电线', position: { x: 0, y: 0.5, z: -4 }, maxHealth: 100, health: 50, repairTime: 1, status: 'damaged', powered: false, connectedTo: ['substation-1', 'user-factory'] },
      { id: 'line-3', type: 'powerline', name: '3号电线', position: { x: 4, y: 0.5, z: 0 }, maxHealth: 100, health: 100, repairTime: 1, status: 'operational', powered: false, connectedTo: ['substation-1', 'user-residential-1'] },
      { id: 'user-hospital', type: 'user', name: '中心医院', position: { x: -7, y: 0.5, z: 0 }, maxHealth: 100, health: 100, repairTime: 0, status: 'operational', powered: false, connectedTo: ['line-1'], priority: 'critical', maxOutageTime: 3, outageTime: 0, population: 500 },
      { id: 'user-factory', type: 'user', name: '重要工厂', position: { x: 0, y: 0.5, z: -7 }, maxHealth: 100, health: 100, repairTime: 0, status: 'operational', powered: false, connectedTo: ['line-2'], priority: 'important', maxOutageTime: 5, outageTime: 0, population: 200 },
      { id: 'user-residential-1', type: 'user', name: '阳光小区', position: { x: 7, y: 0.5, z: 0 }, maxHealth: 100, health: 100, repairTime: 0, status: 'operational', powered: false, connectedTo: ['line-3'], priority: 'normal', maxOutageTime: 10, outageTime: 0, population: 1000 }
    ],
    teams: [
      { id: 'team-1', name: '抢修一队', status: 'idle', efficiency: 1.2, currentTarget: null, cooldown: 0, maxCooldown: 1, position: { x: 0, y: 2, z: 5 } },
      { id: 'team-2', name: '抢修二队', status: 'idle', efficiency: 1, currentTarget: null, cooldown: 0, maxCooldown: 1, position: { x: 2, y: 2, z: 5 } }
    ]
  },
  {
    id: 'storm-1',
    name: '风暴来袭',
    description: '面对复杂的天气变化和多重故障',
    maxTurns: 15,
    difficulty: 'normal',
    initialWeather: 'storm',
    weatherSequence: ['storm', 'storm', 'rain', 'rain', 'clear', 'clear', 'storm', 'heavy_storm', 'rain', 'clear', 'clear', 'clear', 'rain', 'clear', 'clear'],
    nodes: [
      { id: 'substation-1', type: 'substation', name: '主变电站A', position: { x: 0, y: 1, z: 0 }, maxHealth: 100, health: 60, repairTime: 3, status: 'damaged', powered: false, connectedTo: ['line-1', 'line-2', 'line-3', 'line-4'] },
      { id: 'substation-2', type: 'substation', name: '备用变电站B', position: { x: -8, y: 1, z: 5 }, maxHealth: 100, health: 90, repairTime: 2, status: 'damaged', powered: false, connectedTo: ['line-5', 'line-6'] },
      { id: 'line-1', type: 'powerline', name: '1号电线', position: { x: -5, y: 0.5, z: -3 }, maxHealth: 100, health: 40, repairTime: 1, status: 'damaged', powered: false, connectedTo: ['substation-1', 'user-hospital'] },
      { id: 'line-2', type: 'powerline', name: '2号电线', position: { x: 5, y: 0.5, z: -3 }, maxHealth: 100, health: 30, repairTime: 1, status: 'damaged', powered: false, connectedTo: ['substation-1', 'user-data-center'] },
      { id: 'line-3', type: 'powerline', name: '3号电线', position: { x: -5, y: 0.5, z: 3 }, maxHealth: 100, health: 100, repairTime: 1, status: 'operational', powered: false, connectedTo: ['substation-1', 'user-factory'] },
      { id: 'line-4', type: 'powerline', name: '4号电线', position: { x: 5, y: 0.5, z: 3 }, maxHealth: 100, health: 70, repairTime: 1, status: 'damaged', powered: false, connectedTo: ['substation-1', 'user-residential-1'] },
      { id: 'line-5', type: 'powerline', name: '5号电线', position: { x: -8, y: 0.5, z: 0 }, maxHealth: 100, health: 100, repairTime: 1, status: 'operational', powered: false, connectedTo: ['substation-2', 'user-hospital'] },
      { id: 'line-6', type: 'powerline', name: '6号电线', position: { x: -12, y: 0.5, z: 5 }, maxHealth: 100, health: 50, repairTime: 1, status: 'damaged', powered: false, connectedTo: ['substation-2', 'user-residential-2'] },
      { id: 'user-hospital', type: 'user', name: '中心医院', position: { x: -10, y: 0.5, z: -3 }, maxHealth: 100, health: 100, repairTime: 0, status: 'operational', powered: false, connectedTo: ['line-1', 'line-5'], priority: 'critical', maxOutageTime: 3, outageTime: 0, population: 800 },
      { id: 'user-data-center', type: 'user', name: '数据中心', position: { x: 10, y: 0.5, z: -3 }, maxHealth: 100, health: 100, repairTime: 0, status: 'operational', powered: false, connectedTo: ['line-2'], priority: 'critical', maxOutageTime: 3, outageTime: 0, population: 100 },
      { id: 'user-factory', type: 'user', name: '精密仪器厂', position: { x: -10, y: 0.5, z: 3 }, maxHealth: 100, health: 100, repairTime: 0, status: 'operational', powered: false, connectedTo: ['line-3'], priority: 'important', maxOutageTime: 5, outageTime: 0, population: 300 },
      { id: 'user-residential-1', type: 'user', name: '东城花园', position: { x: 10, y: 0.5, z: 3 }, maxHealth: 100, health: 100, repairTime: 0, status: 'operational', powered: false, connectedTo: ['line-4'], priority: 'normal', maxOutageTime: 10, outageTime: 0, population: 1500 },
      { id: 'user-residential-2', type: 'user', name: '幸福小区', position: { x: -15, y: 0.5, z: 5 }, maxHealth: 100, health: 100, repairTime: 0, status: 'operational', powered: false, connectedTo: ['line-6'], priority: 'normal', maxOutageTime: 10, outageTime: 0, population: 1200 }
    ],
    teams: [
      { id: 'team-1', name: '抢修一队', status: 'idle', efficiency: 1.2, currentTarget: null, cooldown: 0, maxCooldown: 1, position: { x: 3, y: 2, z: 8 } },
      { id: 'team-2', name: '抢修二队', status: 'idle', efficiency: 1, currentTarget: null, cooldown: 0, maxCooldown: 1, position: { x: -3, y: 2, z: 8 } },
      { id: 'team-3', name: '抢修三队', status: 'idle', efficiency: 0.9, currentTarget: null, cooldown: 0, maxCooldown: 2, position: { x: 0, y: 2, z: 10 } }
    ]
  },
  {
    id: 'crisis',
    name: '紧急危机',
    description: '极端天气下的极限挑战，考验你的决策能力',
    maxTurns: 10,
    difficulty: 'hard',
    initialWeather: 'heavy_storm',
    weatherSequence: ['heavy_storm', 'storm', 'storm', 'rain', 'storm', 'heavy_storm', 'rain', 'storm', 'clear', 'clear'],
    nodes: [
      { id: 'substation-1', type: 'substation', name: '主变电站A', position: { x: 0, y: 1, z: 0 }, maxHealth: 100, health: 30, repairTime: 3, status: 'damaged', powered: false, connectedTo: ['line-1', 'line-2', 'line-3'] },
      { id: 'line-1', type: 'powerline', name: '1号电线', position: { x: -6, y: 0.5, z: 0 }, maxHealth: 100, health: 20, repairTime: 2, status: 'damaged', powered: false, connectedTo: ['substation-1', 'user-hospital'] },
      { id: 'line-2', type: 'powerline', name: '2号电线', position: { x: 0, y: 0.5, z: -6 }, maxHealth: 100, health: 10, repairTime: 2, status: 'damaged', powered: false, connectedTo: ['substation-1', 'user-airport'] },
      { id: 'line-3', type: 'powerline', name: '3号电线', position: { x: 6, y: 0.5, z: 0 }, maxHealth: 100, health: 40, repairTime: 1, status: 'damaged', powered: false, connectedTo: ['substation-1', 'user-residential'] },
      { id: 'user-hospital', type: 'user', name: '急救中心', position: { x: -12, y: 0.5, z: 0 }, maxHealth: 100, health: 100, repairTime: 0, status: 'operational', powered: false, connectedTo: ['line-1'], priority: 'critical', maxOutageTime: 2, outageTime: 1, population: 600 },
      { id: 'user-airport', type: 'user', name: '国际机场', position: { x: 0, y: 0.5, z: -12 }, maxHealth: 100, health: 100, repairTime: 0, status: 'operational', powered: false, connectedTo: ['line-2'], priority: 'critical', maxOutageTime: 2, outageTime: 1, population: 2000 },
      { id: 'user-residential', type: 'user', name: '大型社区', position: { x: 12, y: 0.5, z: 0 }, maxHealth: 100, health: 100, repairTime: 0, status: 'operational', powered: false, connectedTo: ['line-3'], priority: 'important', maxOutageTime: 4, outageTime: 0, population: 5000 }
    ],
    teams: [
      { id: 'team-1', name: '抢修一队', status: 'idle', efficiency: 1.1, currentTarget: null, cooldown: 0, maxCooldown: 1, position: { x: 3, y: 2, z: 6 } },
      { id: 'team-2', name: '抢修二队', status: 'idle', efficiency: 1, currentTarget: null, cooldown: 0, maxCooldown: 1, position: { x: -3, y: 2, z: 6 } }
    ]
  }
];

export const DEFAULT_LEVEL = LEVELS[1];
