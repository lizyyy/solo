import { Template, ActivityType, WeatherType, ItemCategory } from '../types';

// 模板库数据
export const templates: Template[] = [
  {
    id: 'winter-travel',
    name: '冬季旅行',
    description: '适合寒冷天气的旅行，包含保暖衣物和必备用品',
    icon: '❄️',
    activity: 'city',
    weather: 'cold',
    recommendedDays: 7,
    defaultItems: [
      { name: '羽绒服', category: 'clothing', quantity: 1 },
      { name: '厚毛衣', category: 'clothing', quantity: 2 },
      { name: '保暖内衣', category: 'clothing', quantity: 3 },
      { name: '围巾', category: 'accessories', quantity: 1 },
      { name: '手套', category: 'accessories', quantity: 1 },
      { name: '帽子', category: 'accessories', quantity: 1 },
      { name: '暖宝宝', category: 'other', quantity: 10 },
      { name: '防滑鞋', category: 'clothing', quantity: 1 },
    ]
  },
  {
    id: 'family-trip',
    name: '亲子游',
    description: '适合带孩子出行的清单，包含儿童用品和应急物品',
    icon: '👨‍👩‍👧',
    activity: 'family',
    weather: 'sunny',
    recommendedDays: 5,
    defaultItems: [
      { name: '儿童换洗衣物', category: 'clothing', quantity: 5 },
      { name: '儿童洗漱用品', category: 'toiletries', quantity: 1 },
      { name: '儿童常用药', category: 'medicine', quantity: 1 },
      { name: '玩具/绘本', category: 'other', quantity: 2 },
      { name: '婴儿车/背带', category: 'other', quantity: 1 },
      { name: '零食/奶粉', category: 'other', quantity: 3 },
      { name: '儿童防晒霜', category: 'toiletries', quantity: 1 },
      { name: '驱蚊液', category: 'toiletries', quantity: 1 },
    ]
  },
  {
    id: 'business-trip',
    name: '商务出差',
    description: '适合商务出行的清单，包含正装和工作必备用品',
    icon: '💼',
    activity: 'business',
    weather: 'sunny',
    recommendedDays: 3,
    defaultItems: [
      { name: '西装套装', category: 'clothing', quantity: 2 },
      { name: '正装衬衫', category: 'clothing', quantity: 3 },
      { name: '领带', category: 'accessories', quantity: 3 },
      { name: '皮鞋', category: 'clothing', quantity: 1 },
      { name: '笔记本电脑', category: 'electronics', quantity: 1 },
      { name: '充电器', category: 'electronics', quantity: 2 },
      { name: '充电宝', category: 'electronics', quantity: 1 },
      { name: '名片夹', category: 'accessories', quantity: 1 },
      { name: '商务记事本', category: 'other', quantity: 1 },
    ]
  },
  {
    id: 'beach-vacation',
    name: '海滩度假',
    description: '适合海滩度假的清单，包含泳衣和防晒用品',
    icon: '🏖️',
    activity: 'beach',
    weather: 'hot',
    recommendedDays: 5,
    defaultItems: [
      { name: '泳衣', category: 'clothing', quantity: 2 },
      { name: '防晒霜', category: 'toiletries', quantity: 2 },
      { name: '太阳镜', category: 'accessories', quantity: 1 },
      { name: '遮阳帽', category: 'accessories', quantity: 1 },
      { name: '沙滩巾', category: 'other', quantity: 1 },
      { name: '人字拖', category: 'clothing', quantity: 1 },
      { name: '防水袋', category: 'other', quantity: 1 },
      { name: '驱蚊液', category: 'toiletries', quantity: 1 },
      { name: '薄外套', category: 'clothing', quantity: 1 },
    ]
  },
  {
    id: 'mountain-hiking',
    name: '登山徒步',
    description: '适合登山徒步的清单，包含户外装备和应急用品',
    icon: '⛰️',
    activity: 'mountain',
    weather: 'sunny',
    recommendedDays: 2,
    defaultItems: [
      { name: '登山鞋', category: 'clothing', quantity: 1 },
      { name: '速干衣裤', category: 'clothing', quantity: 2 },
      { name: '冲锋衣', category: 'clothing', quantity: 1 },
      { name: '登山杖', category: 'other', quantity: 2 },
      { name: '背包', category: 'accessories', quantity: 1 },
      { name: '水壶', category: 'other', quantity: 1 },
      { name: '头灯', category: 'electronics', quantity: 1 },
      { name: '急救包', category: 'medicine', quantity: 1 },
      { name: '能量棒', category: 'other', quantity: 5 },
    ]
  },
];

