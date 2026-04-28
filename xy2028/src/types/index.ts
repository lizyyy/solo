export type CategoryType = 'food' | 'home' | 'wear' | 'daily' | 'misc' | 'handmade';

export interface Category {
  id: CategoryType;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  icon: string;
  color: string;
  unit: string;
}

export interface ProductionStep {
  id: string;
  step: number;
  name: string;
  description: string;
  duration: number;
  icon: string;
  details: string;
}

export interface CraftingOption {
  type: 'shape' | 'color' | 'texture' | 'size';
  name: string;
  options: {
    id: string;
    name: string;
    value: string;
    icon?: string;
  }[];
}

export interface Defect {
  id: string;
  name: string;
  icon: string;
  reason: string;
  solution: string;
  frequency: 'rare' | 'common' | 'frequent';
  image: string;
}

export interface Message {
  id: string;
  itemId: string;
  itemName: string;
  content: string;
  author: string;
  timestamp: number;
  likes: number;
  replies?: Reply[];
}

export interface Reply {
  id: string;
  content: string;
  author: string;
  timestamp: number;
}

export interface UserCreation {
  id: string;
  itemId: string;
  itemName: string;
  name: string;
  materials: {
    materialId: string;
    amount: number;
  }[];
  options: Record<string, string>;
  timestamp: number;
  image: string;
  description?: string;
}

export interface Item {
  id: string;
  name: string;
  category: CategoryType;
  icon: string;
  emoji: string;
  description: string;
  coverImage: string;
  tags: string[];
  
  rawMaterials: RawMaterial[];
  productionSteps: ProductionStep[];
  craftingOptions: CraftingOption[];
  
  defects: Defect[];
  
  healingMessage: string;
  meaningMessage: string;
  messages: Message[];
  
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  difficulty: 'easy' | 'medium' | 'hard';
  craftingTime: number;
  
  created: boolean;
  favorite: boolean;
}