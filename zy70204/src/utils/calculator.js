import { ERROR_TYPES, FIRING_TEMPERATURE_RANGES } from '../data/models';

const TOLERANCE = 0.01;

export function validateIngredientRatios(ingredients, materials) {
  const errors = [];
  const warnings = [];
  
  if (!ingredients || ingredients.length === 0) {
    errors.push({
      type: ERROR_TYPES.MISSING_REQUIRED,
      message: '请至少添加一种釉料成分',
    });
    return { isValid: false, errors, warnings };
  }

  const sum = ingredients.reduce((acc, ing) => acc + (ing.ratio || 0), 0);

  for (const ing of ingredients) {
    if (ing.ratio < 0) {
      errors.push({
        type: ERROR_TYPES.RATIO_NEGATIVE,
        message: `比例不能为负数: ${ing.materialName}`,
        materialId: ing.materialId,
      });
    }

    if (ing.ratio === 0) {
      warnings.push({
        message: `成分比例为0: ${ing.materialName}，建议移除`,
        materialId: ing.materialId,
      });
    }

    const material = materials.find(m => m.id === ing.materialId);
    if (material) {
      if (material.minRatio !== undefined && ing.ratio < material.minRatio) {
        warnings.push({
          message: `${ing.materialName} 低于建议最低比例 ${material.minRatio}`,
          materialId: ing.materialId,
          current: ing.ratio,
          min: material.minRatio,
        });
      }
      if (material.maxRatio !== undefined && ing.ratio > material.maxRatio) {
        errors.push({
          type: ERROR_TYPES.RATIO_OUT_OF_BOUNDS,
          message: `${ing.materialName} 超出建议最高比例 ${material.maxRatio}，当前: ${ing.ratio}`,
          materialId: ing.materialId,
          current: ing.ratio,
          max: material.maxRatio,
        });
      }
    }
  }

  if (Math.abs(sum - 100) > TOLERANCE) {
    errors.push({
      type: ERROR_TYPES.RATIO_SUM_INVALID,
      message: `比例总和必须为100%，当前总和: ${sum.toFixed(2)}%`,
      currentSum: sum,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateTemperatureCompatibility(ingredients, targetTemperature, materials) {
  const errors = [];
  const warnings = [];

  if (targetTemperature <= 0) {
    errors.push({
      type: ERROR_TYPES.TEMPERATURE_OUT_OF_RANGE,
      message: '烧成温度必须大于0',
    });
    return { isValid: false, errors, warnings };
  }

  let inRange = false;
  for (const key of Object.keys(FIRING_TEMPERATURE_RANGES)) {
    const range = FIRING_TEMPERATURE_RANGES[key];
    if (targetTemperature >= range.min && targetTemperature <= range.max) {
      inRange = true;
      break;
    }
  }

  if (!inRange) {
    warnings.push({
      message: `温度 ${targetTemperature}℃ 超出常见釉料烧成范围 (900-1400℃)`,
    });
  }

  for (const ing of ingredients) {
    const material = materials.find(m => m.id === ing.materialId);
    if (material && material.temperatureRange) {
      const range = FIRING_TEMPERATURE_RANGES[material.temperatureRange];
      if (range && (targetTemperature < range.min || targetTemperature > range.max)) {
        errors.push({
          type: ERROR_TYPES.TEMPERATURE_OUT_OF_RANGE,
          message: `${ing.materialName} 建议烧成温度为 ${range.name}，与目标温度 ${targetTemperature}℃ 不兼容`,
          materialId: ing.materialId,
          materialRange: range.name,
          targetTemp: targetTemperature,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateIncompatibleMaterials(ingredients, materials) {
  const errors = [];

  const materialIds = ingredients.map(i => i.materialId);

  for (const ing of ingredients) {
    const material = materials.find(m => m.id === ing.materialId);
    if (material && material.incompatibleWith && material.incompatibleWith.length > 0) {
      for (const incompatibleId of material.incompatibleWith) {
        if (materialIds.includes(incompatibleId)) {
          const incompatibleMaterial = materials.find(m => m.id === incompatibleId);
          errors.push({
            type: ERROR_TYPES.GLAZE_INCOMPATIBLE,
            message: `${material.name} 与 ${incompatibleMaterial?.name || incompatibleId} 成分冲突，不建议同时使用`,
            material1: material.id,
            material2: incompatibleId,
          });
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
  };
}

export function validateInventory(ingredients, materials, batchSize = 100) {
  const errors = [];

  for (const ing of ingredients) {
    const material = materials.find(m => m.id === ing.materialId);
    if (material) {
      const requiredAmount = (ing.ratio / 100) * batchSize;
      if (requiredAmount > material.currentStock) {
        errors.push({
          type: ERROR_TYPES.INVENTORY_INSUFFICIENT,
          message: `${material.name} 库存不足。需要: ${requiredAmount.toFixed(2)}g，当前库存: ${material.currentStock}g`,
          materialId: material.id,
          required: requiredAmount,
          available: material.currentStock,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
  };
}

export function calculateCost(ingredients, materials, batchSize = 100) {
  let totalCost = 0;
  const breakdown = [];

  for (const ing of ingredients) {
    const material = materials.find(m => m.id === ing.materialId);
    if (material) {
      const amount = (ing.ratio / 100) * batchSize;
      const cost = amount * material.costPerGram;
      totalCost += cost;
      breakdown.push({
        materialId: material.id,
        materialName: material.name,
        ratio: ing.ratio,
        amount,
        costPerGram: material.costPerGram,
        cost,
      });
    }
  }

  return {
    totalCost: parseFloat(totalCost.toFixed(2)),
    costPerGram: parseFloat((totalCost / batchSize).toFixed(4)),
    breakdown,
  };
}

export function calculateColorDifference(targetColor, observedColor) {
  const parseColor = (color) => {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    }
    if (Array.isArray(color)) {
      return { r: color[0], g: color[1], b: color[2] };
    }
    return color;
  };

  const target = parseColor(targetColor);
  const observed = parseColor(observedColor);

  const rDiff = target.r - observed.r;
  const gDiff = target.g - observed.g;
  const bDiff = target.b - observed.b;

  const euclidean = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
  
  const maxDiff = Math.sqrt(255 * 255 * 3);
  const percentage = (euclidean / maxDiff) * 100;

  let level = '相近';
  if (percentage > 30) level = '明显差异';
  else if (percentage > 15) level = '轻微差异';
  else if (percentage > 5) level = '接近';

  return {
    rDifference: rDiff,
    gDifference: gDiff,
    bDifference: bDiff,
    euclideanDistance: parseFloat(euclidean.toFixed(2)),
    differencePercentage: parseFloat(percentage.toFixed(2)),
    level,
  };
}

export function validateRecipe(recipe, materials, batchSize = 100) {
  const allErrors = [];
  const allWarnings = [];

  const ratioResult = validateIngredientRatios(recipe.ingredients, materials);
  allErrors.push(...ratioResult.errors);
  allWarnings.push(...ratioResult.warnings);

  if (recipe.targetTemperature) {
    const tempResult = validateTemperatureCompatibility(
      recipe.ingredients,
      recipe.targetTemperature,
      materials
    );
    allErrors.push(...tempResult.errors);
    allWarnings.push(...tempResult.warnings);
  }

  const incompatibleResult = validateIncompatibleMaterials(recipe.ingredients, materials);
  allErrors.push(...incompatibleResult.errors);

  if (batchSize > 0) {
    const inventoryResult = validateInventory(recipe.ingredients, materials, batchSize);
    allErrors.push(...inventoryResult.errors);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
