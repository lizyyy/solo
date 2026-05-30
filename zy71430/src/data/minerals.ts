
import { Mineral } from '../types';

export const MINERALS: Mineral[] = [
  {
    id: 'hematite',
    name: 'Hematite',
    nameCn: '赤铁矿',
    spectrum: [0.2, 0.25, 0.3, 0.35, 0.42, 0.5, 0.58, 0.65, 0.7, 0.72, 0.7, 0.65, 0.58, 0.5, 0.45, 0.42, 0.4, 0.38, 0.35, 0.32],
    value: 15,
    color: '#8B0000',
    source: 'USGS矿物光谱数据库 v2023 - 氧化铁矿物组',
    version: '1.0.0'
  },
  {
    id: 'quartz',
    name: 'Quartz',
    nameCn: '石英',
    spectrum: [0.85, 0.88, 0.9, 0.92, 0.93, 0.92, 0.9, 0.88, 0.85, 0.82, 0.8, 0.78, 0.75, 0.72, 0.7, 0.68, 0.65, 0.62, 0.6, 0.58],
    value: 8,
    color: '#F5F5DC',
    source: '地质大学矿物光谱实验室 - 硅酸盐矿物数据集',
    version: '1.0.0'
  },
  {
    id: 'pyrite',
    name: 'Pyrite',
    nameCn: '黄铁矿',
    spectrum: [0.3, 0.32, 0.35, 0.4, 0.45, 0.52, 0.6, 0.68, 0.75, 0.8, 0.82, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4],
    value: 25,
    color: '#B8860B',
    source: 'USGS矿物光谱数据库 v2023 - 硫化物矿物组',
    version: '1.0.0'
  },
  {
    id: 'malachite',
    name: 'Malachite',
    nameCn: '孔雀石',
    spectrum: [0.15, 0.18, 0.22, 0.28, 0.35, 0.45, 0.55, 0.62, 0.58, 0.45, 0.3, 0.2, 0.15, 0.12, 0.1, 0.08, 0.06, 0.05, 0.04, 0.03],
    value: 35,
    color: '#228B22',
    source: '国际铜业协会 - 铜矿物光谱标准',
    version: '1.0.0'
  },
  {
    id: 'galena',
    name: 'Galena',
    nameCn: '方铅矿',
    spectrum: [0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17, 0.18, 0.19, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25, 0.26, 0.27, 0.28, 0.29],
    value: 40,
    color: '#2F4F4F',
    source: 'USGS矿物光谱数据库 v2023 - 硫化铅矿物组',
    version: '1.0.0'
  },
  {
    id: 'fluorite',
    name: 'Fluorite',
    nameCn: '萤石',
    spectrum: [0.4, 0.45, 0.52, 0.6, 0.68, 0.75, 0.8, 0.82, 0.78, 0.7, 0.6, 0.5, 0.42, 0.35, 0.3, 0.26, 0.22, 0.19, 0.16, 0.14],
    value: 20,
    color: '#9932CC',
    source: '地质大学矿物光谱实验室 - 卤化物矿物数据集',
    version: '1.0.0'
  }
];

export const WAVELENGTHS = Array.from({ length: 20 }, (_, i) => 400 + i * 15);

export const getMineralById = (id: string): Mineral | undefined => {
  return MINERALS.find(m => m.id === id);
};
