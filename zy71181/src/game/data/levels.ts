import { LevelConfig, Position } from '../types';

const pos = (x: number, y: number, z: number): Position => ({ x, y, z });

export const LEVELS: LevelConfig[] = [
  {
    id: 'level-1',
    name: '新手训练',
    description: '基础救援任务，学习巡逻员派遣和装备选择',
    difficulty: 1,
    timeLimit: 300,
    initialWeather: 'clear',
    weatherEvents: [],
    slopes: [
      { id: 'slope-1', name: '新手道A', difficulty: 'green', start: pos(0, 0, 0), end: pos(0, 0, -50), isOpen: true, baseTravelTime: 15 },
      { id: 'slope-2', name: '新手道B', difficulty: 'green', start: pos(0, 0, -50), end: pos(30, 0, -80), isOpen: true, baseTravelTime: 12 },
      { id: 'slope-3', name: '中级道A', difficulty: 'blue', start: pos(0, 0, -50), end: pos(-30, 0, -80), isOpen: true, baseTravelTime: 18 },
    ],
    victims: [
      { id: 'victim-1', name: '游客甲', position: pos(15, 0, -65), slopeId: 'slope-2', injury: 'minor', requiredEquipment: [], timeRemaining: 120, maxTime: 120, isRescued: false },
    ],
    patrollers: [
      { id: 'patroller-1', name: '张巡逻', skillLevel: 2, speed: 1, specialties: ['green', 'blue'], fatigue: 0, status: 'idle', position: pos(0, 0, 0) },
      { id: 'patroller-2', name: '李巡逻', skillLevel: 3, speed: 1.2, specialties: ['green', 'blue', 'black'], fatigue: 0, status: 'idle', position: pos(0, 0, 0) },
    ],
  },
  {
    id: 'level-2',
    name: '多伤员救援',
    description: '同时处理多名伤员，学习优先级判断',
    difficulty: 2,
    timeLimit: 420,
    initialWeather: 'light_snow',
    weatherEvents: [
      { time: 120, type: 'heavy_snow', duration: 120 },
    ],
    slopes: [
      { id: 'slope-1', name: '初级道1', difficulty: 'green', start: pos(0, 0, 0), end: pos(0, 0, -60), isOpen: true, baseTravelTime: 18 },
      { id: 'slope-2', name: '中级道1', difficulty: 'blue', start: pos(0, 0, -60), end: pos(40, 0, -100), isOpen: true, baseTravelTime: 22 },
      { id: 'slope-3', name: '中级道2', difficulty: 'blue', start: pos(0, 0, -60), end: pos(-40, 0, -100), isOpen: true, baseTravelTime: 20 },
      { id: 'slope-4', name: '高级道1', difficulty: 'black', start: pos(40, 0, -100), end: pos(60, 0, -140), isOpen: true, baseTravelTime: 28 },
    ],
    victims: [
      { id: 'victim-1', name: '游客A', position: pos(20, 0, -80), slopeId: 'slope-2', injury: 'moderate', requiredEquipment: ['medkit'], timeRemaining: 150, maxTime: 150, isRescued: false },
      { id: 'victim-2', name: '游客B', position: pos(-20, 0, -80), slopeId: 'slope-3', injury: 'minor', requiredEquipment: [], timeRemaining: 180, maxTime: 180, isRescued: false },
      { id: 'victim-3', name: '游客C', position: pos(50, 0, -120), slopeId: 'slope-4', injury: 'severe', requiredEquipment: ['medkit', 'stretcher'], timeRemaining: 100, maxTime: 100, isRescued: false },
    ],
    patrollers: [
      { id: 'patroller-1', name: '王巡逻', skillLevel: 3, speed: 1.1, specialties: ['green', 'blue', 'black'], fatigue: 0, status: 'idle', position: pos(0, 0, 0) },
      { id: 'patroller-2', name: '赵巡逻', skillLevel: 2, speed: 1, specialties: ['green', 'blue'], fatigue: 0, status: 'idle', position: pos(0, 0, 0) },
    ],
  },
  {
    id: 'level-3',
    name: '暴风雪危机',
    description: '恶劣天气下的紧急救援，时间紧迫',
    difficulty: 3,
    timeLimit: 480,
    initialWeather: 'heavy_snow',
    weatherEvents: [
      { time: 60, type: 'blizzard', duration: 180 },
      { time: 240, type: 'heavy_snow', duration: 120 },
      { time: 360, type: 'light_snow', duration: 120 },
    ],
    slopes: [
      { id: 'slope-1', name: '主索道', difficulty: 'green', start: pos(0, 0, 0), end: pos(0, 0, -80), isOpen: true, baseTravelTime: 20 },
      { id: 'slope-2', name: '北坡道', difficulty: 'blue', start: pos(0, 0, -80), end: pos(-50, 0, -130), isOpen: true, baseTravelTime: 25 },
      { id: 'slope-3', name: '南坡道', difficulty: 'blue', start: pos(0, 0, -80), end: pos(50, 0, -130), isOpen: true, baseTravelTime: 25 },
      { id: 'slope-4', name: '专家道', difficulty: 'black', start: pos(-50, 0, -130), end: pos(-80, 0, -180), isOpen: true, baseTravelTime: 35 },
      { id: 'slope-5', name: '挑战道', difficulty: 'double_black', start: pos(50, 0, -130), end: pos(80, 0, -180), isOpen: false, baseTravelTime: 45 },
    ],
    victims: [
      { id: 'victim-1', name: '滑雪者1', position: pos(-25, 0, -105), slopeId: 'slope-2', injury: 'moderate', requiredEquipment: ['medkit'], timeRemaining: 140, maxTime: 140, isRescued: false },
      { id: 'victim-2', name: '滑雪者2', position: pos(25, 0, -105), slopeId: 'slope-3', injury: 'severe', requiredEquipment: ['medkit', 'stretcher'], timeRemaining: 90, maxTime: 90, isRescued: false },
      { id: 'victim-3', name: '滑雪者3', position: pos(-65, 0, -155), slopeId: 'slope-4', injury: 'critical', requiredEquipment: ['aed', 'stretcher', 'oxygen'], timeRemaining: 70, maxTime: 70, isRescued: false },
      { id: 'victim-4', name: '滑雪者4', position: pos(0, 0, -40), slopeId: 'slope-1', injury: 'minor', requiredEquipment: [], timeRemaining: 200, maxTime: 200, isRescued: false },
    ],
    patrollers: [
      { id: 'patroller-1', name: '陈队长', skillLevel: 4, speed: 1.3, specialties: ['green', 'blue', 'black', 'double_black'], fatigue: 0, status: 'idle', position: pos(0, 0, 0) },
      { id: 'patroller-2', name: '刘队员', skillLevel: 3, speed: 1.1, specialties: ['green', 'blue', 'black'], fatigue: 0, status: 'idle', position: pos(0, 0, 0) },
      { id: 'patroller-3', name: '周队员', skillLevel: 2, speed: 1, specialties: ['green', 'blue'], fatigue: 0, status: 'idle', position: pos(0, 0, 0) },
    ],
  },
];

export const getLevelById = (id: string): LevelConfig | undefined => {
  return LEVELS.find(level => level.id === id);
};
