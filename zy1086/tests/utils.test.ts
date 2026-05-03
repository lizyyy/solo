import { describe, it, expect } from 'vitest';
import { convertUnit, normalizeToGrams, roundToPracticalQuantity, getBestDisplayUnit } from '@shared/utils/unitConverter';
import { generateShoppingList, getIngredientCategory, roundQuantity } from '@shared/utils/shoppingListGenerator';
import { generatePrepTasks, sortTasksByDependency, calculateTotalPrepTime } from '@shared/utils/prepPlanner';
import { checkAllRisks, generateRiskSummary } from '@shared/utils/riskDetector';
import { checkStorageAvailability, getStorageSummary } from '@shared/utils/storageManager';
import { SAMPLE_RECIPES, SAMPLE_STORAGE_SLOTS, createSampleProject } from '@shared/data/sampleData';
import { Recipe, SelectedRecipe, ExistingIngredient, Project } from '@shared/types';

describe('Unit Converter', () => {
  describe('convertUnit', () => {
    it('should convert grams to kilograms correctly', () => {
      const result = convertUnit(1000, 'g', 'kg');
      expect(result).toBe(1);
    });

    it('should convert kilograms to grams correctly', () => {
      const result = convertUnit(1, 'kg', 'g');
      expect(result).toBe(1000);
    });

    it('should convert milliliters to liters correctly', () => {
      const result = convertUnit(1000, 'ml', 'l');
      expect(result).toBe(1);
    });

    it('should convert teaspoons to milliliters correctly', () => {
      const result = convertUnit(1, 'tsp', 'ml');
      expect(result).toBe(5);
    });

    it('should convert tablespoons to milliliters correctly', () => {
      const result = convertUnit(1, 'tbsp', 'ml');
      expect(result).toBe(15);
    });

    it('should convert cups to milliliters correctly', () => {
      const result = convertUnit(1, 'cup', 'ml');
      expect(result).toBe(240);
    });

    it('should handle same unit conversion', () => {
      const result = convertUnit(500, 'g', 'g');
      expect(result).toBe(500);
    });
  });

  describe('normalizeToGrams', () => {
    it('should normalize grams to grams correctly', () => {
      const result = normalizeToGrams(500, 'g');
      expect(result).toBe(500);
    });

    it('should normalize kilograms to grams correctly', () => {
      const result = normalizeToGrams(1, 'kg');
      expect(result).toBe(1000);
    });

    it('should normalize volume to grams with default density', () => {
      const result = normalizeToGrams(100, 'ml');
      expect(result).toBe(100);
    });

    it('should normalize count units directly', () => {
      const result = normalizeToGrams(3, 'piece');
      expect(result).toBe(3);
    });
  });

  describe('roundToPracticalQuantity', () => {
    it('should round small quantities to 2 decimal places', () => {
      expect(roundToPracticalQuantity(0.056)).toBe(0.06);
    });

    it('should round quantities between 0.1 and 1 to 1 decimal place', () => {
      expect(roundToPracticalQuantity(0.34)).toBe(0.4);
    });

    it('should round quantities between 1 and 10 to nearest 0.5', () => {
      expect(roundToPracticalQuantity(3.2)).toBe(3.5);
      expect(roundToPracticalQuantity(3.6)).toBe(4);
    });

    it('should round quantities above 10 to nearest integer', () => {
      expect(roundToPracticalQuantity(12.3)).toBe(13);
    });
  });

  describe('getBestDisplayUnit', () => {
    it('should return grams for small quantities', () => {
      const result = getBestDisplayUnit(500);
      expect(result.unit.id).toBe('g');
      expect(result.quantity).toBe(500);
    });

    it('should return kilograms for large quantities', () => {
      const result = getBestDisplayUnit(1500);
      expect(result.unit.id).toBe('kg');
      expect(result.quantity).toBe(1.5);
    });
  });
});

