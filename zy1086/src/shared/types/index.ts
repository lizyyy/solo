export type UnitType = 'weight' | 'volume' | 'count';

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  type: UnitType;
  conversionFactor: number;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  allergens: string[];
  defaultUnit: string;
  shelfLifeDays: {
    fresh: number;
    refrigerated: number;
    frozen: number;
  };
  notes?: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  notes?: string;
  isOptional: boolean;
}

export interface PrepStep {
  id: string;
  stepNumber: number;
  description: string;
  estimatedMinutes: number;
  canBatch: boolean;
  dependencies: string[];
  ingredients: string[];
}

export interface StorageInstructions {
  storageType: 'refrigerated' | 'frozen' | 'pantry';
  shelfLifeDays: number;
  reheatMethod: 'microwave' | 'stovetop' | 'oven' | 'none';
  notes?: string;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  servings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: RecipeIngredient[];
  prepSteps: PrepStep[];
  storageInstructions: StorageInstructions;
  category: string;
  tags: string[];
  notes?: string;
}

export interface ContainerType {
  id: string;
  name: string;
  capacity: number;
  capacityUnit: string;
  isStackable: boolean;
  maxStackHeight: number;
}

export interface StorageSlot {
  id: string;
  name: string;
  storageType: 'refrigerated' | 'frozen';
  maxCapacity: number;
  capacityUnit: string;
  currentContainers: StoredContainer[];
}

export interface StoredContainer {
  id: string;
  containerTypeId: string;
  recipeId: string;
  recipeName: string;
  portionCount: number;
  storedDate: string;
  expiryDate: string;
  slotId: string;
  notes?: string;
}

export interface ShoppingListItem {
  ingredientId: string;
  ingredientName: string;
  totalQuantity: number;
  unit: string;
  existingQuantity: number;
  toPurchase: number;
  category: string;
  notes?: string;
}

export interface RiskWarning {
  id: string;
  type: 'allergen' | 'duplicate' | 'expiring' | 'reheat_mismatch' | 'storage_full';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  relatedItems: string[];
  suggestions?: string[];
}

export interface BatchPrepGroup {
  id: string;
  name: string;
  steps: string[];
  combinedIngredients: string[];
  estimatedMinutes: number;
}

export interface PrepTask {
  id: string;
  recipeId: string;
  recipeName: string;
  stepId: string;
  stepNumber: number;
  description: string;
  estimatedMinutes: number;
  dependencies: string[];
  ingredients: string[];
  isBatchable: boolean;
  batchGroupId?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdDate: string;
  lastModifiedDate: string;
  targetDate: string;
  selectedRecipes: SelectedRecipe[];
  existingIngredients: ExistingIngredient[];
  storageSlots: StorageSlot[];
  shoppingList: ShoppingListItem[];
  prepTasks: PrepTask[];
  batchGroups: BatchPrepGroup[];
  storedContainers: StoredContainer[];
  risks: RiskWarning[];
}

export interface SelectedRecipe {
  recipeId: string;
  recipeName: string;
  targetServings: number;
  multiplier: number;
}

export interface ExistingIngredient {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  expiryDate?: string;
  location: 'pantry' | 'refrigerated' | 'frozen';
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'markdown' | 'html';
  includeShoppingList: boolean;
  includePrepSteps: boolean;
  includeStoragePlan: boolean;
  includeRisks: boolean;
}
