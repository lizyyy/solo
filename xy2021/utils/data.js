const CARBON_FACTORS = {
  transport: {
    taxi: 0.21,
    bus: 0.08,
    subway: 0.05,
    bike: 0,
    walk: 0,
    privateCar: 0.25,
    train: 0.06,
    flight: 0.255
  },
  electricity: 0.785,
  food: {
    fastFood: 2.5,
    takeout: 1.8,
    homeCook: 0.5,
    vegetarian: 0.3
  },
  disposable: {
    straw: 0.005,
    plasticBag: 0.03,
    chopsticks: 0.02,
    waterBottle: 0.08,
    coffeeCup: 0.06
  },
  recycle: {
    paper: 2.5,
    plastic: 6.0,
    glass: 1.4,
    metal: 8.0,
    fabric: 2.0,
    electronics: 15.0
  }
};

const POINTS_RULES = {
  checkIn: { base: 10, streakBonus: 1 },
  taskComplete: 20,
  recycle: {
    paper: 5,
    plastic: 8,
    glass: 6,
    metal: 10,
    fabric: 7,
    electronics: 25
  },
  avoidDisposable: {
    straw: 2,
    plasticBag: 5,
    chopsticks: 3,
    waterBottle: 8,
    coffeeCup: 6
  },
  carbonReduction: 10
};

const AIR_QUALITY_LEVELS = [
  { level: '优', min: 0, max: 50, color: '#4CAF50', suggestion: '空气质量令人满意，基本无空气污染，可正常进行户外活动。' },
  { level: '良', min: 51, max: 100, color: '#8BC34A', suggestion: '空气质量可接受，但某些污染物可能对极少数异常敏感人群健康有较弱影响，建议极少数异常敏感人群应减少户外活动。' },
  { level: '轻度污染', min: 101, max: 150, color: '#FFEB3B', suggestion: '易感人群症状有轻度加剧，健康人群出现刺激症状，建议儿童、老年人及心脏病、呼吸系统疾病患者应减少长时间、高强度的户外锻炼。' },
  { level: '中度污染', min: 151, max: 200, color: '#FF9800', suggestion: '进一步加剧易感人群症状，可能对健康人群心脏、呼吸系统有影响，建议疾病患者避免长时间、高强度的户外锻练，一般人群适量减少户外运动。' },
  { level: '重度污染', min: 201, max: 300, color: '#F44336', suggestion: '心脏病和肺病患者症状显著加剧，运动耐受力降低，健康人群普遍出现症状，建议儿童、老年人和心脏病、肺病患者应停留在室内，停止户外运动，一般人群减少户外运动。' },
  { level: '严重污染', min: 301, max: 500, color: '#880E4F', suggestion: '健康人群运动耐受力降低，有明显强烈症状，提前出现某些疾病，建议儿童、老年人和病人应当留在室内，避免体力消耗，一般人群应避免户外活动。' }
];

const GARBAGE_CATEGORIES = [
  {
    id: 'recyclable',
    name: '可回收物',
    color: '#2196F3',
    icon: '♻️',
    description: '可循环利用的废弃物',
    examples: ['纸张', '塑料瓶', '玻璃瓶', '金属', '织物'],
    tips: ['轻投轻放', '清洁干燥', '避免污染', '废纸尽量平整']
  },
  {
    id: 'kitchen',
    name: '厨余垃圾',
    color: '#4CAF50',
    icon: '🍃',
    description: '易腐烂的生物质废弃物',
    examples: ['剩菜剩饭', '果皮', '茶渣', '蛋壳', '蔬菜'],
    tips: ['沥干水分', '去除包装物', '纯流质直接倒入下水口']
  },
  {
    id: 'harmful',
    name: '有害垃圾',
    color: '#F44336',
    icon: '☠️',
    description: '对人体健康或自然环境有害的废弃物',
    examples: ['废电池', '废灯管', '废药品', '废油漆', '消毒剂'],
    tips: ['单独投放', '轻拿轻放', '易破损包装后投放']
  },
  {
    id: 'other',
    name: '其他垃圾',
    color: '#9E9E9E',
    icon: '🗑️',
    description: '除上述垃圾之外的其他生活废弃物',
    examples: ['砖瓦陶瓷', '渣土', '卫生间废纸', '纸巾', '烟蒂'],
    tips: ['尽量沥干水分', '难以辨识类别的投入其他垃圾']
  }
];

