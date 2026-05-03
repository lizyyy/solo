import { 
  Project, 
  Recipe, 
  RiskWarning,
  SelectedRecipe,
  ExistingIngredient,
  StorageSlot,
  StoredContainer
} from '@shared/types';

export interface RiskCheckOptions {
  allergenThreshold: string[];
  expiryWarningDays: number;
  storageCapacityThreshold: number;
}

const DEFAULT_OPTIONS: RiskCheckOptions = {
  allergenThreshold: ['花生', '坚果', '海鲜', '牛奶', '鸡蛋', '小麦', '大豆'],
  expiryWarningDays: 3,
  storageCapacityThreshold: 0.9,
};

export function checkAllRisks(
  project: Project,
  recipes: Recipe[],
  options: Partial<RiskCheckOptions> = {}
): RiskWarning[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const warnings: RiskWarning[] = [];

  warnings.push(...checkAllergens(project, recipes, opts));
  warnings.push(...checkDuplicateIngredients(project, recipes));
  warnings.push(...checkExpiringIngredients(project, opts));
  warnings.push(...checkReheatMismatch(project, recipes));
  warnings.push(...checkStorageCapacity(project));

  return warnings.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

function checkAllergens(
  project: Project,
  recipes: Recipe[],
  options: RiskCheckOptions
): RiskWarning[] {
  const warnings: RiskWarning[] = [];
  const allergenRecipes = new Map<string, string[]>();

  for (const selected of project.selectedRecipes) {
    const recipe = recipes.find(r => r.id === selected.recipeId);
    if (!recipe) continue;

    for (const ing of recipe.ingredients) {
      const matchedAllergens = options.allergenThreshold.filter(allergen => 
        ing.ingredientName.includes(allergen)
      );

      for (const allergen of matchedAllergens) {
        if (!allergenRecipes.has(allergen)) {
          allergenRecipes.set(allergen, []);
        }
        if (!allergenRecipes.get(allergen)!.includes(recipe.name)) {
          allergenRecipes.get(allergen)!.push(recipe.name);
        }
      }
    }
  }

  for (const [allergen, recipeNames] of allergenRecipes) {
    if (recipeNames.length > 0) {
      warnings.push({
        id: `allergen-${allergen}`,
        type: 'allergen',
        severity: recipeNames.length > 2 ? 'high' : 'medium',
        title: `检测到过敏原：${allergen}`,
        description: `以下菜谱含有${allergen}：${recipeNames.join('、')}`,
        relatedItems: recipeNames,
        suggestions: [
          '请确保家庭成员中没有对该物质过敏的人',
          '备餐时注意分开处理，避免交叉污染',
          '分装时明确标注过敏原信息'
        ]
      });
    }
  }

  return warnings;
}

function checkDuplicateIngredients(
  project: Project,
  recipes: Recipe[]
): RiskWarning[] {
  const warnings: RiskWarning[] = [];
  const ingredientRecipes = new Map<string, string[]>();

  for (const selected of project.selectedRecipes) {
    const recipe = recipes.find(r => r.id === selected.recipeId);
    if (!recipe) continue;

    for (const ing of recipe.ingredients) {
      if (!ingredientRecipes.has(ing.ingredientName)) {
        ingredientRecipes.set(ing.ingredientName, []);
      }
      if (!ingredientRecipes.get(ing.ingredientName)!.includes(recipe.name)) {
        ingredientRecipes.get(ing.ingredientName)!.push(recipe.name);
      }
    }
  }

  for (const [ingredientName, recipeNames] of ingredientRecipes) {
    if (recipeNames.length >= 2) {
      warnings.push({
        id: `duplicate-${ingredientName}`,
        type: 'duplicate',
        severity: 'low',
        title: `重复食材：${ingredientName}`,
        description: `该食材出现在 ${recipeNames.length} 个菜谱中：${recipeNames.join('、')}`,
        relatedItems: recipeNames,
        suggestions: [
          '可以考虑合并采购，减少包装浪费',
          '备料时可以一起处理，提高效率',
          '注意保质期，避免一次采购过多'
        ]
      });
    }
  }

  return warnings;
}

function checkExpiringIngredients(
  project: Project,
  options: RiskCheckOptions
): RiskWarning[] {
  const warnings: RiskWarning[] = [];
  const today = new Date();

  for (const ingredient of project.existingIngredients) {
    if (!ingredient.expiryDate) continue;

    const expiryDate = new Date(ingredient.expiryDate);
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= options.expiryWarningDays) {
      let severity: 'low' | 'medium' | 'high';
      let title: string;

      if (daysUntilExpiry <= 0) {
        severity = 'high';
        title = `${ingredient.ingredientName} 已过期`;
      } else if (daysUntilExpiry === 1) {
        severity = 'high';
        title = `${ingredient.ingredientName} 明天过期`;
      } else if (daysUntilExpiry <= 2) {
        severity = 'medium';
        title = `${ingredient.ingredientName} 即将过期（${daysUntilExpiry}天）`;
      } else {
        severity = 'low';
        title = `${ingredient.ingredientName} 临期提醒（${daysUntilExpiry}天）`;
      }

      warnings.push({
        id: `expiring-${ingredient.ingredientId}`,
        type: 'expiring',
        severity,
        title,
        description: `该食材将于 ${ingredient.expiryDate} 过期，请优先使用`,
        relatedItems: [ingredient.ingredientName],
        suggestions: [
          '考虑在本次备餐中优先使用该食材',
          '检查食材状态，确认是否还可使用',
          '调整菜谱，增加该食材的使用量'
        ]
      });
    }
  }

  return warnings;
}