// 智能生成规则：根据活动类型生成物品
export const getItemsByActivity = (activity: ActivityType): Omit<Omit<Omit<Omit<import('../types').PackingItem, "id">, "completed">, "completedBy">, "notes">[] => {
  const items: Omit<Omit<Omit<Omit<import('../types').PackingItem, "id">, "completed">, "completedBy">, "notes">[] = [];
  
  // 基础物品（所有活动都需要）
  const baseItems: Omit<Omit<Omit<Omit<import('../types').PackingItem, "id">, "completed">, "completedBy">, "notes">[] = [
    { name: '身份证', category: 'documents', quantity: 1 },
    { name: '手机', category: 'electronics', quantity: 1 },
    { name: '手机充电器', category: 'electronics', quantity: 1 },
    { name: '钱包', category: 'accessories', quantity: 1 },
    { name: '钥匙', category: 'accessories', quantity: 1 },
    { name: '纸巾', category: 'other', quantity: 2 },
    { name: '口罩', category: 'other', quantity: 5 },
  ];
  
  items.push(...baseItems);
  
  // 根据活动类型添加物品
  switch (activity) {
    case 'business':
      items.push(
        { name: '西装套装', category: 'clothing', quantity: 2 },
        { name: '正装衬衫', category: 'clothing', quantity: 3 },
        { name: '领带', category: 'accessories', quantity: 3 },
        { name: '皮鞋', category: 'clothing', quantity: 1 },
        { name: '笔记本电脑', category: 'electronics', quantity: 1 },
        { name: '电脑充电器', category: 'electronics', quantity: 1 },
        { name: '充电宝', category: 'electronics', quantity: 1 },
        { name: '名片夹', category: 'accessories', quantity: 1 },
        { name: '商务记事本', category: 'other', quantity: 1 },
        { name: '钢笔', category: 'accessories', quantity: 2 },
      );
      break;
      
    case 'beach':
      items.push(
        { name: '泳衣', category: 'clothing', quantity: 2 },
        { name: '防晒霜', category: 'toiletries', quantity: 2 },
        { name: '太阳镜', category: 'accessories', quantity: 1 },
        { name: '遮阳帽', category: 'accessories', quantity: 1 },
        { name: '沙滩巾', category: 'other', quantity: 1 },
        { name: '人字拖', category: 'clothing', quantity: 1 },
        { name: '防水袋', category: 'other', quantity: 1 },
        { name: '驱蚊液', category: 'toiletries', quantity: 1 },
        { name: '薄外套', category: 'clothing', quantity: 1 },
        { name: '沙滩包', category: 'accessories', quantity: 1 },
      );
      break;
      
    case 'mountain':
      items.push(
        { name: '登山鞋', category: 'clothing', quantity: 1 },
        { name: '速干衣裤', category: 'clothing', quantity: 2 },
        { name: '冲锋衣', category: 'clothing', quantity: 1 },
        { name: '登山杖', category: 'other', quantity: 2 },
        { name: '户外背包', category: 'accessories', quantity: 1 },
        { name: '水壶', category: 'other', quantity: 1 },
        { name: '头灯', category: 'electronics', quantity: 1 },
        { name: '急救包', category: 'medicine', quantity: 1 },
        { name: '能量棒', category: 'other', quantity: 5 },
        { name: '帽子', category: 'accessories', quantity: 1 },
      );
      break;
      
    case 'city':
      items.push(
        { name: '休闲服装', category: 'clothing', quantity: 3 },
        { name: '舒适鞋子', category: 'clothing', quantity: 2 },
        { name: '雨伞', category: 'other', quantity: 1 },
        { name: '相机', category: 'electronics', quantity: 1 },
        { name: '充电宝', category: 'electronics', quantity: 1 },
        { name: '便携背包', category: 'accessories', quantity: 1 },
      );
      break;
      
    case 'family':
      items.push(
        { name: '儿童换洗衣物', category: 'clothing', quantity: 5 },
        { name: '儿童洗漱用品', category: 'toiletries', quantity: 1 },
        { name: '儿童常用药', category: 'medicine', quantity: 1 },
        { name: '玩具/绘本', category: 'other', quantity: 2 },
        { name: '婴儿车/背带', category: 'other', quantity: 1 },
        { name: '零食/奶粉', category: 'other', quantity: 3 },
        { name: '儿童防晒霜', category: 'toiletries', quantity: 1 },
        { name: '驱蚊液', category: 'toiletries', quantity: 1 },
        { name: '湿纸巾', category: 'other', quantity: 3 },
      );
      break;
  }
  
  return items;
};