const CONFUSING_GARBAGE = [
  { name: '大骨头', correct: 'other', wrong: 'kitchen', reason: '大骨头难以粉碎，不适合堆肥处理' },
  { name: '椰子壳', correct: 'other', wrong: 'kitchen', reason: '质地坚硬，难以分解' },
  { name: '榴莲壳', correct: 'other', wrong: 'kitchen', reason: '质地坚硬，难以分解' },
  { name: '玉米皮', correct: 'other', wrong: 'kitchen', reason: '难以粉碎，可能缠绕设备' },
  { name: '一次性筷子', correct: 'other', wrong: 'recyclable', reason: '已被污染，回收价值低' },
  { name: '外卖餐盒', correct: 'other', wrong: 'recyclable', reason: '被油污污染，难以清洗回收' },
  { name: '卫生纸', correct: 'other', wrong: 'recyclable', reason: '遇水即溶，不可回收' },
  { name: '湿巾', correct: 'other', wrong: 'recyclable', reason: '含有化学物质，不可回收' },
  { name: '陶瓷碗', correct: 'other', wrong: 'recyclable', reason: '不可回收，也无回收价值' },
  { name: '旧毛巾', correct: 'other', wrong: 'recyclable', reason: '已被污染，回收价值低' },
  { name: '旧牙刷', correct: 'other', wrong: 'recyclable', reason: '混合材质，难以分离回收' },
  { name: '染发剂', correct: 'harmful', wrong: 'other', reason: '含有有害化学物质' },
  { name: '过期化妆品', correct: 'harmful', wrong: 'other', reason: '可能含有害成分' },
  { name: '废旧灯泡', correct: 'harmful', wrong: 'other', reason: '含有汞等有害物质' }
];

const DAILY_TASKS = [
  { id: 1, title: '自带购物袋', description: '去超市购物时使用环保袋', points: 10, category: 'shopping', icon: '🛍️' },
  { id: 2, title: '步行或骑车出行', description: '短距离出行选择步行或骑车', points: 15, category: 'transport', icon: '🚲' },
  { id: 3, title: '关灯节电', description: '离开房间时随手关灯', points: 5, category: 'electricity', icon: '💡' },
  { id: 4, title: '节约用水', description: '缩短洗澡时间，关紧水龙头', points: 5, category: 'water', icon: '💧' },
  { id: 5, title: '光盘行动', description: '吃饭不浪费，践行光盘', points: 10, category: 'food', icon: '🍽️' },
  { id: 6, title: '拒绝一次性吸管', description: '喝饮料时不用吸管', points: 5, category: 'disposable', icon: '🥤' },
  { id: 7, title: '垃圾分类', description: '正确分类投放垃圾', points: 10, category: 'recycle', icon: '♻️' },
  { id: 8, title: '乘坐公共交通', description: '选择公交、地铁出行', points: 12, category: 'transport', icon: '🚌' },
  { id: 9, title: '自带水杯', description: '使用自己的水杯，拒绝瓶装水', points: 8, category: 'disposable', icon: '🥤' },
  { id: 10, title: '少用外卖', description: '自己做饭或堂食', points: 15, category: 'food', icon: '🍳' },
  { id: 11, title: '旧物利用', description: '将旧物改造成新用品', points: 20, category: 'recycle', icon: '🔨' },
  { id: 12, title: '种植绿植', description: '在家中或办公室种植绿色植物', points: 15, category: 'nature', icon: '🌱' }
];

