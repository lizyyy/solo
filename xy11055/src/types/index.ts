export enum ApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSING = 'processing'
}

export enum RejectionReason {
  TOO_LATE = 'too_late',
  INCONSISTENT = 'inconsistent',
  INVALID = 'invalid'
}

export interface DietaryRestriction {
  id: string;
  type: 'allergy' | 'religion' | 'health' | 'personal';
  name: string;
  description: string;
  severity: 'mild' | 'moderate' | 'severe';
}

export interface MealItem {
  id: string;
  name: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'soup';
  ingredients: string[];
  nutritionalInfo: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface ReplacementItem {
  id: string;
  originalMealId: string;
  originalMealName: string;
  replacementMealId: string;
  replacementMealName: string;
  reason: string;
  dietaryRestrictionId: string;
}

export interface ReplacementApplication {
  id: string;
  orderId: string;
  motherName: string;
  roomNumber: string;
  admissionDate: string;
  deliveryDate: string;
  mealPlanType: 'standard' | 'premium' | 'vegetarian' | 'diabetic';
  deliveryDateRange: {
    start: string;
    end: string;
  };
  mealPreparationCutoffTime: string;
  dietaryRestrictions: DietaryRestriction[];
  replacementItems: ReplacementItem[];
  status: ApplicationStatus;
  rejectionReason?: RejectionReason;
  rejectionMessage?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface CreateApplicationRequest {
  orderId: string;
  motherName: string;
  roomNumber: string;
  admissionDate: string;
  deliveryDate: string;
  mealPlanType: 'standard' | 'premium' | 'vegetarian' | 'diabetic';
  deliveryDateRange: {
    start: string;
    end: string;
  };
  mealPreparationCutoffTime: string;
  dietaryRestrictions: Omit<DietaryRestriction, 'id'>[];
  replacementItems: Omit<ReplacementItem, 'id'>[];
  createdBy: string;
  notes?: string;
}

export interface ValidationResult {
  valid: boolean;
  status?: ApplicationStatus;
  rejectionReason?: RejectionReason;
  message?: string;
}
