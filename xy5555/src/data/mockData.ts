import { DesignPlan, DesignStyle, BudgetRange, SpaceType, FurnitureItem, User, UserPreferences } from './types';

// 设计风格名称映射
export const styleNames: Record<DesignStyle, string> = {
  [DesignStyle.MINIMALIST]: '极简风格',
  [DesignStyle.NORDIC]: '北欧风格',
  [DesignStyle.JAPANESE]: '日式风格',
  [DesignStyle.INDUSTRIAL]: '工业风格',
  [DesignStyle.MODERN]: '现代风格',
  [DesignStyle.LUXURY]: '轻奢风格'
};

// 预算范围名称映射
export const budgetRangeNames: Record<BudgetRange, string> = {
  [BudgetRange.LOW]: '经济型 (5-8万)',
  [BudgetRange.MEDIUM]: '舒适型 (8-15万)',
  [BudgetRange.HIGH]: '高端型 (15-25万)',
  [BudgetRange.PREMIUM]: '豪华型 (25万以上)'
};

// 空间类型名称映射
export const spaceTypeNames: Record<SpaceType, string> = {
  [SpaceType.LIVING_ROOM]: '客厅',
  [SpaceType.BEDROOM]: '卧室',
  [SpaceType.KITCHEN]: '厨房',
  [SpaceType.BATHROOM]: '卫生间',
  [SpaceType.STUDY]: '书房',
  [SpaceType.DINING_ROOM]: '餐厅'
};

// 生成唯一ID - 使用固定前缀和索引，确保ID稳定
const generateId = (prefix: string = 'plan', index: number = 0): string => {
  return `${prefix}_${String(index + 1).padStart(3, '0')}`;
};

