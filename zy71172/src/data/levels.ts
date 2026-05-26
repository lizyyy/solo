
import { LevelConfig } from '@/types';

export const levels: LevelConfig[] = [
  {
    id: 1,
    name: '新手入门',
    description: '学习基础垃圾分类规则，处理常见垃圾',
    timeLimit: 90,
    trashCount: 10,
    difficulty: 'easy',
    availableCategories: ['recyclable', 'wet', 'dry', 'hazardous'],
    hasBagBreakMechanic: false,
    hasContaminationMechanic: false,
    hasAppointmentMechanic: false,
    targetScore: 80,
    correctPoints: 10,
    wrongPenalty: 5,
    maxWrongCount: 5,
  },
  {
    id: 2,
    name: '进阶挑战',
    description: '掌握湿垃圾破袋和污染可回收物处理',
    timeLimit: 75,
    trashCount: 12,
    difficulty: 'medium',
    availableCategories: ['recyclable', 'wet', 'dry', 'hazardous'],
    hasBagBreakMechanic: true,
    hasContaminationMechanic: true,
    hasAppointmentMechanic: false,
    targetScore: 90,
    correctPoints: 10,
    wrongPenalty: 8,
    maxWrongCount: 4,
  },
  {
    id: 3,
    name: '实战模拟',
    description: '综合运用所有规则，含大件垃圾预约',
    timeLimit: 60,
    trashCount: 15,
    difficulty: 'hard',
    availableCategories: ['recyclable', 'wet', 'dry', 'hazardous', 'bulky'],
    hasBagBreakMechanic: true,
    hasContaminationMechanic: true,
    hasAppointmentMechanic: true,
    appointmentSlots: [
      { id: 'slot1', startTime: 0, endTime: 20, isAvailable: true },
      { id: 'slot2', startTime: 35, endTime: 50, isAvailable: true },
    ],
    targetScore: 100,
    correctPoints: 10,
    wrongPenalty: 10,
    maxWrongCount: 3,
  },
];

export const getLevelById = (id: number): LevelConfig | undefined => {
  return levels.find(level => level.id === id);
};

export default levels;
