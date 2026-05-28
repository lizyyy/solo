import { RestorationAction } from '../types';

export const restorationActions: RestorationAction[] = [
  {
    id: 'clean-dry',
    category: 'cleaning',
    name: '干式清洁',
    description: '使用软毛刷和吸尘器轻轻去除表面灰尘和污渍。温和但效果有限。',
    riskLevel: 'low',
    timeCost: 10,
    effects: {
      stainDelta: -12,
      paintLayerDelta: -2,
    },
    risks: {
      paintDamageChance: 0.05,
    },
    materialRequirements: ['软毛刷', '低功率吸尘器'],
  },
  {
    id: 'clean-solvent',
    category: 'cleaning',
    name: '溶剂清洁',
    description: '使用有机溶剂溶解顽固污渍。效果较好，但可能损伤颜料层。',
    riskLevel: 'medium',
    timeCost: 18,
    effects: {
      stainDelta: -25,
      paintLayerDelta: -5,
    },
    risks: {
      overCleaningChance: 0.15,
      paintDamageChance: 0.1,
      materialIncompatibility: ['植物颜料', '水墨'],
    },
    materialRequirements: ['有机溶剂', '棉签', '防护手套'],
  },
  {
    id: 'clean-laser',
    category: 'cleaning',
    name: '激光清洁',
    description: '使用激光技术精确去除污渍。效果显著，但控制不当会灼伤颜料层。',
    riskLevel: 'high',
    timeCost: 20,
    effects: {
      stainDelta: -40,
      paintLayerDelta: -8,
    },
    risks: {
      overCleaningChance: 0.25,
      paintDamageChance: 0.2,
    },
    materialRequirements: ['激光清洗机', '护目镜', '防护设备'],
  },
  {
    id: 'retouch-water',
    category: 'retouching',
    name: '水性颜料补色',
    description: '使用水性颜料进行补色。色彩自然，可逆性好，但耐久性一般。',
    riskLevel: 'low',
    timeCost: 18,
    effects: {
      paintLayerDelta: 12,
    },
    risks: {
      paintDamageChance: 0.05,
      materialIncompatibility: ['干性油', '亚麻油'],
    },
    materialRequirements: ['水性修复颜料', '精细画笔', '调色盘'],
  },
  {
    id: 'retouch-oil',
    category: 'retouching',
    name: '油性颜料补色',
    description: '使用油性颜料进行补色。耐久性好，与油画兼容性佳，但干燥时间长。',
    riskLevel: 'medium',
    timeCost: 25,
    effects: {
      paintLayerDelta: 18,
      structureDelta: 2,
    },
    risks: {
      paintDamageChance: 0.1,
      materialIncompatibility: ['植物颜料', '水墨', '宣纸'],
    },
    materialRequirements: ['油性修复颜料', '调色油', '精细画笔'],
  },
  {
    id: 'retouch-mineral',
    category: 'retouching',
    name: '矿物颜料补色',
    description: '使用天然矿物颜料进行补色。色彩稳定，耐久性极佳，但材料稀缺成本高。',
    riskLevel: 'medium',
    timeCost: 28,
    effects: {
      paintLayerDelta: 20,
      structureDelta: 3,
    },
    risks: {
      paintDamageChance: 0.08,
    },
    materialRequirements: ['天然矿物颜料', '阿拉伯树胶', '精细画笔'],
  },
  {
    id: 'reinforce-spray',
    category: 'reinforcing',
    name: '表面喷涂加固',
    description: '使用透明加固剂喷涂表面。轻度加固，操作简便，但可能改变作品光泽。',
    riskLevel: 'low',
    timeCost: 12,
    effects: {
      structureDelta: 10,
      paintLayerDelta: -1,
    },
    risks: {
      paintDamageChance: 0.05,
    },
    materialRequirements: ['透明加固剂', '喷壶', '防护面具'],
  },
  {
    id: 'reinforce-lining',
    category: 'reinforcing',
    name: '衬纸修复',
    description: '在作品背面添加衬纸以增强结构。中度加固，需匹配底材纤维类型。',
    riskLevel: 'medium',
    timeCost: 30,
    effects: {
      structureDelta: 20,
      paintLayerDelta: 2,
    },
    risks: {
      structureDamageChance: 0.1,
      materialIncompatibility: ['亚麻画布'],
    },
    materialRequirements: ['修复用纸', '淀粉粘合剂', '压平设备'],
  },
  {
    id: 'reinforce-remount',
    category: 'reinforcing',
    name: '重装裱',
    description: '完全重新装裱作品。彻底加固，但属于不可逆操作，风险极高。',
    riskLevel: 'high',
    timeCost: 40,
    effects: {
      structureDelta: 35,
      paintLayerDelta: -5,
    },
    risks: {
      paintDamageChance: 0.15,
      structureDamageChance: 0.2,
    },
    materialRequirements: ['装裱材料', '专业粘合剂', '大型压平设备'],
  },
];

export const getActionsByCategory = (category: string) => {
  return restorationActions.filter(a => a.category === category);
};

export const getActionById = (id: string) => {
  return restorationActions.find(a => a.id === id);
};