describe('Shopping List Generator', () => {
  const testRecipes: Recipe[] = [
    {
      id: 'recipe-test-1',
      name: '测试菜谱1',
      servings: 2,
      prepTimeMinutes: 10,
      cookTimeMinutes: 10,
      ingredients: [
        {
          ingredientId: 'ing-1',
          ingredientName: '鸡胸肉',
          quantity: 300,
          unit: 'g',
          isOptional: false,
        },
        {
          ingredientId: 'ing-2',
          ingredientName: '大蒜',
          quantity: 3,
          unit: 'clove',
          isOptional: false,
        },
      ],
      prepSteps: [],
      storageInstructions: {
        storageType: 'refrigerated',
        shelfLifeDays: 3,
        reheatMethod: 'microwave',
      },
      category: '测试',
      tags: [],
    },
    {
      id: 'recipe-test-2',
      name: '测试菜谱2',
      servings: 2,
      prepTimeMinutes: 15,
      cookTimeMinutes: 10,
      ingredients: [
        {
          ingredientId: 'ing-1',
          ingredientName: '鸡胸肉',
          quantity: 200,
          unit: 'g',
          isOptional: false,
        },
        {
          ingredientId: 'ing-3',
          ingredientName: '西兰花',
          quantity: 250,
          unit: 'g',
          isOptional: false,
        },
      ],
      prepSteps: [],
      storageInstructions: {
        storageType: 'refrigerated',
        shelfLifeDays: 3,
        reheatMethod: 'microwave',
      },
      category: '测试',
      tags: [],
    },
  ];

  describe('generateShoppingList', () => {
    it('should merge same ingredients from multiple recipes', () => {
      const selectedRecipes: SelectedRecipe[] = [
        { recipeId: 'recipe-test-1', recipeName: '测试菜谱1', targetServings: 2, multiplier: 1 },
        { recipeId: 'recipe-test-2', recipeName: '测试菜谱2', targetServings: 2, multiplier: 1 },
      ];

      const existingIngredients: ExistingIngredient[] = [];

      const shoppingList = generateShoppingList(testRecipes, selectedRecipes, existingIngredients);

      const chickenItem = shoppingList.find(item => item.ingredientId === 'ing-1');
      expect(chickenItem).toBeDefined();
      expect(chickenItem?.totalQuantity).toBe(500);
    });

    it('should subtract existing ingredients from required amount', () => {
      const selectedRecipes: SelectedRecipe[] = [
        { recipeId: 'recipe-test-1', recipeName: '测试菜谱1', targetServings: 2, multiplier: 1 },
      ];

      const existingIngredients: ExistingIngredient[] = [
        {
          ingredientId: 'ing-1',
          ingredientName: '鸡胸肉',
          quantity: 100,
          unit: 'g',
          location: 'refrigerated',
        },
      ];

      const shoppingList = generateShoppingList(testRecipes, selectedRecipes, existingIngredients);

      const chickenItem = shoppingList.find(item => item.ingredientId === 'ing-1');
      expect(chickenItem).toBeDefined();
      expect(chickenItem?.existingQuantity).toBe(100);
      expect(chickenItem?.toPurchase).toBe(200);
    });

    it('should not show items with zero purchase amount', () => {
      const selectedRecipes: SelectedRecipe[] = [
        { recipeId: 'recipe-test-1', recipeName: '测试菜谱1', targetServings: 2, multiplier: 1 },
      ];

      const existingIngredients: ExistingIngredient[] = [
        {
          ingredientId: 'ing-1',
          ingredientName: '鸡胸肉',
          quantity: 400,
          unit: 'g',
          location: 'refrigerated',
        },
      ];

      const shoppingList = generateShoppingList(testRecipes, selectedRecipes, existingIngredients);

      const chickenItem = shoppingList.find(item => item.ingredientId === 'ing-1');
      expect(chickenItem).toBeUndefined();
    });
  });

  describe('getIngredientCategory', () => {
    it('should categorize meat correctly', () => {
      expect(getIngredientCategory('鸡胸肉')).toBe('肉类');
      expect(getIngredientCategory('牛肉馅')).toBe('肉类');
      expect(getIngredientCategory('虾仁')).toBe('肉类');
    });

    it('should categorize vegetables correctly', () => {
      expect(getIngredientCategory('西兰花')).toBe('蔬菜');
      expect(getIngredientCategory('胡萝卜')).toBe('蔬菜');
      expect(getIngredientCategory('洋葱')).toBe('蔬菜');
    });

    it('should categorize condiments correctly', () => {
      expect(getIngredientCategory('生抽')).toBe('调料');
      expect(getIngredientCategory('蚝油')).toBe('调料');
      expect(getIngredientCategory('料酒')).toBe('调料');
    });

    it('should return "其他" for unknown ingredients', () => {
      expect(getIngredientCategory('未知食材')).toBe('其他');
    });
  });
});

