import { SoilColorConfig } from '../types';

export const SOIL_COLORS: SoilColorConfig = {
  '填土': { color: '#8B7355', name: '填土' },
  '素填土': { color: '#A0826D', name: '素填土' },
  '杂填土': { color: '#6B5B4F', name: '杂填土' },
  '粉质黏土': { color: '#D4A574', name: '粉质黏土' },
  '黏土': { color: '#C4956A', name: '黏土' },
  '粉土': { color: '#E8D4A8', name: '粉土' },
  '砂土': { color: '#F5DEB3', name: '砂土' },
  '粉砂': { color: '#E8D5B7', name: '粉砂' },
  '细砂': { color: '#DEB887', name: '细砂' },
  '中砂': { color: '#D2B48C', name: '中砂' },
  '粗砂': { color: '#C4A87C', name: '粗砂' },
  '砾石': { color: '#9C8B7A', name: '砾石' },
  '卵石': { color: '#8B7D6B', name: '卵石' },
  '碎石': { color: '#7D6F5E', name: '碎石' },
  '岩石': { color: '#696969', name: '岩石' },
  '强风化岩': { color: '#808080', name: '强风化岩' },
  '中风化岩': { color: '#5A5A5A', name: '中风化岩' },
  '微风化岩': { color: '#4A4A4A', name: '微风化岩' },
  '淤泥': { color: '#4A4A3A', name: '淤泥' },
  '淤泥质土': { color: '#5A5A4A', name: '淤泥质土' },
  '泥炭': { color: '#3A3A2A', name: '泥炭' },
  '地下水': { color: '#4169E1', name: '地下水' },
  '污染层': { color: '#FF4500', name: '污染层' },
  '未知': { color: '#808080', name: '未知' },
};

export function getSoilColor(soilType: string): string {
  const normalized = soilType.trim();
  if (SOIL_COLORS[normalized]) {
    return SOIL_COLORS[normalized].color;
  }
  for (const key of Object.keys(SOIL_COLORS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return SOIL_COLORS[key].color;
    }
  }
  return SOIL_COLORS['未知'].color;
}

export function getUniqueSoilTypes(layers: { soilType: string }[]): string[] {
  const types = new Set<string>();
  layers.forEach(l => types.add(l.soilType));
  return Array.from(types);
}
