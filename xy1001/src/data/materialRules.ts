import { MaterialRule, Season, CoatType, Scenario, MaterialType } from '../types';

export const materialRules: MaterialRule[] = [
  {
    id: 'cotton',
    materialType: 'cotton',
    name: '纯棉',
    description: '天然植物纤维，柔软舒适，透气性好',
    suitableSeasons: ['spring', 'autumn'],
    suitableCoatTypes: ['short', 'medium', 'long', 'double', 'hairless'],
    suitableScenarios: ['daily', 'sleep', 'outdoor'],
    pros: [
      '天然材质，对皮肤友好',
      '吸湿性强，舒适透气',
      '柔软亲肤，穿着舒适',
      '容易清洗打理',
    ],
    cons: [
      '容易起皱',
      '可能会缩水',
      '保暖性一般',
    ],
    careTips: [
      '建议使用温和洗涤剂',
      '水温不超过30度',
      '避免长时间暴晒',
    ],
  },
  {
    id: 'linen',
    materialType: 'linen',
    name: '亚麻',
    description: '天然植物纤维，凉爽透气，适合夏季',
    suitableSeasons: ['spring', 'summer'],
    suitableCoatTypes: ['short', 'medium', 'long', 'double'],
    suitableScenarios: ['daily', 'outdoor', 'sports'],
    pros: [
      '透气性极佳，夏季穿着凉爽',
      '吸湿性强，快速干爽',
      '天然抑菌',
      '轻盈飘逸',
    ],
    cons: [
      '容易起皱',
      '初次穿着可能有些硬挺',
      '不适合寒冷天气',
    ],
    careTips: [
      '建议手洗或轻柔机洗',
      '避免拧干，悬挂晾干',
      '可熨烫保持平整',
    ],
  },
  {
    id: 'fleece',
    materialType: 'fleece',
    name: '摇粒绒',
    description: '合成纤维，轻盈保暖，手感柔软',
    suitableSeasons: ['autumn', 'winter'],
    suitableCoatTypes: ['short', 'medium', 'hairless'],
    suitableScenarios: ['daily', 'sleep', 'outdoor', 'sports'],
    pros: [
      '轻盈保暖，保暖性好',
      '手感柔软舒适',
      '速干性能好',
      '不易起皱',
    ],
    cons: [
      '可能产生静电',
      '透气性一般',
      '长时间穿着可能起球',
    ],
    careTips: [
      '建议使用中性洗涤剂',
      '低温烘干或自然晾干',
      '避免使用柔顺剂',
    ],
  },
  {
    id: 'wool',
    materialType: 'wool',
    name: '羊毛',
    description: '天然动物纤维，保暖性极佳，质感高级',
    suitableSeasons: ['autumn', 'winter'],
    suitableCoatTypes: ['short', 'hairless'],
    suitableScenarios: ['daily', 'party', 'sleep'],
    pros: [
      '保暖性极佳',
      '天然抗菌防臭',
      '吸湿排汗',
      '质感高级',
    ],
    cons: [
      '可能引起皮肤敏感',
      '需要特殊护理',
      '价格较高',
      '可能缩水变形',
    ],
    careTips: [
      '建议干洗或手洗',
      '使用羊毛专用洗涤剂',
      '平铺晾干，避免悬挂',
    ],
  },
  {
    id: 'down',
    materialType: 'down',
    name: '羽绒',
    description: '天然保暖材料，轻盈蓬松，保暖性最强',
    suitableSeasons: ['winter'],
    suitableCoatTypes: ['short', 'hairless'],
    suitableScenarios: ['outdoor', 'daily'],
    pros: [
      '保暖性最强',
      '轻盈蓬松',
      '压缩性好，方便携带',
      '透气性较好',
    ],
    cons: [
      '价格较高',
      '容易钻毛',
      '怕水，需要特殊处理',
      '需要定期护理',
    ],
    careTips: [
      '建议使用羽绒专用洗涤剂',
      '轻柔机洗或手洗',
      '低温烘干，拍打恢复蓬松',
      '储存前确保完全干燥',
    ],
  },
  {
    id: 'nylon',
    materialType: 'nylon',
    name: '尼龙',
    description: '合成纤维，耐磨耐用，弹性好',
    suitableSeasons: ['spring', 'summer', 'autumn'],
    suitableCoatTypes: ['short', 'medium', 'long', 'double', 'hairless'],
    suitableScenarios: ['sports', 'outdoor', 'daily'],
    pros: [
      '非常耐磨耐用',
      '弹性好，活动自如',
      '轻盈',
      '速干性能好',
    ],
    cons: [
      '透气性一般',
      '可能产生静电',
      '质感一般',
    ],
    careTips: [
      '可机洗',
      '避免高温熨烫',
      '自然晾干即可',
    ],
  },
  {
    id: 'waterproof',
    materialType: 'waterproof',
    name: '防水面料',
    description: '特殊处理面料，防水防风，适合户外活动',
    suitableSeasons: ['spring', 'autumn', 'winter'],
    suitableCoatTypes: ['short', 'medium', 'long', 'double', 'hairless'],
    suitableScenarios: ['outdoor', 'sports'],
    pros: [
      '防水防风',
      '雨天也能保护宠物',
      '耐用',
      '容易清洁',
    ],
    cons: [
      '透气性可能较差',
      '质感较硬',
      '需要特殊护理保持防水性',
    ],
    careTips: [
      '建议使用柔和洗涤剂',
      '避免使用柔顺剂',
      '定期重新做防水处理',
      '低温熨烫可能恢复防水性',
    ],
  },
  {
    id: 'velvet',
    materialType: 'velvet',
    name: '丝绒',
    description: '华丽面料，质感柔软，适合派对和节日',
    suitableSeasons: ['autumn', 'winter'],
    suitableCoatTypes: ['short', 'medium', 'long', 'hairless'],
    suitableScenarios: ['party', 'daily'],
    pros: [
      '质感华丽高级',
      '手感柔软舒适',
      '保暖性较好',
      '视觉效果好',
    ],
    cons: [
      '容易粘毛',
      '需要特殊护理',
      '容易产生压痕',
      '不适合激烈运动',
    ],
    careTips: [
      '建议干洗',
      '避免折叠，悬挂存放',
      '使用软毛刷轻轻梳理',
      '避免高温接触',
    ],
  },
];