describe('Prep Planner', () => {
  const testRecipe: Recipe = {
    id: 'recipe-prep-test',
    name: '备料测试菜谱',
    servings: 2,
    prepTimeMinutes: 20,
    cookTimeMinutes: 10,
    ingredients: [],
    prepSteps: [
      {
        id: 'step-1',
        stepNumber: 1,
        description: '准备食材',
        estimatedMinutes: 5,
        canBatch: true,
        dependencies: [],
        ingredients: [],
      },
      {
        id: 'step-2',
        stepNumber: 2,
        description: '切菜',
        estimatedMinutes: 10,
        canBatch: true,
        dependencies: ['step-1'],
        ingredients: [],
      },
      {
        id: 'step-3',
        stepNumber: 3,
        description: '炒菜',
        estimatedMinutes: 8,
        canBatch: false,
        dependencies: ['step-2'],
        ingredients: [],
      },
    ],
    storageInstructions: {
      storageType: 'refrigerated',
      shelfLifeDays: 3,
      reheatMethod: 'microwave',
    },
    category: '测试',
    tags: [],
  };

  describe('generatePrepTasks', () => {
    it('should generate tasks for selected recipes', () => {
      const result = generatePrepTasks(
        [testRecipe],
        [{ recipeId: 'recipe-prep-test', recipeName: '备料测试菜谱', targetServings: 2, multiplier: 1 }]
      );

      expect(result.tasks.length).toBe(3);
      expect(result.tasks[0].stepNumber).toBe(1);
      expect(result.tasks[1].stepNumber).toBe(2);
      expect(result.tasks[2].stepNumber).toBe(3);
    });

    it('should maintain task dependencies', () => {
      const result = generatePrepTasks(
        [testRecipe],
        [{ recipeId: 'recipe-prep-test', recipeName: '备料测试菜谱', targetServings: 2, multiplier: 1 }]
      );

      const step2 = result.tasks.find(t => t.stepNumber === 2);
      const step3 = result.tasks.find(t => t.stepNumber === 3);

      expect(step2?.dependencies.length).toBeGreaterThan(0);
      expect(step3?.dependencies.length).toBeGreaterThan(0);
    });
  });

  describe('sortTasksByDependency', () => {
    it('should sort tasks respecting dependencies', () => {
      const result = generatePrepTasks(
        [testRecipe],
        [{ recipeId: 'recipe-prep-test', recipeName: '备料测试菜谱', targetServings: 2, multiplier: 1 }]
      );

      const sorted = sortTasksByDependency(result.tasks);

      const step1Index = sorted.findIndex(t => t.stepNumber === 1);
      const step2Index = sorted.findIndex(t => t.stepNumber === 2);
      const step3Index = sorted.findIndex(t => t.stepNumber === 3);

      expect(step1Index).toBeLessThan(step2Index);
      expect(step2Index).toBeLessThan(step3Index);
    });
  });

  describe('calculateTotalPrepTime', () => {
    it('should calculate sequential prep time', () => {
      const result = generatePrepTasks(
        [testRecipe],
        [{ recipeId: 'recipe-prep-test', recipeName: '备料测试菜谱', targetServings: 2, multiplier: 1 }]
      );

      const totalTime = calculateTotalPrepTime(result.tasks);

      expect(totalTime).toBe(23);
    });
  });
});

