import { Artwork, DataGap } from '../types';

export const artworks: Artwork[] = [
  {
    id: 'qing-landscape',
    name: '清代山水画',
    description: '清代中期纸本山水画，因长期保存不当出现污渍和颜料层剥落。整体结构尚完整，但边缘有轻微破损。',
    imageType: 'paper',
    initialStain: 45,
    initialPaintLayer: 85,
    initialStructure: 75,
    timeBudget: 100,
    materials: ['宣纸', '植物颜料', '水墨'],
    creationEra: '清代中期 (约1750年)',
    paintComposition: '植物性水墨颜料',
    difficulty: 'easy',
    imageColors: {
      base: '#E8D4BC',
      accent: '#4A5568',
      detail: '#2D3748',
    },
  },
  {
    id: 'renaissance-oil',
    name: '文艺复兴油画',
    description: '文艺复兴时期布面油画，年代久远，污渍严重，颜料层有明显龟裂和剥落迹象。底材状况不明，修复难度极高。',
    imageType: 'canvas',
    initialStain: 70,
    initialPaintLayer: 60,
    initialStructure: 50,
    timeBudget: 80,
    materials: ['亚麻画布', '干性油', '矿物颜料'],
    creationEra: '文艺复兴时期 (约1500年)',
    paintComposition: '亚麻油调和矿物颜料',
    difficulty: 'hard',
    imageColors: {
      base: '#C4A574',
      accent: '#8B4513',
      detail: '#4A3728',
    },
  },
];

export const artworkDataGaps: Record<string, DataGap[]> = {
  'qing-landscape': [
    {
      id: 'gap-1',
      field: 'paintComposition',
      displayName: '颜料成分',
      hint: '可能为植物性水墨颜料，但需检测确认具体配方',
      detectCost: 15,
      resolved: false,
      actualValue: '植物性水墨颜料，含少量矿物质',
    },
  ],
  'renaissance-oil': [
    {
      id: 'gap-1',
      field: 'paintComposition',
      displayName: '颜料成分',
      hint: '推测为油性颜料，但具体油类和颜料配方不明',
      detectCost: 20,
      resolved: false,
      actualValue: '亚麻油调和铅白、朱砂等矿物颜料',
    },
    {
      id: 'gap-2',
      field: 'creationEra',
      displayName: '创作年代',
      hint: '风格特征显示为文艺复兴时期，但具体年份需碳14检测',
      detectCost: 25,
      resolved: false,
      actualValue: '约1520年，文艺复兴盛期',
    },
    {
      id: 'gap-3',
      field: 'unknown',
      displayName: '底材材质',
      hint: '画布背面有多层衬纸，原始底材纤维类型不明',
      detectCost: 18,
      resolved: false,
      actualValue: '优质亚麻画布，含棉纤维混合物',
    },
  ],
};
