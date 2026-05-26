import { Equipment, EquipmentType } from '../types';

export const EQUIPMENT_LIST: Equipment[] = [
  {
    type: 'skis',
    name: '滑雪板',
    icon: '⛷️',
    speedBonus: 0,
    applicableInjuries: ['minor', 'moderate'],
    requiredFor: [],
    description: '基础装备，适合所有雪道',
  },
  {
    type: 'snowmobile',
    name: '雪地摩托',
    icon: '🛷',
    speedBonus: 2,
    applicableInjuries: ['minor', 'moderate', 'severe'],
    requiredFor: [],
    description: '大幅提升移动速度，适合远距离救援',
  },
  {
    type: 'stretcher',
    name: '担架',
    icon: '🛏️',
    speedBonus: -0.5,
    applicableInjuries: ['severe', 'critical'],
    requiredFor: ['critical'],
    description: '转运重伤员必需，但会降低移动速度',
  },
  {
    type: 'medkit',
    name: '医疗包',
    icon: '💊',
    speedBonus: 0,
    applicableInjuries: ['minor', 'moderate', 'severe'],
    requiredFor: ['severe'],
    description: '处理中重度伤情的必需装备',
  },
  {
    type: 'aed',
    name: 'AED除颤仪',
    icon: '⚡',
    speedBonus: 0,
    applicableInjuries: ['critical'],
    requiredFor: ['critical'],
    description: '心脏骤停等危重情况的必需装备',
  },
  {
    type: 'oxygen',
    name: '氧气瓶',
    icon: '🫁',
    speedBonus: 0,
    applicableInjuries: ['severe', 'critical'],
    requiredFor: [],
    description: '为伤员提供氧气支持，延缓伤情恶化',
  },
];

export const getEquipmentByType = (type: EquipmentType): Equipment | undefined => {
  return EQUIPMENT_LIST.find(e => e.type === type);
};

export const getRequiredEquipment = (injury: string): Equipment[] => {
  return EQUIPMENT_LIST.filter(e => e.requiredFor.includes(injury as never));
};