describe('Risk Detector', () => {
  it('should create sample project with no initial risks', () => {
    const project = createSampleProject();
    expect(project.risks.length).toBe(0);
  });

  it('should generate risk summary correctly', () => {
    const project = createSampleProject();
    project.risks = [
      {
        id: 'risk-1',
        type: 'allergen',
        severity: 'high',
        title: '过敏原警告',
        description: '测试警告',
        relatedItems: [],
      },
      {
        id: 'risk-2',
        type: 'duplicate',
        severity: 'medium',
        title: '重复食材',
        description: '测试警告',
        relatedItems: [],
      },
      {
        id: 'risk-3',
        type: 'expiring',
        severity: 'low',
        title: '临期提醒',
        description: '测试警告',
        relatedItems: [],
      },
    ];

    const summary = generateRiskSummary(project.risks);

    expect(summary.high).toBe(1);
    expect(summary.medium).toBe(1);
    expect(summary.low).toBe(1);
    expect(summary.categories['allergen']).toBe(1);
    expect(summary.categories['duplicate']).toBe(1);
    expect(summary.categories['expiring']).toBe(1);
  });
});

describe('Storage Manager', () => {
  describe('checkStorageAvailability', () => {
    it('should return available when there is space', () => {
      const slots = [
        {
          id: 'slot-1',
          name: '测试格位',
          storageType: 'refrigerated' as const,
          maxCapacity: 10,
          capacityUnit: '个',
          currentContainers: [],
        },
      ];

      const result = checkStorageAvailability(slots, 'container-1', 1);

      expect(result.available).toBe(true);
      expect(result.totalAvailable).toBe(10);
    });

    it('should return unavailable when slot is full', () => {
      const slots = [
        {
          id: 'slot-1',
          name: '测试格位',
          storageType: 'refrigerated' as const,
          maxCapacity: 2,
          capacityUnit: '个',
          currentContainers: [
            {
              id: 'container-1',
              containerTypeId: 'type-1',
              recipeId: 'recipe-1',
              recipeName: '测试菜谱',
              portionCount: 2,
              storedDate: '2024-01-01',
              expiryDate: '2024-01-04',
              slotId: 'slot-1',
            },
            {
              id: 'container-2',
              containerTypeId: 'type-1',
              recipeId: 'recipe-2',
              recipeName: '测试菜谱2',
              portionCount: 2,
              storedDate: '2024-01-01',
              expiryDate: '2024-01-04',
              slotId: 'slot-1',
            },
          ],
        },
      ];

      const result = checkStorageAvailability(slots, 'container-3', 1);

      expect(result.available).toBe(false);
    });
  });

  describe('getStorageSummary', () => {
    it('should calculate summary correctly', () => {
      const summary = getStorageSummary(SAMPLE_STORAGE_SLOTS);

      expect(summary.totalCapacity).toBeGreaterThan(0);
      expect(summary.usedCapacity).toBe(0);
      expect(summary.availableCapacity).toBe(summary.totalCapacity);
      expect(summary.byType.refrigerated.total).toBeGreaterThan(0);
      expect(summary.byType.frozen.total).toBeGreaterThan(0);
    });
  });
});

describe('Sample Data', () => {
  it('should have sample recipes', () => {
    expect(SAMPLE_RECIPES.length).toBeGreaterThan(0);
  });

  it('should have complete recipe data', () => {
    const recipe = SAMPLE_RECIPES[0];
    expect(recipe.id).toBeDefined();
    expect(recipe.name).toBeDefined();
    expect(recipe.ingredients.length).toBeGreaterThan(0);
    expect(recipe.prepSteps.length).toBeGreaterThan(0);
    expect(recipe.storageInstructions).toBeDefined();
  });

  it('should create sample project correctly', () => {
    const project = createSampleProject();
    expect(project.id).toBeDefined();
    expect(project.name).toBeDefined();
    expect(project.selectedRecipes.length).toBeGreaterThan(0);
    expect(project.existingIngredients.length).toBeGreaterThan(0);
    expect(project.storageSlots.length).toBeGreaterThan(0);
  });

  it('should have storage slots defined', () => {
    expect(SAMPLE_STORAGE_SLOTS.length).toBeGreaterThan(0);
    const hasRefrigerated = SAMPLE_STORAGE_SLOTS.some(s => s.storageType === 'refrigerated');
    const hasFrozen = SAMPLE_STORAGE_SLOTS.some(s => s.storageType === 'frozen');
    expect(hasRefrigerated).toBe(true);
    expect(hasFrozen).toBe(true);
  });
});