// 生成图片URL
const getImageUrl = (type: string, index: number): string => {
  const prompts: Record<string, string[]> = {
    'minimalist': [
      '极简风格25平米小户型客厅设计，白色为主色调，简洁的沙发和茶几，大量自然光线，现代简约风格',
      '极简风格卧室设计，低矮床架，简单的床头柜，大面积落地窗，白色和木色搭配',
      '极简风格厨房设计，嵌入式家电，简洁的橱柜，白色石英石台面，现代简约'
    ],
    'nordic': [
      '北欧风格25平米小户型设计，白色和浅木色为主，舒适的布艺沙发，绿植点缀，自然光线充足',
      '北欧风格卧室，木质地板，白色床单，简约的灯具，温馨舒适的氛围',
      '北欧风格开放式厨房，白色橱柜，木质台面，开放式置物架，简约实用'
    ],
    'japanese': [
      '日式风格25平米小户型设计，榻榻米，原木色，推拉门，简约自然的禅意氛围',
      '日式风格卧室，榻榻米床垫，低床设计，木质格栅，柔和的灯光',
      '日式风格厨房，木质橱柜，简约设计，自然材质，整洁有序'
    ],
    'industrial': [
      '工业风格25平米小户型设计，裸露的砖墙，金属元素，水泥地面，复古灯具',
      '工业风格卧室，金属床架，砖墙背景，复古灯具，粗犷而有质感',
      '工业风格厨房，金属橱柜，开放式置物架，复古灯具，个性十足'
    ],
    'modern': [
      '现代风格25平米小户型设计，简洁的线条，功能性家具，中性色调，时尚简约',
      '现代风格卧室，低矮床设计，简约床头柜，背景墙设计，时尚舒适',
      '现代风格厨房，嵌入式家电，简约橱柜，石英石台面，现代感十足'
    ],
    'luxury': [
      '轻奢风格25平米小户型设计，金属元素，大理石纹理，柔和的灯光，高端质感',
      '轻奢风格卧室，软包床头，金属装饰，精致的灯具，高端舒适',
      '轻奢风格厨房，大理石台面，金属拉手，嵌入式家电，高端大气'
    ],
    'furniture': [
      '现代简约沙发，布艺材质，浅灰色，舒适实用，客厅家具',
      '北欧风格餐桌，木质材质，圆形设计，简约实用，餐厅家具',
      '极简风格床架，木质材质，低矮设计，简约舒适，卧室家具',
      '现代风格衣柜，推拉门设计，大容量储物，简约实用，卧室家具',
      '北欧风格茶几，圆形设计，木质台面，简约实用，客厅家具'
    ]
  };
  
  const promptList = prompts[type] || prompts['furniture'];
  const prompt = promptList[index % promptList.length];
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=square_hd`;
};

// 生成家具数据
const generateFurniture = (style: DesignStyle): FurnitureItem[] => {
  const furnitureItems: FurnitureItem[] = [
    {
      id: generateId('furniture', 0),
      name: '简约布艺沙发',
      description: '舒适的三人位布艺沙发，适合小户型客厅使用',
      price: style === DesignStyle.LUXURY ? 12800 : style === DesignStyle.HIGH ? 8800 : 4999,
      image: getImageUrl('furniture', 0),
      spaceType: SpaceType.LIVING_ROOM,
      dimensions: { width: 220, height: 85, depth: 90 },
      material: '棉麻布艺',
      brand: '宜家家居'
    },
    {
      id: generateId('furniture', 1),
      name: '北欧风格餐桌',
      description: '简约圆形餐桌，适合2-4人使用',
      price: style === DesignStyle.LUXURY ? 8500 : style === DesignStyle.HIGH ? 5600 : 2999,
      image: getImageUrl('furniture', 1),
      spaceType: SpaceType.DINING_ROOM,
      dimensions: { width: 120, height: 75, depth: 120 },
      material: '橡木',
      brand: '无印良品'
    },
    {
      id: generateId('furniture', 2),
      name: '极简风格床架',
      description: '低矮设计的木质床架，简约而舒适',
      price: style === DesignStyle.LUXURY ? 9800 : style === DesignStyle.HIGH ? 6500 : 3999,
      image: getImageUrl('furniture', 2),
      spaceType: SpaceType.BEDROOM,
      dimensions: { width: 180, height: 35, depth: 200 },
      material: '榉木',
      brand: '宜家家居'
    },
    {
      id: generateId('furniture', 3),
      name: '大容量推拉门衣柜',
      description: '定制推拉门衣柜，充分利用空间',
      price: style === DesignStyle.LUXURY ? 15600 : style === DesignStyle.HIGH ? 9800 : 5999,
      image: getImageUrl('furniture', 3),
      spaceType: SpaceType.BEDROOM,
      dimensions: { width: 240, height: 240, depth: 60 },
      material: '颗粒板',
      brand: '索菲亚'
    },
    {
      id: generateId('furniture', 4),
      name: '圆形木质茶几',
      description: '简约圆形茶几，与沙发完美搭配',
      price: style === DesignStyle.LUXURY ? 3500 : style === DesignStyle.HIGH ? 2200 : 1299,
      image: getImageUrl('furniture', 4),
      spaceType: SpaceType.LIVING_ROOM,
      dimensions: { width: 80, height: 45, depth: 80 },
      material: '橡木',
      brand: '无印良品'
    }
  ];
  
  return furnitureItems;
};

// 生成设计方案数据
const generateDesignPlans = (): DesignPlan[] => {
  const plans: DesignPlan[] = [];
  
  const styles = [DesignStyle.MINIMALIST, DesignStyle.NORDIC, DesignStyle.JAPANESE, DesignStyle.MODERN, DesignStyle.LUXURY, DesignStyle.INDUSTRIAL];
  
  const planData = [
    {
      name: '极简主义空间',
      description: '以极简风格为核心，通过简洁的线条和功能性家具，打造出25平米小户型的极致利用。整体色调以白色和浅木色为主，营造出宽敞明亮的空间感。',
      tags: ['极简', '小户型', '高利用率', '明亮'],
      budget: 128000,
      budgetRange: BudgetRange.MEDIUM,
      style: DesignStyle.MINIMALIST,
      viewCount: 15680,
      likeCount: 2345
    },
    {
      name: '北欧温馨小窝',
      description: '北欧风格设计，注重自然光线和舒适感。大量使用浅木色和白色，搭配绿植点缀，营造出温馨自然的家居氛围。开放式布局让空间更加通透。',
      tags: ['北欧', '温馨', '自然', '绿植'],
      budget: 156000,
      budgetRange: BudgetRange.MEDIUM,
      style: DesignStyle.NORDIC,
      viewCount: 18920,
      likeCount: 3156
    },
    {
      name: '日式禅意空间',
      description: '日式风格设计，追求简约自然的禅意氛围。榻榻米设计、原木色家具、推拉门等元素，让25平米的空间充满东方韵味。',
      tags: ['日式', '禅意', '榻榻米', '原木'],
      budget: 138000,
      budgetRange: BudgetRange.MEDIUM,
      style: DesignStyle.JAPANESE,
      viewCount: 12450,
      likeCount: 1890
    },
    {
      name: '现代都市公寓',
      description: '现代风格设计，强调功能性和时尚感。简洁的线条、中性色调、智能家电的融入，打造出适合都市年轻人的理想居所。',
      tags: ['现代', '时尚', '智能', '都市'],
      budget: 189000,
      budgetRange: BudgetRange.HIGH,
      style: DesignStyle.MODERN,
      viewCount: 21340,
      likeCount: 3567
    },
    {
      name: '轻奢质感生活',
      description: '轻奢风格设计，在简约基础上融入金属元素和大理石纹理。柔和的灯光、精致的细节处理，让25平米的空间充满高端质感。',
      tags: ['轻奢', '高端', '质感', '精致'],
      budget: 268000,
      budgetRange: BudgetRange.PREMIUM,
      style: DesignStyle.LUXURY,
      viewCount: 9870,
      likeCount: 1234
    },
    {
      name: '工业风个性空间',
      description: '工业风格设计，裸露的砖墙、金属元素、水泥地面等元素，打造出充满个性和艺术感的空间。适合追求独特风格的年轻人。',
      tags: ['工业', '个性', '艺术', '复古'],
      budget: 145000,
      budgetRange: BudgetRange.MEDIUM,
      style: DesignStyle.INDUSTRIAL,
      viewCount: 8760,
      likeCount: 987
    }
  ];
  
  planData.forEach((plan, index) => {
    const mainImage = getImageUrl(plan.style, 0);
    const images = [
      mainImage,
      getImageUrl(plan.style, 1),
      getImageUrl(plan.style, 2)
    ];
    
    const designPlan: DesignPlan = {
      id: generateId('plan', index),
      name: plan.name,
      description: plan.description,
      style: plan.style,
      totalBudget: plan.budget,
      budgetRange: plan.budgetRange,
      area: 25,
      images: images,
      mainImage: mainImage,
      tags: plan.tags,
      furnitureItems: generateFurniture(plan.style),
      designer: {
        name: ['张小明', '李设计', '王创意', '赵美学', '刘空间', '陈灵感'][index],
        avatar: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent('专业室内设计师头像，微笑，专业着装，办公室背景')}&image_size=square`,
        rating: 4.5 + Math.random() * 0.5
      },
      createdAt: Date.now() - index * 86400000,
      updatedAt: Date.now() - index * 43200000,
      isFavorite: index < 2,
      viewCount: plan.viewCount,
      likeCount: plan.likeCount
    };
    
    plans.push(designPlan);
  });
  
  return plans;
};

