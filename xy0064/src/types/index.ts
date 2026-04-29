// 物品分类
export type ItemCategory = 
  | 'clothing'      // 衣物
  | 'electronics'   // 电子产品
  | 'toiletries'    // 洗漱用品
  | 'documents'     // 证件文件
  | 'medicine'      // 药品
  | 'accessories'   // 配饰
  | 'other';        // 其他

// 活动类型
export type ActivityType = 
  | 'business'      // 商务出差
  | 'beach'         // 海滩度假
  | 'mountain'      // 登山徒步
  | 'city'          // 城市观光
  | 'family';       // 亲子游

// 天气类型
export type WeatherType = 
  | 'sunny'         // 晴天
  | 'rainy'         // 雨天
  | 'cold'          // 寒冷
  | 'hot'           // 炎热
  | 'cloudy'        // 多云
  | 'cool'          // 凉爽
  | 'warm'          // 温暖
  | 'windy'         // 大风
  | 'snowy'         // 雪天
  | 'foggy';        // 雾天

// 物品项
export interface PackingItem {
  id: string;
  name: string;
  category: ItemCategory;
  completed: boolean;
  completedBy?: string; // 完成者ID（用于多人协作）
  quantity: number;
  notes?: string;
}

// 成员
export interface Member {
  id: string;
  name: string;
  color: string;
}

// 行李清单
export interface PackingList {
  id: string;
  title: string;
  departureLocation: string;
  destination: string;
  days: number;
  weather: WeatherType;
  activity: ActivityType;
  items: PackingItem[];
  members: Member[];
  shareCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 模板
export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  activity: ActivityType;
  weather: WeatherType;
  recommendedDays: number;
  defaultItems: Omit<PackingItem, 'id' | 'completed' | 'completedBy'>[];
}

// 智能生成参数
export interface GenerateListParams {
  departureLocation: string;
  destination: string;
  days: number;
  weather: WeatherType;
  activity: ActivityType;
}