const EARTH_MESSAGES = [
  {
    date: '04-22',
    title: '世界地球日',
    content: '今天是世界地球日。让我们一起为地球母亲做一件小事——种下一棵树，或者少用一个塑料袋。每一个小小的行动，都是对地球的爱的表达。',
    mood: 'hopeful',
    icon: '🌍'
  },
  {
    date: '06-05',
    title: '世界环境日',
    content: '联合国设立的世界环境日，提醒全球关注环境问题。今天，让我们反思自己的生活方式，为可持续发展贡献一份力量。',
    mood: 'serious',
    icon: '🌿'
  },
  {
    date: 'default',
    title: '地球的呼吸',
    content: '每一片树叶都是地球的肺，每一滴清水都是地球的血液。我们的每一个环保行动，都是在帮助地球更健康地呼吸。',
    mood: 'peaceful',
    icon: '🍃'
  }
];

const HEALING_QUOTES = [
  '大自然是最伟大的治愈师。',
  '每一片落叶都是大地的情书。',
  '绿水青山就是金山银山。',
  '保护地球，从保护每一滴水开始。',
  '我们不是继承了地球，而是向后代借用了它。',
  '种下一棵树，就是种下一个希望。',
  '减少一份污染，增加一份清新。',
  '环保不是口号，而是每一天的行动。',
  '让天空更蓝，让河水更清。',
  '地球只有一个，让我们共同守护。'
];

function calculateCarbonFootprint(type, subtype, amount) {
  let factor = 0;
  
  switch (type) {
    case 'transport':
      factor = CARBON_FACTORS.transport[subtype] || 0;
      return factor * amount;
    case 'electricity':
      factor = CARBON_FACTORS.electricity;
      return factor * amount;
    case 'food':
      factor = CARBON_FACTORS.food[subtype] || 0;
      return factor * amount;
    case 'disposable':
      factor = CARBON_FACTORS.disposable[subtype] || 0;
      return factor * amount;
    default:
      return 0;
  }
}

function getAirQualityLevel(aqi) {
  for (const level of AIR_QUALITY_LEVELS) {
    if (aqi >= level.min && aqi <= level.max) {
      return level;
    }
  }
  return AIR_QUALITY_LEVELS[AIR_QUALITY_LEVELS.length - 1];
}

function getTodayTasks() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const dayOfMonth = today.getDate();
  
  const selectedTasks = [];
  const taskCount = 5;
  
  for (let i = 0; i < taskCount; i++) {
    const index = (dayOfMonth + dayOfWeek * 7 + i) % DAILY_TASKS.length;
    if (!selectedTasks.find(t => t.id === DAILY_TASKS[index].id)) {
      selectedTasks.push({...DAILY_TASKS[index], completed: false});
    }
  }
  
  return selectedTasks;
}

function calculateRecycleValue(category, weight) {
  const factor = CARBON_FACTORS.recycle[category] || 0;
  const points = POINTS_RULES.recycle[category] || 0;
  
  return {
    carbonSaved: factor * weight,
    points: Math.floor(points * weight)
  };
}

function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRandomHealingQuote() {
  const index = Math.floor(Math.random() * HEALING_QUOTES.length);
  return HEALING_QUOTES[index];
}

function generateMockAirData(city = '北京') {
  const baseAqi = Math.floor(Math.random() * 150) + 30;
  const level = getAirQualityLevel(baseAqi);
  
  return {
    city: city,
    aqi: baseAqi,
    level: level.level,
    color: level.color,
    suggestion: level.suggestion,
    pollutants: {
      pm25: Math.floor(Math.random() * 100) + 10,
      pm10: Math.floor(Math.random() * 150) + 20,
      o3: Math.floor(Math.random() * 80) + 20,
      no2: Math.floor(Math.random() * 60) + 10,
      so2: Math.floor(Math.random() * 20) + 5,
      co: (Math.random() * 2 + 0.5).toFixed(1)
    },
    updateTime: formatDate(new Date()) + ' ' + new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})
  };
}

module.exports = {
  CARBON_FACTORS,
  POINTS_RULES,
  AIR_QUALITY_LEVELS,
  GARBAGE_CATEGORIES,
  CONFUSING_GARBAGE,
  DAILY_TASKS,
  EARTH_MESSAGES,
  HEALING_QUOTES,
  calculateCarbonFootprint,
  getAirQualityLevel,
  getTodayTasks,
  calculateRecycleValue,
  formatDate,
  getRandomHealingQuote,
  generateMockAirData
};