// 根据天气调整物品
export const adjustItemsByWeather = (items: Omit<Omit<Omit<Omit<import('../types').PackingItem, "id">, "completed">, "completedBy">, "notes">[], weather: WeatherType): Omit<Omit<Omit<Omit<import('../types').PackingItem, "id">, "completed">, "completedBy">, "notes">[] => {
  const adjustedItems = [...items];
  
  switch (weather) {
    case 'cold':
      adjustedItems.push(
        { name: '羽绒服', category: 'clothing', quantity: 1 },
        { name: '厚毛衣', category: 'clothing', quantity: 2 },
        { name: '保暖内衣', category: 'clothing', quantity: 3 },
        { name: '围巾', category: 'accessories', quantity: 1 },
        { name: '手套', category: 'accessories', quantity: 1 },
        { name: '帽子', category: 'accessories', quantity: 1 },
        { name: '暖宝宝', category: 'other', quantity: 10 },
      );
      break;
      
    case 'hot':
      adjustedItems.push(
        { name: '短袖T恤', category: 'clothing', quantity: 5 },
        { name: '短裤', category: 'clothing', quantity: 3 },
        { name: '凉鞋', category: 'clothing', quantity: 1 },
        { name: '防晒霜', category: 'toiletries', quantity: 2 },
        { name: '遮阳帽', category: 'accessories', quantity: 1 },
        { name: '太阳镜', category: 'accessories', quantity: 1 },
        { name: '小风扇', category: 'electronics', quantity: 1 },
      );
      break;
      
    case 'rainy':
      adjustedItems.push(
        { name: '雨伞', category: 'other', quantity: 2 },
        { name: '雨衣', category: 'clothing', quantity: 1 },
        { name: '防水鞋套', category: 'accessories', quantity: 1 },
        { name: '防水袋', category: 'other', quantity: 2 },
      );
      break;
      
    case 'sunny':
      // 晴天不需要额外添加太多物品
      adjustedItems.push(
        { name: '防晒霜', category: 'toiletries', quantity: 1 },
        { name: '遮阳帽', category: 'accessories', quantity: 1 },
      );
      break;
      
    case 'cloudy':
      // 多云天气，添加一些备用物品
      adjustedItems.push(
        { name: '薄外套', category: 'clothing', quantity: 1 },
        { name: '雨伞', category: 'other', quantity: 1 },
      );
      break;
      
    case 'cool':
      // 凉爽天气
      adjustedItems.push(
        { name: '薄外套', category: 'clothing', quantity: 2 },
        { name: '长袖衬衫', category: 'clothing', quantity: 3 },
        { name: '长裤', category: 'clothing', quantity: 2 },
        { name: '围巾', category: 'accessories', quantity: 1 },
      );
      break;
      
    case 'warm':
      // 温暖天气
      adjustedItems.push(
        { name: '长袖T恤', category: 'clothing', quantity: 3 },
        { name: '薄外套', category: 'clothing', quantity: 1 },
        { name: '长裤', category: 'clothing', quantity: 2 },
      );
      break;
      
    case 'windy':
      // 大风天气
      adjustedItems.push(
        { name: '防风外套', category: 'clothing', quantity: 1 },
        { name: '帽子', category: 'accessories', quantity: 1 },
        { name: '围巾', category: 'accessories', quantity: 1 },
        { name: '护目镜', category: 'accessories', quantity: 1 },
      );
      break;
      
    case 'snowy':
      // 雪天，比寒冷天气需要更多保暖装备
      adjustedItems.push(
        { name: '羽绒服', category: 'clothing', quantity: 1 },
        { name: '厚毛衣', category: 'clothing', quantity: 2 },
        { name: '保暖内衣', category: 'clothing', quantity: 3 },
        { name: '围巾', category: 'accessories', quantity: 1 },
        { name: '手套', category: 'accessories', quantity: 2 },
        { name: '帽子', category: 'accessories', quantity: 1 },
        { name: '暖宝宝', category: 'other', quantity: 15 },
        { name: '雪地靴', category: 'clothing', quantity: 1 },
        { name: '防雪套', category: 'accessories', quantity: 1 },
        { name: '护目镜', category: 'accessories', quantity: 1 },
      );
      break;
      
    case 'foggy':
      // 雾天
      adjustedItems.push(
        { name: '手电筒', category: 'electronics', quantity: 1 },
        { name: '反光条', category: 'accessories', quantity: 2 },
        { name: '口罩', category: 'other', quantity: 10 },
      );
      break;
  }
  
  return adjustedItems;
};