export function getMaterialByType(type: MaterialType): MaterialRule | undefined {
  return materialRules.find(m => m.materialType === type);
}

export function getMaterialsBySeason(season: Season): MaterialRule[] {
  return materialRules.filter(m => m.suitableSeasons.includes(season));
}

export function getMaterialsByCoatType(coatType: CoatType): MaterialRule[] {
  return materialRules.filter(m => m.suitableCoatTypes.includes(coatType));
}

export function getMaterialsByScenario(scenario: Scenario): MaterialRule[] {
  return materialRules.filter(m => m.suitableScenarios.includes(scenario));
}

export interface MaterialRecommendation {
  material: MaterialRule;
  score: number;
  priority: 'high' | 'medium' | 'low';
  reasons: string[];
}

export function recommendMaterials(
  season: Season,
  coatType: CoatType,
  scenario: Scenario
): MaterialRecommendation[] {
  const recommendations: MaterialRecommendation[] = [];
  
  for (const material of materialRules) {
    let score = 0;
    const reasons: string[] = [];
    
    if (material.suitableSeasons.includes(season)) {
      score += 40;
      reasons.push(`适合${getSeasonName(season)}穿着`);
    }
    
    if (material.suitableCoatTypes.includes(coatType)) {
      score += 30;
      reasons.push(`适合${getCoatTypeName(coatType)}宠物`);
    }
    
    if (material.suitableScenarios.includes(scenario)) {
      score += 30;
      reasons.push(`适合${getScenarioName(scenario)}场景`);
    }
    
    if (score > 0) {
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (score >= 80) priority = 'high';
      else if (score <= 40) priority = 'low';
      
      recommendations.push({
        material,
        score,
        priority,
        reasons,
      });
    }
  }
  
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations;
}

function getSeasonName(season: Season): string {
  const names: Record<Season, string> = {
    spring: '春季',
    summer: '夏季',
    autumn: '秋季',
    winter: '冬季',
  };
  return names[season];
}

function getCoatTypeName(coatType: CoatType): string {
  const names: Record<CoatType, string> = {
    short: '短毛',
    medium: '中毛',
    long: '长毛',
    double: '双层毛',
    hairless: '无毛',
  };
  return names[coatType];
}

function getScenarioName(scenario: Scenario): string {
  const names: Record<Scenario, string> = {
    daily: '日常居家',
    outdoor: '户外出行',
    sports: '运动健身',
    party: '派对节日',
    sleep: '睡眠保暖',
  };
  return names[scenario];
}

export function generateMaterialTips(
  season: Season,
  coatType: CoatType,
  scenario: Scenario
): string[] {
  const tips: string[] = [];
  
  if (season === 'winter') {
    tips.push('冬季保暖优先，建议选择摇粒绒、羊毛、羽绒等保暖材质');
    if (coatType === 'short' || coatType === 'hairless') {
      tips.push('短毛或无毛宠物在冬季需要额外保暖，建议选择羽绒或羊毛材质');
    }
  }
  
  if (season === 'summer') {
    tips.push('夏季以透气凉爽为主，建议选择纯棉、亚麻等天然透气材质');
    if (coatType === 'long' || coatType === 'double') {
      tips.push('长毛或双层毛宠物夏季本身已有较好的保暖性，建议选择轻薄透气的衣物');
    }
  }
  
  if (scenario === 'party') {
    tips.push('派对场合可以选择丝绒等质感华丽的材质，让宠物更加亮眼');
  }
  
  if (scenario === 'sports' || scenario === 'outdoor') {
    tips.push('运动或户外场景建议选择尼龙或防水面料，耐磨耐用，活动自如');
    if (season === 'winter') {
      tips.push('冬季户外活动建议选择防风防水的保暖外套');
    }
  }
  
  if (scenario === 'sleep') {
    tips.push('睡眠时建议选择柔软舒适的纯棉或摇粒绒材质，让宠物睡得更安稳');
  }
  
  if (coatType === 'hairless') {
    tips.push('无毛宠物需要特别注意皮肤保护，建议选择柔软亲肤的天然材质，避免刺激皮肤');
  }
  
  return tips;
}
