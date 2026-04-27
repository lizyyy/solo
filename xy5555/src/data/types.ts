// 设计风格枚举
export enum DesignStyle {
  MINIMALIST = 'minimalist', // 极简风格
  NORDIC = 'nordic', // 北欧风格
  JAPANESE = 'japanese', // 日式风格
  INDUSTRIAL = 'industrial', // 工业风格
  MODERN = 'modern', // 现代风格
  LUXURY = 'luxury' // 轻奢风格
}

// 空间类型枚举
export enum SpaceType {
  LIVING_ROOM = 'living_room', // 客厅
  BEDROOM = 'bedroom', // 卧室
  KITCHEN = 'kitchen', // 厨房
  BATHROOM = 'bathroom', // 卫生间
  STUDY = 'study', // 书房
  DINING_ROOM = 'dining_room' // 餐厅
}

// 预算范围枚举
export enum BudgetRange {
  LOW = 'low', // 经济型 (5-8万)
  MEDIUM = 'medium', // 舒适型 (8-15万)
  HIGH = 'high', // 高端型 (15-25万)
  PREMIUM = 'premium' // 豪华型 (25万以上)
}

// 家具项
export interface FurnitureItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  spaceType: SpaceType;
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };
  material?: string;
  brand?: string;
}

// 设计方案
export interface DesignPlan {
  id: string;
  name: string;
  description: string;
  style: DesignStyle;
  totalBudget: number;
  budgetRange: BudgetRange;
  area: number;
  images: string[];
  mainImage: string;
  tags: string[];
  furnitureItems: FurnitureItem[];
  designer?: {
    name: string;
    avatar: string;
    rating: number;
  };
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
  viewCount: number;
  likeCount: number;
}

// 用户偏好
export interface UserPreferences {
  id: string;
  userId: string;
  preferredStyles: DesignStyle[];
  budgetRange: BudgetRange;
  preferredMaterials: string[];
  colorPreferences: string[];
  spacePriorities: SpaceType[];
  createdAt: number;
  updatedAt: number;
}

// 对比项
export interface ComparisonItem {
  planId: string;
  plan: DesignPlan;
  addedAt: number;
}

// 收藏项
export interface FavoriteItem {
  planId: string;
  plan: DesignPlan;
  addedAt: number;
  note?: string;
}

// 预算估算参数
export interface BudgetEstimateParams {
  style: DesignStyle;
  area: number;
  budgetRange: BudgetRange;
  customRequirements?: {
    hasSmartHome: boolean;
    hasCustomCabinets: boolean;
    hasHighEndMaterials: boolean;
  };
}

// 预算估算结果
export interface BudgetEstimateResult {
  totalBudget: number;
  breakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  tips: string[];
}

// 用户信息
export interface User {
  id: string;
  name: string;
  avatar: string;
  phone?: string;
  email?: string;
  preferences: UserPreferences;
}