// 根据天数调整物品数量
export const adjustItemsByDays = (items: Omit<Omit<Omit<Omit<import('../types').PackingItem, "id">, "completed">, "completedBy">, "notes">[], days: number): Omit<Omit<Omit<Omit<import('../types').PackingItem, "id">, "completed">, "completedBy">, "notes">[] => {
  return items.map(item => {
    // 衣物类根据天数调整
    if (item.category === 'clothing' && item.name !== '羽绒服' && item.name !== '冲锋衣' && item.name !== '西装套装') {
      // 基础数量 + 天数/3 的增量
      const additional = Math.floor(days / 3);
      return {
        ...item,
        quantity: Math.max(item.quantity, Math.min(item.quantity + additional, 10))
      };
    }
    
    // 洗漱用品根据天数调整
    if (item.category === 'toiletries') {
      const additional = Math.floor(days / 5);
      return {
        ...item,
        quantity: Math.max(item.quantity, Math.min(item.quantity + additional, 5))
      };
    }
    
    return item;
  });
};

// 获取分类名称
export const getCategoryName = (category: ItemCategory): string => {
  const categoryMap: Record<ItemCategory, string> = {
    clothing: '衣物',
    electronics: '电子产品',
    toiletries: '洗漱用品',
    documents: '证件文件',
    medicine: '药品',
    accessories: '配饰',
    other: '其他',
  };
  
  return categoryMap[category] || '其他';
};

// 获取活动类型名称
export const getActivityName = (activity: ActivityType): string => {
  const activityMap: Record<ActivityType, string> = {
    business: '商务出差',
    beach: '海滩度假',
    mountain: '登山徒步',
    city: '城市观光',
    family: '亲子游',
  };
  
  return activityMap[activity] || '城市观光';
};

// 获取天气类型名称
export const getWeatherName = (weather: WeatherType): string => {
  const weatherMap: Record<WeatherType, string> = {
    sunny: '☀️ 晴天',
    rainy: '🌧️ 雨天',
    cold: '❄️ 寒冷',
    hot: '🔥 炎热',
    cloudy: '☁️ 多云',
    cool: '🍃 凉爽',
    warm: '🌤️ 温暖',
    windy: '💨 大风',
    snowy: '❄️ 雪天',
    foggy: '🌫️ 雾天',
  };
  
  return weatherMap[weather] || '☀️ 晴天';
};
