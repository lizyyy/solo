
import { Equipment } from '../types';

export const EQUIPMENT: Equipment[] = [
  {
    id: 'basic-scanner',
    name: '基础扫描仪',
    type: 'scanner',
    powerCost: 5,
    efficiency: 1.0,
    icon: 'scan',
    description: '基础光谱扫描设备，消耗5单位电量'
  },
  {
    id: 'precision-scanner',
    name: '精密扫描仪',
    type: 'scanner',
    powerCost: 10,
    efficiency: 1.5,
    icon: 'scan',
    description: '高精度光谱分析，消耗10单位电量，识别更清晰'
  },
  {
    id: 'basic-drill',
    name: '基础钻机',
    type: 'drill',
    powerCost: 15,
    efficiency: 1.0,
    icon: 'drill',
    description: '标准开采设备，消耗15单位电量'
  },
  {
    id: 'heavy-drill',
    name: '重型钻机',
    type: 'drill',
    powerCost: 25,
    efficiency: 1.8,
    icon: 'drill',
    description: '高产量开采，消耗25单位电量，产量提升80%'
  },
  {
    id: 'transport',
    name: '运输机',
    type: 'transport',
    powerCost: 8,
    efficiency: 1.0,
    icon: 'truck',
    description: '矿石运输入库，消耗8单位电量'
  }
];

export const getEquipmentById = (id: string): Equipment | undefined => {
  return EQUIPMENT.find(e => e.id === id);
};

export const getEquipmentByType = (type: Equipment['type']): Equipment[] => {
  return EQUIPMENT.filter(e => e.type === type);
};
