export interface Elder {
  id: string;
  name: string;
  phone: string;
  address: string;
  dietaryRestrictions: string[];
  chronicConditions: string[];
  deliveryRoute: string;
  roomNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  ingredients: string[];
  isSuitableFor: {
    diabetes: boolean;
    hypertension: boolean;
    vegetarian: boolean;
  };
  price: number;
  category: 'breakfast' | 'lunch' | 'dinner';
}

export interface MealPlan {
  id: string;
  elderId: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  menuItemId: string;
  status: 'planned' | 'confirmed' | 'modified' | 'cancelled';
  conflicts: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Delivery {
  id: string;
  mealPlanId: string;
  elderId: string;
  date: string;
  route: string;
  status: 'pending' | 'out_for_delivery' | 'delivered' | 'failed';
  deliveredAt?: string;
  notes?: string;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  elderId: string;
  date: string;
  mealPlanId?: string;
  satisfaction?: number;
  feedback?: string;
  issues?: string[];
  createdAt: string;
}

export interface ImportError {
  row: number;
  rawData: Record<string, any>;
  error: string;
  suggestion: string;
}

export interface ImportResult<T> {
  success: T[];
  errors: ImportError[];
  total: number;
}

export interface DatabaseSchema {
  elders: Elder[];
  menuItems: MenuItem[];
  mealPlans: MealPlan[];
  deliveries: Delivery[];
  followUps: FollowUp[];
  importErrors: {
    elders: ImportError[];
    menuItems: ImportError[];
    deliveries: ImportError[];
  };
  history: HistoryRecord[];
}

export interface HistoryRecord {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: Record<string, any>;
  timestamp: string;
}
