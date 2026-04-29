export type ConstitutionType = 'cold' | 'qi_deficiency' | 'heat' | 'unknown';

export interface ConstitutionResult {
  type: ConstitutionType;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  bgColor?: string;
  dietaryAdvice?: {
    avoid: string[];
    recommend: string[];
  };
  taboos?: string[];
  footBathRecipe: FootBathRecipe;
  clothingAdvice: ClothingAdvice;
}

export interface FootBathRecipe {
  name?: string;
  ingredients: string[];
  steps: string[];
  temperature: string;
  duration: string;
  frequency?: string;
}

export interface ClothingAdvice {
  keyAreas: string[];
  materials: string[];
  tips: string[];
}

export interface CycleRecord {
  id: string;
  startDate: string;
  endDate: string | null;
  duration: number;
  symptoms: SymptomRecord[];
  painLevels: PainLevelRecord[];
  checkIns: CheckInRecord[];
  notes: string;
}

export interface SymptomRecord {
  date: string;
  symptoms: SymptomType[];
  mood: MoodType;
  notes: string;
}

export type SymptomType = 
  | 'chest_pain' 
  | 'abdominal_bloating' 
  | 'acne' 
  | 'irritable'
  | 'fatigue'
  | 'headache'
  | 'back_pain'
  | 'cramps';

export type MoodType = 'happy' | 'normal' | 'sad' | 'anxious' | 'irritable';

export interface PainLevelRecord {
  id: string;
  date: string;
  level: number;
  type: PainType;
  notes: string;
}

export type PainType = 'lower_abdomen' | 'back' | 'head' | 'chest';

export interface CheckInRecord {
  id: string;
  date: string;
  type: CheckInType;
  completed: boolean;
  symptomImprovement?: number;
}

export type CheckInType = 'foot_bath' | 'hot_compress' | 'early_sleep' | 'brown_sugar';

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  canEat: boolean;
  coldLevel: ColdLevel;
  tags?: string[];
  description: string;
  tips?: string;
  alternative?: string;
  alternatives?: string[];
}

export type FoodCategory = 'beverage' | 'drink' | 'fruit' | 'snack' | 'vegetable' | 'meat' | 'seafood' | 'other';
export type ColdLevel = 'cold' | 'cool' | 'neutral' | 'warm' | 'hot';

export interface SymptomForecast {
  day: number;
  phase: CyclePhase;
  symptoms: SymptomPrediction[];
  suggestions: string[];
  relaxationText: string;
}

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface SymptomPrediction {
  type: SymptomType;
  probability: number;
  severity: 'mild' | 'moderate' | 'severe';
}

export interface DiaryEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  encryptedContent?: string;
  mood: MoodType;
  physicalState: PhysicalState;
  cycleDay?: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PhysicalState {
  energy: number;
  pain: number;
  bloating: number;
}

export interface DiarySettings {
  passwordHash?: string;
  hint?: string;
  enabled: boolean;
}

export interface Post {
  id: string;
  author: string;
  avatar: string;
  title: string;
  content: string;
  images: string[];
  tags: string[];
  likes: number;
  isLiked: boolean;
  commentCount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  author: string;
  avatar: string;
  content: string;
  likes: number;
  isLiked: boolean;
  createdAt: string;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  constitutionType: ConstitutionType;
  averageCycleLength: number;
  averagePeriodLength: number;
  lastPeriodStart: string;
  constitutionTestCompleted: boolean;
}

export interface WeatherData {
  date: string;
  temp: number;
  high: number;
  low: number;
  condition: string;
  humidity: number;
  wind: number;
}

export interface OutfitSuggestion {
  phase: CyclePhase;
  tempRange: [number, number];
  tops: string[];
  bottoms: string[];
  outerwear: string[];
  accessories: string[];
  warnings: string[];
}
