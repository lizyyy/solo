export type Grade = 1 | 2 | 3;

export type Allergen = '花生' | '海鲜' | '牛奶' | '鸡蛋' | '小麦' | '大豆';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'picking' | 'completed' | 'expired' | 'failed';

export type MealType = '主食' | '荤菜' | '素菜' | '汤品' | '水果';

export interface Meal {
  id: string;
  name: string;
  type: MealType;
  grade: Grade;
  containsAllergens: Allergen[];
  emoji: string;
  color: string;
}

export interface Student {
  id: string;
  name: string;
  grade: Grade;
  allergens: Allergen[];
}

export interface Order {
  id: string;
  student: Student;
  meal: Meal;
  pickupWindowId: string;
  pickupTime: number;
  status: OrderStatus;
  createdAt: number;
  expiresAt: number;
}

export interface PrepStation {
  id: string;
  grade: Grade;
  capacity: number;
  meals: string[];
}

export interface PickupWindow {
  id: string;
  name: string;
  queue: string[];
  maxQueue: number;
}

export interface ActionRecord {
  id: string;
  sessionId: string;
  type: 'place_meal' | 'assign_pickup' | 'complete_order' | 'expire_order' | 'error';
  orderId?: string;
  mealId?: string;
  targetId?: string;
  timestamp: number;
  gameTime: number;
  success: boolean;
  details?: string;
}

export interface ErrorRecord {
  id: string;
  sessionId: string;
  errorType: 'allergen_mismatch' | 'wrong_grade' | 'pickup_timeout' | 'window_congestion' | 'food_waste';
  description: string;
  penaltyScore: number;
  timestamp: number;
  gameTime: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  difficulty: number;
  orderCount: number;
  allergenRatio: number;
  windowCount: number;
  durationSeconds: number;
  targetScore: number;
  description: string;
}

export interface GameSession {
  id: string;
  levelId: string;
  levelName: string;
  startTime: number;
  endTime: number | null;
  totalScore: number;
  result: 'win' | 'lose';
  correctCount: number;
  errorCount: number;
  allergenMismatches: number;
  pickupTimeouts: number;
  congestions: number;
  wastes: number;
  maxCombo: number;
  actions: ActionRecord[];
  errors: ErrorRecord[];
}

export interface ScoreBreakdown {
  prepAccuracy: number;
  pickupTimeliness: number;
  allergenAvoidance: number;
  wasteRatio: number;
}

export interface FrameSnapshot {
  gameTime: number;
  orders: { id: string; status: OrderStatus; studentName: string; mealName: string }[];
  prepStations: { id: string; meals: string[] }[];
  pickupWindows: { id: string; queue: string[] }[];
  score: number;
  combo: number;
}