// 生成用户数据
const generateUser = (): User => {
  const preferences: UserPreferences = {
    id: 'pref_001',
    userId: 'user_001',
    preferredStyles: [DesignStyle.MINIMALIST, DesignStyle.NORDIC, DesignStyle.MODERN],
    budgetRange: BudgetRange.MEDIUM,
    preferredMaterials: ['实木', '棉麻', '橡木'],
    colorPreferences: ['白色', '浅木色', '灰色'],
    spacePriorities: [SpaceType.LIVING_ROOM, SpaceType.BEDROOM, SpaceType.KITCHEN],
    createdAt: Date.now() - 30 * 86400000,
    updatedAt: Date.now()
  };
  
  return {
    id: 'user_001',
    name: '家居爱好者',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=用户头像，简约风格，微笑，现代感&image_size=square',
    phone: '138****8888',
    email: 'user@example.com',
    preferences: preferences
  };
};

// 导出模拟数据
export const mockDesignPlans: DesignPlan[] = generateDesignPlans();
export const mockUser: User = generateUser();

// 获取所有设计方案
export const getAllDesignPlans = (): DesignPlan[] => {
  return [...mockDesignPlans];
};

// 根据风格筛选设计方案
export const getDesignPlansByStyle = (style: DesignStyle): DesignPlan[] => {
  return mockDesignPlans.filter(plan => plan.style === style);
};

// 根据预算范围筛选设计方案
export const getDesignPlansByBudgetRange = (budgetRange: BudgetRange): DesignPlan[] => {
  return mockDesignPlans.filter(plan => plan.budgetRange === budgetRange);
};

// 根据ID获取设计方案
export const getDesignPlanById = (id: string): DesignPlan | undefined => {
  return mockDesignPlans.find(plan => plan.id === id);
};