function checkReheatMismatch(
  project: Project,
  recipes: Recipe[]
): RiskWarning[] {
  const warnings: RiskWarning[] = [];
  const reheatMethodGroups = new Map<string, string[]>();

  for (const selected of project.selectedRecipes) {
    const recipe = recipes.find(r => r.id === selected.recipeId);
    if (!recipe) continue;

    const method = recipe.storageInstructions.reheatMethod;
    if (!reheatMethodGroups.has(method)) {
      reheatMethodGroups.set(method, []);
    }
    reheatMethodGroups.get(method)!.push(recipe.name);
  }

  const methodCount = reheatMethodGroups.size;
  if (methodCount > 1) {
    const methodNames: Record<string, string> = {
      'microwave': '微波炉',
      'stovetop': '炉灶',
      'oven': '烤箱',
      'none': '无需加热'
    };

    const methodsWithRecipes = Array.from(reheatMethodGroups.entries())
      .map(([method, recipes]) => `${methodNames[method] || method}: ${recipes.join('、')}`)
      .join('；');

    warnings.push({
      id: 'reheat-mismatch',
      type: 'reheat_mismatch',
      severity: 'low',
      title: '复热方式不统一',
      description: `不同菜谱使用不同的复热方式：${methodsWithRecipes}`,
      relatedItems: Array.from(reheatMethodGroups.values()).flat(),
      suggestions: [
        '分装时标注各菜品的复热方式',
        '食用时根据不同菜品调整加热方式',
        '考虑选择复热方式相似的菜谱组合'
      ]
    });
  }

  return warnings;
}

function checkStorageCapacity(project: Project): RiskWarning[] {
  const warnings: RiskWarning[] = [];

  for (const slot of project.storageSlots) {
    const currentCapacity = slot.currentContainers.length;
    const capacityRatio = currentCapacity / slot.maxCapacity;

    if (capacityRatio >= project.storageSlots.length > 0 ? 0.8 : 1) {
      let severity: 'low' | 'medium' | 'high';
      let title: string;

      if (capacityRatio >= 1) {
        severity = 'high';
        title = `${slot.name} 已满`;
      } else if (capacityRatio >= 0.9) {
        severity = 'medium';
        title = `${slot.name} 即将满（${currentCapacity}/${slot.maxCapacity}）`;
      } else {
        severity = 'low';
        title = `${slot.name} 容量提醒（${currentCapacity}/${slot.maxCapacity}）`;
      }

      warnings.push({
        id: `storage-full-${slot.id}`,
        type: 'storage_full',
        severity,
        title,
        description: `当前已使用 ${currentCapacity}/${slot.maxCapacity} 个位置`,
        relatedItems: slot.currentContainers.map(c => c.recipeName),
        suggestions: [
          '考虑清理过期或不需要的存储物品',
          '使用更高效的堆叠或收纳方式',
          '调整分装策略，减少使用的容器数量'
        ]
      });
    }
  }

  return warnings;
}

export function generateRiskSummary(warnings: RiskWarning[]): {
  high: number;
  medium: number;
  low: number;
  categories: Record<string, number>;
} {
  const summary = {
    high: 0,
    medium: 0,
    low: 0,
    categories: {} as Record<string, number>
  };

  for (const warning of warnings) {
    summary[warning.severity]++;
    summary.categories[warning.type] = (summary.categories[warning.type] || 0) + 1;
  }

  return summary;
}
