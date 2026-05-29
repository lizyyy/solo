import type { MoldMaterial } from '../types';

export const MOLD_MATERIALS: MoldMaterial[] = [
  {
    id: 'aluminum',
    name: '铝合金模具',
    thermalConductivity: 205,
    specificHeat: 900,
    density: 2700,
    thickness: 0.002,
    color: '#A8A8A8',
    source: '工程材料手册 - 金属材料卷',
    sourceUrl: 'https://www.matweb.com/search/DataSheet.aspx?MatGUID=95485'
  },
  {
    id: 'silicone',
    name: '硅胶模具',
    thermalConductivity: 0.2,
    specificHeat: 1200,
    density: 1100,
    thickness: 0.003,
    color: '#E8B4D4',
    source: '食品级硅胶材料规格书',
    sourceUrl: 'https://www.specialtysilicones.com/food-grade'
  },
  {
    id: 'steel',
    name: '碳钢模具',
    thermalConductivity: 50,
    specificHeat: 470,
    density: 7850,
    thickness: 0.0025,
    color: '#4A4A4A',
    source: '钢铁材料热物理性能数据库',
    sourceUrl: 'https://www.steelconstruction.info'
  },
  {
    id: 'ceramic',
    name: '陶瓷模具',
    thermalConductivity: 1.5,
    specificHeat: 850,
    density: 2400,
    thickness: 0.005,
    color: '#D4C4A8',
    source: '先进陶瓷材料性能手册',
    sourceUrl: 'https://www.ceramics.org'
  },
  {
    id: 'copper',
    name: '铜质模具',
    thermalConductivity: 401,
    specificHeat: 385,
    density: 8960,
    thickness: 0.0015,
    color: '#B87333',
    source: '铜及铜合金物理性能标准',
    sourceUrl: 'https://www.copper.org'
  },
  {
    id: 'glass',
    name: '玻璃模具',
    thermalConductivity: 0.8,
    specificHeat: 840,
    density: 2500,
    thickness: 0.004,
    color: '#88C8E8',
    source: '硼硅酸盐玻璃性能参数',
    sourceUrl: 'https://www.pyrex.com'
  }
];

export const CAKE_BATTER_PROPERTIES = {
  thermalConductivity: 0.45,
  specificHeat: 3200,
  density: 1050
};

export const TARGET_CENTER_TEMPERATURE = 95;