// 根据用户偏好推荐设计方案
export const getRecommendedPlans = (preferences: UserPreferences): DesignPlan[] => {
  const { preferredStyles, budgetRange } = preferences;
  
  // 首先匹配偏好风格和预算范围
  let recommended = mockDesignPlans.filter(plan => 
    preferredStyles.includes(plan.style) && plan.budgetRange === budgetRange
  );
  
  // 如果没有匹配的，只匹配风格
  if (recommended.length === 0) {
    recommended = mockDesignPlans.filter(plan => preferredStyles.includes(plan.style));
  }
  
  // 如果还是没有，返回热度最高的
  if (recommended.length === 0) {
    recommended = [...mockDesignPlans].sort((a, b) => b.viewCount - a.viewCount);
  }
  
  return recommended;
};

// 计算预算估算
export const calculateBudgetEstimate = (params: {
  style: DesignStyle;
  area: number;
  budgetRange: BudgetRange;
  hasSmartHome?: boolean;
  hasCustomCabinets?: boolean;
  hasHighEndMaterials?: boolean;
}): {
  totalBudget: number;
  breakdown: { category: string; amount: number; percentage: number }[];
  tips: string[];
} => {
  const { style, area, budgetRange, hasSmartHome = false, hasCustomCabinets = true, hasHighEndMaterials = false } = params;
  
  // 基础预算单价（元/平米）
  const basePricePerSqm: Record<BudgetRange, number> = {
    [BudgetRange.LOW]: 2000,
    [BudgetRange.MEDIUM]: 4000,
    [BudgetRange.HIGH]: 7000,
    [BudgetRange.PREMIUM]: 12000
  };
  
  // 风格系数
  const styleMultiplier: Record<DesignStyle, number> = {
    [DesignStyle.MINIMALIST]: 1.0,
    [DesignStyle.NORDIC]: 1.1,
    [DesignStyle.JAPANESE]: 1.05,
    [DesignStyle.INDUSTRIAL]: 1.15,
    [DesignStyle.MODERN]: 1.1,
    [DesignStyle.LUXURY]: 1.3
  };
  
  let totalBudget = area * basePricePerSqm[budgetRange] * styleMultiplier[style];
  
  // 额外配置费用
  let extraCost = 0;
  if (hasSmartHome) extraCost += 15000;
  if (hasCustomCabinets) extraCost += 8000;
  if (hasHighEndMaterials) extraCost += 20000;
  
  totalBudget += extraCost;
  
  // 费用明细
  const breakdown = [
    { category: '设计费', amount: totalBudget * 0.1, percentage: 10 },
    { category: '硬装工程', amount: totalBudget * 0.35, percentage: 35 },
    { category: '主材', amount: totalBudget * 0.25, percentage: 25 },
    { category: '定制家具', amount: totalBudget * 0.2, percentage: 20 },
    { category: '软装配饰', amount: totalBudget * 0.1, percentage: 10 }
  ];
  
  // 费用建议
  const tips: string[] = [];
  
  tips.push(`根据您选择的${styleNames[style]}和${budgetRangeNames[budgetRange]}，25平米的预估总预算约为${Math.round(totalBudget)}元。`);
  
  if (budgetRange === BudgetRange.LOW) {
    tips.push('经济型预算建议优先选择性价比高的主材，可考虑使用复合地板和普通瓷砖。');
  } else if (budgetRange === BudgetRange.MEDIUM) {
    tips.push('舒适型预算可以考虑实木复合地板和品牌瓷砖，厨房橱柜可选择中等价位的定制品牌。');
  } else if (budgetRange === BudgetRange.HIGH) {
    tips.push('高端型预算可以选择实木地板、进口瓷砖和高端定制橱柜，考虑增加智能家居系统。');
  } else {
    tips.push('豪华型预算可以选择进口主材、高端定制家具和全套智能家居系统，建议聘请专业设计师进行整体规划。');
  }
  
  if (hasSmartHome) {
    tips.push('智能家居系统建议预算15000-30000元，包括智能灯光、智能窗帘、智能安防等。');
  }
  
  tips.push('建议预留总预算的10%作为应急资金，以应对装修过程中可能出现的意外情况。');
  
  return {
    totalBudget: Math.round(totalBudget),
    breakdown: breakdown.map(item => ({
      ...item,
      amount: Math.round(item.amount)
    })),
    tips
  };
};
